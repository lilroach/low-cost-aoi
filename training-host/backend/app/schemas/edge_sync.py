from pathlib import Path
from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field


class EdgeDeviceConfig(BaseModel):
    device_id: str = Field(pattern=r"^[A-Za-z0-9_.-]+$")
    name: str
    host: str
    port: int = Field(default=22, ge=1, le=65535)
    user: str
    identity_file: Path
    known_hosts_file: Path


class EdgeDevicePublic(BaseModel):
    device_id: str
    name: str
    host: str
    port: int


class SyncItem(BaseModel):
    source: str
    run_id: Optional[str] = None
    status: Literal["added", "skipped", "updated", "failed"]
    detail: str = ""


class EdgeSyncResult(BaseModel):
    device: EdgeDevicePublic
    synced_at: str
    counts: Dict[str, int]
    items: list[SyncItem]
    diagnostics: Dict[str, Any]
