from datetime import datetime

import os
import re
from urllib import request, error

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, Optional
import json
from pathlib import Path
from collections import Counter, defaultdict

import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, confusion_matrix as sk_confusion_matrix, f1_score
from pydantic import BaseModel, Field

try:
    from .history_sandbox import router as history_sandbox_router
except ImportError:
    from history_sandbox import router as history_sandbox_router

app = FastAPI(title="Clinic Analytics API")

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

APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
TRIAGE_ROOT = BACKEND_DIR.parent
WORKSPACE_ROOT = TRIAGE_ROOT.parent


def get_json_paths():
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
    name = Path(str(generator_json_path)).name
    if not name.startswith("notes_"):
        return ""
    try:
        stem = Path(name).stem
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
    length_mode="truncate",
    max_individual_curves=60,
    max_curve_points=60,
):
    data, per_file, json_paths = load_all_jsons()

    curves = []
    tstars = []
    meta = []
    for child in data:
        if not isinstance(child, dict):
            continue
        gpt_deltas = child.get("gpt_deltas")
        if not gpt_deltas:
            continue

        smoothed = moving_average(gpt_deltas, window=smooth_window)
        cumulative = np.cumsum(smoothed)

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

    mean_curves = []
    for c in range(n_clusters):
        mean_curve = X[labels == c].mean(axis=0)
        mean_curves.append(downsample(mean_curve, max_curve_points).tolist())

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

        vals = Dc.astype(int).tolist()
        counts = Counter(vals)
        hist_tstar[c] = [{"t": t, "count": counts.get(t, 0)} for t in range(t_min, t_max + 1)]

        qstar_curves[c] = [
            {"Q": int(q), "E_delivered": float(ed)}
            for q, ed in zip(Qs.tolist(), E_delivered.tolist())
        ]

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
    length_mode: str = "truncate",
    max_individual_curves: int = 60,
    max_curve_points: int = 60,
) -> Dict[str, Any]:
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
    try:
        notes, meta = load_unionized_notes()
        return {
            "notes": notes,
            "meta": meta,
        }
    except Exception as e:
        return {"error": str(e)}


SCORING_PROMPT_TEXT = (
    "You are reviewing a sequence of pediatric speech-language therapy notes for one child.\n"
    "Each note has a note_number, and higher note_number values correspond to later sessions.\n\n"
    "Your task:\n"
    "- For each pair of consecutive notes (Note 1→2, 2→3, ..., N-1→N),\n"
    "  estimate how much progress occurred between those two sessions.\n"
    "- Use this 0-3 rating scale:\n\n"
    "  0 = maintenance / minimal change\n"
    "  1 = small but clear improvement\n"
    "  2 = meaningful clinical progress\n"
    "  3 = major gain / step up in level (use sparingly)\n\n"
    "Additional guidance:\n"
    "- Do not overuse 3. Reserve it for true breakthroughs.\n"
    "- If the notes show mixed evidence, choose the lower reasonable score.\n"
    "- Focus on change between consecutive notes, not overall severity.\n\n"
    "Return ONLY a JSON array of integers with length (number_of_notes - 1).\n"
    "Values must be in [0, 3]. No explanations or keys."
)


def _build_q1_clients(data):
    clients = []
    all_scores = []
    archetype_scores = defaultdict(list)

    for child in data:
        if not isinstance(child, dict):
            continue
        gpt_deltas = child.get("gpt_deltas")
        if not gpt_deltas or not isinstance(gpt_deltas, list):
            continue

        child_index = _safe_int(child.get("child_index"), 0)
        archetype = child.get("archetype", "unknown")
        int_scores = [int(round(float(s))) for s in gpt_deltas]

        all_scores.extend(int_scores)
        archetype_scores[archetype].extend(int_scores)

        gen = child.get("generator_result") or {}
        gen_data = gen.get("data") if isinstance(gen, dict) else None
        notes_preview = []
        if isinstance(gen_data, dict):
            raw_notes = gen_data.get("notes", [])
            if isinstance(raw_notes, list):
                notes_preview = [
                    {"note_number": _safe_int(n.get("note_number"), i + 1), "snippet": str(n.get("note_text", ""))[:220]}
                    for i, n in enumerate(raw_notes)
                    if isinstance(n, dict)
                ]

        clients.append({
            "client_id": f"C-{child_index + 1:04d}",
            "archetype": archetype,
            "scores": int_scores,
            "notes_preview": notes_preview[:13],
            "n_notes": len(notes_preview),
            "n_scores": len(int_scores),
        })
    return clients, all_scores, archetype_scores


@app.get("/q1/summary")
def q1_summary(max_sample_clients: int = 10) -> Dict[str, Any]:
    try:
        data, per_file, _ = load_all_jsons()
        clients, all_scores, archetype_scores = _build_q1_clients(data)

        score_counts = Counter(all_scores)
        score_distribution = {str(k): int(v) for k, v in sorted(score_counts.items())}
        total_scores = len(all_scores)

        archetype_distributions = {}
        for arch, scores in archetype_scores.items():
            counts = Counter(scores)
            archetype_distributions[arch] = {str(k): int(v) for k, v in sorted(counts.items())}

        mean_score = float(np.mean(all_scores)) if all_scores else 0.0

        evaluation = {
            "weighted_accuracy": None,
            "exact_match_accuracy": None,
            "confusion_matrix": None,
            "note": (
                "Ground-truth hand-labeled scores (from David Patel) would be compared against LLM scores here. "
                "In the full pipeline, this produces a 4×4 confusion matrix and weighted accuracy. "
                "The mock data shows LLM-generated scores only."
            ),
        }

        return {
            "prompt": SCORING_PROMPT_TEXT,
            "model": "gpt-4o / gpt-4.1",
            "total_clients": len(clients),
            "total_scores": total_scores,
            "mean_score": round(mean_score, 2),
            "score_distribution": score_distribution,
            "archetype_distributions": archetype_distributions,
            "archetypes": sorted(archetype_scores.keys()),
            "sample_clients": clients[:max_sample_clients],
            "all_clients": clients,
            "evaluation": evaluation,
            "per_file": per_file,
        }
    except Exception as e:
        return {"error": str(e)}


class Q1ScoreRequest(BaseModel):
    prompt: str = Field(..., min_length=10, description="The system-level scoring prompt to send to the LLM.")
    client_index: int = Field(default=0, description="Index into the all_clients list (0-based).")


def _get_full_notes_for_child(data, child_index: int):
    idx = 0
    for child in data:
        if not isinstance(child, dict):
            continue
        gpt_deltas = child.get("gpt_deltas")
        if not gpt_deltas or not isinstance(gpt_deltas, list):
            continue
        if idx == child_index:
            gen = child.get("generator_result") or {}
            gen_data = gen.get("data") if isinstance(gen, dict) else None
            notes = []
            if isinstance(gen_data, dict):
                raw_notes = gen_data.get("notes", [])
                if isinstance(raw_notes, list):
                    notes = [
                        {"note_number": _safe_int(n.get("note_number"), i + 1), "note_text": str(n.get("note_text", ""))}
                        for i, n in enumerate(raw_notes)
                        if isinstance(n, dict)
                    ]
            return {
                "child_index": _safe_int(child.get("child_index"), 0),
                "archetype": child.get("archetype", "unknown"),
                "precomputed_scores": [int(round(float(s))) for s in gpt_deltas],
                "notes": notes,
            }
        idx += 1
    return None


@app.post("/q1/score")
def q1_score(payload: Q1ScoreRequest) -> Dict[str, Any]:
    try:
        data, _, _ = load_all_jsons()
        child_data = _get_full_notes_for_child(data, payload.client_index)
        if child_data is None:
            return {"error": f"Client index {payload.client_index} not found."}

        notes = child_data["notes"]
        if len(notes) < 2:
            return {"error": "Client has fewer than 2 notes; cannot score transitions."}

        notes_block = "\n\n".join(
            f"--- Note {n['note_number']} ---\n{n['note_text']}"
            for n in sorted(notes, key=lambda x: x["note_number"])
        )

        settings = _llm_settings()
        if not _llm_enabled(settings):
            return {
                "error": "LLM not configured. Set OPENAI_API_KEY (or GEMINI_API_KEY + LLM_PROVIDER=gemini) as environment variables.",
                "llm_enabled": False,
            }

        expected_length = len(notes) - 1
        user_message = (
            f"Here are the therapy notes for one child ({len(notes)} notes total). "
            f"Please return a JSON array of exactly {expected_length} integers.\n\n"
            f"{notes_block}"
        )

        llm_response = _call_openai_chat(
            messages=[
                {"role": "system", "content": payload.prompt},
                {"role": "user", "content": user_message},
            ],
            settings=settings,
        )

        parsed_scores = None
        parse_error = None
        try:
            import re
            match = re.search(r'\[[\s\d,]+\]', llm_response)
            if match:
                parsed_scores = json.loads(match.group())
                parsed_scores = [max(0, min(3, int(round(float(s))))) for s in parsed_scores]
            else:
                parse_error = "Could not find a JSON array in the LLM response."
        except (json.JSONDecodeError, ValueError) as exc:
            parse_error = f"Failed to parse LLM response: {exc}"

        precomputed = child_data["precomputed_scores"]
        comparison = None
        if parsed_scores and len(parsed_scores) == len(precomputed):
            exact_matches = sum(1 for a, b in zip(parsed_scores, precomputed) if a == b)
            within_one = sum(1 for a, b in zip(parsed_scores, precomputed) if abs(a - b) <= 1)
            comparison = {
                "exact_match_rate": round(exact_matches / len(precomputed), 4),
                "within_one_rate": round(within_one / len(precomputed), 4),
                "n_transitions": len(precomputed),
                "per_transition": [
                    {"transition": i + 1, "your_score": parsed_scores[i], "precomputed": precomputed[i], "diff": parsed_scores[i] - precomputed[i]}
                    for i in range(len(precomputed))
                ],
            }

        return {
            "client_id": f"C-{child_data['child_index'] + 1:04d}",
            "archetype": child_data["archetype"],
            "n_notes": len(notes),
            "expected_scores": expected_length,
            "llm_raw_response": llm_response,
            "parsed_scores": parsed_scores,
            "parse_error": parse_error,
            "precomputed_scores": precomputed,
            "comparison": comparison,
            "model_used": settings["model"],
            "llm_enabled": True,
        }
    except Exception as e:
        return {"error": str(e)}


def _cluster_children_for_q3(data, n_clusters, smooth_window, alpha):
    curves = []
    tstars = []
    meta = []

    for child in data:
        if not isinstance(child, dict):
            continue
        gpt_deltas = child.get("gpt_deltas")
        if not gpt_deltas or not isinstance(gpt_deltas, list):
            continue

        smoothed = moving_average(gpt_deltas, window=smooth_window)
        cumulative = np.cumsum(smoothed)
        t_star_session = stopping_point_fraction(cumulative, alpha=alpha) + 2

        curves.append(cumulative.astype(float))
        tstars.append(float(t_star_session))
        meta.append({
            "child_index": _safe_int(child.get("child_index"), 0),
            "archetype": child.get("archetype", "unknown"),
        })

    if len(curves) < n_clusters:
        raise ValueError(f"Not enough trajectories ({len(curves)}) for {n_clusters} clusters.")

    lengths = [len(c) for c in curves]
    if len(set(lengths)) > 1:
        curves = truncate_to_min_length(curves)

    X = np.vstack(curves)
    T_max = X.shape[1] + 1
    X_scaled = StandardScaler().fit_transform(X)
    labels = KMeans(n_clusters=n_clusters, random_state=0, n_init="auto").fit_predict(X_scaled)

    return labels, np.array(tstars), meta, T_max


def _generate_intake_features(meta, labels, seed=42):
    rng = np.random.RandomState(seed)
    archetype_profiles = {
        "rapid": {"age_mean": 3.1, "age_std": 0.4, "complexity_weights": [0.45, 0.30, 0.15, 0.08, 0.02], "severity_mean": 1.8},
        "steady": {"age_mean": 3.6, "age_std": 0.5, "complexity_weights": [0.20, 0.35, 0.25, 0.15, 0.05], "severity_mean": 2.5},
        "late": {"age_mean": 4.0, "age_std": 0.45, "complexity_weights": [0.08, 0.15, 0.30, 0.30, 0.17], "severity_mean": 3.2},
        "plateau": {"age_mean": 4.4, "age_std": 0.35, "complexity_weights": [0.04, 0.10, 0.22, 0.34, 0.30], "severity_mean": 3.8},
    }
    default_profile = {"age_mean": 3.8, "age_std": 0.6, "complexity_weights": [0.20, 0.20, 0.20, 0.20, 0.20], "severity_mean": 2.8}

    rows = []
    for i, m in enumerate(meta):
        profile = archetype_profiles.get(m["archetype"], default_profile)
        age = round(float(np.clip(rng.normal(profile["age_mean"], profile["age_std"]), 2.0, 6.0)), 1)
        complexity = int(rng.choice([1, 2, 3, 4, 5], p=profile["complexity_weights"]))
        severity = round(float(np.clip(rng.normal(profile["severity_mean"], 0.6), 1.0, 5.0)), 1)
        rows.append({
            "client_id": f"C-{m['child_index'] + 1:04d}",
            "archetype": m["archetype"],
            "cluster": int(labels[i]),
            "age_years": age,
            "complexity_score": complexity,
            "severity_index": severity,
        })
    return rows


@app.get("/q3/analysis")
def q3_analysis(
    n_clusters: int = 4,
    smooth_window: int = 3,
    alpha: float = 0.90,
    test_size: float = 0.20,
    waitlist_size: int = 40,
) -> Dict[str, Any]:
    try:
        data, _, _ = load_all_jsons()
        labels, tstars, meta, T_max = _cluster_children_for_q3(data, n_clusters, smooth_window, alpha)
        feature_rows = _generate_intake_features(meta, labels)

        import pandas as pd
        df = pd.DataFrame(feature_rows)
        feature_cols = ["age_years", "complexity_score", "severity_index"]
        X_all = df[feature_cols].values
        y_all = df["cluster"].values

        class_counts = Counter(y_all)
        min_class_count = min(class_counts.values())
        stratify_y = y_all if min_class_count >= 2 else None

        X_train, X_test, y_train, y_test = train_test_split(
            X_all, y_all, test_size=test_size, random_state=42, stratify=stratify_y,
        )

        model_results = {}
        fitted_models = {}
        for model_name, model_cls, model_params in [
            ("logistic_regression", LogisticRegression, {"max_iter": 1000, "random_state": 42, "class_weight": "balanced"}),
            ("random_forest", RandomForestClassifier, {"n_estimators": 200, "random_state": 42, "class_weight": "balanced_subsample"}),
        ]:
            model = model_cls(**model_params)
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            fitted_models[model_name] = model

            acc = float(accuracy_score(y_test, y_pred))
            mf1 = float(f1_score(y_test, y_pred, average="macro", zero_division=0))
            cm = sk_confusion_matrix(y_test, y_pred, labels=sorted(set(y_all))).tolist()

            importance = None
            if hasattr(model, "feature_importances_"):
                importance = {col: round(float(imp), 4) for col, imp in zip(feature_cols, model.feature_importances_)}

            model_results[model_name] = {
                "accuracy": round(acc, 4),
                "macro_f1": round(mf1, 4),
                "confusion_matrix": cm,
                "class_labels": sorted(int(c) for c in set(y_all)),
                "feature_importance": importance,
            }

        best_model_name = max(model_results, key=lambda k: model_results[k]["macro_f1"])
        best_model = fitted_models[best_model_name]

        feature_exploration = {}
        for cluster_id in sorted(set(y_all)):
            cluster_mask = y_all == cluster_id
            cluster_features = {}
            for col_idx, col_name in enumerate(feature_cols):
                vals = X_all[cluster_mask, col_idx]
                cluster_features[col_name] = {
                    "mean": round(float(np.mean(vals)), 2),
                    "std": round(float(np.std(vals)), 2),
                    "min": round(float(np.min(vals)), 2),
                    "max": round(float(np.max(vals)), 2),
                    "values": [round(float(v), 2) for v in vals.tolist()],
                }
            feature_exploration[str(cluster_id)] = cluster_features

        rng = np.random.RandomState(99)
        waitlist_rows = []
        for i in range(waitlist_size):
            age = round(float(np.clip(rng.normal(3.7, 0.7), 2.0, 6.0)), 1)
            complexity = int(rng.choice([1, 2, 3, 4, 5], p=[0.15, 0.25, 0.25, 0.20, 0.15]))
            severity = round(float(np.clip(rng.normal(2.8, 0.8), 1.0, 5.0)), 1)
            waitlist_rows.append({
                "client_id": f"W-{i + 1:03d}",
                "age_years": age,
                "complexity_score": complexity,
                "severity_index": severity,
            })

        X_waitlist = np.array([[r["age_years"], r["complexity_score"], r["severity_index"]] for r in waitlist_rows])
        waitlist_predictions = best_model.predict(X_waitlist)

        for i, pred in enumerate(waitlist_predictions):
            waitlist_rows[i]["predicted_cluster"] = int(pred)

        waitlist_cluster_mix = {str(k): int(v) for k, v in sorted(Counter(int(p) for p in waitlist_predictions).items())}

        cluster_qstar = {}
        cluster_e_delivered = {}
        for c in range(n_clusters):
            D_c = tstars[labels == c]
            Q_star, _, _, _ = optimal_audit_Q(D_c, T_max)
            if Q_star is not None:
                cluster_qstar[c] = int(Q_star)
                cluster_e_delivered[c] = expected_delivered_given_Q(D_c, Q_star, T_max)
            else:
                cluster_qstar[c] = T_max
                cluster_e_delivered[c] = float(T_max)

        baseline_total = waitlist_size * T_max
        projected_total = 0.0
        per_cluster_capacity = []
        for c in range(n_clusters):
            count = int(waitlist_cluster_mix.get(str(c), 0))
            e_del = cluster_e_delivered.get(c, float(T_max))
            projected_total += count * e_del
            per_cluster_capacity.append({
                "cluster": c,
                "waitlist_count": count,
                "q_star": cluster_qstar.get(c, T_max),
                "e_delivered_per_child": round(e_del, 2),
                "total_delivered": round(count * e_del, 1),
            })

        sessions_saved = baseline_total - projected_total

        return {
            "config": {
                "n_clusters": n_clusters,
                "smooth_window": smooth_window,
                "alpha": alpha,
                "test_size": test_size,
                "T_max": T_max,
                "waitlist_size": waitlist_size,
            },
            "features_used": feature_cols,
            "feature_exploration": feature_exploration,
            "train_size": len(X_train),
            "test_size_actual": len(X_test),
            "models": model_results,
            "best_model": best_model_name,
            "waitlist_predictions": waitlist_rows,
            "waitlist_cluster_mix": waitlist_cluster_mix,
            "capacity_projection": {
                "per_cluster": per_cluster_capacity,
                "baseline_sessions": int(baseline_total),
                "projected_sessions": round(projected_total, 1),
                "sessions_saved": round(sessions_saved, 1),
                "percent_saved": round((sessions_saved / baseline_total) * 100, 1) if baseline_total > 0 else 0,
                "extra_starts_possible": int(sessions_saved // T_max) if T_max > 0 else 0,
            },
            "historical_clients": feature_rows,
        }
    except Exception as e:
        return {"error": str(e)}


CAPACITY_DIFFICULTY_PROFILES = {
    "easy": {
        "surgeMultiplier": 1.45,
        "volatilityRange": 1,
        "disruptionBase": 0.03,
        "disruptionJitter": 0.04,
        "progressMultiplier": 1.1,
    },
    "medium": {
        "surgeMultiplier": 1.8,
        "volatilityRange": 2,
        "disruptionBase": 0.08,
        "disruptionJitter": 0.07,
        "progressMultiplier": 1.0,
    },
    "hard": {
        "surgeMultiplier": 2.2,
        "volatilityRange": 3,
        "disruptionBase": 0.14,
        "disruptionJitter": 0.1,
        "progressMultiplier": 0.82,
    },
}


class AgentChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    mode: str = Field(default="capacity-planning")
    game_state: Dict[str, Any] = Field(default_factory=dict)
    conversation_id: Optional[str] = None


def _llm_settings() -> Dict[str, Any]:
    provider = os.getenv("LLM_PROVIDER", "openai").strip().lower()
    if provider == "gemini":
        api_key = os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("OPENAI_API_KEY", "").strip()
        model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash").strip()
        base_url = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai").strip().rstrip("/")
    else:
        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()
        base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").strip().rstrip("/")

    return {
        "provider": provider,
        "api_key": api_key,
        "base_url": base_url,
        "model": model,
        "temperature": float(os.getenv("OPENAI_TEMPERATURE", "0.2")),
        "max_tokens": int(os.getenv("OPENAI_MAX_TOKENS", "450")),
    }


def _llm_enabled(settings: Dict[str, Any]) -> bool:
    return settings["provider"] in {"openai", "gemini"} and bool(settings["api_key"]) and bool(settings["model"])


def _call_openai_chat(messages: list, settings: Dict[str, Any]) -> str:
    def _request_once(request_messages: list, max_tokens: int) -> Dict[str, Any]:
        payload = {
            "model": settings["model"],
            "temperature": settings["temperature"],
            "max_tokens": int(max_tokens),
            "messages": request_messages,
        }
        body = json.dumps(payload).encode("utf-8")
        req = request.Request(
            url=f"{settings['base_url']}/chat/completions",
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings['api_key']}",
            },
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=20) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw)
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"LLM HTTP error {exc.code}: {detail}") from exc
        except Exception as exc:
            raise RuntimeError(f"LLM request failed: {exc}") from exc

    def _extract_content(choice: Dict[str, Any]) -> str:
        message = choice.get("message", {})
        content = message.get("content", "")
        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, dict):
                    txt = item.get("text")
                    if isinstance(txt, str):
                        parts.append(txt)
            return "".join(parts).strip()
        return str(content).strip()

    base_max_tokens = max(128, int(settings.get("max_tokens", 450)))
    attempts = 0
    max_attempts = 3
    assembled_text = ""
    working_messages = list(messages)
    current_max_tokens = base_max_tokens

    while attempts < max_attempts:
        parsed = _request_once(working_messages, current_max_tokens)
        try:
            choice = parsed["choices"][0]
            chunk = _extract_content(choice)
            finish_reason = str(choice.get("finish_reason", "")).lower()
        except Exception as exc:
            raise RuntimeError(f"LLM response parse failed: {exc}") from exc

        if chunk:
            assembled_text = f"{assembled_text}{chunk}" if assembled_text else chunk

        if finish_reason and finish_reason != "length":
            break

        if finish_reason == "length":
            attempts += 1
            if attempts >= max_attempts:
                break
            working_messages = working_messages + [
                {"role": "assistant", "content": assembled_text},
                {
                    "role": "user",
                    "content": "Continue exactly where you left off and finish your response. Do not repeat prior text.",
                },
            ]
            current_max_tokens = min(max(current_max_tokens * 2, base_max_tokens), 4000)
            continue

        break

    return assembled_text.strip()


def _cap_clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def _safe_number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return float(default)


def _capacity_arrivals(base_arrivals: int, demand_regime: str, week_number: int, difficulty_profile: Dict[str, float]) -> int:
    if demand_regime == "surge" and 8 <= week_number <= 14:
        return int(round(base_arrivals * difficulty_profile["surgeMultiplier"]))
    if demand_regime == "volatile":
        return int(max(1, min(16, base_arrivals)))
    return int(base_arrivals)


def _simulate_capacity_week(state: Dict[str, Any], decisions: Dict[str, Any], difficulty_profile: Dict[str, float]) -> Dict[str, Any]:
    next_week = int(_safe_number(state.get("week"), 0)) + 1
    arrivals = _capacity_arrivals(
        int(_safe_number(decisions.get("arrivals"), 0)),
        str(decisions.get("demandRegime", "normal")),
        next_week,
        difficulty_profile,
    )

    clinicians = int(_safe_number(decisions.get("clinicians"), 0))
    hours_per_clinician = int(_safe_number(decisions.get("hoursPerClinician"), 0))
    buffer_slots = int(_safe_number(decisions.get("bufferSlots"), 0))

    nominal_capacity = max(0, clinicians * hours_per_clinician - buffer_slots)
    disruption_rate = _cap_clamp(float(difficulty_profile["disruptionBase"]), 0.0, 0.45)
    available_capacity = max(0, nominal_capacity - int(round(nominal_capacity * disruption_rate)))

    waitlist_now = int(_safe_number(state.get("waitlist"), 0))
    active_now = int(_safe_number(state.get("active"), 0))

    wait_pressure = waitlist_now / max(1, waitlist_now + active_now)
    target_start_share = _cap_clamp(0.3 + wait_pressure * 0.35, 0.3, 0.65)
    new_start_capacity = int(available_capacity * target_start_share)
    continuation_capacity = max(0, available_capacity - new_start_capacity)

    queue_before = waitlist_now + arrivals
    new_starts = min(queue_before, new_start_capacity)
    waitlist_next = max(0, queue_before - new_starts)

    active_pool = active_now + new_starts
    continuation_visits = min(active_pool, continuation_capacity)

    cadence = str(decisions.get("cadence", "weekly"))
    base_cadence_rate = 0.12 if cadence == "weekly" else 0.07 if cadence == "biweekly" else 0.15
    discharge_rate = base_cadence_rate * float(difficulty_profile["progressMultiplier"])
    completed = min(active_pool, int(round(active_pool * discharge_rate)))
    active_next = max(0, active_pool - completed)

    delivered = new_starts + continuation_visits
    utilization = int(round((delivered / available_capacity) * 100)) if available_capacity > 0 else 0

    return {
        "week": next_week,
        "arrivals": arrivals,
        "capacity": available_capacity,
        "newStarts": new_starts,
        "continuationVisits": continuation_visits,
        "waitlist": waitlist_next,
        "active": active_next,
        "completed": completed,
        "utilization": int(_cap_clamp(utilization, 0, 100)),
    }


def _extract_capacity_state(game_state: Dict[str, Any]) -> Dict[str, Any]:
    capacity = game_state.get("capacity") if isinstance(game_state.get("capacity"), dict) else game_state
    sim_state = capacity.get("simulationState") if isinstance(capacity.get("simulationState"), dict) else {}
    decisions = capacity.get("decisions") if isinstance(capacity.get("decisions"), dict) else {}
    difficulty = str(capacity.get("difficulty", "medium")).lower()
    difficulty_profile = CAPACITY_DIFFICULTY_PROFILES.get(difficulty, CAPACITY_DIFFICULTY_PROFILES["medium"])

    history = sim_state.get("history") if isinstance(sim_state.get("history"), list) else []
    latest = history[-1] if history else {}

    return {
        "difficulty": difficulty,
        "difficultyProfile": difficulty_profile,
        "decisions": {
            "clinicians": int(_safe_number(decisions.get("clinicians"), 3)),
            "hoursPerClinician": int(_safe_number(decisions.get("hoursPerClinician"), 6)),
            "bufferSlots": int(_safe_number(decisions.get("bufferSlots"), 0)),
            "arrivals": int(_safe_number(decisions.get("arrivals"), 4)),
            "demandRegime": str(decisions.get("demandRegime", "normal")),
            "cadence": str(decisions.get("cadence", "weekly")),
        },
        "simulationState": {
            "week": int(_safe_number(sim_state.get("week"), 0)),
            "waitlist": int(_safe_number(sim_state.get("waitlist"), 0)),
            "active": int(_safe_number(sim_state.get("active"), 0)),
            "completedTotal": int(_safe_number(sim_state.get("completedTotal"), 0)),
            "latest": latest if isinstance(latest, dict) else {},
        },
    }


def _apply_message_change(decisions: Dict[str, Any], message: str) -> Dict[str, Any]:
    updated = dict(decisions)
    text = message.lower()

    if "biweekly" in text:
        updated["cadence"] = "biweekly"
    elif "intensive" in text:
        updated["cadence"] = "intensive"
    elif "weekly" in text:
        updated["cadence"] = "weekly"

    if "surge" in text:
        updated["demandRegime"] = "surge"
    elif "volatile" in text:
        updated["demandRegime"] = "volatile"
    elif "normal demand" in text or "demand normal" in text:
        updated["demandRegime"] = "normal"

    field_aliases = {
        "clinician": "clinicians",
        "clinicians": "clinicians",
        "hours": "hoursPerClinician",
        "hours per clinician": "hoursPerClinician",
        "arrivals": "arrivals",
        "buffer": "bufferSlots",
        "buffer slots": "bufferSlots",
    }

    for phrase, field in field_aliases.items():
        pattern = rf"(increase|decrease)\s+{re.escape(phrase)}(?:\s+by\s+(\d+))?"
        match = re.search(pattern, text)
        if not match:
            continue
        direction = 1 if match.group(1) == "increase" else -1
        delta = int(match.group(2)) if match.group(2) else 1
        updated[field] = int(_safe_number(updated.get(field), 0)) + direction * delta

    updated["clinicians"] = int(_cap_clamp(updated["clinicians"], 1, 8))
    updated["hoursPerClinician"] = int(_cap_clamp(updated["hoursPerClinician"], 2, 10))
    updated["bufferSlots"] = int(_cap_clamp(updated["bufferSlots"], 0, 6))
    updated["arrivals"] = int(_cap_clamp(updated["arrivals"], 1, 10))
    return updated


def _answer_capacity_question(message: str, game_state: Dict[str, Any]) -> Dict[str, Any]:
    parsed = _extract_capacity_state(game_state)
    state = parsed["simulationState"]
    decisions = parsed["decisions"]
    difficulty = parsed["difficulty"]
    difficulty_profile = parsed["difficultyProfile"]
    latest = state.get("latest", {})
    text = message.lower()

    waitlist = int(_safe_number(latest.get("waitlist"), state.get("waitlist", 0)))
    active = int(_safe_number(latest.get("active"), state.get("active", 0)))
    utilization = int(_safe_number(latest.get("utilization"), 0))
    week = int(_safe_number(state.get("week"), 0))
    completed_total = int(_safe_number(state.get("completedTotal"), 0))

    citations = [
        "game_state.capacity.simulationState.week",
        "game_state.capacity.simulationState.waitlist",
        "game_state.capacity.simulationState.active",
        "game_state.capacity.simulationState.completedTotal",
        "game_state.capacity.decisions",
    ]

    metric_definitions = {
        "waitlist": "Waitlist is pending clients not yet started; it increases by arrivals and decreases by new starts each week.",
        "active": "Active caseload is in-service clients; it increases with starts and decreases with completions.",
        "utilization": "Utilization is delivered visits divided by available capacity, shown as a percent and clamped to 0-100.",
        "completed": "Completed total is cumulative discharges across all simulated weeks.",
        "capacity": "Available capacity is nominal capacity minus disruption loss for the week.",
    }

    wants_what_if = "what if" in text or "if i" in text or "increase" in text or "decrease" in text
    wants_definition = any(k in text for k in ["what is", "define", "meaning", "explain"]) and any(
        key in text for key in metric_definitions.keys()
    )

    if wants_definition:
        for key, definition in metric_definitions.items():
            if key in text:
                return {"answer": definition, "citations": citations}

    if wants_what_if:
        adjusted_decisions = _apply_message_change(decisions, message)
        forecast_state = {
            "week": week,
            "waitlist": waitlist,
            "active": active,
        }
        forecast_rows = []
        for _ in range(4):
            row = _simulate_capacity_week(forecast_state, adjusted_decisions, difficulty_profile)
            forecast_rows.append(row)
            forecast_state = {"week": row["week"], "waitlist": row["waitlist"], "active": row["active"]}

        first = forecast_rows[0]
        last = forecast_rows[-1]
        return {
            "answer": (
                f"What-if projection (next 4 weeks, expected conditions): waitlist {waitlist} -> {last['waitlist']}, "
                f"active {active} -> {last['active']}, utilization around {first['utilization']}%-{last['utilization']}%. "
                f"Applied decisions: clinicians={adjusted_decisions['clinicians']}, hours={adjusted_decisions['hoursPerClinician']}, "
                f"buffer={adjusted_decisions['bufferSlots']}, arrivals={adjusted_decisions['arrivals']}, "
                f"demand={adjusted_decisions['demandRegime']}, cadence={adjusted_decisions['cadence']}."
            ),
            "citations": citations,
            "suggested_actions": [
                "Use Auto Play for 4-8 weeks to validate this projection under random disruption.",
                "Watch waitlist and utilization trend together; high utilization with rising waitlist indicates overload.",
            ],
        }

    pressure_note = "Backlog pressure is elevated." if waitlist > active else "Backlog pressure is moderate."
    response = (
        f"Current state (week {week}, {difficulty} difficulty): waitlist={waitlist}, active={active}, "
        f"utilization={utilization}%, completed total={completed_total}. "
        f"Current levers: clinicians={decisions['clinicians']}, hours={decisions['hoursPerClinician']}, "
        f"buffer={decisions['bufferSlots']}, arrivals={decisions['arrivals']}, "
        f"demand={decisions['demandRegime']}, cadence={decisions['cadence']}. {pressure_note}"
    )
    return {
        "answer": response,
        "citations": citations,
        "suggested_actions": [
            "Ask a what-if question like: increase clinicians by 1 and switch to surge.",
            "Ask for a metric definition, e.g. what is utilization?",
        ],
    }


def _answer_scheduling_question(message: str, game_state: Dict[str, Any]) -> Dict[str, Any]:
    scheduling = game_state.get("scheduling") if isinstance(game_state.get("scheduling"), dict) else {}
    mode = str(scheduling.get("simulationMode", "scheduling"))
    difficulty = str(scheduling.get("simulationDifficulty", "medium"))
    chapter = int(_safe_number(scheduling.get("currentChapter"), 1))
    clinicians = int(_safe_number(scheduling.get("cliniciansCount"), 0))
    queue = int(_safe_number(scheduling.get("queueCount"), 0))
    active_or_completed = int(_safe_number(scheduling.get("activeOrCompletedCount"), 0))
    appointments = int(_safe_number(scheduling.get("appointmentCount"), 0))

    citations = [
        "game_state.scheduling.simulationMode",
        "game_state.scheduling.simulationDifficulty",
        "game_state.scheduling.currentChapter",
        "game_state.scheduling.cliniciansCount",
        "game_state.scheduling.queueCount",
        "game_state.scheduling.activeOrCompletedCount",
        "game_state.scheduling.appointmentCount",
    ]

    text = message.lower()
    asks_clinician_what_if = (
        ("what happens" in text or "if i" in text or "increase" in text or "add" in text)
        and ("clinician" in text or "clinicians" in text)
    )

    if asks_clinician_what_if:
        next_clinicians = max(1, clinicians + 1)
        current_load = appointments / max(1, clinicians)
        next_load = appointments / next_clinicians
        load_delta = current_load - next_load
        return {
            "answer": (
                f"If you increase clinicians from {clinicians} to {next_clinicians}, total scheduling capacity should improve and "
                f"load per clinician drops from about {current_load:.1f} to {next_load:.1f} appointments "
                f"(~{load_delta:.1f} fewer each on average). With queue={queue}, that usually means faster intake and less bottleneck risk, "
                "assuming you keep bookings balanced across clinicians."
            ),
            "citations": citations,
            "suggested_actions": [
                "Add one clinician and rebalance appointments across the team.",
                "Track queue size and per-clinician load after 1-2 scheduling cycles.",
            ],
        }

    if "optimize" in text or "first" in text or "priority" in text:
        return {
            "answer": (
                f"Start by reducing queue pressure. Current queue={queue}, clinicians={clinicians}, appointments={appointments}. "
                "Prioritize high-risk/high-priority clients, then balance clinician load to avoid bottlenecks."
            ),
            "citations": citations,
            "suggested_actions": [
                "Check queue composition by priority.",
                "Ensure each clinician has balanced booked load before adding new clients.",
            ],
        }

    return {
        "answer": (
            f"Scheduling state: mode={mode}, difficulty={difficulty}, chapter={chapter}, clinicians={clinicians}, "
            f"queue={queue}, active/completed clients={active_or_completed}, appointments={appointments}."
        ),
        "citations": citations,
        "suggested_actions": [
            "Ask: what should I optimize first?",
            "Ask: summarize scheduling risks this week.",
        ],
    }


def _compose_llm_answer(
    user_message: str,
    mode: str,
    deterministic_result: Dict[str, Any],
    game_state: Dict[str, Any],
    settings: Dict[str, Any],
) -> Dict[str, Any]:
    if not _llm_enabled(settings):
        return deterministic_result

    if mode == "capacity-planning":
        state_context = _extract_capacity_state(game_state)
    else:
        state_context = game_state.get("scheduling") if isinstance(game_state.get("scheduling"), dict) else {}

    system_prompt = (
        "You are CareBot, an assistant for a simulation game. "
        "Use only the provided grounded facts. Do not invent metrics or values. "
        "If a value is missing, say that directly. Keep responses concise (3-6 sentences)."
    )
    user_prompt = (
        f"User question:\n{user_message}\n\n"
        f"Mode:\n{mode}\n\n"
        f"Grounded state context:\n{json.dumps(state_context, ensure_ascii=True)}\n\n"
        f"Deterministic baseline answer (trusted facts):\n{json.dumps(deterministic_result, ensure_ascii=True)}\n\n"
        "Rewrite as a friendly assistant response while preserving the same facts."
    )

    llm_text = _call_openai_chat(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        settings=settings,
    )

    merged = dict(deterministic_result)
    merged["answer"] = llm_text
    merged["model"] = settings["model"]
    merged["llm_used"] = True
    return merged


def _agent_strategy() -> str:
    strategy = os.getenv("AGENT_STRATEGY", "llm_guardrails").strip().lower()
    return strategy if strategy in {"llm_guardrails", "deterministic_rewrite"} else "llm_guardrails"


def _llm_guardrailed_answer(
    user_message: str,
    mode: str,
    deterministic_result: Dict[str, Any],
    game_state: Dict[str, Any],
    settings: Dict[str, Any],
) -> Dict[str, Any]:
    if not _llm_enabled(settings):
        return deterministic_result

    state_context = game_state if isinstance(game_state, dict) else {}
    mode_context = {}
    if mode == "capacity-planning":
        mode_context = _extract_capacity_state(game_state)
    elif mode == "scheduling":
        mode_context = game_state.get("scheduling") if isinstance(game_state.get("scheduling"), dict) else {}

    citations = deterministic_result.get("citations", [])

    system_prompt = (
        "You are CareBot, an assistant for an educational simulation game. "
        "Answer using ONLY the provided state context and derived facts. "
        "Do not invent values or hidden events. If data is missing, say exactly what is missing. "
        "Be conversational but concise (3-7 sentences). Provide practical next steps when helpful."
    )
    user_prompt = (
        f"User question:\n{user_message}\n\n"
        f"Mode:\n{mode}\n\n"
        f"Full game state JSON:\n{json.dumps(state_context, ensure_ascii=True)}\n\n"
        f"Mode-focused context:\n{json.dumps(mode_context, ensure_ascii=True)}\n\n"
        f"Derived trusted facts:\n{json.dumps(deterministic_result, ensure_ascii=True)}\n\n"
        "Important: keep numerical claims aligned with derived trusted facts and provided state."
    )

    llm_text = _call_openai_chat(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        settings=settings,
    )

    return {
        "answer": llm_text,
        "citations": citations,
        "suggested_actions": deterministic_result.get("suggested_actions", []),
        "llm_used": True,
        "model": settings["model"],
    }


@app.post("/agent/chat")
def agent_chat(payload: AgentChatRequest) -> Dict[str, Any]:
    try:
        mode = (payload.mode or "capacity-planning").lower()
        game_state = payload.game_state or {}

        if mode == "capacity-planning":
            deterministic_result = _answer_capacity_question(payload.message, game_state)
        elif mode == "scheduling":
            deterministic_result = _answer_scheduling_question(payload.message, game_state)
        else:
            deterministic_result = {
                "answer": f"Unsupported mode '{mode}'. Supported modes: capacity-planning, scheduling.",
                "citations": [],
            }

        llm_cfg = _llm_settings()
        strategy = _agent_strategy()
        result = deterministic_result
        llm_error = ""
        if _llm_enabled(llm_cfg):
            try:
                if strategy == "deterministic_rewrite":
                    result = _compose_llm_answer(payload.message, mode, deterministic_result, game_state, llm_cfg)
                else:
                    result = _llm_guardrailed_answer(payload.message, mode, deterministic_result, game_state, llm_cfg)
            except Exception as exc:
                llm_error = str(exc)

        return {
            "mode": mode,
            "conversation_id": payload.conversation_id,
            "llm_enabled": _llm_enabled(llm_cfg),
            "llm_provider": llm_cfg["provider"],
            "llm_model": llm_cfg["model"] if _llm_enabled(llm_cfg) else None,
            "agent_strategy": strategy,
            "llm_error": llm_error or None,
            **result,
        }
    except Exception as e:
        return {"error": str(e)}
