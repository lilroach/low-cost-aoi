# Raspberry Pi Edge Deployment

此資料夾是 Raspberry Pi 5 + Hailo 8L 實機 Edge 環境，與 Windows Docker 模擬環境分離。

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
```

可用環境變數：

- `AOI_EDGE_DATA_DIR`: 檢測程式與歷史資料目錄。
- `AOI_EDGE_MODEL_DIR`: 目前模型包目錄，預設 `backend/models/current`。
- `AOI_TRAINING_HOST_URL`: Training Host API，例如 `http://192.168.1.10:8000`。
- `AOI_MACHINE_ID`: 這台 Edge 的識別名稱。

## 2. Hailo 模型包

Pi backend 預設從 `backend/models/current/` 載入：

```text
manifest.json
model.hef
labels.txt        # optional
classes.json      # optional
```

`manifest.json` 必須包含：

- `model_id`
- `format: "hailo-hef"`
- `source_yolo_model`
- `classes`
- `input_size`
- `postprocess`
- `created_at`
- `checksum.model_hef`

後端會驗證 `model.hef` 的 SHA-256。若沒有模型、manifest 格式錯誤、checksum 不符、或未安裝 HailoRT Python binding，`/api/inference/model/status` 會回報明確錯誤。

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

5. 使用 Training Host API 下載，或手動複製到 Pi 的 `backend/models/current/`。
