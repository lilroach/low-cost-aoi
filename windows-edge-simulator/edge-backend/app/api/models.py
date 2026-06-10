import os
from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.config import MODEL_INFERENCE_ENABLED
from app.model_registry import ModelRegistryError, registry


router = APIRouter()


@router.get("")
async def list_models():
    return {
        **registry.snapshot(),
        "inference_enabled": MODEL_INFERENCE_ENABLED,
    }


@router.get("/active")
async def get_active_models():
    return {"active": registry.load_active(), "inference_enabled": MODEL_INFERENCE_ENABLED}


@router.post("/refresh")
async def refresh_models():
    return {
        **registry.refresh(),
        "inference_enabled": MODEL_INFERENCE_ENABLED,
    }


@router.post("/install")
async def install_model_bundle(bundle: UploadFile = File(...)):
    if not bundle.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Model bundle must be a .zip file")

    tmp_name = None
    try:
        with NamedTemporaryFile(delete=False, suffix=".zip") as tmp:
            tmp_name = tmp.name
            while chunk := await bundle.read(1024 * 1024):
                tmp.write(chunk)

        model = registry.install_zip(Path(tmp_name))
        return {
            "status": "installed",
            "model": model,
            "inference_enabled": MODEL_INFERENCE_ENABLED,
            "activation_required": True,
        }
    except ModelRegistryError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        if tmp_name and os.path.exists(tmp_name):
            os.unlink(tmp_name)


@router.post("/{model_id}/activate")
async def activate_model(model_id: str):
    try:
        return {
            "status": "active-record-updated",
            "runtime_loaded": False,
            "locked": not MODEL_INFERENCE_ENABLED,
            **registry.activate(model_id),
        }
    except ModelRegistryError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
