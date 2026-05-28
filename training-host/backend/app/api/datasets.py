from fastapi import APIRouter, UploadFile, File, HTTPException
import shutil
import os
import json
import zipfile
from pathlib import Path
from typing import Any, Dict, List

router = APIRouter(prefix="/datasets", tags=["datasets"])

DATA_DIR = Path("/app/data")
RAW_DIR = DATA_DIR / "raw"
IMPORTED_RUNS_DIR = DATA_DIR / "imported_runs"

# Ensure directories exist
RAW_DIR.mkdir(parents=True, exist_ok=True)
IMPORTED_RUNS_DIR.mkdir(parents=True, exist_ok=True)


def _require_keys(data: Dict[str, Any], keys: List[str], label: str) -> None:
    missing = [key for key in keys if key not in data]
    if missing:
        raise HTTPException(status_code=400, detail=f"{label} missing required keys: {', '.join(missing)}")


def _validate_report(report: Dict[str, Any]) -> None:
    _require_keys(report, ["metadata", "total_points", "results", "completed_at", "status"], "report.json")
    if not isinstance(report["results"], list):
        raise HTTPException(status_code=400, detail="report.json results must be a list")

    for result in report["results"]:
        _require_keys(result, ["point_id", "x", "y", "result", "detections", "image_path"], "result")
        if result["result"] not in ("OK", "NG"):
            raise HTTPException(status_code=400, detail="result must be OK or NG")
        if not isinstance(result["detections"], list):
            raise HTTPException(status_code=400, detail="detections must be a list")
        for detection in result["detections"]:
            _require_keys(detection, ["label", "confidence", "box"], "detection")
            if not isinstance(detection["box"], list) or len(detection["box"]) != 4:
                raise HTTPException(status_code=400, detail="detection box must be [x, y, w, h]")


def _validate_bundle_manifest(manifest: Dict[str, Any]) -> None:
    _require_keys(manifest, ["schema_version", "run_id", "machine_id", "created_at", "contents"], "manifest.json")
    if manifest["schema_version"] != "1.0":
        raise HTTPException(status_code=400, detail="Unsupported dataset bundle schema_version")

    contents = manifest["contents"]
    _require_keys(contents, ["report", "program", "images_dir"], "manifest contents")
    if contents["report"] != "report.json" or contents["program"] != "program.json" or contents["images_dir"] != "images":
        raise HTTPException(status_code=400, detail="Bundle contents must use report.json, program.json, and images/")


def _safe_extract_bundle(bundle: zipfile.ZipFile, destination: Path) -> None:
    destination = destination.resolve()
    for member in bundle.infolist():
        target = (destination / member.filename).resolve()
        if not str(target).startswith(str(destination)):
            raise HTTPException(status_code=400, detail="Bundle contains unsafe paths")
    bundle.extractall(destination)

@router.post("/upload")
async def upload_images(files: List[UploadFile] = File(...)):
    """
    Upload PCB images to the raw dataset folder.
    """
    uploaded_files = []

    for file in files:
        if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp')):
            continue

        file_path = RAW_DIR / file.filename

        # Save file
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            uploaded_files.append(file.filename)
        except Exception as e:
            print(f"Error saving {file.filename}: {e}")

    return {"uploaded": uploaded_files, "failed": []}


@router.post("/import-run")
async def import_run_bundle(bundle: UploadFile = File(...)):
    """
    Import one Edge inspection run bundle.
    Expected zip layout: manifest.json, report.json, program.json, images/.
    """
    if not bundle.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Bundle must be a .zip file")

    safe_name = Path(bundle.filename).name
    tmp_path = IMPORTED_RUNS_DIR / f"upload_{os.getpid()}_{safe_name}"
    try:
        with open(tmp_path, "wb") as buffer:
            shutil.copyfileobj(bundle.file, buffer)

        with zipfile.ZipFile(tmp_path, "r") as zip_file:
            names = set(zip_file.namelist())
            required = {"manifest.json", "report.json", "program.json"}
            missing = sorted(required - names)
            if missing:
                raise HTTPException(status_code=400, detail=f"Bundle missing files: {', '.join(missing)}")

            manifest = json.loads(zip_file.read("manifest.json"))
            report = json.loads(zip_file.read("report.json"))
            _validate_bundle_manifest(manifest)
            _validate_report(report)

            run_id = manifest["run_id"]
            run_dir = IMPORTED_RUNS_DIR / run_id
            if run_dir.exists():
                shutil.rmtree(run_dir)
            run_dir.mkdir(parents=True)
            _safe_extract_bundle(zip_file, run_dir)

            copied_images = []
            image_dir = run_dir / "images"
            if image_dir.exists():
                for image in image_dir.iterdir():
                    if image.is_file() and image.suffix.lower() in (".png", ".jpg", ".jpeg", ".bmp"):
                        target = RAW_DIR / f"{run_id}_{image.name}"
                        shutil.copyfile(image, target)
                        copied_images.append(target.name)

        return {
            "status": "imported",
            "run_id": run_id,
            "stored_at": str(run_dir),
            "raw_images": copied_images,
        }
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=400, detail="Invalid zip bundle") from exc
    finally:
        if tmp_path.exists():
            tmp_path.unlink()

@router.delete("/{filename}")
async def delete_image(filename: str):
    file_path = RAW_DIR / filename
    if file_path.exists():
        os.remove(file_path)
        return {"message": f"Deleted {filename}"}
    raise HTTPException(status_code=404, detail="File not found")

@router.get("/")
async def list_images():
    """
    List all uploaded images.
    """
    if not RAW_DIR.exists():
        return []

    images = [f.name for f in RAW_DIR.iterdir() if f.is_file()]
    return {"count": len(images), "images": images}
