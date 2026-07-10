import json
import re
import shutil
import zipfile
from pathlib import Path
from typing import Any, Dict, List

from fastapi import HTTPException


SAFE_STORAGE_ID = re.compile(r"^[A-Za-z0-9_.-]+$")
IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".bmp")


def _require_keys(data: Dict[str, Any], keys: List[str], label: str) -> None:
    missing = [key for key in keys if key not in data]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"{label} missing required keys: {', '.join(missing)}",
        )


def validate_report(report: Dict[str, Any]) -> None:
    _require_keys(
        report,
        ["metadata", "total_points", "results", "completed_at", "status"],
        "report.json",
    )
    if not isinstance(report["results"], list):
        raise HTTPException(status_code=400, detail="report.json results must be a list")

    for result in report["results"]:
        _require_keys(
            result,
            ["point_id", "x", "y", "result", "detections", "image_path"],
            "result",
        )
        if result["result"] not in ("OK", "NG"):
            raise HTTPException(status_code=400, detail="result must be OK or NG")
        if not isinstance(result["detections"], list):
            raise HTTPException(status_code=400, detail="detections must be a list")
        for detection in result["detections"]:
            _require_keys(detection, ["label", "confidence", "box"], "detection")
            box = detection["box"]
            if not isinstance(box, list) or len(box) != 4:
                raise HTTPException(
                    status_code=400,
                    detail="detection box must be [x, y, w, h]",
                )


def validate_bundle_manifest(manifest: Dict[str, Any]) -> None:
    _require_keys(
        manifest,
        ["schema_version", "run_id", "machine_id", "created_at", "contents"],
        "manifest.json",
    )
    if manifest["schema_version"] != "1.0":
        raise HTTPException(
            status_code=400,
            detail="Unsupported dataset bundle schema_version",
        )

    contents = manifest["contents"]
    _require_keys(contents, ["report", "program", "images_dir"], "manifest contents")
    if (
        contents["report"] != "report.json"
        or contents["program"] != "program.json"
        or contents["images_dir"] != "images"
    ):
        raise HTTPException(
            status_code=400,
            detail="Bundle contents must use report.json, program.json, and images/",
        )


def safe_extract_bundle(bundle: zipfile.ZipFile, destination: Path) -> None:
    destination = destination.resolve()
    for member in bundle.infolist():
        target = (destination / member.filename).resolve()
        if target != destination and destination not in target.parents:
            raise HTTPException(status_code=400, detail="Bundle contains unsafe paths")
    bundle.extractall(destination)


def import_run_bundle_file(
    bundle_path: Path,
    imported_runs_dir: Path,
    raw_dir: Path,
    storage_id: str | None = None,
    replace_existing: bool = True,
) -> Dict[str, Any]:
    imported_runs_dir.mkdir(parents=True, exist_ok=True)
    raw_dir.mkdir(parents=True, exist_ok=True)

    incoming_dir: Path | None = None
    try:
        with zipfile.ZipFile(bundle_path, "r") as bundle:
            names = set(bundle.namelist())
            required = {"manifest.json", "report.json", "program.json"}
            missing = sorted(required - names)
            if missing:
                raise HTTPException(
                    status_code=400,
                    detail=f"Bundle missing files: {', '.join(missing)}",
                )

            manifest = json.loads(bundle.read("manifest.json"))
            report = json.loads(bundle.read("report.json"))
            validate_bundle_manifest(manifest)
            validate_report(report)

            resolved_storage_id = storage_id or manifest["run_id"]
            if not SAFE_STORAGE_ID.fullmatch(resolved_storage_id):
                raise HTTPException(status_code=400, detail="Invalid storage id")

            final_dir = imported_runs_dir / resolved_storage_id
            if final_dir.exists() and not replace_existing:
                raise HTTPException(
                    status_code=409,
                    detail=f"Run already exists: {resolved_storage_id}",
                )

            incoming_dir = imported_runs_dir / f".{resolved_storage_id}.incoming"
            if incoming_dir.exists():
                shutil.rmtree(incoming_dir)
            incoming_dir.mkdir()
            safe_extract_bundle(bundle, incoming_dir)

        copied_images = []
        image_dir = incoming_dir / "images"
        if image_dir.exists():
            for image in image_dir.iterdir():
                if image.is_file() and image.suffix.lower() in IMAGE_EXTENSIONS:
                    target = raw_dir / f"{resolved_storage_id}_{image.name}"
                    shutil.copyfile(image, target)
                    copied_images.append(target.name)

        if final_dir.exists():
            shutil.rmtree(final_dir)
        incoming_dir.replace(final_dir)
        incoming_dir = None

        return {
            "status": "imported",
            "run_id": manifest["run_id"],
            "storage_id": resolved_storage_id,
            "stored_at": str(final_dir),
            "raw_images": copied_images,
        }
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=400, detail="Invalid zip bundle") from exc
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Bundle contains invalid JSON") from exc
    finally:
        if incoming_dir and incoming_dir.exists():
            shutil.rmtree(incoming_dir)
