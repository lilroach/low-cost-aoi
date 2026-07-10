import os
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

from app.repositories.edge_sync_repository import (
    EdgeConfigurationError,
    EdgeDeviceRepository,
)
from app.repositories.edge_sync_state_repository import EdgeSyncStateRepository
from app.schemas.edge_sync import EdgeSyncResult
from app.services.edge_sync_service import EdgeSyncService
from app.services.ssh_edge_service import EdgeConnectionError


router = APIRouter(prefix="/edges", tags=["edges"])

TRAINING_HOST_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = Path(
    os.environ.get("AOI_TRAINING_DATA_DIR", str(TRAINING_HOST_ROOT / "data"))
)

edge_sync_service = EdgeSyncService(
    device_repository=EdgeDeviceRepository(),
    state_repository=EdgeSyncStateRepository(DATA_DIR / "edge_sync"),
    imported_runs_dir=DATA_DIR / "imported_runs",
    raw_dir=DATA_DIR / "raw",
    temp_dir=DATA_DIR / "edge_sync_tmp",
)


def _configuration_error(exc: EdgeConfigurationError) -> HTTPException:
    return HTTPException(status_code=500, detail=str(exc))


@router.get("")
def list_edges() -> List[Dict[str, Any]]:
    try:
        return edge_sync_service.list_devices()
    except EdgeConfigurationError as exc:
        raise _configuration_error(exc) from exc


@router.post("/{device_id}/test")
def test_edge(device_id: str) -> Dict[str, Any]:
    try:
        return edge_sync_service.test_connection(device_id)
    except EdgeConfigurationError as exc:
        raise _configuration_error(exc) from exc
    except EdgeConnectionError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/{device_id}/sync")
def sync_edge(device_id: str) -> EdgeSyncResult:
    try:
        return edge_sync_service.sync(device_id)
    except EdgeConfigurationError as exc:
        raise _configuration_error(exc) from exc
    except EdgeConnectionError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/{device_id}/latest")
def latest_edge_snapshot(device_id: str) -> Dict[str, Any]:
    try:
        return edge_sync_service.latest(device_id)
    except EdgeConfigurationError as exc:
        raise _configuration_error(exc) from exc
