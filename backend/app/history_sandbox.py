import contextlib
import io
from typing import Any, Dict

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class HistoryPythonSandboxRequest(BaseModel):
    code: str
    appointments: list[dict[str, Any]]
    clients: list[dict[str, Any]]
    clinicians: list[dict[str, Any]]
    constraints: dict[str, Any]


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(v) for v in value]
    return str(value)


@router.post("/sandbox/history/python")
def run_history_python_sandbox(payload: HistoryPythonSandboxRequest) -> Dict[str, Any]:
    """
    NOTE: The user's code should assign its final output to a variable named `result`.
    """
    safe_builtins = {
        "__import__": __import__,
        "len": len,
        "sum": sum,
        "min": min,
        "max": max,
        "sorted": sorted,
        "enumerate": enumerate,
        "range": range,
        "any": any,
        "all": all,
        "abs": abs,
        "round": round,
        "set": set,
        "list": list,
        "dict": dict,
        "tuple": tuple,
        "str": str,
        "int": int,
        "float": float,
        "bool": bool,
        "Exception": Exception,
        "print": print,
    }

    globals_dict = {"__builtins__": safe_builtins}
    locals_dict = {
        "appointments": payload.appointments,
        "clients": payload.clients,
        "clinicians": payload.clinicians,
        "CONSTRAINTS": payload.constraints,
    }

    stdout_buffer = io.StringIO()
    try:
        with contextlib.redirect_stdout(stdout_buffer):
            exec(payload.code, globals_dict, locals_dict)
    except Exception as exc:
        return {"ok": False, "error": str(exc)}

    if "result" not in locals_dict:
        return {
            "ok": False,
            "error": "Your Python code must assign the final output to a variable named `result`.",
        }

    return {
        "ok": True,
        "value": _json_safe(locals_dict["result"]),
        "stdout": stdout_buffer.getvalue(),
    }
