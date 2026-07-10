from fastapi import APIRouter, UploadFile, File, Form, HTTPException
import shutil
import os
import json
import zipfile
import subprocess
import sys
import re
from pathlib import Path
from typing import Any, Dict, List
from app.services.run_import_service import import_run_bundle_file



router = APIRouter(prefix="/datasets", tags=["datasets"])


def _default_app_root() -> Path:
    docker_root = Path("/app")
    if os.name != "nt" and ((docker_root / "app").exists() or (docker_root / "data").exists()):
        return docker_root
    current_file = Path(__file__).resolve()
    if current_file.parents[2].name == "backend":
        return current_file.parents[3]
    return current_file.parents[2]


APP_ROOT = Path(os.getenv("AOI_TRAINING_APP_ROOT", str(_default_app_root())))
DATA_DIR = Path(os.getenv("AOI_TRAINING_DATA_DIR", str(APP_ROOT / "data")))
MODELS_DIR = Path(os.getenv("AOI_TRAINING_MODELS_DIR", str(APP_ROOT / "models")))
LEGACY_TRAINING_RUNS_DIR = APP_ROOT.parent / "runs" / "models" / "training-runs"
RAW_DIR = DATA_DIR / "raw"
IMPORTED_RUNS_DIR = DATA_DIR / "imported_runs"
TRAINING_DATASETS_DIR = DATA_DIR / "datasets"
VALIDATION_DATASETS_DIR = DATA_DIR / "validation-datasets"
TRAINING_RUNS_DIR = MODELS_DIR / "training-runs"
VALIDATION_REPORTS_DIR = MODELS_DIR / "validation-reports"
IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".bmp")
YOLO_METADATA_FILES = {
    "classes.txt",
    "obj.names",
    "data.yaml",
    "data.yml",
    "train.txt",
    "val.txt",
    "valid.txt",
    "test.txt",
    "notes.json",
}

# Ensure directories exist
RAW_DIR.mkdir(parents=True, exist_ok=True)
IMPORTED_RUNS_DIR.mkdir(parents=True, exist_ok=True)


def _safe_child(root: Path, name: str) -> Path:
    if not name or Path(name).name != name:
        raise HTTPException(status_code=400, detail="Invalid item id")
    target = (root / name).resolve()
    root_resolved = root.resolve()
    if target != root_resolved and root_resolved not in target.parents:
        raise HTTPException(status_code=400, detail="Invalid item path")
    return target


def _safe_dataset_id(value: str) -> str:
    dataset_id = value.strip()
    if not re.fullmatch(r"[\w.-]+", dataset_id, flags=re.ASCII):
        raise HTTPException(status_code=400, detail="dataset_id may only contain letters, numbers, _, ., and -")
    return dataset_id


def _image_count(path: Path) -> int:
    image_dir = path / "images"
    if not image_dir.exists():
        return 0
    return len([file for file in image_dir.iterdir() if file.is_file() and file.suffix.lower() in (".png", ".jpg", ".jpeg", ".bmp")])


def _label_count(path: Path) -> int:
    label_dir = path / "labels"
    if not label_dir.exists():
        return 0
    return len([file for file in label_dir.iterdir() if file.is_file() and file.suffix.lower() == ".txt"])


def _read_classes(path: Path) -> List[str]:
    classes_txt = path / "classes.txt"
    if classes_txt.exists():
        return [line.strip() for line in classes_txt.read_text(encoding="utf-8").splitlines() if line.strip()]
    data_yaml = path / "data.yaml"
    if not data_yaml.exists():
        return []
    classes: Dict[int, str] = {}
    for line in data_yaml.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if ":" not in stripped:
            continue
        key, value = stripped.split(":", 1)
        if key.strip().isdigit():
            classes[int(key.strip())] = value.strip().strip('"').strip("'")
    return [classes[index] for index in sorted(classes)]


def _write_data_yaml(dataset_dir: Path, classes: List[str]) -> None:
    names = "\n".join([f"  {index}: {name}" for index, name in enumerate(classes)])
    content = "\n".join([
        f"path: {dataset_dir.as_posix()}",
        "train: images",
        "val: images",
        "names:",
        names,
        "",
    ])
    (dataset_dir / "data.yaml").write_text(content, encoding="utf-8")


def _dataset_item(path: Path, category: str) -> Dict[str, Any]:
    return {
        "id": path.name,
        "category": category,
        "path": str(path),
        "updated_at": path.stat().st_mtime if path.exists() else None,
        "image_count": _image_count(path),
        "label_count": _label_count(path),
        "classes": _read_classes(path),
        "has_data_yaml": (path / "data.yaml").exists(),
        "has_classes_txt": (path / "classes.txt").exists(),
    }


def _training_run_item(path: Path) -> Dict[str, Any]:
    best_pt = path / "weights" / "best.pt"
    return {
        "id": path.name,
        "category": "training-runs",
        "path": str(path),
        "updated_at": path.stat().st_mtime,
        "has_best_model": best_pt.exists(),
        "best_model_path": str(best_pt) if best_pt.exists() else None,
        "has_results_csv": (path / "results.csv").exists(),
        "has_args_yaml": (path / "args.yaml").exists(),
    }


def _validation_report_item(path: Path) -> Dict[str, Any]:
    try:
        report = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        report = {}
    summary = report.get("summary", {})
    return {
        "id": path.stem,
        "category": "validation-reports",
        "path": str(path),
        "folder_path": str(path.parent),
        "updated_at": path.stat().st_mtime,
        "status": report.get("status"),
        "pass_rate": summary.get("pass_rate"),
        "ng_recall": summary.get("ng_recall"),
        "false_pass": summary.get("false_pass"),
        "false_reject": summary.get("false_reject"),
    }


def _deployable_model_item(path: Path) -> Dict[str, Any]:
    manifest_path = path / "manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception:
        manifest = {}
    weights = manifest.get("weights", "best.pt")
    return {
        "id": path.name,
        "category": "deployable-models",
        "path": str(path),
        "updated_at": path.stat().st_mtime,
        "model_id": manifest.get("model_id", path.name),
        "part_no": manifest.get("part_no"),
        "version": manifest.get("version"),
        "format": manifest.get("format"),
        "classes": manifest.get("classes", []),
        "has_manifest": manifest_path.exists(),
        "has_weights": (path / weights).exists(),
    }


def _open_path(path: Path) -> None:
    if not path.exists():
        raise HTTPException(status_code=404, detail="Folder not found")
    if path.is_file():
        path = path.parent
    open_folder_enabled = os.getenv("AOI_ENABLE_OPEN_FOLDER", "true" if os.name == "nt" else "false").lower()
    if open_folder_enabled not in ("1", "true", "yes", "on"):
        raise HTTPException(
            status_code=400,
            detail=f"Open folder is only available for local terminal deployments. Path: {path}",
        )
    if os.name == "nt":
        os.startfile(str(path))  # type: ignore[attr-defined]
    elif sys.platform == "darwin":
        subprocess.Popen(["open", str(path)])
    else:
        subprocess.Popen(["xdg-open", str(path)])



def _safe_extract_bundle(bundle: zipfile.ZipFile, destination: Path) -> None:
    destination = destination.resolve()
    for member in bundle.infolist():
        target = (destination / member.filename).resolve()
        if not str(target).startswith(str(destination)):
            raise HTTPException(status_code=400, detail="Bundle contains unsafe paths")
    bundle.extractall(destination)


def _collect_images(root: Path) -> List[Path]:
    return sorted([
        path for path in root.rglob("*")
        if path.is_file()
        and "__MACOSX" not in path.parts
        and path.suffix.lower() in IMAGE_EXTENSIONS
    ])


def _collect_label_files(root: Path) -> List[Path]:
    return sorted([
        path for path in root.rglob("*.txt")
        if path.is_file()
        and "__MACOSX" not in path.parts
        and path.name not in YOLO_METADATA_FILES
    ])


def _read_yolo_classes(root: Path, label_files: List[Path]) -> List[str]:
    for name in ("classes.txt", "obj.names"):
        for path in sorted(root.rglob(name)):
            classes = [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
            if classes:
                return classes

    for name in ("data.yaml", "data.yml"):
        for path in sorted(root.rglob(name)):
            classes = _read_classes(path.parent)
            if classes:
                return classes

    class_ids = set()
    for label_path in label_files:
        for line in label_path.read_text(encoding="utf-8").splitlines():
            parts = line.strip().split()
            if not parts:
                continue
            try:
                class_ids.add(int(float(parts[0])))
            except ValueError:
                continue
    if not class_ids:
        return ["defect"]
    return [f"class_{index}" for index in range(max(class_ids) + 1)]


def _unique_by_stem(paths: List[Path], label: str) -> Dict[str, Path]:
    by_stem: Dict[str, Path] = {}
    duplicates = []
    for path in paths:
        stem = path.stem
        if stem in by_stem:
            duplicates.append(stem)
            continue
        by_stem[stem] = path
    if duplicates:
        raise HTTPException(status_code=400, detail=f"Duplicate {label} filename stems: {', '.join(sorted(set(duplicates))[:10])}")
    return by_stem

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


@router.post("/import-yolo")
async def import_yolo_dataset(
    dataset_id: str = Form(...),
    archive: UploadFile = File(...),
    overwrite: bool = Form(False),
):
    """
    Import a Label Studio / YOLO export zip into a training-ready YOLO dataset.
    The importer pairs images and labels by filename stem and generates data.yaml.
    """
    if not archive.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="YOLO export must be a .zip file")

    safe_dataset_id = _safe_dataset_id(dataset_id)
    safe_archive_name = Path(archive.filename).name
    tmp_path = IMPORTED_RUNS_DIR / f"labelstudio_upload_{os.getpid()}_{safe_archive_name}"
    extract_dir = IMPORTED_RUNS_DIR / f".labelstudio_import_{os.getpid()}_{safe_dataset_id}"
    dataset_dir = TRAINING_DATASETS_DIR / safe_dataset_id
    images_dir = dataset_dir / "images"
    labels_dir = dataset_dir / "labels"

    try:
        if extract_dir.exists():
            shutil.rmtree(extract_dir)
        extract_dir.mkdir(parents=True)

        with open(tmp_path, "wb") as buffer:
            shutil.copyfileobj(archive.file, buffer)

        with zipfile.ZipFile(tmp_path, "r") as zip_file:
            _safe_extract_bundle(zip_file, extract_dir)

        image_paths = _collect_images(extract_dir)
        if not image_paths:
            raise HTTPException(status_code=400, detail="YOLO export contains no images")

        label_paths = _collect_label_files(extract_dir)
        labels_by_stem = _unique_by_stem(label_paths, "label")
        _unique_by_stem(image_paths, "image")
        classes = _read_yolo_classes(extract_dir, label_paths)

        if dataset_dir.exists() and not overwrite:
            raise HTTPException(status_code=409, detail=f"Dataset already exists: {safe_dataset_id}")
        if dataset_dir.exists():
            shutil.rmtree(dataset_dir)
        images_dir.mkdir(parents=True)
        labels_dir.mkdir(parents=True)

        copied_images = []
        copied_labels = []
        missing_labels = []

        for image_path in image_paths:
            target_image = images_dir / image_path.name
            shutil.copyfile(image_path, target_image)
            copied_images.append(target_image.name)

            label_path = labels_by_stem.get(image_path.stem)
            if label_path:
                target_label = labels_dir / f"{image_path.stem}.txt"
                shutil.copyfile(label_path, target_label)
                copied_labels.append(target_label.name)
            else:
                missing_labels.append(image_path.name)

        (dataset_dir / "classes.txt").write_text("\n".join(classes) + "\n", encoding="utf-8")
        _write_data_yaml(dataset_dir, classes)

        return {
            "status": "imported",
            "dataset_id": safe_dataset_id,
            "dataset_path": str(dataset_dir),
            "image_count": len(copied_images),
            "label_count": len(copied_labels),
            "missing_label_count": len(missing_labels),
            "missing_labels": missing_labels[:50],
            "classes": classes,
            "data_yaml": str(dataset_dir / "data.yaml"),
        }
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=400, detail="Invalid zip archive") from exc
    finally:
        if tmp_path.exists():
            tmp_path.unlink()
        if extract_dir.exists():
            shutil.rmtree(extract_dir)


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

        return import_run_bundle_file(tmp_path, IMPORTED_RUNS_DIR, RAW_DIR)

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


@router.get("/inventory")
async def dataset_inventory():
    """
    List local Training Host assets grouped by workflow stage.
    """
    annotated = []
    if TRAINING_DATASETS_DIR.exists():
        annotated = [
            _dataset_item(path, "annotated-datasets")
            for path in sorted(TRAINING_DATASETS_DIR.iterdir())
            if path.is_dir() and (path / "images").exists()
        ]

    validation_datasets = []
    if VALIDATION_DATASETS_DIR.exists():
        validation_datasets = [
            _dataset_item(path, "validation-datasets")
            for path in sorted(VALIDATION_DATASETS_DIR.iterdir())
            if path.is_dir() and (path / "images").exists()
        ]

    training_runs = []
    seen_runs = set()
    for root in [TRAINING_RUNS_DIR, LEGACY_TRAINING_RUNS_DIR]:
        if not root.exists():
            continue
        for path in sorted(root.iterdir(), key=lambda item: item.stat().st_mtime, reverse=True):
            if path.is_dir() and path.name not in seen_runs:
                seen_runs.add(path.name)
                training_runs.append(_training_run_item(path))

    validation_reports = []
    if VALIDATION_REPORTS_DIR.exists():
        validation_reports = [
            _validation_report_item(path)
            for path in sorted(VALIDATION_REPORTS_DIR.glob("*.json"), key=lambda item: item.stat().st_mtime, reverse=True)
        ]

    deployable_models = []
    if MODELS_DIR.exists():
        deployable_models = [
            _deployable_model_item(path)
            for path in sorted(MODELS_DIR.iterdir())
            if path.is_dir() and (path / "manifest.json").exists()
        ]

    return {
        "groups": {
            "annotated_datasets": annotated,
            "training_runs": training_runs,
            "validation_reports": validation_reports,
            "validation_datasets": validation_datasets,
            "deployable_models": deployable_models,
        }
    }


@router.post("/open-folder/{category}/{item_id}")
async def open_inventory_folder(category: str, item_id: str):
    roots = {
        "annotated-datasets": TRAINING_DATASETS_DIR,
        "validation-datasets": VALIDATION_DATASETS_DIR,
        "training-runs": TRAINING_RUNS_DIR,
        "legacy-training-runs": LEGACY_TRAINING_RUNS_DIR,
        "deployable-models": MODELS_DIR,
    }

    if category == "validation-reports":
        report = _safe_child(VALIDATION_REPORTS_DIR, f"{item_id}.json")
        _open_path(report.parent)
        return {"status": "opened", "path": str(report.parent)}

    root = roots.get(category)
    if not root:
        raise HTTPException(status_code=400, detail="Unknown category")
    target = _safe_child(root, item_id)
    if category == "training-runs" and not target.exists():
        target = _safe_child(LEGACY_TRAINING_RUNS_DIR, item_id)
    _open_path(target)
    return {"status": "opened", "path": str(target)}


@router.get("/")
async def list_images():
    """
    List all uploaded images.
    """
    if not RAW_DIR.exists():
        return []

    images = [f.name for f in RAW_DIR.iterdir() if f.is_file()]
    return {"count": len(images), "images": images}
