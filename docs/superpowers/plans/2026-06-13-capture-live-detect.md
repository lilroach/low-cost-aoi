# Capture 即時辨識實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Raspberry Pi 與 Windows Edge Simulator 的 Capture 頁面加入即時辨識開關與單次辨識按鈕，直接使用目前相機 frame 顯示缺陷框與辨識度，不建立 Capture 紀錄。

**Architecture:** 後端 inference router 新增 `POST /api/inference/live-detect`，直接讀取 camera frame 並沿用 `predict_on_image`。所有模型推論共用 execution lock，讓 Live Detect、Detect Once 與 SNAP 串行執行；前端以固定間隔輪詢，並依來源影像比例與 `object-contain` 留黑邊計算疊框位置。

**Tech Stack:** FastAPI、Python `unittest`、OpenCV、React 18、TypeScript、Vite、Tailwind CSS。

---

## 檔案結構

- 建立 `raspberry-pi/backend/tests/test_live_detect.py`：驗證 live-detect response、錯誤映射與推論串行化。
- 修改 `raspberry-pi/backend/app/api/inference.py`：新增 live detect schema、camera frame 推論 endpoint 與共用 inference lock。
- 建立 `windows-edge-simulator/edge-backend/tests/test_live_detect.py`：以 simulator backend 驗證相同 API contract。
- 修改 `windows-edge-simulator/edge-backend/app/api/inference.py`：新增相同 endpoint，並支援 simulator 的 `source_image_url`。
- 修改 `raspberry-pi/frontend/src/features/capture/CaptureView.tsx`：加入控制、輪詢、狀態列與 bounding-box overlay。
- 修改 `windows-edge-simulator/edge-frontend/src/features/capture/CaptureView.tsx`：加入相同 UI，live detect request 帶入目前模擬相機圖片。

### Task 1: Raspberry Pi live-detect API

**Files:**
- Create: `raspberry-pi/backend/tests/test_live_detect.py`
- Modify: `raspberry-pi/backend/app/api/inference.py`

- [ ] **Step 1: 寫成功 response 的失敗測試**

使用 `unittest.IsolatedAsyncioTestCase` patch `camera.get_latest_frame` 與 `predict_on_image`，直接呼叫 `run_live_detect(model_id="model-a")`：

```python
frame = np.zeros((480, 640, 3), dtype=np.uint8)
with patch.object(inference.camera, "get_latest_frame", return_value=frame):
    with patch.object(
        inference,
        "predict_on_image",
        return_value={
            "result": "NG",
            "detections": [{"label": "bridge", "confidence": 0.91, "box": [10, 20, 30, 40]}],
        },
    ):
        response = await inference.run_live_detect(model_id="model-a", part_no=None)

self.assertEqual(response.result, "NG")
self.assertEqual(response.image_size.width, 640)
self.assertEqual(response.image_size.height, 480)
self.assertEqual(response.model_id, "model-a")
```

- [ ] **Step 2: 執行測試並確認紅燈**

Run:

```powershell
python -m unittest tests.test_live_detect.LiveDetectTests.test_returns_detection_for_latest_frame -v
```

Workdir: `raspberry-pi/backend`

Expected: FAIL，因為 `run_live_detect` 尚不存在。

- [ ] **Step 3: 實作最小 live-detect endpoint**

在 inference module import camera，新增 response models，並實作：

```python
class ImageSize(BaseModel):
    width: int
    height: int


class LiveInferenceResult(InferenceResult):
    status: str
    image_size: ImageSize
    model_id: str
    captured_at: str


@router.post("/live-detect", response_model=LiveInferenceResult)
async def run_live_detect(model_id: Optional[str] = None, part_no: Optional[str] = None):
    frame = camera.get_latest_frame()
    if frame is None:
        raise HTTPException(status_code=500, detail="Failed to get frame from camera")

    result = predict_on_image(frame, model_id=model_id, part_no=part_no)
    height, width = frame.shape[:2]
    return LiveInferenceResult(
        status="success",
        result=result["result"],
        detections=result["detections"],
        image_size=ImageSize(width=width, height=height),
        model_id=model_id or active_model_manager.adapter_for(part_no=part_no).model_id,
        captured_at=datetime.now().astimezone().isoformat(timespec="seconds"),
    )
```

保留既有 423、503、501 錯誤類型，並將沒有模型選擇的 `ModelManifestError` 映射成 400。

- [ ] **Step 4: 執行成功與錯誤測試**

補上 camera frame 為 `None`、feature locked、缺少 model 的測試後執行：

```powershell
python -m unittest tests.test_live_detect -v
```

Expected: 4 tests PASS。

### Task 2: 推論串行化與 SNAP 協調

**Files:**
- Modify: `raspberry-pi/backend/tests/test_live_detect.py`
- Modify: `raspberry-pi/backend/app/api/inference.py`

- [ ] **Step 1: 寫不允許重疊推論的失敗測試**

建立兩個 thread 同時呼叫 `predict_on_image`，fake adapter 追蹤同時進入 `predict` 的最大數量：

```python
self.assertEqual(adapter.max_active_calls, 1)
```

- [ ] **Step 2: 執行測試並確認紅燈**

Run:

```powershell
python -m unittest tests.test_live_detect.LiveDetectTests.test_serializes_model_execution -v
```

Expected: FAIL，`max_active_calls` 為 2。

- [ ] **Step 3: 在 `predict_on_image` 加入 execution lock**

```python
_inference_execution_lock = RLock()


def predict_on_image(image, model_id: Optional[str] = None, part_no: Optional[str] = None):
    with _inference_execution_lock:
        adapter = active_model_manager.adapter_for(model_id=model_id, part_no=part_no)
        return adapter.predict(image)
```

- [ ] **Step 4: 執行完整 Pi backend 測試**

```powershell
python -m unittest discover -s tests -v
```

Expected: 所有測試 PASS。

### Task 3: Windows Simulator API parity

**Files:**
- Create: `windows-edge-simulator/edge-backend/tests/test_live_detect.py`
- Modify: `windows-edge-simulator/edge-backend/app/api/inference.py`

- [ ] **Step 1: 寫 simulator live-detect 失敗測試**

測試兩種 frame 來源：

```python
response = await inference.run_live_detect(
    model_id="testv1-yolo11-smoke",
    part_no=None,
    source_image_url=None,
)
self.assertEqual(response.image_size.width, 640)
```

以及 `source_image_url="/sim-camera/images/726579.jpg"` 時呼叫 simulator image loader。

- [ ] **Step 2: 執行測試並確認紅燈**

```powershell
python -m unittest tests.test_live_detect -v
```

Workdir: `windows-edge-simulator/edge-backend`

Expected: FAIL，因為 endpoint 尚不存在。

- [ ] **Step 3: 實作 simulator endpoint 與 execution lock**

endpoint 優先使用合法的 `/sim-camera/` 圖片；未提供時才使用 `camera.get_latest_frame()`。共用 helper 將 frontend 圖片下載並 decode，拒絕其他 URL。

- [ ] **Step 4: 執行 simulator backend 測試**

```powershell
python -m unittest discover -s tests -v
```

Expected: 所有測試 PASS。

### Task 4: Raspberry Pi Capture UI

**Files:**
- Modify: `raspberry-pi/frontend/src/features/capture/CaptureView.tsx`

- [ ] **Step 1: 新增 TypeScript types 與狀態**

```typescript
type LiveDetectResult = {
    status: 'success'
    result: 'OK' | 'NG'
    detections: Detection[]
    image_size: { width: number; height: number }
    model_id: string
    captured_at: string
}
```

新增 `liveDetectEnabled`、`isDetecting`、`liveDetectResult`、`liveDetectError`、container ref 與 measured size。

- [ ] **Step 2: 實作單次辨識與非重疊輪詢**

`runLiveDetect` 使用 ref guard；live toggle 開啟時用 completion-based `setTimeout` 每 1000 ms 執行一次。`isSnapping` 為 true 時跳過該輪。

```typescript
const params = new URLSearchParams({
    model_id: selectedModelId,
    part_no: partNo || 'UNKNOWN',
})
const response = await fetch(`/api/inference/live-detect?${params}`, { method: 'POST' })
```

- [ ] **Step 3: 實作 `object-contain` overlay 換算**

```typescript
const scale = Math.min(containerWidth / sourceWidth, containerHeight / sourceHeight)
const renderedWidth = sourceWidth * scale
const renderedHeight = sourceHeight * scale
const offsetX = (containerWidth - renderedWidth) / 2
const offsetY = (containerHeight - renderedHeight) / 2
```

每個 detection 轉成 absolute-positioned border，label 顯示 `${label} ${(confidence * 100).toFixed(1)}%`。

- [ ] **Step 4: 加入操作控制與 SNAP 暫停行為**

在相機右上控制區加入 `Detect Once` 按鈕與 `Live Detect` toggle。無 enabled model 時 disabled；`handleSnap` 期間輪詢不送新 request，後端 execution lock 負責等待已在途的推論。

- [ ] **Step 5: 執行 Pi frontend build**

```powershell
npm run build
```

Workdir: `raspberry-pi/frontend`

Expected: TypeScript 與 Vite build exit code 0。

### Task 5: Windows Simulator Capture UI parity

**Files:**
- Modify: `windows-edge-simulator/edge-frontend/src/features/capture/CaptureView.tsx`

- [ ] **Step 1: 套用相同狀態、控制與 overlay**

保持 simulator 現有 carousel 行為，request 額外傳入：

```typescript
if (currentSimImage?.src) {
    params.set('source_image_url', currentSimImage.src)
}
```

- [ ] **Step 2: 執行 simulator frontend build**

```powershell
npm run build
```

Workdir: `windows-edge-simulator/edge-frontend`

Expected: TypeScript 與 Vite build exit code 0。

### Task 6: 整體驗證

**Files:**
- Verify: `raspberry-pi/backend/app/api/inference.py`
- Verify: `windows-edge-simulator/edge-backend/app/api/inference.py`
- Verify: both `CaptureView.tsx`

- [ ] **Step 1: 執行所有 backend tests**

```powershell
python -m unittest discover -s tests -v
```

分別在兩個 edge backend 執行，Expected: 全部 PASS。

- [ ] **Step 2: 執行兩個 frontend build**

```powershell
npm run build
```

分別在兩個 edge frontend 執行，Expected: exit code 0。

- [ ] **Step 3: 啟動 Windows Edge Simulator 並用 Browser 驗證**

檢查：

- 選擇 enabled model 後 `Detect Once` 可使用。
- `Live Detect` toggle 可開始與停止。
- API 回傳 detection 時框與 confidence 疊在相機圖片正確位置。
- Live 開啟時按 `SNAP`，Capture list 只新增一筆，Live Detect 在 SNAP 後繼續。
- `Detect Once` 與 Live Detect 都不新增 Capture list。
- 小螢幕與桌面畫面沒有控制重疊。

- [ ] **Step 4: 檢查差異與需求覆蓋**

```powershell
git diff --check
git status --short
```

確認只有計畫、兩組 backend tests/API 與兩組 Capture UI 被修改。
