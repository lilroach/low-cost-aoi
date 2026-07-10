# SSH Edge Data Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 Training Host 可由 UI 手動透過 SSH 唯讀同步 Raspberry Pi 的 Capture、歷史 run bundle、裝置狀態與最近日誌。

**Architecture:** Raspberry Pi 僅補一個歷史 run bundle 唯讀端點。Training Host 以系統 OpenSSH 執行固定白名單指令，將 Edge 本機 API 回應與 bundle 串流回本機，再由共用 run importer 驗證、版本化匯入並保存同步快照。API、service、repository 與 schema 分層，前端只接觸 Training Host API，不接觸 SSH 金鑰。

**Tech Stack:** Python 3.10+、FastAPI、Pydantic 2、stdlib `subprocess`/`zipfile`/`hashlib`、React 18、TypeScript、Vite、unittest

---

## File Structure

### Raspberry Pi Edge

- Create: `raspberry-pi/backend/tests/test_history_bundle.py` — 歷史 bundle 與安全 run ID 的回歸測試。
- Modify: `raspberry-pi/backend/app/api/orchestrator.py` — 加入安全 run 解析、bundle 建立函式與唯讀下載端點。

### Training Host Backend

- Create: `training-host/backend/app/schemas/edge_sync.py` — 裝置設定與同步結果型別。
- Create: `training-host/backend/app/repositories/edge_sync_repository.py` — 設定檔、同步索引與快照落盤。
- Create: `training-host/backend/app/services/run_import_service.py` — 共用 bundle 驗證與原子匯入。
- Create: `training-host/backend/app/services/ssh_edge_service.py` — OpenSSH 固定白名單讀取與 bundle 串流。
- Create: `training-host/backend/app/services/edge_sync_service.py` — 同步流程、去重、版本與部分失敗控制。
- Create: `training-host/backend/app/api/edges.py` — Edge list/test/sync/latest API。
- Create: `training-host/backend/tests/test_run_import_service.py` — 匯入與 ZIP 安全測試。
- Create: `training-host/backend/tests/test_ssh_edge_service.py` — SSH 參數、安全白名單與敏感資訊測試。
- Create: `training-host/backend/tests/test_edge_sync_service.py` — 新增、跳過、更新與部分失敗測試。
- Modify: `training-host/backend/app/api/datasets.py` — HTTP upload 改呼叫共用 importer。
- Modify: `training-host/backend/app/main.py` — 註冊 Edge router。

### Training Host Frontend and Configuration

- Create: `training-host/frontend/src/features/EdgeSyncPanel.tsx` — 連線、狀態、同步摘要與日誌 UI。
- Create: `training-host/config/edge_devices.example.json` — 不含真實位址或金鑰的多裝置範例。
- Modify: `training-host/frontend/src/features/DatasetManager.tsx` — 在資料集頁面加入 EdgeSyncPanel。
- Modify: `.gitignore` — 忽略正式 `training-host/config/edge_devices.json`。
- Modify: `README.md` — 加入啟用方式與安全注意事項。
- Modify: `docs/specs/tasks.md` — 記錄 SSH 手動同步功能完成狀態。

---

### Task 1: Raspberry Pi 歷史 run bundle 唯讀端點

**Files:**
- Create: `raspberry-pi/backend/tests/test_history_bundle.py`
- Modify: `raspberry-pi/backend/app/api/orchestrator.py`

- [ ] **Step 1: Write the failing tests**

```python
import json
import tempfile
import unittest
import zipfile
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

from app.api import orchestrator


class HistoryBundleTests(unittest.TestCase):
    def test_build_history_bundle_returns_contract_zip(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            run_dir = root / "20260710_120000"
            run_dir.mkdir()
            (run_dir / "point-1.jpg").write_bytes(b"jpeg")
            (run_dir / "report.json").write_text(json.dumps({
                "metadata": {"machine_id": "pi-a"},
                "total_points": 1,
                "results": [{
                    "point_id": 1, "x": 1, "y": 2, "result": "OK",
                    "detections": [], "image_path": "20260710_120000/point-1.jpg",
                }],
                "completed_at": 1,
                "status": "completed",
            }), encoding="utf-8")
            (run_dir / "program.json").write_text('{"points": []}', encoding="utf-8")

            with patch.object(orchestrator, "HISTORY_DIR", str(root)):
                payload = orchestrator.build_history_bundle("20260710_120000")

            with zipfile.ZipFile(BytesIO(payload)) as bundle:
                self.assertEqual(
                    {"manifest.json", "report.json", "program.json", "images/point-1.jpg"},
                    set(bundle.namelist()),
                )

    def test_build_history_bundle_rejects_path_traversal(self):
        with self.assertRaises(HTTPException) as context:
            orchestrator.build_history_bundle("../secret")
        self.assertEqual(context.exception.status_code, 400)

    def test_build_history_bundle_returns_404_for_missing_run(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(orchestrator, "HISTORY_DIR", tmp):
            with self.assertRaises(HTTPException) as context:
                orchestrator.build_history_bundle("missing")
        self.assertEqual(context.exception.status_code, 404)
```

- [ ] **Step 2: Run tests and verify RED**

Run from `raspberry-pi/backend`:

```powershell
python -m unittest tests.test_history_bundle -v
```

Expected: FAIL because `orchestrator.build_history_bundle` does not exist.

- [ ] **Step 3: Implement the minimal safe bundle endpoint**

Add `re` and `Response` imports, then add:

```python
SAFE_RUN_ID = re.compile(r"^[A-Za-z0-9_.-]+$")


def _history_run_dir(run_id: str) -> Path:
    if not SAFE_RUN_ID.fullmatch(run_id) or run_id in {".", "..", "captures"}:
        raise HTTPException(status_code=400, detail="Invalid run id")
    root = Path(HISTORY_DIR).resolve()
    run_dir = (root / run_id).resolve()
    if run_dir.parent != root:
        raise HTTPException(status_code=400, detail="Invalid run id")
    return run_dir


def build_history_bundle(run_id: str) -> bytes:
    run_dir = _history_run_dir(run_id)
    report_path = run_dir / "report.json"
    if not report_path.exists():
        raise HTTPException(status_code=404, detail="Run not found")
    report_data = json.loads(report_path.read_text(encoding="utf-8"))
    program_path = run_dir / "program.json"
    program_data = (
        json.loads(program_path.read_text(encoding="utf-8"))
        if program_path.exists()
        else {"name": report_data.get("metadata", {}).get("program_name", ""), "points": []}
    )
    return create_run_bundle(run_id, run_dir, report_data, program_data)


@router.get("/history/{run_id}/bundle")
async def download_history_bundle(run_id: str):
    content = build_history_bundle(run_id)
    return Response(
        content=content,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{run_id}.zip"'},
    )
```

- [ ] **Step 4: Run Edge tests and verify GREEN**

```powershell
python -m unittest discover -s tests -p "test_*.py" -v
```

Expected: all Raspberry Pi backend tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add raspberry-pi/backend/app/api/orchestrator.py raspberry-pi/backend/tests/test_history_bundle.py
git commit -m "feat: export Edge history bundles"
```

### Task 2: Extract a reusable and atomic Training Host run importer

**Files:**
- Create: `training-host/backend/app/services/run_import_service.py`
- Create: `training-host/backend/tests/test_run_import_service.py`
- Modify: `training-host/backend/app/api/datasets.py`

- [ ] **Step 1: Write failing importer tests**

Create tests with a `_bundle(path, run_id, member="images/a.jpg")` helper that writes `manifest.json`, `report.json`, `program.json`, and the member. Assert:

```python
result = import_run_bundle_file(bundle_path, imported_dir, raw_dir, storage_id="edge-a__run-1")
self.assertEqual(result["run_id"], "run-1")
self.assertEqual(result["storage_id"], "edge-a__run-1")
self.assertTrue((imported_dir / "edge-a__run-1" / "report.json").exists())
self.assertTrue((raw_dir / "edge-a__run-1_a.jpg").exists())
```

Also test:

```python
with self.assertRaises(HTTPException):
    import_run_bundle_file(unsafe_bundle, imported_dir, raw_dir)
```

where `unsafe_bundle` contains `../escape.txt`. Test `replace_existing=False` returns HTTP 409 and leaves the existing directory unchanged.

- [ ] **Step 2: Run tests and verify RED**

Run from `training-host/backend`:

```powershell
python -m unittest tests.test_run_import_service -v
```

Expected: FAIL because `app.services.run_import_service` does not exist.

- [ ] **Step 3: Move validation and extraction into the service**

Implement these public functions in `run_import_service.py`:

```python
def validate_report(report: Dict[str, Any]) -> None: ...
def validate_bundle_manifest(manifest: Dict[str, Any]) -> None: ...
def safe_extract_bundle(bundle: zipfile.ZipFile, destination: Path) -> None: ...
def import_run_bundle_file(
    bundle_path: Path,
    imported_runs_dir: Path,
    raw_dir: Path,
    storage_id: str | None = None,
    replace_existing: bool = True,
) -> Dict[str, Any]: ...
```

The importer must validate `storage_id` with `^[A-Za-z0-9_.-]+$`, extract into `<storage_id>.incoming`, copy raw images using the storage ID prefix, then use `Path.replace()` only after every validation succeeds. On exception, remove only its own `.incoming` directory. Return:

```python
{
    "status": "imported",
    "run_id": manifest["run_id"],
    "storage_id": resolved_storage_id,
    "stored_at": str(final_dir),
    "raw_images": copied_images,
}
```

- [ ] **Step 4: Rewire the HTTP upload endpoint**

Keep upload-file handling in `datasets.py`, but replace inline ZIP extraction with:

```python
result = import_run_bundle_file(tmp_path, IMPORTED_RUNS_DIR, RAW_DIR)
return result
```

Remove only validation/extraction imports and helpers made unused by this refactor.

- [ ] **Step 5: Run focused and existing Training Host tests**

```powershell
python -m unittest tests.test_run_import_service -v
python -m unittest discover -s tests -p "test_*.py" -v
```

Expected: all Training Host backend tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add training-host/backend/app/services/run_import_service.py training-host/backend/app/api/datasets.py training-host/backend/tests/test_run_import_service.py
git commit -m "refactor: share run bundle importer"
```

### Task 3: Add device configuration and safe OpenSSH client

**Files:**
- Create: `training-host/backend/app/schemas/edge_sync.py`
- Create: `training-host/backend/app/repositories/edge_sync_repository.py`
- Create: `training-host/backend/app/services/ssh_edge_service.py`
- Create: `training-host/backend/tests/test_ssh_edge_service.py`

- [ ] **Step 1: Write failing SSH client tests**

Use `unittest.mock.Mock` as the subprocess runner. Verify:

```python
client.read_json("health")
args = runner.call_args.args[0]
self.assertEqual(args[0], "ssh")
self.assertIn("BatchMode=yes", args)
self.assertIn("StrictHostKeyChecking=yes", args)
self.assertNotIn("identity_file", client.public_device().model_dump())
```

Verify `read_json("arbitrary")` raises `ValueError`, unsafe run IDs are rejected before invoking the runner, non-zero SSH exit raises `EdgeConnectionError`, and `download_bundle` passes an opened destination file as `stdout` instead of capturing ZIP bytes in memory.

- [ ] **Step 2: Run test and verify RED**

```powershell
python -m unittest tests.test_ssh_edge_service -v
```

Expected: FAIL because the schema, repository and service do not exist.

- [ ] **Step 3: Implement device schemas**

```python
class EdgeDeviceConfig(BaseModel):
    device_id: str
    name: str
    host: str
    port: int = 22
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
    run_id: str | None = None
    status: Literal["added", "skipped", "updated", "failed"]
    detail: str = ""
```

- [ ] **Step 4: Implement configuration repository**

`load_devices()` reads `AOI_EDGE_DEVICES_FILE`, defaulting to `training-host/config/edge_devices.json`. Missing files return an empty list; malformed files raise a clear configuration error. `get_device(device_id)` performs exact lookup and never accepts a host/user/key path from an API request.

- [ ] **Step 5: Implement the OpenSSH allowlist**

Use fixed operations:

```python
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
```

The base SSH argv must include `-i`, `-p`, `BatchMode=yes`, `ConnectTimeout=10`, `StrictHostKeyChecking=yes`, and `UserKnownHostsFile=<path>`. Dynamic history download is allowed only after the run ID passes the same ASCII regex used on Edge.

- [ ] **Step 6: Run tests and verify GREEN**

```powershell
python -m unittest tests.test_ssh_edge_service -v
python -m unittest discover -s tests -p "test_*.py" -v
```

Expected: all Training Host backend tests PASS.

- [ ] **Step 7: Commit**

```powershell
git add training-host/backend/app/schemas/edge_sync.py training-host/backend/app/repositories/edge_sync_repository.py training-host/backend/app/services/ssh_edge_service.py training-host/backend/tests/test_ssh_edge_service.py
git commit -m "feat: add safe SSH Edge reader"
```

### Task 4: Implement synchronization, versioning, snapshots and API

**Files:**
- Create: `training-host/backend/app/services/edge_sync_service.py`
- Create: `training-host/backend/app/api/edges.py`
- Create: `training-host/backend/tests/test_edge_sync_service.py`
- Modify: `training-host/backend/app/repositories/edge_sync_repository.py`
- Modify: `training-host/backend/app/main.py`

- [ ] **Step 1: Write failing synchronization tests**

Build a fake SSH client returning health/camera/models/capture/history and writing fixture ZIPs to requested destinations. Verify four flows:

```python
first = service.sync("edge-a")
self.assertEqual(first.counts, {"added": 2, "skipped": 0, "updated": 0, "failed": 0})

second = service.sync("edge-a")
self.assertEqual(second.counts["skipped"], 2)

fake.replace_bundle("run-1", changed_bundle)
third = service.sync("edge-a")
self.assertEqual(third.counts["updated"], 1)
self.assertEqual(len(repository.versions("edge-a", "run-1")), 2)
```

Also make one history download fail and assert the valid capture still imports, the failed item is reported, and no `.incoming` directory remains.

- [ ] **Step 2: Run test and verify RED**

```powershell
python -m unittest tests.test_edge_sync_service -v
```

Expected: FAIL because `EdgeSyncService` does not exist.

- [ ] **Step 3: Implement repository state**

Store per-device files under `<data>/edge_sync/<device_id>/`:

```text
latest.json
history/<UTC timestamp>.json
```

`latest.json` contains the latest diagnostics plus a `sources` mapping. Each source keeps `{run_id, sha256, storage_id, synced_at}` versions. Write JSON to `.incoming` and replace atomically.

- [ ] **Step 4: Implement sync service**

The service must:

1. Reject concurrent syncs for the same `device_id` with HTTP 409.
2. Read diagnostic operations independently and record individual errors.
3. Read capture summary and history inventory.
4. Download today's Capture bundle only when `ready_for_training > 0`.
5. Download every history run returned by Edge.
6. Compute SHA-256 locally.
7. Classify the source as added/skipped/updated.
8. Import added/updated bundles with storage IDs:
   - first version: `<device_id>__<run_id>`
   - updated version: `<device_id>__<run_id>__<sha256 first 12 chars>`
9. Continue after a single item failure.
10. Save latest and timestamped snapshots in a `finally` block.

- [ ] **Step 5: Add API router and register it**

```python
router = APIRouter(prefix="/edges", tags=["edges"])

@router.get("")
async def list_edges(): ...

@router.post("/{device_id}/test")
async def test_edge(device_id: str): ...

@router.post("/{device_id}/sync")
async def sync_edge(device_id: str): ...

@router.get("/{device_id}/latest")
async def latest_edge_snapshot(device_id: str): ...
```

Register with `app.include_router(edges.router, prefix="/api")`. API responses use public device schemas and never return `identity_file`, `known_hosts_file`, full SSH argv, or local private-key paths.

- [ ] **Step 6: Run focused and full backend tests**

```powershell
python -m unittest tests.test_edge_sync_service -v
python -m unittest discover -s tests -p "test_*.py" -v
```

Expected: all Training Host backend tests PASS.

- [ ] **Step 7: Commit**

```powershell
git add training-host/backend/app/services/edge_sync_service.py training-host/backend/app/repositories/edge_sync_repository.py training-host/backend/app/api/edges.py training-host/backend/app/main.py training-host/backend/tests/test_edge_sync_service.py
git commit -m "feat: sync Edge data over SSH"
```

### Task 5: Add Training Host Edge Sync UI

**Files:**
- Create: `training-host/frontend/src/features/EdgeSyncPanel.tsx`
- Modify: `training-host/frontend/src/features/DatasetManager.tsx`

- [ ] **Step 1: Define UI response types and panel state**

Use explicit types for `EdgeDevice`, `EdgeSnapshot`, `SyncItem`, and `SyncResult`. The panel loads `GET /api/edges` on mount, selects the first configured device, and keeps separate `testing` and `syncing` states.

- [ ] **Step 2: Implement test and sync actions**

```tsx
const testConnection = async () => {
  setTesting(true)
  try {
    const res = await fetch(`/api/edges/${encodeURIComponent(deviceId)}/test`, { method: 'POST' })
    const data = await parseResponse(res)
    if (!res.ok) throw new Error(data.detail || 'Edge 連線失敗')
    setNotice({ type: 'ok', text: 'Edge SSH 與 Backend 連線正常' })
  } finally {
    setTesting(false)
  }
}
```

`syncEdge` calls the sync endpoint, refreshes latest snapshot, shows counts, and calls an optional `onSynced` callback so DatasetManager refreshes inventory.

- [ ] **Step 3: Render the panel**

Render:

- device selector when more than one device exists;
- connection badge;
- Backend/camera/disk/model summary cards;
- test and sync buttons disabled during requests;
- added/skipped/updated/failed counts;
- per-item failure details;
- collapsible last 200 journal lines;
- a clear empty state pointing to `training-host/config/edge_devices.json` when no device is configured.

- [ ] **Step 4: Integrate above DatasetManager inventory**

Render `<EdgeSyncPanel onSynced={fetchInventory} />` before existing summary cards. Do not move or redesign existing inventory sections.

- [ ] **Step 5: Run frontend build**

Run from `training-host/frontend`:

```powershell
npm run build
```

Expected: TypeScript and Vite build PASS with exit code 0.

- [ ] **Step 6: Commit**

```powershell
git add training-host/frontend/src/features/EdgeSyncPanel.tsx training-host/frontend/src/features/DatasetManager.tsx
git commit -m "feat: add Edge SSH sync panel"
```

### Task 6: Add configuration example and operator documentation

**Files:**
- Create: `training-host/config/edge_devices.example.json`
- Modify: `.gitignore`
- Modify: `README.md`
- Modify: `docs/specs/tasks.md`

- [ ] **Step 1: Add safe example configuration**

```json
[
  {
    "device_id": "pi-edge-01",
    "name": "Raspberry Pi AOI",
    "host": "<pi-tailscale-ip-or-dns>",
    "port": 22,
    "user": "<pi-user>",
    "identity_file": "C:\\Users\\<user>\\.ssh\\aoi_pi_ed25519",
    "known_hosts_file": "C:\\Users\\<user>\\.ssh\\known_hosts"
  }
]
```

- [ ] **Step 2: Ignore the real local configuration**

Add:

```gitignore
training-host/config/edge_devices.json
```

- [ ] **Step 3: Document setup and operation**

README instructions must include copying the example file, replacing placeholders locally, verifying the host key with an interactive `ssh` command once, starting Training Host, using「測試連線」then「從 Edge 同步」, and confirming that sync never deletes Edge data. Do not document a real IP, user, or private-key path.

- [ ] **Step 4: Update task tracking**

Add an `SSH Edge Manual Sync Roadmap` section with completed checkboxes for the readonly endpoint, safe SSH backend, versioned import, diagnostic snapshot, UI, and documentation. Do not mark the broader Phase 2 operator SOP task complete unless every item in that SOP exists.

- [ ] **Step 5: Verify docs and repository safety**

```powershell
rg -n "100\.89\.|aoi_pi_ed25519|BEGIN OPENSSH PRIVATE KEY" README.md training-host/config docs/specs/tasks.md
git check-ignore training-host/config/edge_devices.json
git diff --check
```

Expected: no real credential match in newly changed content; real config path is ignored; diff check exits 0.

- [ ] **Step 6: Commit**

```powershell
git add .gitignore README.md docs/specs/tasks.md training-host/config/edge_devices.example.json
git commit -m "docs: add Edge SSH sync setup"
```

### Task 7: Full verification and requirements audit

**Files:**
- Verify all changed files

- [ ] **Step 1: Run Raspberry Pi backend tests**

```powershell
cd raspberry-pi/backend
python -m unittest discover -s tests -p "test_*.py" -v
```

Expected: all tests PASS with zero failures.

- [ ] **Step 2: Run Training Host backend tests**

```powershell
cd training-host/backend
python -m unittest discover -s tests -p "test_*.py" -v
```

Expected: all tests PASS with zero failures.

- [ ] **Step 3: Build Training Host frontend**

```powershell
cd training-host/frontend
npm run build
```

Expected: `tsc` and Vite exit 0.

- [ ] **Step 4: Compile Python sources**

Run from repository root:

```powershell
python -m compileall raspberry-pi/backend/app training-host/backend/app
```

Expected: exit 0 with no syntax errors.

- [ ] **Step 5: Review security and scope**

```powershell
rg -n "shell=True|StrictHostKeyChecking=no|password|rm -|unlink\(|rmtree\(" training-host/backend/app/api/edges.py training-host/backend/app/services/ssh_edge_service.py training-host/backend/app/services/edge_sync_service.py
git diff --check
git status --short
```

Expected: no unsafe SSH option, password input, or Edge deletion path; diff check exits 0; status contains only intended changes.

- [ ] **Step 6: Compare implementation to design acceptance criteria**

Confirm each item in `docs/superpowers/specs/2026-07-10-ssh-edge-data-sync-design.md` section 12 has implementation or verification evidence. Record any real-Pi-only item as pending hardware validation rather than claiming it passed locally.

- [ ] **Step 7: Commit any verification-only corrections**

```powershell
git add <only-files-corrected-during-verification>
git commit -m "fix: complete Edge SSH sync verification"
```

Skip this commit when verification required no corrections.
