# 低成本 PCB AOI 系統 (Low-Cost PCB AOI System)

這是一個專為電子製造與 DIY 愛好者設計的經濟型開源自動光學檢測 (AOI) 系統。本專案包含兩個主要組件：負責即時檢測的 **Edge System (邊緣系統)** (Raspberry Pi 5)，以及負責 AI 模型開發的 **Training Host (訓練主機)** (PC)。

## 📚 專案文件 (Documentation)

詳細文件位於 `docs/` 目錄中：

- **硬體 (Hardware)**:
    - [硬體規格與費用估算](docs/hardware/spec_and_cost.md)
    - [相機與光學設置指南](docs/hardware/camera_optics.md)
    - [運動控制方案選擇](docs/hardware/motion_control_selection.md)
    - [Klipper 設定教學](docs/hardware/klipper_setup.md)
- **專案管理 (Project)**:
    - [實作計畫](docs/project/implementation_plan.md)
    - [進度報告 (2026-01-13)](docs/project/status_report_2026_01_13.md)
    - [待辦事項](docs/project/tasks.md)
- **資源 (Resources)**:
    - [學習資源與參考](docs/resources/references.md)

## 🏗️ 系統架構

### 1. 邊緣系統 (Edge System - Raspberry Pi 5)
位於 `edge-backend` 與 `edge-frontend` 的執行環境。
- **硬體**: Raspberry Pi 5 + FluidNC/Klipper 龍門架 + USB/CSI 相機。
- **後端**: FastAPI (Python)。處理運動控制 (G-Code)、相機串流與 AI 推論。
- **前端**: React + Vite (TypeScript)。提供操作員介面，包含教學 (Teaching)、執行 (Run) 與回顧 (Review) 功能。
- **部署**: 透過 `docker-compose.edge.yml` 運行視訊與 API 服務容器。

### 2. 訓練主機 (Training Host - PC / Workstation)
位於 `training-host` 的開發環境。
- **用途**: 管理資料集與訓練 AI 模型 (YOLO/MobileNet)。
- **技術棧**: Python, PyTorch/TensorFlow, Jupyter。
- **部署**: 透過 `docker-compose.yml` (標準) 運行。

---

## 🚀 邊緣系統快速開始 (Edge System Quick Start)

邊緣系統是操作 AOI 機台的核心介面。

### 前置需求
- Docker & Docker Compose
- Raspberry Pi 5 (建議) 或 Linux PC

### 執行邊緣服務
1. 進入專案根目錄：
   ```bash
   cd low-cost-aoi
   ```
2. 啟動 Edge 服務堆疊：
   ```bash
   docker-compose -f docker-compose.edge.yml up -d --build
   ```
3. 存取介面：
   - **前端 UI**: [http://localhost:3001](http://localhost:3001)
   - **後端 API**: [http://localhost:8001/docs](http://localhost:8001/docs)

### ✨ Edge 主要功能
- **教學模式 (Teaching Mode)**: 
  - 手動移動控制 (Jog Control)。
  - 記錄參考點 (Fiducial) 與檢測點。
  - **新功能**: 拖放排序點位、行內編輯座標、以及「移動相機至此」驗證工具。
- **檢測執行 (Inspection Run)**: 
  - 自動化掃描序列 (支援模擬或真實運動)。
  - PCB 手動對位精靈。
- **回顧儀表板 (Review Dashboard)**:
  - 檢測執行歷史紀錄。
  - **新功能**: CSV 資料匯出與歷史紀錄管理 (刪除功能)。

---

## 🖥️ 訓練主機快速開始 (Training Host Quick Start)

用於訓練新的 AI 模型或管理大型資料集。

1. 進入 `training-host` 目錄 (若為獨立開發) 或使用根目錄 compose：
   ```bash
   docker-compose up -d --build
   ```
2. 存取服務：
   - **儀表板**: [http://localhost:3000](http://localhost:3000)
   - **TensorBoard**: [http://localhost:6006](http://localhost:6006)

---

## 📂 專案結構

```
e:\Docker\low-cost-aoi\
├── docs/               # 專案文件 (硬體, 專案規劃, 資源)
├── edge-backend/       # FastAPI 應用程式 (運動, 相機, 推論)
├── edge-frontend/      # React 應用程式 (操作員 UI)
├── training-host/      # 模型訓練腳本與伺服器
├── shared/             # 共用程式碼/模型
├── docker-compose.edge.yml  # 邊緣系統 Compose 檔
└── docker-compose.yml       # 訓練主機 Compose 檔
```
