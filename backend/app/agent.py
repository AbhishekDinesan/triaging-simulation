import json
import os
import re
from typing import Any, Dict
from urllib import error, request


CAPACITY_DIFFICULTY_PROFILES: Dict[str, Dict[str, float]] = {
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


def _cap_clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def _safe_number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return float(default)


def llm_settings() -> Dict[str, Any]:
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


def llm_enabled(settings: Dict[str, Any]) -> bool:
    return settings["provider"] in {"openai", "gemini"} and bool(settings["api_key"]) and bool(settings["model"])


def call_openai_chat(messages: list, settings: Dict[str, Any]) -> str:

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


def answer_capacity_question(message: str, game_state: Dict[str, Any]) -> Dict[str, Any]:
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


def answer_scheduling_question(message: str, game_state: Dict[str, Any]) -> Dict[str, Any]:
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


def compose_llm_answer(
    user_message: str,
    mode: str,
    deterministic_result: Dict[str, Any],
    game_state: Dict[str, Any],
    settings: Dict[str, Any],
) -> Dict[str, Any]:
    if not llm_enabled(settings):
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

    llm_text = call_openai_chat(
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


def llm_guardrailed_answer(
    user_message: str,
    mode: str,
    deterministic_result: Dict[str, Any],
    game_state: Dict[str, Any],
    settings: Dict[str, Any],
) -> Dict[str, Any]:
    if not llm_enabled(settings):
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

    llm_text = call_openai_chat(
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


def agent_strategy() -> str:
    strategy = os.getenv("AGENT_STRATEGY", "llm_guardrails").strip().lower()
    return strategy if strategy in {"llm_guardrails", "deterministic_rewrite"} else "llm_guardrails"
