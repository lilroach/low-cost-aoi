from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import asyncio
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

router = APIRouter(prefix="/training", tags=["training"])


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
DATASETS_DIR = DATA_DIR / "datasets"
VALIDATION_DATASETS_DIR = DATA_DIR / "validation-datasets"
MODELS_DIR = Path(os.getenv("AOI_TRAINING_MODELS_DIR", str(APP_ROOT / "models")))
TRAINING_RUNS_DIR = MODELS_DIR / "training-runs"
LEGACY_TRAINING_RUNS_DIR = APP_ROOT.parent / "runs" / "models" / "training-runs"


class TrainingConfig(BaseModel):
    dataset_id: str = "testv1"
    model_type: str = "yolo11n.pt"
    epochs: int = Field(default=50, ge=1, le=1000)
    batch_size: int = Field(default=8, ge=-1, le=1024)
    img_size: int = Field(default=640, ge=64, le=4096)
    run_name: str = Field(default="testv1-yolo11-smoke", min_length=1, max_length=80)


class BundleRequest(BaseModel):
    run_name: str
    dataset_id: str
    model_id: str
    part_no: str
    version: str = "v1"
    source_yolo_model: str = "yolo11n.pt"
    img_size: int = 640
    confidence_threshold: float = 0.25
    iou_threshold: float = 0.45


class ValidationRequest(BaseModel):
    model_ref: str
    validation_dataset_id: str
    confidence_threshold: float = Field(default=0.25, ge=0, le=1)
    iou_threshold: float = Field(default=0.45, ge=0, le=1)
    min_pass_rate: float = Field(default=0.9, ge=0, le=1)
    min_ng_recall: float = Field(default=0.95, ge=0, le=1)


def _safe_name(value: str, label: str) -> str:
    cleaned = value.strip()
    if not re.fullmatch(r"[\w.-]+", cleaned, flags=re.ASCII):
        raise HTTPException(status_code=400, detail=f"{label} may only contain letters, numbers, _, ., and -")
    return cleaned


def _ensure_inside(path: Path, root: Path, label: str) -> Path:
    resolved = path.resolve()
    root_resolved = root.resolve()
    if resolved != root_resolved and root_resolved not in resolved.parents:
        raise HTTPException(status_code=400, detail=f"Invalid {label}")
    return resolved


def _dataset_dir(dataset_id: str) -> Path:
    dataset_name = _safe_name(dataset_id, "dataset_id")
    return _ensure_inside(DATASETS_DIR / dataset_name, DATASETS_DIR, "dataset_id")


def _validation_dataset_dir(dataset_id: str) -> Path:
    dataset_name = _safe_name(dataset_id, "validation_dataset_id")
    return _ensure_inside(VALIDATION_DATASETS_DIR / dataset_name, VALIDATION_DATASETS_DIR, "validation_dataset_id")


def _run_dir(run_name: str) -> Path:
    run = _safe_name(run_name, "run_name")
    return _ensure_inside(TRAINING_RUNS_DIR / run, TRAINING_RUNS_DIR, "run_name")


def _training_run_roots() -> List[Path]:
    roots = [TRAINING_RUNS_DIR]
    if LEGACY_TRAINING_RUNS_DIR != TRAINING_RUNS_DIR:
        roots.append(LEGACY_TRAINING_RUNS_DIR)
    return roots


def _existing_run_dir(run_name: str) -> Path:
    run = _safe_name(run_name, "run_name")
    for root in _training_run_roots():
        candidate = _ensure_inside(root / run, root, "run_name")
        if candidate.exists():
            return candidate
    return _run_dir(run)


def _run_dataset_id(run_dir: Path) -> Optional[str]:
    args_path = run_dir / "args.yaml"
    if not args_path.exists():
        return None

    for line in args_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped.startswith("data:"):
            continue
        raw_data_path = stripped.split(":", 1)[1].strip().strip("\"'")
        if not raw_data_path:
            return None
        normalized = raw_data_path.replace("\\", "/")
        parts = [part for part in normalized.split("/") if part]
        if parts and parts[-1] in ("data.yaml", "data.yml") and len(parts) >= 2:
            return parts[-2]
        if parts:
            return parts[-1]
        return None
    return None


def _assert_run_dataset_matches_request(run_dir: Path, dataset_id: str) -> None:
    run_dataset_id = _run_dataset_id(run_dir)
    if run_dataset_id and run_dataset_id != dataset_id:
        raise HTTPException(
            status_code=400,
            detail=f"Selected run dataset ({run_dataset_id}) does not match requested dataset ({dataset_id})",
        )


def _model_bundle_dir(model_id: str) -> Path:
    safe_model_id = _safe_name(model_id, "model_id")
    return _ensure_inside(MODELS_DIR / safe_model_id, MODELS_DIR, "model_id")


def _read_classes(dataset_path: Path) -> List[str]:
    classes_txt = dataset_path / "classes.txt"
    if classes_txt.exists():
        return [line.strip() for line in classes_txt.read_text(encoding="utf-8").splitlines() if line.strip()]

    data_yaml = dataset_path / "data.yaml"
    if not data_yaml.exists():
        return []

    classes: Dict[int, str] = {}
    in_names = False
    for line in data_yaml.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped.startswith("names:"):
            in_names = True
            continue
        if in_names:
            match = re.match(r"(\d+):\s*[\"']?(.*?)[\"']?$", stripped)
            if match:
                classes[int(match.group(1))] = match.group(2)
            elif stripped and not stripped.startswith("#"):
                break
    return [classes[idx] for idx in sorted(classes)]


def _dataset_summary(dataset_path: Path) -> Dict[str, Any]:
    image_dir = dataset_path / "images"
    label_dir = dataset_path / "labels"
    image_count = len([p for p in image_dir.glob("*") if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".bmp")]) if image_dir.exists() else 0
    label_count = len([p for p in label_dir.glob("*.txt")]) if label_dir.exists() else 0
    return {
        "dataset_id": dataset_path.name,
        "path": str(dataset_path),
        "data_yaml": str(dataset_path / "data.yaml"),
        "has_data_yaml": (dataset_path / "data.yaml").exists(),
        "image_count": image_count,
        "label_count": label_count,
        "classes": _read_classes(dataset_path),
    }


def _is_validation_dataset(dataset_path: Path) -> bool:
    if not dataset_path.is_dir():
        return False
    if not (dataset_path / "images").exists():
        return False
    return (dataset_path / "data.yaml").exists() or (dataset_path / "classes.txt").exists()


def _read_yolo_label(label_path: Path) -> List[int]:
    if not label_path.exists():
        return []
    class_ids = []
    for line in label_path.read_text(encoding="utf-8").splitlines():
        parts = line.strip().split()
        if not parts:
            continue
        try:
            class_ids.append(int(float(parts[0])))
        except ValueError:
            continue
    return class_ids


def _resolve_validation_model(model_ref: str) -> Dict[str, Any]:
    if ":" not in model_ref:
        raise HTTPException(status_code=400, detail="model_ref must use run:<run_name> or bundle:<model_id>")
    source, raw_id = model_ref.split(":", 1)
    if source == "run":
        run_dir = _existing_run_dir(raw_id)
        weights_path = run_dir / "weights" / "best.pt"
        if not weights_path.exists():
            raise HTTPException(status_code=404, detail=f"Run best.pt not found: {raw_id}")
        return {
            "model_ref": model_ref,
            "source": "run",
            "id": raw_id,
            "weights_path": str(weights_path),
            "display_name": f"訓練 run: {raw_id}",
            "manifest": None,
        }
    if source == "bundle":
        bundle_dir = _model_bundle_dir(raw_id)
        manifest_path = bundle_dir / "manifest.json"
        if not manifest_path.exists():
            raise HTTPException(status_code=404, detail=f"Model bundle manifest not found: {raw_id}")
        with open(manifest_path, "r", encoding="utf-8") as file:
            manifest = json.load(file)
        weights_path = bundle_dir / manifest.get("weights", "best.pt")
        if not weights_path.exists():
            raise HTTPException(status_code=404, detail=f"Model bundle weights not found: {raw_id}")
        return {
            "model_ref": model_ref,
            "source": "bundle",
            "id": raw_id,
            "weights_path": str(weights_path),
            "display_name": f"模型包: {raw_id}",
            "manifest": manifest,
        }
    raise HTTPException(status_code=400, detail="model_ref must use run:<run_name> or bundle:<model_id>")


def _validate_model(request: ValidationRequest) -> Dict[str, Any]:
    model_info = _resolve_validation_model(request.model_ref)
    dataset_path = _validation_dataset_dir(request.validation_dataset_id)
    image_dir = dataset_path / "images"
    label_dir = dataset_path / "labels"
    if not image_dir.exists():
        raise HTTPException(status_code=400, detail=f"Validation dataset images folder not found: {image_dir}")
    if not (dataset_path / "data.yaml").exists() and not (dataset_path / "classes.txt").exists():
        raise HTTPException(status_code=400, detail="Validation dataset must contain data.yaml or classes.txt")

    image_paths = sorted([p for p in image_dir.glob("*") if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".bmp")])
    if not image_paths:
        raise HTTPException(status_code=400, detail="Validation dataset has no images")

    from ultralytics import YOLO

    model = YOLO(model_info["weights_path"])
    class_names = _read_classes(dataset_path)
    report_dir = MODELS_DIR / "validation-reports"
    report_dir.mkdir(parents=True, exist_ok=True)
    report_id = f"{model_info['source']}-{model_info['id']}-{request.validation_dataset_id}-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

    ok_total = 0
    ng_total = 0
    ok_correct = 0
    ng_detected = 0
    false_pass = 0
    false_reject = 0
    missing_label_files = 0
    class_stats: Dict[str, Dict[str, int]] = {}
    examples = []

    for image_path in image_paths:
        label_path = label_dir / f"{image_path.stem}.txt"
        if not label_path.exists():
            missing_label_files += 1
        truth_class_ids = _read_yolo_label(label_path)
        truth_is_ng = len(truth_class_ids) > 0
        if truth_is_ng:
            ng_total += 1
        else:
            ok_total += 1

        prediction = model.predict(
            source=str(image_path),
            conf=request.confidence_threshold,
            iou=request.iou_threshold,
            verbose=False,
        )[0]
        predicted_class_ids = []
        if prediction.boxes is not None and prediction.boxes.cls is not None:
            predicted_class_ids = [int(cls_id) for cls_id in prediction.boxes.cls.tolist()]
        predicted_is_ng = len(predicted_class_ids) > 0

        if not truth_is_ng and not predicted_is_ng:
            ok_correct += 1
            result = "OK 正確"
        elif truth_is_ng and predicted_is_ng:
            ng_detected += 1
            result = "NG 檢出"
        elif truth_is_ng and not predicted_is_ng:
            false_pass += 1
            result = "漏判"
        else:
            false_reject += 1
            result = "誤殺"

        for class_id in set(truth_class_ids):
            class_name = class_names[class_id] if 0 <= class_id < len(class_names) else str(class_id)
            class_stats.setdefault(class_name, {"truth": 0, "detected": 0})
            class_stats[class_name]["truth"] += 1
            if class_id in predicted_class_ids:
                class_stats[class_name]["detected"] += 1

        if result in ("漏判", "誤殺") and len(examples) < 30:
            examples.append({
                "image": image_path.name,
                "result": result,
                "truth": "NG" if truth_is_ng else "OK",
                "prediction": "NG" if predicted_is_ng else "OK",
                "truth_classes": [
                    class_names[class_id] if 0 <= class_id < len(class_names) else str(class_id)
                    for class_id in sorted(set(truth_class_ids))
                ],
                "predicted_classes": [
                    class_names[class_id] if 0 <= class_id < len(class_names) else str(class_id)
                    for class_id in sorted(set(predicted_class_ids))
                ],
            })

    total = len(image_paths)
    correct = ok_correct + ng_detected
    pass_rate = correct / total if total else 0
    ok_accuracy = ok_correct / ok_total if ok_total else None
    ng_recall = ng_detected / ng_total if ng_total else None
    passed = pass_rate >= request.min_pass_rate and (ng_recall is None or ng_recall >= request.min_ng_recall)

    for stats in class_stats.values():
        stats["recall"] = round(stats["detected"] / stats["truth"], 4) if stats["truth"] else 0

    report = {
        "report_id": report_id,
        "created_at": datetime.now().astimezone().isoformat(),
        "status": "passed" if passed else "failed",
        "model": model_info,
        "validation_dataset": _dataset_summary(dataset_path),
        "thresholds": {
            "confidence": request.confidence_threshold,
            "iou": request.iou_threshold,
            "min_pass_rate": request.min_pass_rate,
            "min_ng_recall": request.min_ng_recall,
        },
        "summary": {
            "total": total,
            "correct": correct,
            "pass_rate": round(pass_rate, 4),
            "ok_total": ok_total,
            "ok_correct": ok_correct,
            "ok_accuracy": round(ok_accuracy, 4) if ok_accuracy is not None else None,
            "ng_total": ng_total,
            "ng_detected": ng_detected,
            "ng_recall": round(ng_recall, 4) if ng_recall is not None else None,
            "false_pass": false_pass,
            "false_reject": false_reject,
            "missing_label_files": missing_label_files,
        },
        "class_stats": class_stats,
        "examples": examples,
    }
    report_path = report_dir / f"{report_id}.json"
    with open(report_path, "w", encoding="utf-8") as file:
        json.dump(report, file, ensure_ascii=False, indent=2)
    report["report_path"] = str(report_path)
    return report


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class TrainingManager:
    def __init__(self):
        self.is_running = False
        self.current_epoch = 0
        self.total_epochs = 0
        self.progress = 0.0
        self.metrics = {"loss": [], "map50": []}
        self.logs: List[str] = []
        self.active_websockets: List[WebSocket] = []
        self._lock = threading.RLock()
        self._thread: Optional[threading.Thread] = None
        self._process: Optional[subprocess.Popen[str]] = None
        self.current_run: Optional[Dict[str, Any]] = None

    async def connect_websocket(self, websocket: WebSocket):
        await websocket.accept()
        self.active_websockets.append(websocket)

    def disconnect_websocket(self, websocket: WebSocket):
        if websocket in self.active_websockets:
            self.active_websockets.remove(websocket)

    async def broadcast(self, message: str, event_type: str = "info"):
        payload = {
            "type": event_type,
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "message": message,
            "is_running": self.is_running,
            "progress": self.progress,
            "current_epoch": self.current_epoch,
            "total_epochs": self.total_epochs,
            "metrics": self.metrics,
            "current_run": self.current_run,
        }
        for ws in list(self.active_websockets):
            try:
                await ws.send_text(json.dumps(payload, ensure_ascii=False))
            except Exception:
                self.disconnect_websocket(ws)

    def _append_log(self, message: str, event_type: str = "log"):
        line = f"[{datetime.now().strftime('%H:%M:%S')}] {message}"
        with self._lock:
            self.logs = [*self.logs, line]
        asyncio.run(self.broadcast(message, event_type))

    def _update_epoch_from_line(self, line: str):
        match = re.search(r"^\s*(\d+)/(\d+)\s+", line)
        if not match:
            return
        self.current_epoch = int(match.group(1))
        self.total_epochs = int(match.group(2))
        self.progress = round((self.current_epoch / max(self.total_epochs, 1)) * 100, 1)

    def _read_results_csv(self, run_dir: Path):
        results_csv = run_dir / "results.csv"
        if not results_csv.exists():
            return
        try:
            rows = results_csv.read_text(encoding="utf-8").splitlines()
            if len(rows) < 2:
                return
            header = [h.strip() for h in rows[0].split(",")]
            loss_idx = header.index("train/box_loss") if "train/box_loss" in header else None
            map_idx = header.index("metrics/mAP50(B)") if "metrics/mAP50(B)" in header else None
            loss_values = []
            map_values = []
            for row in rows[1:]:
                cols = [c.strip() for c in row.split(",")]
                if loss_idx is not None and len(cols) > loss_idx:
                    loss_values.append(float(cols[loss_idx]))
                if map_idx is not None and len(cols) > map_idx:
                    map_values.append(float(cols[map_idx]))
            self.metrics = {"loss": loss_values, "map50": map_values}
        except Exception:
            return

    def _run_training(self, config: TrainingConfig, data_yaml: Path, run_dir: Path):
        command = [
            sys.executable,
            "-c",
            (
                "from ultralytics import YOLO; "
                f"model = YOLO({config.model_type!r}); "
                "model.train("
                f"data={str(data_yaml)!r}, "
                f"epochs={config.epochs}, "
                f"imgsz={config.img_size}, "
                f"batch={config.batch_size}, "
                f"project={str(TRAINING_RUNS_DIR)!r}, "
                f"name={config.run_name!r}, "
                "exist_ok=True)"
            ),
        ]
        env = {**os.environ, "PYTHONIOENCODING": "utf-8"}

        with self._lock:
            self.is_running = True
            self.current_epoch = 0
            self.total_epochs = config.epochs
            self.progress = 0.0
            self.metrics = {"loss": [], "map50": []}
            self.logs = []
            self.current_run = {
                "run_name": config.run_name,
                "dataset_id": config.dataset_id,
                "model_type": config.model_type,
                "run_path": str(run_dir),
                "best_model_path": str(run_dir / "weights" / "best.pt"),
                "status": "running",
                "started_at": datetime.now(timezone.utc).isoformat(),
            }

        command_line = subprocess.list2cmdline(command)
        terminal_block = "\n".join([
            "========== AOI Training Host 終端機訓練 ==========",
            f"工作目錄: {APP_ROOT}",
            f"資料集: {data_yaml}",
            f"輸出目錄: {run_dir}",
            f"基礎模型: {config.model_type}",
            f"訓練輪數: {config.epochs}",
            f"影像尺寸: {config.img_size}",
            f"批次大小: {config.batch_size}",
            "實際執行指令:",
            command_line,
            "=================================================",
        ])
        self._append_log(terminal_block, "command")

        try:
            self._process = subprocess.Popen(
                command,
                cwd=str(APP_ROOT),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
            )

            assert self._process.stdout is not None
            for line in self._process.stdout:
                clean_line = line.rstrip()
                if clean_line:
                    self._update_epoch_from_line(clean_line)
                    self._append_log(clean_line, "log")

            return_code = self._process.wait()
            self._read_results_csv(run_dir)
            best_path = run_dir / "weights" / "best.pt"
            with self._lock:
                if self.current_run:
                    self.current_run["finished_at"] = datetime.now(timezone.utc).isoformat()
                    self.current_run["best_model_path"] = str(best_path)
                    self.current_run["status"] = "completed" if return_code == 0 and best_path.exists() else "failed"
                self.progress = 100.0 if return_code == 0 else self.progress

            if return_code == 0 and best_path.exists():
                self._append_log(f"Training completed. best.pt: {best_path}", "success")
            elif return_code == -15:
                self._append_log("Training stopped by user.", "warning")
            else:
                self._append_log(f"Training failed with exit code {return_code}.", "error")
        except Exception as exc:
            with self._lock:
                if self.current_run:
                    self.current_run["status"] = "failed"
                    self.current_run["finished_at"] = datetime.now(timezone.utc).isoformat()
            self._append_log(f"Training failed: {exc}", "error")
        finally:
            with self._lock:
                self.is_running = False
                self._process = None
                self._thread = None
            asyncio.run(self.broadcast("Training job finished.", "status"))

    def start_training(self, config: TrainingConfig):
        if self.is_running:
            return False, "Training is already in progress"

        dataset_path = _dataset_dir(config.dataset_id)
        data_yaml = dataset_path / "data.yaml"
        if not data_yaml.exists():
            raise HTTPException(status_code=400, detail=f"Dataset data.yaml not found: {data_yaml}")

        run_dir = _run_dir(config.run_name)
        TRAINING_RUNS_DIR.mkdir(parents=True, exist_ok=True)
        self._thread = threading.Thread(target=self._run_training, args=(config, data_yaml, run_dir), daemon=True)
        self._thread.start()
        return True, "Training started"

    def stop_training(self):
        if not self.is_running:
            return False, "No active training found"
        if self._process and self._process.poll() is None:
            self._process.terminate()
        return True, "Stopping training..."

    def status(self) -> Dict[str, Any]:
        return {
            "is_running": self.is_running,
            "progress": self.progress,
            "current_epoch": self.current_epoch,
            "total_epochs": self.total_epochs,
            "metrics": self.metrics,
            "logs": self.logs,
            "current_run": self.current_run,
        }


manager = TrainingManager()


@router.get("/datasets")
async def list_training_datasets():
    DATASETS_DIR.mkdir(parents=True, exist_ok=True)
    datasets = []
    for dataset_path in sorted(DATASETS_DIR.iterdir()):
        if dataset_path.is_dir() and (dataset_path / "data.yaml").exists():
            datasets.append(_dataset_summary(dataset_path))
    return {"datasets": datasets}


@router.get("/validation-datasets")
async def list_validation_datasets():
    VALIDATION_DATASETS_DIR.mkdir(parents=True, exist_ok=True)
    datasets = []
    for dataset_path in sorted(VALIDATION_DATASETS_DIR.iterdir()):
        if _is_validation_dataset(dataset_path):
            datasets.append(_dataset_summary(dataset_path))
    return {"datasets": datasets}


@router.get("/validation-models")
async def list_validation_models():
    models = []
    seen_runs = set()
    for root in _training_run_roots():
        root.mkdir(parents=True, exist_ok=True)
        for run_path in sorted(root.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
            if not run_path.is_dir() or run_path.name in seen_runs:
                continue
            best_path = run_path / "weights" / "best.pt"
            if best_path.exists():
                seen_runs.add(run_path.name)
                models.append({
                    "model_ref": f"run:{run_path.name}",
                    "source": "run",
                    "id": run_path.name,
                    "name": f"訓練 run：{run_path.name}",
                    "weights_path": str(best_path),
                })

    if MODELS_DIR.exists():
        for model_dir in sorted(MODELS_DIR.iterdir()):
            manifest_path = model_dir / "manifest.json"
            if not model_dir.is_dir() or not manifest_path.exists():
                continue
            try:
                with open(manifest_path, "r", encoding="utf-8") as file:
                    manifest = json.load(file)
            except Exception:
                manifest = {}
            weights_name = manifest.get("weights", "best.pt")
            weights_path = model_dir / weights_name
            if weights_path.exists():
                models.append({
                    "model_ref": f"bundle:{model_dir.name}",
                    "source": "bundle",
                    "id": model_dir.name,
                    "name": f"模型包：{model_dir.name}",
                    "weights_path": str(weights_path),
                    "part_no": manifest.get("part_no"),
                    "version": manifest.get("version"),
                })
    return {"models": models}


@router.post("/start")
async def start_training(config: TrainingConfig):
    config.run_name = _safe_name(config.run_name, "run_name")
    success, msg = manager.start_training(config)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"status": "started", "message": msg, "config": config.model_dump()}


@router.post("/stop")
async def stop_training():
    success, msg = manager.stop_training()
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"status": "stopping", "message": msg}


@router.get("/status")
async def get_status():
    return manager.status()


@router.post("/validate")
async def validate_model(request: ValidationRequest):
    return _validate_model(request)


@router.get("/runs")
async def list_training_runs():
    runs = []
    seen_runs = set()
    for root in _training_run_roots():
        root.mkdir(parents=True, exist_ok=True)
        for run_path in sorted(root.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
            if not run_path.is_dir() or run_path.name in seen_runs:
                continue
            seen_runs.add(run_path.name)
            best_path = run_path / "weights" / "best.pt"
            args_path = run_path / "args.yaml"
            runs.append({
                "run_name": run_path.name,
                "run_path": str(run_path),
                "dataset_id": _run_dataset_id(run_path),
                "best_model_path": str(best_path) if best_path.exists() else None,
                "has_best_model": best_path.exists(),
                "args_path": str(args_path) if args_path.exists() else None,
                "updated_at": datetime.fromtimestamp(run_path.stat().st_mtime).isoformat(),
            })
    return {"runs": runs}


@router.post("/package")
async def package_model_bundle(request: BundleRequest):
    model_id = _safe_name(request.model_id, "model_id")
    run_dir = _existing_run_dir(request.run_name)
    best_path = run_dir / "weights" / "best.pt"
    if not best_path.exists():
        raise HTTPException(status_code=404, detail=f"best.pt not found for run: {request.run_name}")

    dataset_path = _dataset_dir(request.dataset_id)
    _assert_run_dataset_matches_request(run_dir, request.dataset_id)
    classes = _read_classes(dataset_path)
    if not classes:
        raise HTTPException(status_code=400, detail="Dataset classes not found")

    bundle_dir = _ensure_inside(MODELS_DIR / model_id, MODELS_DIR, "model_id")
    bundle_dir.mkdir(parents=True, exist_ok=True)
    target_weights = bundle_dir / "best.pt"
    shutil.copyfile(best_path, target_weights)

    manifest = {
        "model_id": model_id,
        "part_no": request.part_no,
        "version": request.version,
        "format": "ultralytics-pt",
        "source_yolo_model": request.source_yolo_model,
        "weights": "best.pt",
        "weights_sha256": _sha256(target_weights),
        "classes": classes,
        "input_size": [request.img_size, request.img_size],
        "postprocess": {
            "type": "yolo11",
            "confidence_threshold": request.confidence_threshold,
            "iou_threshold": request.iou_threshold,
        },
        "training": {
            "run_name": request.run_name,
            "dataset_id": request.dataset_id,
            "source_best_pt": str(best_path),
        },
        "created_at": datetime.now().astimezone().isoformat(),
    }
    with open(bundle_dir / "manifest.json", "w", encoding="utf-8") as file:
        json.dump(manifest, file, ensure_ascii=False, indent=2)

    return {"status": "packaged", "model_id": model_id, "bundle_path": str(bundle_dir), "manifest": manifest}


@router.get("/models")
async def list_model_bundles():
    models = []
    if not MODELS_DIR.exists():
        return {"models": models}

    for model_dir in sorted(MODELS_DIR.iterdir()):
        manifest_path = model_dir / "manifest.json"
        if not model_dir.is_dir() or not manifest_path.exists():
            continue
        try:
            with open(manifest_path, "r", encoding="utf-8") as file:
                manifest = json.load(file)
        except Exception:
            manifest = {"model_id": model_dir.name}
        weights_name = manifest.get("weights", "best.pt")
        models.append({
            "model_id": manifest.get("model_id", model_dir.name),
            "part_no": manifest.get("part_no"),
            "version": manifest.get("version"),
            "format": manifest.get("format"),
            "source_yolo_model": manifest.get("source_yolo_model"),
            "weights": weights_name,
            "has_weights": (model_dir / weights_name).exists(),
            "created_at": manifest.get("created_at"),
        })
    return {"models": models}


@router.get("/models/{model_id}/download")
async def download_model_bundle(model_id: str):
    safe_model_id = _safe_name(model_id, "model_id")
    model_dir = _ensure_inside(MODELS_DIR / safe_model_id, MODELS_DIR, "model_id")

    manifest_path = model_dir / "manifest.json"
    if not manifest_path.exists():
        raise HTTPException(status_code=404, detail="Model bundle not found")

    with open(manifest_path, "r", encoding="utf-8") as file:
        manifest = json.load(file)
    weights_path = model_dir / manifest.get("weights", "best.pt")
    if not weights_path.exists():
        raise HTTPException(status_code=404, detail="Model weights not found")

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
        bundle.write(manifest_path, "manifest.json")
        bundle.write(weights_path, manifest.get("weights", "best.pt"))
        labels_path = model_dir / "labels.txt"
        classes_path = model_dir / "classes.json"
        if labels_path.exists():
            bundle.write(labels_path, "labels.txt")
        if classes_path.exists():
            bundle.write(classes_path, "classes.json")
    buffer.seek(0)

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={safe_model_id}.zip"},
    )


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect_websocket(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_websocket(websocket)
