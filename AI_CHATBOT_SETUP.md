# AI Chatbot Setup Guide

This project includes a **Student View right-sidebar chatbot** ("CareBot Assistant") that answers questions about simulation state.

## What is implemented now

- Frontend sidebar chat in Student View (Capacity and Scheduling pages).
- Backend endpoint: `POST /agent/chat`.
- State-grounded deterministic answers for:
  - **capacity-planning** (status, metric definitions, simple what-if projection)
  - **scheduling** (state summary and basic optimization guidance)
- Optional **real LLM-backed generation** on top of grounded facts (OpenAI-compatible API).

## 1) Start frontend + backend together

From project root:

```powershell
cd C:\Users\abhid\OneDrive\Desktop\research\simulation\medical-triage-sim
.\start-dev.ps1
```

This starts:

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`

Use `Ctrl+C` in that terminal to stop both.

## 2) Verify backend health quickly

Open this in browser:

- `http://localhost:8000/docs`

You should see FastAPI docs, including `POST /agent/chat`.

## 3) Where the chatbot appears

- Log in to the app.
- Open **Student View**.
- The chatbot is on the **right sidebar** as "CareBot Assistant".
- In Capacity Planning mode, ask:
  - `What is my current status?`
  - `What if I increase clinicians by 1?`
  - `What does utilization mean?`

## 4) Environment variables

The chatbot always works in deterministic mode with **no key required**.
To enable real LLM generation, set backend env vars before starting `.\start-dev.ps1`.

### Backend (LLM)

Shared:

- `LLM_PROVIDER` (`gemini` or `openai`)
- `AGENT_STRATEGY` (`llm_guardrails` or `deterministic_rewrite`, default: `llm_guardrails`)
- `OPENAI_TEMPERATURE` (optional, default: `0.2`)
- `OPENAI_MAX_TOKENS` (optional, default: `450`)

Gemini (OpenAI-compatible endpoint mode):

- `GEMINI_API_KEY` (required when `LLM_PROVIDER=gemini`)
- `GEMINI_MODEL` (optional, default: `gemini-2.0-flash`)
- `GEMINI_BASE_URL` (optional, default: `https://generativelanguage.googleapis.com/v1beta/openai`)

OpenAI:

- `OPENAI_API_KEY` (required when `LLM_PROVIDER=openai`)
- `OPENAI_MODEL` (optional, default: `gpt-4o-mini`)
- `OPENAI_BASE_URL` (optional, default: `https://api.openai.com/v1`)

You can store these in a backend env file:

- Create: `backend/.env`
- Copy keys from: `backend/env.example`

Example `backend/.env`:

```env
LLM_PROVIDER=gemini
AGENT_STRATEGY=llm_guardrails
GEMINI_API_KEY=your_real_key_here
GEMINI_MODEL=gemini-2.5-flash
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
OPENAI_TEMPERATURE=0.2
OPENAI_MAX_TOKENS=450
```

PowerShell example (current terminal session only):

```powershell
$env:LLM_PROVIDER="gemini"
$env:GEMINI_API_KEY="YOUR_KEY_HERE"
$env:GEMINI_MODEL="gemini-2.0-flash"
.\start-dev.ps1
```

PowerShell example (persist for future sessions):

```powershell
setx LLM_PROVIDER "gemini"
setx GEMINI_API_KEY "YOUR_KEY_HERE"
setx GEMINI_MODEL "gemini-2.0-flash"
```

After `setx`, open a **new** terminal before running.

Note: `.\start-dev.ps1` now auto-loads `backend/.env` if present.

Optional frontend env (already supported):

- `VITE_API_BASE=http://localhost:8000`

If not set, frontend defaults to `http://localhost:8000`.

## 5) Troubleshooting

- **Chatbot missing from UI**
  - Confirm you are in Student View (not Instructor-only panel).
  - Confirm frontend was started from this repo and refreshed after pull/restart.

- **Agent errors in sidebar**
  - Ensure backend is running on port `8000`.
  - Check `http://localhost:8000/docs` loads.
  - Confirm browser console/network shows requests to `/agent/chat`.
  - Check API response fields:
    - `llm_enabled`
    - `llm_model`
    - `llm_error` (non-null means fallback was used)

- **LLM not being used**
  - Confirm provider + key are set for your selected provider:
    - Gemini: `LLM_PROVIDER=gemini` + `GEMINI_API_KEY`
    - OpenAI: `LLM_PROVIDER=openai` + `OPENAI_API_KEY`
  - Confirm outbound network access to your configured base URL (`GEMINI_BASE_URL` or `OPENAI_BASE_URL`).
  - If LLM call fails, backend automatically falls back to deterministic answer.

- **`make` does not work on Windows**
  - Use `.\start-dev.ps1` instead.
  - `make` requires installing GNU Make separately.

## 6) How LLM mode works

- Default strategy is `llm_guardrails`:
  - Backend sends full game state + mode-focused context + trusted derived facts to the LLM.
  - LLM produces the primary answer with strict grounding instructions.
- Optional strategy `deterministic_rewrite`:
  - Backend computes a deterministic baseline answer first.
  - LLM rewrites that baseline into more conversational text.
- On any LLM error, backend returns deterministic fallback (so chat still works).
