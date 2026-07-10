import json
import tempfile
import unittest
from pathlib import Path

from app.repositories.edge_sync_repository import (
    EdgeConfigurationError,
    EdgeDeviceRepository,
)


class EdgeDeviceRepositoryTests(unittest.TestCase):
    def test_missing_configuration_returns_empty_list(self):
        with tempfile.TemporaryDirectory() as tmp:
            repository = EdgeDeviceRepository(Path(tmp) / "missing.json")

            self.assertEqual(repository.list_devices(), [])

    def test_configuration_loads_device_array(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            config_path = root / "devices.json"
            config_path.write_text(
                json.dumps(
                    [
                        {
                            "device_id": "edge-a",
                            "name": "Edge A",
                            "host": "pi-a.example.test",
                            "port": 22,
                            "user": "aoi",
                            "identity_file": str(root / "key"),
                            "known_hosts_file": str(root / "known_hosts"),
                        }
                    ]
                ),
                encoding="utf-8",
            )

            devices = EdgeDeviceRepository(config_path).list_devices()

            self.assertEqual(len(devices), 1)
            self.assertEqual(devices[0].device_id, "edge-a")

    def test_duplicate_device_ids_are_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            config_path = root / "devices.json"
            device = {
                "device_id": "edge-a",
                "name": "Edge A",
                "host": "pi-a.example.test",
                "port": 22,
                "user": "aoi",
                "identity_file": str(root / "key"),
                "known_hosts_file": str(root / "known_hosts"),
            }
            config_path.write_text(json.dumps([device, device]), encoding="utf-8")

            with self.assertRaises(EdgeConfigurationError):
                EdgeDeviceRepository(config_path).list_devices()


if __name__ == "__main__":
    unittest.main()
