import tempfile
import unittest
from pathlib import Path

from fastapi import HTTPException

from app.repositories.edge_sync_state_repository import EdgeSyncStateRepository
from app.services.edge_sync_service import EdgeSyncService


class EmptyDeviceRepository:
    def list_devices(self):
        return []

    def get_device(self, device_id: str):
        raise KeyError(device_id)


class EdgeSyncUnknownDeviceTests(unittest.TestCase):
    def test_unknown_device_does_not_leave_sync_lock_held(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            service = EdgeSyncService(
                device_repository=EmptyDeviceRepository(),
                state_repository=EdgeSyncStateRepository(root / "state"),
                imported_runs_dir=root / "imported",
                raw_dir=root / "raw",
                temp_dir=root / "tmp",
            )

            for unused in range(2):
                with self.assertRaises(HTTPException) as context:
                    service.sync("missing")
                self.assertEqual(context.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
