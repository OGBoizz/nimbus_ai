#	Receives frontend requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from backend.audit import write_audit_log

# This creates the router
router = APIRouter()


class AskRequest(BaseModel):
    question: str = Field(min_length=2, max_length=2000)



def run_module(module_name: str, function_name: str, *args):
    import importlib
    import traceback

    try:
        module = importlib.import_module(f"backend.{module_name}")
        function = getattr(module, function_name)
        return function(*args)

    except Exception as exc:
        traceback.print_exc()
        write_audit_log(
            f"{module_name}.{function_name}",
            "error",
            traceback.format_exc()
        )
        raise HTTPException(
            status_code=500,
            detail=f"{module_name}.{function_name}: {type(exc).__name__}: {exc}"
        )


@router.get("/health")
def health():
    return {
        "status": "healthy",
        "application": "Nimbus AI",
        "api": "running"
    }

@router.get("/scorecard")
def scorecard():
    result = run_module("tools", "get_scorecard")
    write_audit_log("scorecard", "success")
    return {"status": "success", "data": result}

@router.post("/ask")
def ask(request: AskRequest):
    result = run_module("agent", "answer_question", request.question)
    write_audit_log("ask", "success", request.question)
    return {"status": "success", "data": result}


@router.get("/report")
def report():
    result = result = run_module("report", "weekly_report")
    write_audit_log("report", "success")
    return {"status": "success", "data": result}


@router.get("/changelog")
def changelog():
    result = run_module("clean_data", "get_changelog")
    write_audit_log("changelog", "success")
    return {"status": "success", "data": result}
