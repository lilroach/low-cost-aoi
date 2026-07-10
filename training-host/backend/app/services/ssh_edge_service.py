import json
import re
import subprocess
from pathlib import Path
from typing import Any, Callable, Dict

from app.schemas.edge_sync import EdgeDeviceConfig, EdgeDevicePublic


JSON_COMMANDS = {
    "health": "curl -fsS --max-time 15 http://127.0.0.1:8000/api/health",
    "camera": "curl -fsS --max-time 15 http://127.0.0.1:8000/api/camera/status",
    "models": "curl -fsS --max-time 15 http://127.0.0.1:8000/api/models",
    "capture": "curl -fsS --max-time 15 http://127.0.0.1:8000/api/capture/export",
    "history": "curl -fsS --max-time 15 http://127.0.0.1:8000/api/orchestrator/history",
}

TEXT_COMMANDS = {
    "disk": "df -Pk / | tail -n 1",
    "services": "systemctl is-active aoi-edge-backend nginx tailscaled",
    "journal": "journalctl -u aoi-edge-backend -n 200 --no-pager -o short-iso",
}

SAFE_RUN_ID = re.compile(r"^[A-Za-z0-9_.-]+$")
MAX_TEXT_BYTES = 1024 * 1024
MAX_BUNDLE_BYTES = 2 * 1024 * 1024 * 1024


class EdgeConnectionError(RuntimeError):
    pass


class SshEdgeClient:
    def __init__(
        self,
        device: EdgeDeviceConfig,
        runner: Callable[..., subprocess.CompletedProcess] = subprocess.run,
    ) -> None:
        self.device = device
        self._runner = runner

    def public_device(self) -> EdgeDevicePublic:
        return EdgeDevicePublic(
            device_id=self.device.device_id,
            name=self.device.name,
            host=self.device.host,
            port=self.device.port,
        )

    def _base_args(self) -> list[str]:
        return [
            "ssh",
            "-i",
            str(self.device.identity_file),
            "-p",
            str(self.device.port),
            "-o",
            "BatchMode=yes",
            "-o",
            "ConnectTimeout=10",
            "-o",
            "StrictHostKeyChecking=yes",
            "-o",
            f"UserKnownHostsFile={self.device.known_hosts_file}",
            f"{self.device.user}@{self.device.host}",
        ]

    def _raise_for_result(self, result: subprocess.CompletedProcess) -> None:
        if result.returncode == 0:
            return
        stderr = (result.stderr or b"").decode("utf-8", errors="replace").strip()
        stderr = stderr.replace(str(self.device.identity_file), "[identity-file]")
        stderr = stderr.replace(
            str(self.device.known_hosts_file), "[known-hosts-file]"
        )
        raise EdgeConnectionError(stderr or f"Edge SSH command failed with exit code {result.returncode}")

    def _run_text_command(self, command: str, timeout: int = 30) -> str:
        result = self._runner(
            [*self._base_args(), command],
            capture_output=True,
            timeout=timeout,
            check=False,
        )
        self._raise_for_result(result)
        stdout = result.stdout or b""
        if len(stdout) > MAX_TEXT_BYTES:
            raise EdgeConnectionError("Edge response exceeds the text size limit")
        return stdout.decode("utf-8", errors="replace")

    def test_connection(self) -> None:
        self._run_text_command("true")

    def read_json(self, operation: str) -> Dict[str, Any] | list[Any]:
        command = JSON_COMMANDS.get(operation)
        if command is None:
            raise ValueError(f"Unknown Edge JSON operation: {operation}")
        try:
            return json.loads(self._run_text_command(command))
        except json.JSONDecodeError as exc:
            raise EdgeConnectionError(f"Edge {operation} returned invalid JSON") from exc

    def read_text(self, operation: str) -> str:
        command = TEXT_COMMANDS.get(operation)
        if command is None:
            raise ValueError(f"Unknown Edge text operation: {operation}")
        return self._run_text_command(command)

    def download_bundle(
        self,
        operation: str,
        destination: Path,
        run_id: str | None = None,
    ) -> None:
        if operation == "capture":
            command = "curl -fsS --max-time 120 http://127.0.0.1:8000/api/capture/export/bundle"
        elif operation == "history":
            if run_id is None or not SAFE_RUN_ID.fullmatch(run_id):
                raise ValueError("Invalid history run id")
            command = (
                "curl -fsS --max-time 120 "
                f"http://127.0.0.1:8000/api/orchestrator/history/{run_id}/bundle"
            )
        else:
            raise ValueError(f"Unknown Edge bundle operation: {operation}")

        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open("wb") as output:
            result = self._runner(
                [*self._base_args(), command],
                stdout=output,
                stderr=subprocess.PIPE,
                timeout=180,
                check=False,
            )
        self._raise_for_result(result)
        if destination.stat().st_size > MAX_BUNDLE_BYTES:
            destination.unlink(missing_ok=True)
            raise EdgeConnectionError("Edge bundle exceeds the size limit")
