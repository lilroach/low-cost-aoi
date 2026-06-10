import datetime
import io
import json
import os
import zipfile
from pathlib import Path
from typing import Any, Dict, List

from app.config import MACHINE_ID


def _require_keys(data: Dict[str, Any], keys: List[str], label: str) -> None:
    missing = [key for key in keys if key not in data]
    if missing:
        raise ValueError(f"{label} missing required keys: {', '.join(missing)}")


def validate_inspection_run(report: Dict[str, Any]) -> None:
    _require_keys(report, ["metadata", "total_points", "results", "completed_at", "status"], "report.json")
    if not isinstance(report["results"], list):
        raise ValueError("report.json results must be a list")

    for result in report["results"]:
        _require_keys(result, ["point_id", "x", "y", "result", "detections", "image_path"], "result")
        if result["result"] not in ("OK", "NG"):
            raise ValueError("result must be OK or NG")
        if not isinstance(result["detections"], list):
            raise ValueError("detections must be a list")
        for detection in result["detections"]:
            _require_keys(detection, ["label", "confidence", "box"], "detection")
            box = detection["box"]
            if not isinstance(box, list) or len(box) != 4:
                raise ValueError("detection box must be [x, y, w, h]")


def create_bundle_manifest(run_id: str, report: Dict[str, Any]) -> Dict[str, Any]:
    metadata = report.get("metadata", {})
    return {
        "schema_version": "1.0",
        "run_id": run_id,
        "machine_id": metadata.get("machine_id") or MACHINE_ID,
        "part_no": metadata.get("part_no", ""),
        "batch_no": metadata.get("batch_no", ""),
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "contents": {
            "report": "report.json",
            "program": "program.json",
            "images_dir": "images",
        },
    }


def create_run_bundle(run_id: str, run_dir: Path, report: Dict[str, Any], program_data: Dict[str, Any]) -> bytes:
    validate_inspection_run(report)
    manifest = create_bundle_manifest(run_id, report)

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
        bundle.writestr("manifest.json", json.dumps(manifest, indent=2))
        bundle.writestr("report.json", json.dumps(report, indent=2))
        bundle.writestr("program.json", json.dumps(program_data, indent=2))

        for result in report["results"]:
            source = run_dir / os.path.basename(result["image_path"])
            if source.exists():
                bundle.write(source, f"images/{source.name}")

    return buffer.getvalue()
