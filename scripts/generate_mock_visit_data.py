#!/usr/bin/env python3
"""Generate mock visit data with AX/TX/RAX flow and difficulty presets.

This script is intentionally compatible with the frontend seeding flow that expects:
client_id, clinician_id, visit_type, booking_datetime, scheduled_start,
scheduled_end, status, cancel_datetime
"""

from __future__ import annotations

import argparse
import random
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Any

import pandas as pd


OUTPUT_COLUMNS = [
    "client_id",
    "clinician_id",
    "visit_type",
    "booking_datetime",
    "scheduled_start",
    "scheduled_end",
    "status",
    "cancel_datetime",
]

REQUIRED_CLIENT_COLUMNS = {"client_id", "clinician_id", "referral_date", "service_start_date"}


class JourneyPlan:
    DISCHARGED_ONE_BLOCK_DONE = "discharged_one_block_done"
    DISCHARGED_TWO_BLOCKS_DONE = "discharged_two_blocks_done"
    ACTIVE_ONE_BLOCK_PLUS_RAX = "active_one_block_plus_rax"
    ACTIVE_SECOND_BLOCK_IN_PROGRESS = "active_second_block_in_progress"


@dataclass(frozen=True)
class DifficultyProfile:
    name: str
    followup_tx_rate: float
    extra_discharged_rate: float
    discharged_two_block_rate: float
    midblock_start_rate: float
    completed_rate: float
    no_show_rate: float
    cancel_over_24h_rate: float
    cancel_under_24h_rate: float
    booking_lead_min_days: int
    booking_lead_max_days: int
    referral_to_ax_min_days: int
    referral_to_ax_max_days: int
    break_min_months: int
    break_max_months: int
    partial_second_block_min_tx: int
    partial_second_block_max_tx: int


DIFFICULTY_PROFILES: dict[str, DifficultyProfile] = {
    "easy": DifficultyProfile(
        name="easy",
        followup_tx_rate=0.82,
        extra_discharged_rate=0.22,
        discharged_two_block_rate=0.70,
        midblock_start_rate=0.15,
        completed_rate=0.90,
        no_show_rate=0.05,
        cancel_over_24h_rate=0.04,
        cancel_under_24h_rate=0.01,
        booking_lead_min_days=7,
        booking_lead_max_days=45,
        referral_to_ax_min_days=14,
        referral_to_ax_max_days=90,
        break_min_months=2,
        break_max_months=3,
        partial_second_block_min_tx=3,
        partial_second_block_max_tx=5,
    ),
    "medium": DifficultyProfile(
        name="medium",
        followup_tx_rate=0.70,
        extra_discharged_rate=0.45,
        discharged_two_block_rate=0.55,
        midblock_start_rate=0.30,
        completed_rate=0.82,
        no_show_rate=0.08,
        cancel_over_24h_rate=0.06,
        cancel_under_24h_rate=0.04,
        booking_lead_min_days=3,
        booking_lead_max_days=35,
        referral_to_ax_min_days=21,
        referral_to_ax_max_days=120,
        break_min_months=2,
        break_max_months=4,
        partial_second_block_min_tx=1,
        partial_second_block_max_tx=5,
    ),
    "hard": DifficultyProfile(
        name="hard",
        followup_tx_rate=0.52,
        extra_discharged_rate=0.62,
        discharged_two_block_rate=0.40,
        midblock_start_rate=0.48,
        completed_rate=0.68,
        no_show_rate=0.14,
        cancel_over_24h_rate=0.10,
        cancel_under_24h_rate=0.08,
        booking_lead_min_days=1,
        booking_lead_max_days=21,
        referral_to_ax_min_days=35,
        referral_to_ax_max_days=160,
        break_min_months=2,
        break_max_months=5,
        partial_second_block_min_tx=1,
        partial_second_block_max_tx=3,
    ),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Generate mock visit data where each client gets AX -> 6 TX -> break -> RAX, "
            "with difficulty presets and configurable in-progress/discharged patterns."
        )
    )
    parser.add_argument(
        "--clients-csv",
        default="mock_client_metadata.csv",
        help="Input client metadata CSV (default: mock_client_metadata.csv).",
    )
    parser.add_argument(
        "--output-csv",
        default="mock_visit_data_generated.csv",
        help="Output visit CSV path (default: mock_visit_data_generated.csv).",
    )
    parser.add_argument(
        "--difficulty",
        choices=["easy", "medium", "hard"],
        default="medium",
        help="Difficulty profile controlling cancellation/no-show patterns and journey mix.",
    )
    parser.add_argument(
        "--followup-tx-rate",
        type=float,
        default=None,
        help="Override: share of active clients in second TX block after RAX (0-1).",
    )
    parser.add_argument(
        "--extra-discharged-rate",
        type=float,
        default=None,
        help="Override: additional share of non-discharged clients modeled as discharged (0-1).",
    )
    parser.add_argument(
        "--discharged-two-block-rate",
        type=float,
        default=None,
        help="Override: among discharged journeys, share that complete two blocks (0-1).",
    )
    parser.add_argument(
        "--midblock-start-rate",
        type=float,
        default=None,
        help="Override: share of clients whose first visible visit starts mid first TX block (0-1).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducibility (default: 42).",
    )
    return parser.parse_args()


def parse_optional_date(raw: object) -> date | None:
    if pd.isna(raw):
        return None
    raw_str = str(raw).strip()
    if raw_str == "":
        return None
    return pd.to_datetime(raw_str).date()


def choose_session_time(rng: random.Random, session_date: date) -> datetime:
    hour = rng.choice([8, 9, 10, 11, 13, 14, 15, 16])
    minute = rng.choice([0, 15, 30, 45])
    return datetime.combine(session_date, time(hour=hour, minute=minute))


def choose_duration_minutes(rng: random.Random, visit_type: str) -> int:
    if visit_type in {"AX", "RAX"}:
        base = 75
        jitter = rng.randint(-10, 10)
    else:
        base = 45
        jitter = rng.randint(-5, 5)
    return max(30, base + jitter)


def choose_status(rng: random.Random, profile: DifficultyProfile) -> str:
    roll = rng.random()
    c1 = profile.completed_rate
    c2 = c1 + profile.no_show_rate
    c3 = c2 + profile.cancel_over_24h_rate
    if roll < c1:
        return "Completed"
    if roll < c2:
        return "No-show"
    if roll < c3:
        return "Cancelled (>24h)"
    return "Cancelled (<24h)"


def format_dt(ts: datetime | None) -> str:
    if ts is None:
        return ""
    return ts.strftime("%Y-%m-%d %H:%M:%S")


def build_visit_row(
    rng: random.Random,
    profile: DifficultyProfile,
    client_id: str,
    clinician_id: str,
    visit_type: str,
    scheduled_start: datetime,
) -> dict[str, str]:
    scheduled_end = scheduled_start + timedelta(minutes=choose_duration_minutes(rng, visit_type))

    lead_days = rng.randint(profile.booking_lead_min_days, profile.booking_lead_max_days)
    booking_datetime = scheduled_start - timedelta(
        days=lead_days,
        hours=rng.randint(0, 23),
        minutes=rng.randint(0, 59),
    )
    status = choose_status(rng, profile)

    cancel_datetime: datetime | None = None
    if status.startswith("Cancelled"):
        if "(>24h)" in status:
            cancel_datetime = scheduled_start - timedelta(
                hours=rng.randint(25, 120),
                minutes=rng.randint(0, 59),
            )
        else:
            cancel_datetime = scheduled_start - timedelta(
                hours=rng.randint(1, 23),
                minutes=rng.randint(0, 59),
            )
        if cancel_datetime <= booking_datetime:
            cancel_datetime = booking_datetime + timedelta(hours=1)

    return {
        "client_id": client_id,
        "clinician_id": clinician_id,
        "visit_type": visit_type,
        "booking_datetime": format_dt(booking_datetime),
        "scheduled_start": format_dt(scheduled_start),
        "scheduled_end": format_dt(scheduled_end),
        "status": status,
        "cancel_datetime": format_dt(cancel_datetime),
    }


def is_discharged(client_row: dict[str, object]) -> bool:
    raw_status = str(client_row.get("status", "")).strip().lower()
    return raw_status == "discharged"


def build_first_ax_date(rng: random.Random, profile: DifficultyProfile, client_row: dict[str, object]) -> date:
    service_start = parse_optional_date(client_row.get("service_start_date"))
    if service_start is not None:
        return service_start

    referral = parse_optional_date(client_row.get("referral_date"))
    if referral is not None:
        return referral + timedelta(days=rng.randint(profile.referral_to_ax_min_days, profile.referral_to_ax_max_days))

    return date.today() - timedelta(days=rng.randint(180, 720))


def next_weekly_session(rng: random.Random, previous_start: datetime) -> datetime:
    next_date = previous_start.date() + timedelta(days=rng.randint(6, 9))
    return choose_session_time(rng, next_date)


def with_month_break(rng: random.Random, profile: DifficultyProfile, previous_start: datetime) -> datetime:
    break_months = rng.randint(profile.break_min_months, profile.break_max_months)
    return_date = (
        pd.Timestamp(previous_start.date()) + pd.DateOffset(months=break_months)
    ).date() + timedelta(days=rng.randint(0, 14))
    return choose_session_time(rng, return_date)


def choose_active_plan(rng: random.Random, followup_tx_rate: float) -> str:
    if rng.random() < followup_tx_rate:
        return JourneyPlan.ACTIVE_SECOND_BLOCK_IN_PROGRESS
    return JourneyPlan.ACTIVE_ONE_BLOCK_PLUS_RAX


def assign_discharged_plans(
    rng: random.Random, discharged_client_ids: list[str], two_block_rate: float
) -> dict[str, str]:
    plans: dict[str, str] = {}
    for cid in discharged_client_ids:
        plans[cid] = (
            JourneyPlan.DISCHARGED_TWO_BLOCKS_DONE
            if rng.random() < two_block_rate
            else JourneyPlan.DISCHARGED_ONE_BLOCK_DONE
        )

    if len(discharged_client_ids) >= 2:
        values = set(plans.values())
        if JourneyPlan.DISCHARGED_ONE_BLOCK_DONE not in values:
            plans[discharged_client_ids[0]] = JourneyPlan.DISCHARGED_ONE_BLOCK_DONE
        if JourneyPlan.DISCHARGED_TWO_BLOCKS_DONE not in values:
            plans[discharged_client_ids[-1]] = JourneyPlan.DISCHARGED_TWO_BLOCKS_DONE

    return plans


def build_first_block_rows(
    rng: random.Random,
    profile: DifficultyProfile,
    client_id: str,
    clinician_id: str,
    first_ax_start: datetime,
) -> tuple[list[dict[str, str]], datetime]:
    first_block_rows: list[dict[str, str]] = []
    current_start = first_ax_start
    first_block_rows.append(build_visit_row(rng, profile, client_id, clinician_id, "AX", current_start))
    for _ in range(6):
        current_start = next_weekly_session(rng, current_start)
        first_block_rows.append(build_visit_row(rng, profile, client_id, clinician_id, "TX", current_start))
    return first_block_rows, current_start


def apply_midblock_visibility_cut(
    rng: random.Random, first_block_rows: list[dict[str, str]], midblock_start_rate: float
) -> list[dict[str, str]]:
    if rng.random() >= midblock_start_rate:
        return first_block_rows[:]
    tx_start_idx = rng.randint(1, 6)
    return first_block_rows[tx_start_idx:]


def add_tx_visits(
    rng: random.Random,
    profile: DifficultyProfile,
    rows: list[dict[str, str]],
    client_id: str,
    clinician_id: str,
    current_start: datetime,
    n_tx: int,
) -> datetime:
    for _ in range(n_tx):
        current_start = next_weekly_session(rng, current_start)
        rows.append(build_visit_row(rng, profile, client_id, clinician_id, "TX", current_start))
    return current_start


def generate_client_visits(
    rng: random.Random,
    profile: DifficultyProfile,
    client_row: dict[str, object],
    plan: str,
    midblock_start_rate: float,
) -> list[dict[str, str]]:
    client_id = str(client_row["client_id"])
    clinician_id = str(client_row["clinician_id"])

    first_ax_start = choose_session_time(rng, build_first_ax_date(rng, profile, client_row))
    first_block_rows, current_start = build_first_block_rows(rng, profile, client_id, clinician_id, first_ax_start)

    if plan in {
        JourneyPlan.ACTIVE_ONE_BLOCK_PLUS_RAX,
        JourneyPlan.ACTIVE_SECOND_BLOCK_IN_PROGRESS,
    }:
        rows = apply_midblock_visibility_cut(rng, first_block_rows, midblock_start_rate)
    else:
        rows = first_block_rows[:]

    if plan == JourneyPlan.DISCHARGED_ONE_BLOCK_DONE:
        return rows

    current_start = with_month_break(rng, profile, current_start)
    rows.append(build_visit_row(rng, profile, client_id, clinician_id, "RAX", current_start))

    if plan == JourneyPlan.DISCHARGED_TWO_BLOCKS_DONE:
        add_tx_visits(rng, profile, rows, client_id, clinician_id, current_start, 6)
    elif plan == JourneyPlan.ACTIVE_SECOND_BLOCK_IN_PROGRESS:
        add_tx_visits(
            rng,
            profile,
            rows,
            client_id,
            clinician_id,
            current_start,
            rng.randint(profile.partial_second_block_min_tx, profile.partial_second_block_max_tx),
        )

    return rows


def validate_clients_df(df: pd.DataFrame) -> None:
    missing = REQUIRED_CLIENT_COLUMNS - set(df.columns)
    if missing:
        missing_list = ", ".join(sorted(missing))
        raise ValueError(f"Missing required client columns: {missing_list}")


def validate_rate(name: str, value: float) -> None:
    if not (0.0 <= value <= 1.0):
        raise ValueError(f"{name} must be between 0 and 1.")


def resolve_settings(args: argparse.Namespace) -> dict[str, Any]:
    profile = DIFFICULTY_PROFILES[args.difficulty]
    followup_tx_rate = profile.followup_tx_rate if args.followup_tx_rate is None else args.followup_tx_rate
    extra_discharged_rate = (
        profile.extra_discharged_rate if args.extra_discharged_rate is None else args.extra_discharged_rate
    )
    discharged_two_block_rate = (
        profile.discharged_two_block_rate
        if args.discharged_two_block_rate is None
        else args.discharged_two_block_rate
    )
    midblock_start_rate = profile.midblock_start_rate if args.midblock_start_rate is None else args.midblock_start_rate

    validate_rate("--followup-tx-rate", followup_tx_rate)
    validate_rate("--extra-discharged-rate", extra_discharged_rate)
    validate_rate("--discharged-two-block-rate", discharged_two_block_rate)
    validate_rate("--midblock-start-rate", midblock_start_rate)

    total_status_rate = (
        profile.completed_rate
        + profile.no_show_rate
        + profile.cancel_over_24h_rate
        + profile.cancel_under_24h_rate
    )
    if abs(total_status_rate - 1.0) > 1e-9:
        raise ValueError(f"Status rates for profile '{profile.name}' must sum to 1.0 (got {total_status_rate:.3f}).")

    return {
        "profile": profile,
        "followup_tx_rate": followup_tx_rate,
        "extra_discharged_rate": extra_discharged_rate,
        "discharged_two_block_rate": discharged_two_block_rate,
        "midblock_start_rate": midblock_start_rate,
    }


def main() -> None:
    args = parse_args()
    settings = resolve_settings(args)
    profile: DifficultyProfile = settings["profile"]

    clients_df = pd.read_csv(args.clients_csv)
    validate_clients_df(clients_df)

    rng = random.Random(args.seed)
    client_rows = clients_df.to_dict(orient="records")
    status_discharged_ids = [str(r["client_id"]) for r in client_rows if is_discharged(r)]
    extra_discharged_ids = [
        str(r["client_id"])
        for r in client_rows
        if (not is_discharged(r)) and (rng.random() < settings["extra_discharged_rate"])
    ]
    discharged_client_ids = sorted(set(status_discharged_ids) | set(extra_discharged_ids))
    discharged_plan_by_client = assign_discharged_plans(
        rng, discharged_client_ids, settings["discharged_two_block_rate"]
    )

    all_rows: list[dict[str, str]] = []
    plan_counts: dict[str, int] = {}
    for row in client_rows:
        cid = str(row["client_id"])
        if cid in discharged_plan_by_client:
            plan = discharged_plan_by_client[cid]
        else:
            plan = choose_active_plan(rng, settings["followup_tx_rate"])
        plan_counts[plan] = plan_counts.get(plan, 0) + 1

        all_rows.extend(generate_client_visits(rng, profile, row, plan, settings["midblock_start_rate"]))

    visits_df = pd.DataFrame(all_rows, columns=OUTPUT_COLUMNS).sort_values(
        ["client_id", "scheduled_start", "booking_datetime"]
    )
    visits_df.to_csv(args.output_csv, index=False)

    clients_with_post_rax_tx_full = 0
    clients_with_post_rax_tx_partial = 0
    for _, g in visits_df.groupby("client_id", sort=False):
        visit_types = g["visit_type"].tolist()
        if "RAX" not in visit_types:
            continue
        rax_idx = visit_types.index("RAX")
        tx_after_rax = sum(vt == "TX" for vt in visit_types[rax_idx + 1 :])
        if tx_after_rax >= 6:
            clients_with_post_rax_tx_full += 1
        elif tx_after_rax >= 1:
            clients_with_post_rax_tx_partial += 1

    counts = visits_df["visit_type"].value_counts().to_dict()
    print(f"Wrote {len(visits_df)} rows to {args.output_csv}")
    print(f"Difficulty profile: {args.difficulty}")
    print(f"Visit type counts: {counts}")
    print(f"Clients with full post-RAX TX block (6 TX): {clients_with_post_rax_tx_full}")
    print(f"Clients with in-progress post-RAX TX block (1-5 TX): {clients_with_post_rax_tx_partial}")
    print(
        "Clients whose first visible visit is TX: "
        f"{sum(s.iloc[0] == 'TX' for _, s in visits_df.groupby('client_id')['visit_type'])}"
    )
    print(
        "Clients modeled as discharged journeys: "
        f"{len(discharged_client_ids)} "
        f"(metadata discharged={len(status_discharged_ids)}, extra={len(extra_discharged_ids)})"
    )
    print(f"Journey plans used: {plan_counts}")


if __name__ == "__main__":
    main()
