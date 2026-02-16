# backend/app/main.py
from datetime import datetime

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any
import json
from pathlib import Path
from collections import Counter, defaultdict

import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans

try:
    from .history_sandbox import router as history_sandbox_router
except ImportError:
    from history_sandbox import router as history_sandbox_router

app = FastAPI(title="Clinic Analytics API")

# Vite dev server is typically :5173, while other local apps may run on :3000.
cors_origins_env = os.getenv("CORS_ORIGINS", "")
default_cors_origins = ["http://localhost:3000", "http://localhost:5173"]
allow_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()] or default_cors_origins
cors_origin_regex_env = os.getenv("CORS_ORIGIN_REGEX", "").strip()
allow_origin_regex = cors_origin_regex_env or r"https?://(localhost|127\.0\.0\.1)(:\d+)?$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(history_sandbox_router)

# ============================================================
# INPUT FILE DISCOVERY
# ============================================================
APP_DIR = Path(__file__).resolve().parent                  # .../triaging-simulation/backend/app
BACKEND_DIR = APP_DIR.parent                               # .../triaging-simulation/backend
TRIAGE_ROOT = BACKEND_DIR.parent                           # .../triaging-simulation
WORKSPACE_ROOT = TRIAGE_ROOT.parent                        # .../case-study


def get_json_paths():
    """
    Discover batch-note JSON files from likely locations.
    Primary location is `backend/app/mock-notes`.
    Use `MOCK_NOTES_DIR` to override directory and
    `MOCK_NOTES_GLOB` to override filename pattern.
    """
    env_dir = os.getenv("MOCK_NOTES_DIR", "").strip()
    pattern = os.getenv("MOCK_NOTES_GLOB", "batch_notes_eval_*.json")

    candidate_dirs = []
    if env_dir:
        candidate_dirs.append(Path(env_dir))
    candidate_dirs.extend([
        APP_DIR / "mock-notes",
        BACKEND_DIR / "mock-notes",
        TRIAGE_ROOT / "mock-notes",
        WORKSPACE_ROOT / "mock-notes",
        WORKSPACE_ROOT / "output",
    ])

    for directory in candidate_dirs:
        if not directory.exists() or not directory.is_dir():
            continue

        matches = sorted(directory.glob(pattern))
        if matches:
            return [p.resolve() for p in matches]

    searched = [str(d.resolve()) for d in candidate_dirs]
    raise FileNotFoundError(
        f"No JSON files found with pattern '{pattern}'. "
        f"Searched directories: {searched}. "
        "Set MOCK_NOTES_DIR to override."
    )

# ------------------------------------------------------------
# Helpers (ported from your scripts)
# ------------------------------------------------------------
def moving_average(arr, window=3):
    arr = np.asarray(arr, dtype=float)
    if len(arr) < window or window <= 1:
        return arr
    kernel = np.ones(window) / window
    return np.convolve(arr, kernel, mode="same")


def stopping_point_fraction(cumulative, alpha=0.9):
    cumulative = np.asarray(cumulative, dtype=float)
    if cumulative.size == 0:
        return 0
    target = alpha * cumulative[-1]
    return int(np.argmax(cumulative >= target))


def optimal_audit_Q(D_cluster, T_max):
    D_cluster = np.asarray(D_cluster, dtype=float)
    D_cluster = D_cluster[~np.isnan(D_cluster)]
    if D_cluster.size == 0:
        return None, None, None, None

    Qs = np.arange(1, T_max + 1)
    F = np.array([(D_cluster <= Q).mean() for Q in Qs])
    expected_delivered = Qs * F + T_max * (1 - F)
    Q_star = int(Qs[np.argmin(expected_delivered)])
    return Q_star, Qs, expected_delivered, F


def expected_delivered_given_Q(D_cluster, Q, T_max):
    D_cluster = np.asarray(D_cluster, dtype=float)
    D_cluster = D_cluster[~np.isnan(D_cluster)]
    if D_cluster.size == 0:
        return float(T_max)
    delivered = np.where(Q < D_cluster, T_max, Q)
    return float(np.mean(delivered))


def q_mean_policy(D_cluster, method="round", T_max=1):
    D_cluster = np.asarray(D_cluster, dtype=float)
    D_cluster = D_cluster[~np.isnan(D_cluster)]
    if D_cluster.size == 0:
        return int(T_max)

    m = float(np.mean(D_cluster))
    if method == "round":
        q = int(np.round(m))
    elif method == "ceil":
        q = int(np.ceil(m))
    elif method == "floor":
        q = int(np.floor(m))
    else:
        raise ValueError("method must be one of: round, ceil, floor")

    return int(np.clip(q, 1, T_max))


def truncate_to_min_length(curves):
    m = min(len(c) for c in curves)
    return [c[:m] for c in curves]


def pad_to_max_length(curves):
    m = max(len(c) for c in curves)
    out = []
    for c in curves:
        if len(c) == m:
            out.append(c)
        else:
            pad = np.full((m - len(c),), np.nan, dtype=float)
            out.append(np.concatenate([c, pad]))
    return out


def downsample(arr, max_points=60):
    arr = np.asarray(arr, dtype=float)
    if arr.size <= max_points:
        return arr
    idx = np.linspace(0, arr.size - 1, max_points).astype(int)
    return arr[idx]


def load_all_jsons():
    json_paths = get_json_paths()
    data = []
    per_file_raw = {}
    per_file_has_deltas = Counter()
    per_file_missing_deltas = Counter()
    per_file_lengths = defaultdict(list)

    for p in json_paths:
        if not p.exists():
            raise FileNotFoundError(f"Missing file: {p.resolve()}")

        with p.open("r", encoding="utf-8") as f:
            chunk = json.load(f)

        if not isinstance(chunk, list):
            raise ValueError(f"{p} did not load to a list (got {type(chunk)}).")

        per_file_raw[p.name] = len(chunk)

        for child in chunk:
            if isinstance(child, dict):
                child["_source_file"] = p.name
                gpt_deltas = child.get("gpt_deltas")
                if gpt_deltas and isinstance(gpt_deltas, list) and len(gpt_deltas) > 0:
                    per_file_has_deltas[p.name] += 1
                    per_file_lengths[p.name].append(len(gpt_deltas))
                else:
                    per_file_missing_deltas[p.name] += 1

        data.extend(chunk)

    per_file = []
    for p in json_paths:
        name = p.name
        lens = per_file_lengths[name]
        per_file.append({
            "file": name,
            "path": str(p),
            "total": int(per_file_raw.get(name, 0)),
            "with_gpt_deltas": int(per_file_has_deltas.get(name, 0)),
            "missing_or_empty_gpt_deltas": int(per_file_missing_deltas.get(name, 0)),
            "min_len": int(min(lens)) if lens else None,
            "max_len": int(max(lens)) if lens else None,
        })

    return data, per_file, json_paths


def _safe_int(value, default=0):
    try:
        return int(value)
    except Exception:
        return default


def _parse_created_at(generator_json_path: str) -> str:
    """
    Parse `output/notes_YYYYMMDD_HHMMSS.json` into `YYYY-MM-DD`.
    """
    name = Path(str(generator_json_path)).name
    if not name.startswith("notes_"):
        return ""
    try:
        stem = Path(name).stem  # notes_YYYYMMDD_HHMMSS
        date_token = stem.split("_")[1]
        dt = datetime.strptime(date_token, "%Y%m%d")
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return ""


def _make_snippet(note_text: str, max_chars: int = 150) -> str:
    flat = " ".join(str(note_text).split())
    if len(flat) <= max_chars:
        return flat
    return flat[: max_chars - 1] + "…"


def load_unionized_notes():
    """
    Loads all discovered batch-note JSON files, extracts all generator notes, unions/deduplicates them,
    and returns rows tailored for frontend display.
    """
    # Keep one note per (client, note_number) across files.
    # If the same slot appears in multiple batch files, later files win.
    notes_by_key = {}
    duplicates_removed = 0
    total_before_union = 0

    json_paths = get_json_paths()

    for p in json_paths:
        if not p.exists():
            raise FileNotFoundError(f"Missing file: {p.resolve()}")

        with p.open("r", encoding="utf-8") as f:
            chunk = json.load(f)

        if not isinstance(chunk, list):
            raise ValueError(f"{p} did not load to a list (got {type(chunk)}).")

        for child in chunk:
            if not isinstance(child, dict):
                continue

            child_index = _safe_int(child.get("child_index"), 0)
            client_num = child_index + 1
            client_id = f"C-{client_num:04d}"
            archetype = child.get("archetype")
            gpt_deltas = child.get("gpt_deltas")
            has_eval = isinstance(gpt_deltas, list) and len(gpt_deltas) > 0

            gen = child.get("generator_result") or {}
            gen_data = gen.get("data") if isinstance(gen, dict) else None
            if not isinstance(gen_data, dict):
                continue

            trajectory_type = gen_data.get("trajectory_type")
            notes = gen_data.get("notes")
            if not isinstance(notes, list):
                continue

            created_at = _parse_created_at(gen.get("json", ""))
            clinician = f"SLP-{(client_num % 12) + 1:02d}"
            site = "Cambridge"
            status = "evaluated" if has_eval else "extracted"

            for idx, note_obj in enumerate(notes):
                if not isinstance(note_obj, dict):
                    continue

                note_text = str(note_obj.get("note_text") or "").strip()
                if not note_text:
                    continue

                note_number = _safe_int(note_obj.get("note_number"), idx + 1)
                total_before_union += 1

                # Union key: same client + note number.
                # Note text can vary across reruns; we keep the newest discovered file's text.
                union_key = (client_id, note_number)
                if union_key in notes_by_key:
                    duplicates_removed += 1

                tags = [t for t in [archetype, trajectory_type] if t]
                note_id = f"{client_id}-N{note_number:02d}"

                notes_by_key[union_key] = {
                    "note_id": note_id,
                    "client_id": client_id,
                    "created_at": created_at or "unknown",
                    "clinician": clinician,
                    "site": site,
                    "status": status,
                    "tags": tags,
                    "snippet": _make_snippet(note_text, max_chars=150),
                    "note": note_text,
                    "child_index": child_index,
                    "note_number": note_number,
                    "archetype": archetype,
                    "trajectory_type": trajectory_type,
                    "source_file": p.name,
                }

    union_notes = list(notes_by_key.values())
    union_notes.sort(key=lambda n: (n["client_id"], n["note_number"]))
    unique_sites = sorted({n.get("site", "") for n in union_notes if n.get("site")})

    return union_notes, {
        "source_files": [str(p) for p in json_paths],
        "total_notes_before_union": int(total_before_union),
        "total_notes_after_union": int(len(union_notes)),
        "duplicates_removed": int(duplicates_removed),
        "site_options": unique_sites,
    }


def run_analytics(
    n_clusters=4,
    smooth_window=3,
    alpha=0.90,
    length_mode="truncate",     # truncate|pad|error
    max_individual_curves=60,
    max_curve_points=60,
):
    data, per_file, json_paths = load_all_jsons()

    curves = []   # cumulative curves in delta-space (length M)
    tstars = []   # session-space demand t* (1..T_max)
    meta = []
    for child in data:
        if not isinstance(child, dict):
            continue
        gpt_deltas = child.get("gpt_deltas")
        if not gpt_deltas:
            continue

        smoothed = moving_average(gpt_deltas, window=smooth_window)
        cumulative = np.cumsum(smoothed)

        # t* in session space: delta index -> session index via +2
        t_star_session = stopping_point_fraction(cumulative, alpha=alpha) + 2

        curves.append(cumulative.astype(float))
        tstars.append(float(t_star_session))
        meta.append({
            "child_index": child.get("child_index"),
            "archetype": child.get("archetype"),
            "source_file": child.get("_source_file"),
        })

    if len(curves) < n_clusters:
        raise ValueError(f"Not enough usable trajectories ({len(curves)}) for n_clusters={n_clusters}")

    lengths = [len(c) for c in curves]
    uniq = sorted(set(lengths))
    if len(uniq) != 1:
        if length_mode == "error":
            raise ValueError(f"Length mismatch: {uniq[:20]} (min={min(lengths)}, max={max(lengths)})")
        elif length_mode == "truncate":
            curves = truncate_to_min_length(curves)
        elif length_mode == "pad":
            curves = pad_to_max_length(curves)
        else:
            raise ValueError(f"Unknown length_mode: {length_mode}")

    X = np.vstack(curves)

    # If padded, handle NaNs
    if np.isnan(X).any():
        col_means = np.nanmean(X, axis=0)
        inds = np.where(np.isnan(X))
        X[inds] = np.take(col_means, inds[1])

    M = X.shape[1]
    T_max = M + 1

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    kmeans = KMeans(n_clusters=n_clusters, random_state=0, n_init="auto")
    labels = kmeans.fit_predict(X_scaled)

    cluster_counts = Counter(labels)

    # mean curves
    mean_curves = []
    for c in range(n_clusters):
        mean_curve = X[labels == c].mean(axis=0)
        mean_curves.append(downsample(mean_curve, max_curve_points).tolist())

    # sample individual curves (light payload)
    idxs = list(range(len(labels)))
    if len(idxs) > max_individual_curves:
        idxs = np.random.RandomState(0).choice(idxs, size=max_individual_curves, replace=False).tolist()

    individual_curves = []
    for i in idxs:
        individual_curves.append({
            "label": int(labels[i]),
            "curve": downsample(X[i], max_curve_points).tolist(),
            "source_file": meta[i].get("source_file"),
            "archetype": meta[i].get("archetype"),
        })

    # Q* policy per cluster
    tstars_np = np.asarray(tstars, float)

    cluster_Qstar = {}
    cluster_Edel = {}
    cluster_Esaved = {}
    cluster_Qmean = {}
    cluster_Edel_mean = {}
    cluster_Esaved_mean = {}
    cluster_p_pass_opt = {}
    cluster_p_pass_mean = {}
    cluster_policy_frontier = {}
    hist_tstar = {}
    qstar_curves = {}

    t_min = int(np.nanmin(tstars_np))
    t_max = int(np.nanmax(tstars_np))

    for c in range(n_clusters):
        Dc = tstars_np[labels == c]
        Q_star, Qs, E_delivered, F = optimal_audit_Q(Dc, T_max=T_max)
        if Q_star is None:
            continue

        Q_mean = q_mean_policy(Dc, method="round", T_max=T_max)
        E_del_opt = expected_delivered_given_Q(Dc, Q_star, T_max)
        E_del_mean = expected_delivered_given_Q(Dc, Q_mean, T_max)
        p_pass_opt = float((Dc <= Q_star).mean())
        p_pass_mean = float((Dc <= Q_mean).mean())

        cluster_Qstar[c] = int(Q_star)
        cluster_Edel[c] = E_del_opt
        cluster_Esaved[c] = float(T_max - E_del_opt)
        cluster_Qmean[c] = int(Q_mean)
        cluster_Edel_mean[c] = E_del_mean
        cluster_Esaved_mean[c] = float(T_max - E_del_mean)
        cluster_p_pass_opt[c] = p_pass_opt
        cluster_p_pass_mean[c] = p_pass_mean

        cluster_policy_frontier[c] = [
            {"Q": int(q), "expected_delivered": float(ed)}
            for q, ed in zip(Qs.tolist(), E_delivered.tolist())
        ]

        # histogram counts for t*
        vals = Dc.astype(int).tolist()
        counts = Counter(vals)
        hist_tstar[c] = [{"t": t, "count": counts.get(t, 0)} for t in range(t_min, t_max + 1)]

         # Store the whole curve for plotting (downsample optional; Q is small so keep full)
        qstar_curves[c] = [
            {"Q": int(q), "E_delivered": float(ed)}
            for q, ed in zip(Qs.tolist(), E_delivered.tolist())
        ]

    # overall expected impact
    total_children = int(len(labels))
    total_original = float(total_children * T_max)

    expected_total_delivered = 0.0
    expected_total_delivered_mean = 0.0
    for c in range(n_clusters):
        n_c = cluster_counts[c]
        expected_total_delivered += n_c * cluster_Edel.get(c, float(T_max))
        expected_total_delivered_mean += n_c * cluster_Edel_mean.get(c, float(T_max))

    expected_total_saved = total_original - expected_total_delivered
    expected_total_saved_mean = total_original - expected_total_delivered_mean

    archetypes_overall = Counter([m.get("archetype") for m in meta if m.get("archetype") is not None])
    archetypes_by_cluster = {}
    for c in range(n_clusters):
        archs = [
            meta[i].get("archetype")
            for i, lbl in enumerate(labels)
            if lbl == c and meta[i].get("archetype") is not None
        ]
        archetypes_by_cluster[c] = dict(Counter(archs))

    return {
        "config": {
            "n_clusters": int(n_clusters),
            "smooth_window": int(smooth_window),
            "alpha": float(alpha),
            "length_mode": str(length_mode),
            "T_max_sessions": int(T_max),
            "M_deltas": int(M),
        },
        "inputs": {
            "json_paths": [str(p) for p in json_paths],
        },
        "per_file": per_file,
        "clusters": {
            "counts": {str(k): int(v) for k, v in cluster_counts.items()},
            "mean_curves": mean_curves,
            "individual_curves": individual_curves,
            "hist_tstar": {str(k): v for k, v in hist_tstar.items()},
            "policy_frontier": {str(k): v for k, v in cluster_policy_frontier.items()},
            "Qstar": {str(k): v for k, v in cluster_Qstar.items()},
            "E_delivered": {str(k): v for k, v in cluster_Edel.items()},
            "E_saved": {str(k): v for k, v in cluster_Esaved.items()},
            "Qmean": {str(k): v for k, v in cluster_Qmean.items()},
            "E_delivered_mean": {str(k): v for k, v in cluster_Edel_mean.items()},
            "E_saved_mean": {str(k): v for k, v in cluster_Esaved_mean.items()},
            "p_pass_opt": {str(k): v for k, v in cluster_p_pass_opt.items()},
            "p_pass_mean": {str(k): v for k, v in cluster_p_pass_mean.items()},
            "archetypes_overall": dict(archetypes_overall),
            "archetypes_by_cluster": {str(k): v for k, v in archetypes_by_cluster.items()},
            "Qstar_curve": {str(k): v for k, v in qstar_curves.items()},
        },
        "overall": {
            "total_children": total_children,
            "total_original_sessions": total_original,
            "expected_total_delivered": expected_total_delivered,
            "expected_total_saved": expected_total_saved,
            "expected_percent_saved": (expected_total_saved / total_original) if total_original > 0 else 0.0,
            "expected_total_delivered_baseline": expected_total_delivered_mean,
            "expected_total_saved_baseline": expected_total_saved_mean,
            "expected_percent_saved_baseline": (expected_total_saved_mean / total_original) if total_original > 0 else 0.0,
            "delta_saved_vs_baseline": expected_total_saved - expected_total_saved_mean,
            "savings_improvement_vs_baseline": (
                (expected_total_saved - expected_total_saved_mean) / expected_total_saved_mean
            ) if expected_total_saved_mean > 0 else 0.0,
        },
        "notes": {
            "tstar_definition": "first session where cumulative >= alpha * final cumulative (delta-space then mapped to session index via +2)",
            "audit_rule": "If audit Q < demand D then deliver T_max; else stop at Q",
        },
    }


@app.get("/notes/analytics")
def notes_analytics(
    n_clusters: int = 4,
    smooth_window: int = 3,
    alpha: float = 0.90,
    length_mode: str = "truncate",  # truncate|pad|error
    max_individual_curves: int = 60,
    max_curve_points: int = 60,
) -> Dict[str, Any]:
    """
    Run analytics on discovered batch-note JSON files.
    Query params control your interactive knobs.
    """
    try:
        return run_analytics(
            n_clusters=n_clusters,
            smooth_window=smooth_window,
            alpha=alpha,
            length_mode=length_mode,
            max_individual_curves=max_individual_curves,
            max_curve_points=max_curve_points,
        )
    except Exception as e:
        return {"error": str(e)}


@app.get("/notes/lab")
def notes_lab() -> Dict[str, Any]:
    """
    Returns flattened, unionized notes from discovered batch-note JSON files.
    """
    try:
        notes, meta = load_unionized_notes()
        return {
            "notes": notes,
            "meta": meta,
        }
    except Exception as e:
        return {"error": str(e)}
