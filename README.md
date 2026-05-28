# 低成本 PCB AOI 系統 (Low-Cost PCB AOI System)

這是一個專為電子製造與 DIY 愛好者設計的經濟型開源自動光學檢測 (AOI) 系統。專案現在分成三個明確環境：

- `edge-backend/` + `edge-frontend/`: Windows 本機 Docker Edge 模擬環境。
- `raspberry-pi/`: Raspberry Pi 5 + Hailo 8L 實機 Edge 原生部署環境。
- `training-host/`: PC/Workstation 訓練主機，用於資料集管理、YOLO 訓練與 Hailo 模型包發布。

## Documentation

- 硬體:
  - [硬體規格與費用估算](docs/hardware/spec_and_cost.md)
  - [相機與光學設置指南](docs/hardware/camera_optics.md)
  - [運動控制方案選擇](docs/hardware/motion_control_selection.md)
  - [Klipper 設定教學](docs/hardware/klipper_setup.md)
- 專案:
  - [實作計畫](docs/project/implementation_plan.md)
  - [進度報告 (2026-01-13)](docs/project/status_report_2026_01_13.md)
  - [待辦事項](docs/project/tasks.md)
- 資料/模型契約:
  - `shared/contracts/inspection_run.schema.json`
  - `shared/contracts/dataset_bundle.schema.json`
  - `shared/contracts/model_manifest.schema.json`

## Windows Edge 模擬

Windows 下的 Edge 前後端只作 Docker 模擬與 UI/API 開發，不包含樹莓派安裝流程。

```bash
docker-compose -f docker-compose.edge.yml up -d --build
```

- 前端 UI: http://localhost:3001
- 後端 API: http://localhost:8001/docs

`docker-compose.edge.yml` 會以 `SIMULATION_MODE=true` 啟動後端，適合本機測試相機、運動、檢測流程與資料上傳 API。

## Raspberry Pi Edge 實機

樹莓派實機部署已拆到 `raspberry-pi/`，避免被 Windows Docker 設定影響。

請從 [raspberry-pi/README.md](raspberry-pi/README.md) 開始安裝。重點流程：

1. 在 Windows 編譯 `raspberry-pi/frontend` 的 `dist/`。
2. 將 `dist/` 傳到 Raspberry Pi。
3. 在 Pi 執行 `raspberry-pi/backend/deploy-pi-backend.sh` 與 `raspberry-pi/frontend/deploy-pi-frontend.sh`。
4. 將 Training Host 產出的 Hailo 模型包放到 `raspberry-pi/backend/models/current/`。

Pi 後端會讀取：

- `manifest.json`
- `model.hef`
- optional `labels.txt` 或 `classes.json`

模型格式以 Hailo 8L 的 `.hef` 為主，manifest 必須符合 `shared/contracts/model_manifest.schema.json`。

## Training Host

Training Host 用於資料集管理、YOLO 訓練、模型轉換與發布。

```bash
cd training-host
docker-compose up -d --build
```

- 儀表板: http://localhost:3000
- 後端 API: http://localhost:8000/docs
- TensorBoard: http://localhost:6006
- Label Studio: http://localhost:8080

Training Host 現在提供：

- `POST /api/datasets/import-run`: 接收 Edge 上傳的 run bundle zip。
- `GET /api/training/models`: 列出可發布的 Hailo 模型包。
- `GET /api/training/models/{model_id}/download`: 下載模型包。

## Edge 與 Training Host 資料交換

Edge 每次檢測可將一個 run bundle 上傳到 Training Host。bundle 內容固定為：

```text
manifest.json
report.json
program.json
images/
```

其中：

- `manifest.json` 符合 `shared/contracts/dataset_bundle.schema.json`。
- `report.json` 符合 `shared/contracts/inspection_run.schema.json`。
- `images/` 的檔名由 `report.json` 的 `image_path` 對應。
- `detections[].box` 統一為像素座標 `[x, y, w, h]`。

Edge 使用 `AOI_TRAINING_HOST_URL` 指定上傳目標，預設為 `http://127.0.0.1:8000`。

## Project Structure

```text
low-cost-aoi/
├── docs/                    # 專案文件
├── edge-backend/            # Windows Docker Edge backend 模擬
├── edge-frontend/           # Windows Docker Edge frontend 模擬
├── raspberry-pi/            # Raspberry Pi 5 + Hailo 8L 原生部署
├── shared/contracts/        # Edge/Training/Pi 共用資料與模型契約
├── training-host/           # 訓練主機
├── docker-compose.edge.yml  # Windows Edge 模擬 Compose
└── README.md
```
