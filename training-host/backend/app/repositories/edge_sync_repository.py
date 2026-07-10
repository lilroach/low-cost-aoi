import json
import os
from pathlib import Path
from typing import List

from pydantic import ValidationError

from app.schemas.edge_sync import EdgeDeviceConfig


class EdgeConfigurationError(ValueError):
    pass


def _default_config_path() -> Path:
    training_host_root = Path(__file__).resolve().parents[3]
    return Path(
        os.environ.get(
            "AOI_EDGE_DEVICES_FILE",
            str(training_host_root / "config" / "edge_devices.json"),
        )
    )


class EdgeDeviceRepository:
    def __init__(self, config_path: Path | None = None) -> None:
        self.config_path = config_path or _default_config_path()

    def list_devices(self) -> List[EdgeDeviceConfig]:
        if not self.config_path.exists():
            return []
        try:
            raw = json.loads(self.config_path.read_text(encoding="utf-8"))
            if not isinstance(raw, list):
                raise EdgeConfigurationError("Edge device configuration must be a JSON array")
            devices = [EdgeDeviceConfig.model_validate(item) for item in raw]
        except (json.JSONDecodeError, ValidationError) as exc:
            raise EdgeConfigurationError(f"Invalid Edge device configuration: {exc}") from exc

        device_ids = [device.device_id for device in devices]
        if len(device_ids) != len(set(device_ids)):
            raise EdgeConfigurationError("Edge device_id values must be unique")
        return devices

    def get_device(self, device_id: str) -> EdgeDeviceConfig:
        for device in self.list_devices():
            if device.device_id == device_id:
                return device
        raise KeyError(device_id)
