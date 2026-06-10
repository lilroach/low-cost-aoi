from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
import os
import cv2
import datetime
import time
import json
import io
import zipfile
from typing import Literal
from app.api import camera
from app.api import inference
from app.config import HISTORY_DIR, MACHINE_ID, MODEL_INFERENCE_ENABLED
from app.model_registry import registry

router = APIRouter()

CAPTURE_BASE_DIR = os.path.join(str(HISTORY_DIR), "captures")

# Ensure base capture directory exists
os.makedirs(CAPTURE_BASE_DIR, exist_ok=True)

class CaptureMetadataUpdate(BaseModel):
    part_no: str | None = None
    batch_no: str | None = None
    model_id: str | None = None


def _daily_paths():
    today = datetime.datetime.now().strftime("%Y%m%d")
    daily_dir = os.path.join(CAPTURE_BASE_DIR, today)
    records_path = os.path.join(daily_dir, "captures.json")
    return today, daily_dir, records_path


def _load_records(records_path: str):
    if not os.path.exists(records_path):
        return []
    with open(records_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_records(records_path: str, records):
    with open(records_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)


def _get_model(model_id: str):
    if model_id == "none":
        return {"id": "none", "name": "No model", "version": "-", "enabled": False}
    model = registry.get_model(model_id)
    if not model or model["status"] != "valid":
        return None
    manifest = model["manifest"]
    runtime_compatible = model.get("runtime_compatible", manifest.get("format") == "hailo-hef")
    return {
        "id": model["model_id"],
        "name": f"{manifest['part_no']} {model['model_id']}",
        "version": manifest["version"],
        "part_no": manifest["part_no"],
        "format": manifest["format"],
        "enabled": MODEL_INFERENCE_ENABLED and runtime_compatible,
        "locked": not MODEL_INFERENCE_ENABLED or not runtime_compatible,
        "runtime_compatible": runtime_compatible,
    }


def _ready_records(records):
    return [record for record in records if record.get("export_ready") and record.get("manual_result") in ("OK", "NG")]


def _capture_image_path(daily_dir: str, record) -> str:
    return os.path.join(daily_dir, record["filename"])


def _top_detection(detections):
    if not detections:
        return None
    return max(detections, key=lambda detection: detection.get("confidence", 0))


def _build_training_host_bundle(today: str, daily_dir: str, records) -> tuple[str, bytes]:
    ready_records = _ready_records(records)
    if not ready_records:
        raise HTTPException(status_code=400, detail="No export-ready captures. Please set manual OK/NG first.")

    missing = [record["filename"] for record in ready_records if not os.path.exists(_capture_image_path(daily_dir, record))]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing capture images: {', '.join(missing)}")

    now = datetime.datetime.now(datetime.timezone.utc)
    run_id = f"capture_{today}_{now.strftime('%H%M%S')}"
    results = []
    program_points = []

    for index, record in enumerate(reversed(ready_records), start=1):
        image_path = f"images/{record['filename']}"
        result = {
            "point_id": str(index),
            "x": 0,
            "y": 0,
            "result": record["manual_result"],
            "detections": record.get("detections", []),
            "image_path": image_path,
            "capture_id": record["id"],
            "filename": record["filename"],
            "captured_at": record.get("captured_at"),
            "part_no": record.get("part_no"),
            "batch_no": record.get("batch_no"),
            "model_id": record.get("model_id"),
            "model_name": record.get("model_name"),
            "model_result": record.get("model_result"),
            "manual_result": record.get("manual_result"),
            "recognition_error": record.get("recognition_error", False),
        }
        results.append(result)
        program_points.append({
            "point_id": str(index),
            "x": 0,
            "y": 0,
            "image_path": image_path,
            "capture_id": record["id"],
        })

    report = {
        "metadata": {
            "source": "capture-mode",
            "machine_id": MACHINE_ID,
            "date": today,
            "part_numbers": sorted({record.get("part_no") or "UNKNOWN" for record in ready_records}),
            "batch_numbers": sorted({record.get("batch_no") or "UNKNOWN" for record in ready_records}),
            "models": sorted({record.get("model_id") or "none" for record in ready_records}),
            "transfer": "usb",
        },
        "total_points": len(results),
        "results": results,
        "completed_at": now.isoformat(),
        "status": "completed",
    }
    program = {
        "name": "capture-mode",
        "source": "raspberry-pi",
        "machine_id": MACHINE_ID,
        "points": program_points,
    }
    manifest = {
        "schema_version": "1.0",
        "run_id": run_id,
        "machine_id": MACHINE_ID,
        "created_at": now.isoformat(),
        "contents": {
            "report": "report.json",
            "program": "program.json",
            "images_dir": "images",
        },
    }

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
        bundle.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
        bundle.writestr("report.json", json.dumps(report, ensure_ascii=False, indent=2))
        bundle.writestr("program.json", json.dumps(program, ensure_ascii=False, indent=2))
        for record in ready_records:
            bundle.write(_capture_image_path(daily_dir, record), f"images/{record['filename']}")

    return f"{run_id}.zip", buffer.getvalue()


@router.get("/models")
async def list_capture_models():
    """
    Returns available model choices for Capture mode.
    """
    models = [{"id": "none", "name": "No model", "version": "-", "enabled": False}]
    for model in registry.list_models():
        if model["status"] != "valid":
            continue
        manifest = model["manifest"]
        runtime_compatible = model.get("runtime_compatible", manifest.get("format") == "hailo-hef")
        models.append({
            "id": model["model_id"],
            "name": f"{manifest['part_no']} {model['model_id']}",
            "version": manifest["version"],
            "part_no": manifest["part_no"],
            "format": manifest["format"],
            "enabled": MODEL_INFERENCE_ENABLED and runtime_compatible,
            "locked": not MODEL_INFERENCE_ENABLED or not runtime_compatible,
            "runtime_compatible": runtime_compatible,
        })
    return {"models": models, "active": registry.load_active(), "inference_enabled": MODEL_INFERENCE_ENABLED}

@router.post("/snap")
async def snap_image(part_no: str = "UNKNOWN", batch_no: str = "UNKNOWN", model_id: str = "none"):
    """
    Captures the current frame and records the Capture-mode result.
    """
    try:
        # 1. Get daily directory
        today, daily_dir, records_path = _daily_paths()
        os.makedirs(daily_dir, exist_ok=True)
        selected_model = _get_model(model_id) or _get_model("none")

        # 2. Capture frame
        camera.flush_buffer()
        frame = camera.get_latest_frame()

        if frame is None:
            raise HTTPException(status_code=500, detail="Failed to capture frame from camera")

        # 3. Generate filename with metadata
        timestamp = datetime.datetime.now().strftime("%H%M%S_%f")[:-3]
        filename = f"{part_no}_{batch_no}_{timestamp}.jpg"
        filepath = os.path.join(daily_dir, filename)

        # 4. Save to disk
        success = cv2.imwrite(filepath, frame)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to write image to disk")

        inference_result = {"result": None, "detections": []}
        if selected_model["enabled"]:
            inference_result = inference.predict_on_image(frame, model_id=selected_model["id"])

        record = {
            "id": filename.replace(".jpg", ""),
            "filename": filename,
            "url": f"/data/history/captures/{today}/{filename}",
            "captured_at": datetime.datetime.now().isoformat(timespec="seconds"),
            "part_no": part_no,
            "batch_no": batch_no,
            "model_id": selected_model["id"],
            "model_name": selected_model["name"] if selected_model["enabled"] else None,
            "model_version": selected_model["version"] if selected_model["enabled"] else None,
            "model_result": inference_result["result"],
            "detections": inference_result["detections"],
            "top_detection": _top_detection(inference_result["detections"]),
            "manual_result": None,
            "recognition_error": False,
            "export_ready": False,
        }
        records = _load_records(records_path)
        records.insert(0, record)
        _save_records(records_path, records)

        return {
            "status": "success",
            "capture": record,
            "path": filepath,
            "saved_at": time.time(),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list")
async def list_captures():
    """
    Returns a list of all images captured today.
    """
    today, daily_dir, records_path = _daily_paths()

    if not os.path.exists(daily_dir):
        return {"images": []}

    records_file_exists = os.path.exists(records_path)
    records = _load_records(records_path)
    known_files = {record["filename"] for record in records}

    if not records_file_exists:
        # Include legacy captures that were created before captures.json existed.
        files = [f for f in os.listdir(daily_dir) if f.endswith(".jpg")]
        files.sort(reverse=True)
        for f in files:
            if f in known_files:
                continue
            records.append({
                "id": f.replace(".jpg", ""),
                "filename": f,
                "url": f"/data/history/captures/{today}/{f}",
                "captured_at": None,
                "part_no": None,
                "batch_no": None,
                "model_id": "none",
                "model_name": None,
                "model_version": None,
                "model_result": None,
                "detections": [],
                "top_detection": None,
                "manual_result": None,
                "recognition_error": False,
                "export_ready": False,
            })

    return {"images": records}

@router.get("/count")
async def get_capture_count():
    """
    Returns the total number of images captured today.
    """
    today = datetime.datetime.now().strftime("%Y%m%d")
    daily_dir = os.path.join(CAPTURE_BASE_DIR, today)

    if not os.path.exists(daily_dir):
        return {"count": 0}

    files = [f for f in os.listdir(daily_dir) if f.endswith('.jpg')]
    return {"count": len(files)}


@router.post("/{capture_id}/manual_result")
async def update_manual_result(capture_id: str, result: Literal["OK", "NG"]):
    """
    Stores manual OK/NG judgement and recognition error status.
    """
    _, _, records_path = _daily_paths()
    records = _load_records(records_path)
    for record in records:
        if record["id"] == capture_id:
            record["manual_result"] = result
            record["recognition_error"] = bool(record["model_result"] and record["model_result"] != result)
            record["export_ready"] = True
            _save_records(records_path, records)
            return {"status": "success", "capture": record}
    raise HTTPException(status_code=404, detail="Capture record not found")


@router.patch("/{capture_id}/metadata")
async def update_capture_metadata(capture_id: str, payload: CaptureMetadataUpdate):
    """
    Updates Capture metadata and reruns inference when the model changes.
    """
    _, daily_dir, records_path = _daily_paths()
    records = _load_records(records_path)
    for record in records:
        if record["id"] != capture_id:
            continue

        if payload.part_no is not None:
            record["part_no"] = payload.part_no or "NA"
        if payload.batch_no is not None:
            record["batch_no"] = payload.batch_no or "NA"
        if payload.model_id is not None and payload.model_id != record.get("model_id"):
            selected_model = _get_model(payload.model_id)
            if not selected_model:
                raise HTTPException(status_code=400, detail="Unknown model")

            record["model_id"] = selected_model["id"]
            record["model_name"] = selected_model["name"] if selected_model["enabled"] else None
            record["model_version"] = selected_model["version"] if selected_model["enabled"] else None
            record["model_result"] = None
            record["detections"] = []
            record["top_detection"] = None

            if selected_model["enabled"]:
                image_path = _capture_image_path(daily_dir, record)
                image = cv2.imread(image_path)
                if image is None:
                    raise HTTPException(status_code=404, detail="Capture image file not found")
                inference_result = inference.predict_on_image(image, model_id=selected_model["id"])
                record["model_result"] = inference_result["result"]
                record["detections"] = inference_result["detections"]
                record["top_detection"] = _top_detection(inference_result["detections"])

            record["recognition_error"] = bool(
                record.get("manual_result") and record.get("model_result") and record["manual_result"] != record["model_result"]
            )

        _save_records(records_path, records)
        return {"status": "success", "capture": record}

    raise HTTPException(status_code=404, detail="Capture record not found")


@router.get("/export")
async def export_capture_project():
    """
    Exports today's Capture records as a project dataset manifest.
    """
    today, _, records_path = _daily_paths()
    records = _load_records(records_path)
    ready_records = _ready_records(records)
    return {
        "project": "capture-mode",
        "date": today,
        "total": len(records),
        "ready_for_training": len(ready_records),
        "recognition_errors": len([record for record in records if record.get("recognition_error")]),
        "bundle_format": "training-host-import-run-v1",
        "bundle_contents": ["manifest.json", "report.json", "program.json", "images/"],
        "transfer": "usb",
        "captures": records,
    }


@router.get("/export/bundle")
async def export_capture_bundle():
    """
    Exports ready Capture records as a Training Host import bundle.
    """
    today, daily_dir, records_path = _daily_paths()
    records = _load_records(records_path)
    filename, content = _build_training_host_bundle(today, daily_dir, records)
    return Response(
        content=content,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/list")
async def clear_capture_list():
    """
    Clears today's Capture list records without deleting captured image files.
    """
    _, daily_dir, records_path = _daily_paths()
    os.makedirs(daily_dir, exist_ok=True)
    _save_records(records_path, [])
    return {"status": "success", "cleared": True, "deleted_images": False}
