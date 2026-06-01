# Raspberry Pi Edge Deployment

此資料夾是 Raspberry Pi 5 4GB + Hailo 8L 實機 Edge 環境，與 Windows Docker 模擬環境分離。所有服務需以 4GB RAM 為上限設計，避免在 Pi 上一次載入大量模型、圖片或前端建置程序。

## 目錄

```text
raspberry-pi/
├── backend/     # FastAPI Edge backend, systemd 部署, Hailo model loader
└── frontend/    # React/Vite UI, Nginx 原生部署
```

## 1. 後端安裝

在 Raspberry Pi 上：

```bash
cd ~/low-cost-aoi/raspberry-pi/backend
sudo chmod +x deploy-pi-backend.sh
sudo AOI_TRAINING_HOST_URL=http://<training-host-ip>:8000 ./deploy-pi-backend.sh
```

部署後檢查：

```bash
systemctl status aoi-edge-backend
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8000/api/inference/model/status
curl http://127.0.0.1:8000/api/camera/status
```

目前實機維護建議透過 Tailscale：

```text
AOI UI: http://<pi-tailscale-ip>/
SSH:    ssh -i <path-to-private-key> <pi-user>@<pi-tailscale-ip>
```

## 快速啟動 AOI 服務

Pi 本機可使用：

```bash
cd ~/low-cost-aoi/raspberry-pi
chmod +x start-aoi.sh
./start-aoi.sh start
```

可用動作：

```bash
./start-aoi.sh start
./start-aoi.sh restart
./start-aoi.sh stop
./start-aoi.sh status
```

Windows 開發機可透過 Tailscale 遠端啟動。建議用環境變數保存自己的 Pi 位址、使用者與 SSH key 路徑：

```powershell
$env:AOI_PI_HOST="<pi-tailscale-ip>"
$env:AOI_PI_USER="<pi-user>"
$env:AOI_PI_SSH_KEY="<path-to-private-key>"
.\start-pi-aoi.ps1 status
.\start-pi-aoi.ps1 restart
```

可用環境變數：

- `AOI_EDGE_DATA_DIR`: 檢測程式與歷史資料目錄。
- `AOI_EDGE_MODEL_DIR`: 模型庫目錄，預設 `backend/models`。
- `AOI_EDGE_MODEL_INFERENCE_ENABLED`: 模型推論功能旗標，Phase 2 預設 `false`，因此可管理模型但不實際載入/推論。
- `AOI_TRAINING_HOST_URL`: Training Host API，例如 `http://<training-host-ip>:8000`。
- `AOI_MACHINE_ID`: 這台 Edge 的識別名稱。
- `AOI_CAMERA_INDEX`: OpenCV / V4L2 camera index，預設 `0`。
- `AOI_CAMERA_WIDTH`: camera 解析度寬，預設 `1920`。
- `AOI_CAMERA_HEIGHT`: camera 解析度高，預設 `1080`。
- `AOI_CAMERA_FPS`: camera FPS，預設 `30`。
- `AOI_CAMERA_FOURCC`: camera fourcc，預設 `MJPG`。

目前 CCD / USB camera 驗證狀態：

- 裝置：`Microdia USB2M Cam`
- 影像介面：`/dev/video0`
- metadata 介面：`/dev/video1`
- 取像 backend：OpenCV V4L2
- 已驗證：MJPG `1920x1080` / `30 FPS`

## 2. Hailo 模型包與載入策略

Pi backend 已先採用完整 model bundle 管理架構，但 Phase 2 預設用 `AOI_EDGE_MODEL_INFERENCE_ENABLED=false` 鎖住實際模型載入與推論。每個 `backend/models/<model_id>/` 目錄都是一個可部署模型包：

```text
backend/models/
├── PCB-A001-yolo-v1/
│   ├── manifest.json
│   ├── model.hef
│   └── classes.json      # optional, preferred for UI metadata
├── PCB-B017-yolo-v1/
│   ├── manifest.json
│   ├── model.hef
│   └── labels.txt        # optional
└── active.json
```

`manifest.json` 必須包含：

- `model_id`
- `part_no`
- `version`
- `format: "hailo-hef"`
- `source_yolo_model`
- `classes`
- `input_size`
- `postprocess`
- `created_at`
- `checksum.model_hef`

`models/<model_id>/` 的資料夾名稱必須與 `manifest.json` 的 `model_id` 一致。後端會驗證 `model.hef` 的 SHA-256。若 manifest 格式錯誤、checksum 不符、或未安裝 HailoRT Python binding，模型 registry 需標示該 bundle 無效，但不應阻擋其他有效模型。

`active.json` 用來記錄每個料號預設使用哪個模型：

```json
{
  "PCB-A001": "PCB-A001-yolo-v1",
  "PCB-B017": "PCB-B017-yolo-v1"
}
```

新增模型時，流程應為：

1. 將完整 model bundle zip 上傳到 Pi，或手動放入 `backend/models/<model_id>/`。
2. 後端驗證 `manifest.json`、`model.hef` checksum、`part_no` 與 `model_id`。
3. 驗證通過後加入 model registry。
4. 若要讓某個料號自動使用此模型，更新 `active.json`。
5. 不需重啟後端服務；正常流程應支援刷新模型清單與熱切換 active model。

目前提供的 API：

```text
GET  /api/models
POST /api/models/install
POST /api/models/refresh
POST /api/models/{model_id}/activate
GET  /api/models/active
```

服務啟動時只需掃描模型庫與建立 registry，不必一次載入所有 `model.hef`。使用者選擇料號或 active model 時，再載入對應的 Hailo adapter。切換模型時需等待目前推論完成或以鎖保護，避免推論中途替換模型。只有 HailoRT runtime、driver 或資源釋放異常時，才提示重啟 `aoi-edge-backend`。

## 3. 前端建置與部署

建議在 Windows 開發機編譯，避免 Pi 4GB 記憶體不足：

```bash
cd raspberry-pi/frontend
npm install
npm run build
scp -r dist pi@<raspberry-pi-ip>:/home/pi/low-cost-aoi/raspberry-pi/frontend/
```

在 Raspberry Pi 上：

```bash
cd ~/low-cost-aoi/raspberry-pi/frontend
sudo chmod +x deploy-pi-frontend.sh
sudo ./deploy-pi-frontend.sh
```

完成後開啟：

```text
http://<raspberry-pi-ip>/
```

Nginx 會將 `/api` 與 `/data/history` proxy 到本機 FastAPI `127.0.0.1:8000`。

## 4. 資料上傳

檢測完成後，Edge 前端的 Upload 會呼叫：

```text
POST /api/orchestrator/history/{run_id}/upload
```

後端會打包：

```text
manifest.json
report.json
program.json
images/
```

並上傳到 Training Host：

```text
POST <AOI_TRAINING_HOST_URL>/api/datasets/import-run
```

資料格式請以 `shared/contracts/` 為準。

Pi 前端另提供 Transfer UI，可直接：

1. 設定 Training Host URL。
2. 匯出 ready captures bundle。
3. 將 bundle 上傳到 Training Host `POST /api/datasets/import-run`。
4. 從本機選擇既有 capture bundle zip 上傳到 Training Host。
5. 從本機選擇 model bundle zip，安裝到 Pi `POST /api/models/install`。
6. 刷新模型清單並啟用指定模型。

注意：如果使用 Pi 本機瀏覽器開啟 UI，`127.0.0.1:8000` 會指向 Pi 本機，不會指向 Windows Training Host。此時 Training Host URL 需填入 Windows 主機在目前網路或 Tailscale 上可被瀏覽器連到的位址。

## 5. Training Host 模型流程

1. YOLO 訓練產出 `.pt`。
2. 匯出 ONNX。
3. 使用 Hailo Dataflow Compiler 針對 `hailo8l` 編譯 `.hef`。
4. 建立模型包目錄：

```text
training-host/models/<model_id>/
├── manifest.json
└── model.hef
```

5. 使用 Training Host API 下載，或手動複製到 Pi 的 `backend/models/<model_id>/`。
6. 在 Pi 上刷新模型清單，必要時將此 `model_id` 設為該 `part_no` 的 active model。
