import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

from app.schemas.edge_sync import EdgeDeviceConfig
from app.services.ssh_edge_service import EdgeConnectionError, SshEdgeClient


class SshRedactionTests(unittest.TestCase):
    def test_connection_error_redacts_private_key_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            key = root / "secret-edge-key"
            known_hosts = root / "known_hosts"
            device = EdgeDeviceConfig(
                device_id="edge-a",
                name="Edge A",
                host="pi-a.example.test",
                user="aoi",
                identity_file=key,
                known_hosts_file=known_hosts,
            )
            runner = Mock(
                return_value=subprocess.CompletedProcess(
                    args=[],
                    returncode=255,
                    stdout=b"",
                    stderr=f"Identity file {key} not accessible".encode(),
                )
            )

            with self.assertRaises(EdgeConnectionError) as context:
                SshEdgeClient(device, runner=runner).read_json("health")

            self.assertNotIn(str(key), str(context.exception))
            self.assertIn("[identity-file]", str(context.exception))


if __name__ == "__main__":
    unittest.main()
