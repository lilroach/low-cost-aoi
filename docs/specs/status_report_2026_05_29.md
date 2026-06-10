# AOI Project 修正日誌 - 2026-05-29

## 今日目標

- 建立 AOI Training Host 與 Edge Simulator 的初步模型驗證工作流。
- 讓訓練後的 YOLO 模型可以被 Windows Edge Simulator 載入測試。
- 加入模擬相機照片輪播，在尚未接入實體相機前可驗證完整流程。
- 加入本機 VLM 輔助判讀，用於 PCB 邊緣毛絲與殘肉檢查。

## 架構決策

### AOI Training Host 範圍

Training Host 只保留兩個核心職責：

1. 接收 Raspberry Pi / Edge 回傳的圖片與檢測資料。
2. 對資料進行標註，並訓練可部署到邊緣端的模型。

補充要求：

- 需要支援多模型管理，因為不同料號會使用不同模型。
- Label Studio 可作為標註 UI，先以可用性為主，中文化列為後續優化。

### Model Bundle 結構

Edge / Raspberry Pi 使用的部署包採單層資料夾結構：

```text
models/
  testv1-yolo11-smoke/
    manifest.json
    best.pt
```

Raspberry Pi 最終 Hailo 版本目標：

```text
models/
  PCB-B017-yolo-v1/
    manifest.json
    model.hef
    labels.txt 或 classes.json
```

不再多包一層 `pcb-A001/` 料號資料夾。每個資料夾就是一個完整 model bundle。

### Edge 模型載入路線

後續技術路線定為：

```text
多 model bundle registry + active.json + 熱切換
```

目前階段：

- Windows Edge Simulator 已啟用 `.pt` 模型推論驗證。
- Raspberry Pi 端已預留 registry / active.json / hot-switch 結構，但推論功能先鎖住，維持階段二範圍。

## Training Host 修正

### YOLO 版本確認

最初曾嘗試 `yolov8n.pt`，但因 PyTorch 2.6 weights-only 載入限制導致失敗。

後續確認改用 YOLO11：

```text
yolo11n.pt
```

已調整 Training Host 相關預設：

- `training-host/backend/requirements.txt`
- `training-host/backend/app/api/training.py`
- `training-host/frontend/src/features/TrainingMonitor.tsx`

目前使用：

```text
ultralytics 8.4.56
```

### Dataset

目前測試資料集：

```text
training-host/data/datasets/testv1
```

資料集類別：

```text
0: 122
1: 123
2: 124
3: 殘肉
4: 毛絲
```

YOLO `data.yaml`：

```yaml
path: E:/Docker/low-cost-aoi/training-host/data/datasets/testv1
train: images
val: images

names:
  0: "122"
  1: "123"
  2: "124"
  3: "殘肉"
  4: "毛絲"
```

### 已訓練模型

完成初步 smoke model：

```text
runs/models/training-runs/testv1-yolo11-smoke/weights/best.pt
```

部署到 Edge Simulator bundle：

```text
windows-edge-simulator/edge-backend/models/testv1-yolo11-smoke/
```

## Windows Edge Simulator 修正

### Docker 啟動流程

確立 Docker 優先流程：

1. 先檢查是否已有容器執行。
2. 若有，停止並移除：

```powershell
docker stop aoi-edge-backend aoi-edge-frontend
docker rm aoi-edge-backend aoi-edge-frontend
```

3. 重新 build / up：

```powershell
docker compose -f docker-compose.edge.yml up -d --build
```

### Dockerfile 修正

修正 backend Docker 缺少 OpenCV 系統函式庫問題：

```text
ImportError: libGL.so.1: cannot open shared object file
```

已在 backend Dockerfile 加入：

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*
```

同時將 PyTorch 固定為 CPU wheel，避免 Docker build 拉取大量 CUDA 套件：

```dockerfile
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu \
    torch==2.3.1 torchvision==0.18.1 && \
    pip install --no-cache-dir -r requirements.txt
```

### Model Registry

新增 Windows Edge Simulator model registry：

- `windows-edge-simulator/edge-backend/app/model_registry.py`
- `windows-edge-simulator/edge-backend/app/api/models.py`

支援：

- 掃描 `models/` 下的 bundle。
- 讀取 `manifest.json`。
- 讀取/更新 `active.json`。
- 透過 API 取得可用模型。

目前 active model：

```json
{
  "testv1": "testv1-yolo11-smoke"
}
```

### YOLO 推論

Edge Simulator 已可載入 Ultralytics `.pt`：

- `windows-edge-simulator/edge-backend/app/api/inference.py`
- `windows-edge-simulator/edge-backend/app/api/capture.py`

推論邏輯：

```text
有 detection -> NG
沒有 detection -> OK
```

每筆 capture record 現在會寫出：

```json
{
  "model_result": "OK 或 NG",
  "detections": [
    {
      "label": "殘肉",
      "confidence": 0.864,
      "box": [120, 80, 42, 36]
    }
  ],
  "top_detection": {
    "label": "殘肉",
    "confidence": 0.864,
    "box": [120, 80, 42, 36]
  }
}
```

前端會顯示：

- YOLO OK/NG
- Top Match
- Detections count
- label
- confidence
- box

## 模擬相機修正

### 原因

目前尚未接入實體相機，因此將 Capture 大畫面改為使用前端靜態照片做定時輪播，方便驗證完整流程。

### 模擬照片資料夾

新增：

```text
windows-edge-simulator/edge-frontend/public/sim-camera/
```

照片放置位置：

```text
windows-edge-simulator/edge-frontend/public/sim-camera/images/
```

輪播清單：

```text
windows-edge-simulator/edge-frontend/public/sim-camera/manifest.json
```

目前 manifest 使用 8 張照片：

```text
726579.jpg
726580.jpg
738646.jpg
738647.jpg
S__1444061187.jpg
S__1447911436.jpg
S__1447911437.jpg
S__7503937.jpg
```

### Capture 工作流

目前流程：

```text
Simulated Live 圖片輪播
-> SNAP
-> 後端讀取當前輪播圖片
-> YOLO11 推論
-> 寫入 Capture Result List
-> 人工 OK/NG
-> Export
```

曾加入 Capture Result List 的大畫面輪播，但後續因使用體驗問題取消並刪除相關程式碼。

目前保留：

- 大相機框只顯示 Simulated Live。
- 右側 Capture Result List 保留。
- 單張圖片 modal 保留，用於人工判定與模型結果檢視。

### 圖片 proxy 修正

修正前端圖片破圖問題。

原因：

Capture 圖片 URL 使用：

```text
/data/history/...
```

但 nginx 原本只 proxy `/api`。

已在 frontend nginx 加入：

```nginx
location /data {
    proxy_pass http://edge-backend:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## 本機 VLM 輔助判讀

### 本機環境

本機已安裝 Ollama，且 GPU 可用：

```text
NVIDIA GeForce RTX 3090
```

已確認本機 Ollama 模型：

```text
qwen3.5:9b
gemma4:e4b
```

兩者皆支援 vision。

### VLM API

新增：

```text
windows-edge-simulator/edge-backend/app/api/vlm.py
```

API：

```text
POST /api/vlm/analyze
```

預設模型：

```text
qwen3.5:9b
```

Docker backend 透過：

```text
http://host.docker.internal:11434
```

呼叫主機上的 Ollama。

### VLM 前端整合

在 Capture 單張圖片檢視中新增：

```text
Vision Model -> Analyze
```

定位：

```text
YOLO11: 正式 OK/NG、框、confidence
VLM: 自然語言輔助判讀、可疑點描述、標註輔助
```

### VLM 提示詞修正

已將 VLM 提示詞改為專注檢查：

```text
PCB 邊緣 / 金手指邊緣是否有毛絲或殘肉
```

固定輸出格式：

```text
1. 判定：OK 或 NG
2. 是否疑似毛絲：是/否，信心 0-100
3. 是否疑似殘肉：是/否，信心 0-100
4. 可疑位置：上/下/左/右/中央與接近第幾個金手指
5. 理由：簡短說明觀察依據
6. 不確定因素：若無請寫無
```

## 今日驗證

已完成驗證：

- Training Host 可使用 Label Studio 做標註。
- YOLO11 smoke model 已訓練完成。
- Edge Docker backend/frontend 可正常啟動。
- frontend:

```text
http://127.0.0.1:3001
```

- backend:

```text
http://127.0.0.1:8001/api/health
```

- 模型 registry 可讀取 `testv1-yolo11-smoke`。
- 使用模擬相機圖片 SNAP 成功。
- Capture record 可寫入 YOLO 結果、detections、confidence。
- `/data/history/...` 圖片可透過 frontend nginx 正常讀取。
- VLM API 可從 Docker backend 呼叫本機 Ollama。
- VLM 可針對 PCB 邊緣毛絲/殘肉輸出固定格式分析。

## 目前限制

- YOLO11 smoke model 訓練資料仍偏少，偵測結果可能多為 `OK / No match`。
- 目前 YOLO 的 OK 表示「沒有 detection 超過 confidence threshold」，不等於保證無缺陷。
- VLM 是輔助判讀，不作為正式自動判定依據。
- 實體相機尚未接入，目前用 sim-camera 圖片輪播替代。
- Raspberry Pi 端模型推論功能仍鎖住，僅保留 registry / active.json 技術路線。
- sim-camera 圖片輪播與本機 VLM 僅作為 Windows Edge Simulator 的開發驗證工具；正式 Raspberry Pi 部署時應移除，不納入邊緣端正式功能。
- YOLO 簡易訓練與標註 v1 流程已完成，但目前模型在模擬輪播圖片上的辨識效果不足，主要原因是訓練資料量與場景覆蓋仍不足，需要更多毛絲 / 殘肉 / OK 圖片再訓練。
- 今日訓練流程仍主要透過 PowerShell / terminal 指令執行，尚未形成 Training Host 內可操作的 UI 工作流。

## 下一步建議

1. 持續收集毛絲 / 殘肉樣本，每類至少累積 30-50 張作為下一輪 smoke retrain。
2. 將 YOLO 判錯或 No Match 的圖片人工 OK/NG，匯出回 Training Host 再訓練。
3. 加入一鍵「VLM 建議 -> 標註備註」功能，讓 VLM 結果可回流 Label Studio。
4. 針對 YOLO confidence threshold 增加 UI 設定或 manifest 可調參數。
5. 評估公開 PCB pretrained YOLO 模型作為比對基準，但最終仍以自家毛絲/殘肉資料重訓。
6. 接入實體相機後，替換 sim-camera 來源，保留相同 capture / inference / export 工作流。
7. 建立 Training Host 訓練 UI，將 terminal 訓練流程自動化，至少支援：
   - 選擇訓練資料集。
   - 選擇 base model，例如 `yolo11n.pt`。
   - 設定 epochs、imgsz、batch、run name。
   - 啟動訓練、查看訓練狀態、查看結果路徑。
   - 將訓練完成的 best model 打包成 model bundle。

## 補充修正筆記

### 模擬功能的生命週期

目前 Windows Edge Simulator 中的兩個功能：

```text
sim-camera 圖片輪播
本機 Ollama VLM 輔助判讀
```

定位為開發期驗證工具，用於在未接入實體相機、未部署 Raspberry Pi 前測試資料流與 UI。

正式 Raspberry Pi 部署時應刪除或關閉：

- 不保留 sim-camera 靜態照片輪播。
- 不保留本機 Ollama / VLM 分析功能。
- Raspberry Pi 僅保留正式相機輸入、模型 registry、active model、YOLO/Hailo 推論與結果回傳。

### YOLO v1 狀態

今日已完成：

```text
標註 -> YOLO dataset -> YOLO11 terminal train -> best.pt -> Edge Simulator model bundle -> SNAP 推論
```

但目前訓練資料仍不足。對輪播圖片測試時，YOLO 多數回傳：

```text
OK / No match / detections = []
```

這代表目前模型沒有找到超過 confidence threshold 的毛絲或殘肉，尚不能視為模型已可穩定使用。

後續需要補強：

- 增加毛絲樣本。
- 增加殘肉樣本。
- 增加 OK 樣本。
- 確保訓練圖與模擬/實際檢測圖的倍率、光源、角度、背景一致。
- 將判錯圖片回流 Label Studio 再訓練。

### Training Host UI 目標

今日訓練是以 PowerShell 指令完成，例如：

```powershell
.\.venv\Scripts\yolo.exe detect train `
  model=yolo11n.pt `
  data=..\data\datasets\testv1\data.yaml `
  epochs=50 `
  imgsz=640 `
  batch=8 `
  project=..\models\training-runs `
  name=testv1
```

下一階段 Training Host 應將此流程 UI 化，讓使用者不需要手動輸入 terminal 指令。

預期 UI 工作流：

```text
選資料集 -> 選 base model -> 設定訓練參數 -> 啟動訓練 -> 查看 log/進度 -> 選 best.pt -> 產生 model bundle
```
