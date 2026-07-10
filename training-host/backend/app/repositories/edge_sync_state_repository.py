import json
import re
from pathlib import Path
from typing import Any, Dict, List


SAFE_DEVICE_ID = re.compile(r"^[A-Za-z0-9_.-]+$")


class EdgeSyncStateRepository:
    def __init__(self, root: Path) -> None:
        self.root = root

    def _device_dir(self, device_id: str) -> Path:
        if not SAFE_DEVICE_ID.fullmatch(device_id):
            raise ValueError("Invalid device id")
        return self.root / device_id

    def load_latest(self, device_id: str) -> Dict[str, Any]:
        path = self._device_dir(device_id) / "latest.json"
        if not path.exists():
            return {}
        return json.loads(path.read_text(encoding="utf-8"))

    def versions(self, device_id: str, source_key: str) -> List[Dict[str, Any]]:
        latest = self.load_latest(device_id)
        return list(latest.get("sources", {}).get(source_key, []))

    def save_snapshot(self, device_id: str, snapshot: Dict[str, Any]) -> None:
        device_dir = self._device_dir(device_id)
        history_dir = device_dir / "history"
        history_dir.mkdir(parents=True, exist_ok=True)

        latest_path = device_dir / "latest.json"
        incoming_path = device_dir / ".latest.json.incoming"
        content = json.dumps(snapshot, ensure_ascii=False, indent=2)
        incoming_path.write_text(content, encoding="utf-8")
        incoming_path.replace(latest_path)

        timestamp = str(snapshot["synced_at"]).replace(":", "").replace("-", "")
        timestamp = timestamp.replace("+0000", "Z").replace("+00:00", "Z")
        (history_dir / f"{timestamp}.json").write_text(content, encoding="utf-8")
