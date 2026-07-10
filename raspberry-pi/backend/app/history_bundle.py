import json
import re
from pathlib import Path

from fastapi import HTTPException

from app.config import HISTORY_DIR
from app.run_bundle import create_run_bundle


SAFE_RUN_ID = re.compile(r"^[A-Za-z0-9_.-]+$")


def _history_run_dir(run_id: str) -> Path:
    if not SAFE_RUN_ID.fullmatch(run_id) or run_id in {".", "..", "captures"}:
        raise HTTPException(status_code=400, detail="Invalid run id")

    root = Path(HISTORY_DIR).resolve()
    run_dir = (root / run_id).resolve()
    if run_dir.parent != root:
        raise HTTPException(status_code=400, detail="Invalid run id")
    return run_dir


def build_history_bundle(run_id: str) -> bytes:
    run_dir = _history_run_dir(run_id)
    report_path = run_dir / "report.json"
    if not report_path.exists():
        raise HTTPException(status_code=404, detail="Run not found")

    report_data = json.loads(report_path.read_text(encoding="utf-8"))
    program_path = run_dir / "program.json"
    program_data = (
        json.loads(program_path.read_text(encoding="utf-8"))
        if program_path.exists()
        else {
            "name": report_data.get("metadata", {}).get("program_name", ""),
            "points": [],
        }
    )
    return create_run_bundle(run_id, run_dir, report_data, program_data)
