# 低成本 PCB AOI 系統 (Low-Cost PCB AOI System)

這是一個專為電子製造與 DIY 愛好者設計的經濟型開源自動光學檢測 (AOI) 系統。

## 開發進度

**目前進度：Phase 2 - Raspberry Pi 截圖部署。**

Phase 2 的重點是先讓 Raspberry Pi 實機穩定完成「相機截圖、人工 OK/NG 判定、資料回收、模型包管理入口」；本階段不啟用 YOLO / Hailo 自動推論，也不整合移動平台。

| 階段 | 狀態 | 目標 |
|:---|:---:|:---|
| Phase 1: 架構、UI、Training Host | 已完成 / 維護中 | 建立三環境架構、資料契約、Training Host 訓練與模型包流程 |
| Phase 2: Raspberry Pi 截圖部署 | 目前階段 | Pi 前後端部署、CCD camera 取像、Capture、人工覆判、Export / Transfer |
| Phase 3: Pi 截圖 + 邊緣辨識 | 待開始 | 啟用 YOLO / Hailo 推論、模型辨識結果、辨識錯誤回收 |
| Phase 4: Pi 移動架構整合 | 待開始 | 整合 SKR Pico / Klipper / Moonraker、自動掃描與長時間運作 |

### Phase 2 已完成

- Raspberry Pi 5 4GB 實機前後端部署：backend 使用 systemd，frontend 使用 nginx。
- Tailscale 外網維護連線規格已整理；公開文件只保留占位符，不保存實際 IP、使用者或 SSH key 路徑。
- 新增快速啟動腳本：
  - `raspberry-pi/start-aoi.sh`
  - `start-pi-aoi.ps1`
- 新 CCD / USB camera 已改用 OpenCV V4L2 backend，支援環境變數設定 camera index、解析度、FPS 與 FOURCC。
- 新增 `GET /api/camera/status`，可檢查實際取像狀態。
- Capture 流程可儲存圖片、保留 metadata、人工 OK / NG、匯出 Training Host 相容 bundle。
- Edge model registry 已建立，可安裝、刷新、啟用 model bundle；實際 inference 仍鎖在 Phase 3。
- Raspberry Pi 前端與 Windows Edge Simulator 前端加入 Transfer UI，可上傳 capture bundle 到 Training Host，也可把 model bundle zip 安裝到 Edge。
- Training Host 已具備資料匯入、訓練 UI、驗證、模型包建立與下載流程。

### Phase 2 尚未包含

- 不執行 Hailo / YOLO 自動辨識。
- 不依模型結果自動判定 OK / NG。
- 不整合 XY 移動平台、Jog、自動掃描或 Klipper / Moonraker。
- 不處理 MES / SMEMA / 商用 AOI 產線整合。

## 專案環境

專案分成三個明確環境：

- `windows-edge-simulator/`: Windows 本機 Docker Edge 模擬環境，內含 `edge-backend/` 與 `edge-frontend/`。
- `raspberry-pi/`: Raspberry Pi 5 4GB + Hailo 8L 實機 Edge 原生部署環境。
- `training-host/`: PC/Workstation 訓練主機，用於資料集管理、YOLO 訓練與 Hailo 模型包發布。

## Documentation

- 規格文件集中入口: [docs/specs/README.md](docs/specs/README.md)
- 後續功能開發基準: [docs/specs/development_roadmap.md](docs/specs/development_roadmap.md)
- 主要文件:
  - [開發路線圖](docs/specs/development_roadmap.md)
  - [功能說明書](docs/specs/functional_spec.md)
  - [實作計畫與架構](docs/specs/implementation_plan.md)
  - [硬體規格與費用估算](docs/specs/spec_and_cost.md)
  - [待辦事項](docs/specs/tasks.md)
- 資料/模型契約:
  - `shared/contracts/inspection_run.schema.json`
  - `shared/contracts/dataset_bundle.schema.json`
  - `shared/contracts/model_manifest.schema.json`

## Windows Edge 模擬

Windows 下的 Edge 前後端只作 Docker 模擬與 UI/API 開發，不包含樹莓派安裝流程。

```bash
cd windows-edge-simulator
docker-compose -f docker-compose.edge.yml up -d --build
```

- 前端 UI: http://localhost:3001
- 後端 API: http://localhost:8001/docs

`windows-edge-simulator/docker-compose.edge.yml` 會以 `SIMULATION_MODE=true` 啟動後端，適合本機測試相機、運動、檢測流程與資料上傳 API。此環境的程式需以 Raspberry Pi 邊緣裝置的效能限制為設計前提，避免依賴訓練主機等級的算力。

## Raspberry Pi Edge 實機

樹莓派實機部署已拆到 `raspberry-pi/`，避免被 Windows Docker 設定影響。

請從 [raspberry-pi/README.md](raspberry-pi/README.md) 開始安裝。重點流程：

1. 在 Windows 編譯 `raspberry-pi/frontend` 的 `dist/`。
2. 將 `dist/` 傳到 Raspberry Pi。
3. 在 Pi 執行 `raspberry-pi/backend/deploy-pi-backend.sh` 與 `raspberry-pi/frontend/deploy-pi-frontend.sh`。
4. 將 Training Host 產出的 model bundle zip 透過 Transfer UI 上傳，或放到 `raspberry-pi/backend/models/<model_id>/`。

Pi 後端會讀取：

- `manifest.json`
- `model.hef`
- optional `labels.txt` 或 `classes.json`

模型格式以 Hailo 8L 的 `.hef` 為主，manifest 必須符合 `shared/contracts/model_manifest.schema.json`。
Phase 2 可管理模型包與 active model，但不載入模型做自動推論。

## Training Host

Training Host 用於資料集管理、YOLO 訓練、模型轉換與發布。

後端預設以 Windows 終端機部署，不再依賴 Docker backend。

PowerShell 視窗 1：

```powershell
cd training-host
.\start-backend.ps1
```

PowerShell 視窗 2：

```powershell
cd training-host
.\start-frontend.ps1
```

- 儀表板: http://localhost:3000
- 後端 API: http://localhost:8000/docs
- Label Studio: 可視需要另外啟動 Docker 版或本機安裝版，標註後匯出 YOLO dataset

若只想用 Docker 啟動前端與 Label Studio，也可以在後端終端機已啟動後執行：

```powershell
cd training-host
docker compose up -d --build frontend label-studio
```

此 compose 不會啟動 Training Host 後端，也不會啟動 Redis；前端容器會透過 `host.docker.internal:8000` 連到終端機後端。

Training Host 現在提供：

- `POST /api/datasets/import-run`: 接收 Edge 上傳的 run bundle zip。
- `POST /api/training/start`: 從 UI 啟動 YOLO11 訓練。
- `POST /api/training/validate`: 使用額外驗證資料集計算模型合格率。
- `GET /api/training/models`: 列出可發布的模型包。
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
├── docs/specs/              # 規格文件集中資料夾
├── raspberry-pi/            # Raspberry Pi 5 4GB + Hailo 8L 原生部署
├── shared/contracts/        # Edge/Training/Pi 共用資料與模型契約
├── training-host/           # 訓練主機
├── windows-edge-simulator/  # Windows Docker Edge 模擬
│   ├── edge-backend/
│   ├── edge-frontend/
│   └── docker-compose.edge.yml
└── README.md
```
