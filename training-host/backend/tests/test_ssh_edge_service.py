import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

from app.schemas.edge_sync import EdgeDeviceConfig
from app.services.ssh_edge_service import EdgeConnectionError, SshEdgeClient


def _device(root: Path) -> EdgeDeviceConfig:
    key = root / "edge-key"
    known_hosts = root / "known_hosts"
    key.write_text("private", encoding="utf-8")
    known_hosts.write_text("pi-a ssh-ed25519 AAAA", encoding="utf-8")
    return EdgeDeviceConfig(
        device_id="edge-a",
        name="Edge A",
        host="pi-a.example.test",
        port=22,
        user="aoi",
        identity_file=key,
        known_hosts_file=known_hosts,
    )


class SshEdgeClientTests(unittest.TestCase):
    def test_read_json_uses_hardened_ssh_arguments(self):
        with tempfile.TemporaryDirectory() as tmp:
            runner = Mock(
                return_value=subprocess.CompletedProcess(
                    args=[], returncode=0, stdout=b'{"status":"ok"}', stderr=b""
                )
            )
            client = SshEdgeClient(_device(Path(tmp)), runner=runner)

            result = client.read_json("health")

            self.assertEqual(result, {"status": "ok"})
            args = runner.call_args.args[0]
            self.assertEqual(args[0], "ssh")
            self.assertIn("BatchMode=yes", args)
            self.assertIn("StrictHostKeyChecking=yes", args)
            self.assertNotIn("identity_file", client.public_device().model_dump())
            self.assertNotIn("known_hosts_file", client.public_device().model_dump())

    def test_unknown_operation_is_rejected_before_runner(self):
        with tempfile.TemporaryDirectory() as tmp:
            runner = Mock()
            client = SshEdgeClient(_device(Path(tmp)), runner=runner)

            with self.assertRaises(ValueError):
                client.read_json("arbitrary")

            runner.assert_not_called()

    def test_unsafe_history_run_id_is_rejected_before_runner(self):
        with tempfile.TemporaryDirectory() as tmp:
            runner = Mock()
            client = SshEdgeClient(_device(Path(tmp)), runner=runner)

            with self.assertRaises(ValueError):
                client.download_bundle("history", Path(tmp) / "run.zip", run_id="../secret")

            runner.assert_not_called()

    def test_nonzero_ssh_exit_raises_redacted_connection_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            runner = Mock(
                return_value=subprocess.CompletedProcess(
                    args=[], returncode=255, stdout=b"", stderr=b"permission denied"
                )
            )
            client = SshEdgeClient(_device(Path(tmp)), runner=runner)

            with self.assertRaises(EdgeConnectionError) as context:
                client.read_json("health")

            self.assertIn("permission denied", str(context.exception))
            self.assertNotIn("edge-key", str(context.exception))

    def test_download_bundle_streams_stdout_to_destination(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)

            def write_stdout(args, **kwargs):
                kwargs["stdout"].write(b"zip-bytes")
                return subprocess.CompletedProcess(args=args, returncode=0, stderr=b"")

            runner = Mock(side_effect=write_stdout)
            client = SshEdgeClient(_device(root), runner=runner)
            destination = root / "capture.zip"

            client.download_bundle("capture", destination)

            self.assertEqual(destination.read_bytes(), b"zip-bytes")
            self.assertIsNotNone(runner.call_args.kwargs["stdout"])
            self.assertNotIn("capture_output", runner.call_args.kwargs)


if __name__ == "__main__":
    unittest.main()
