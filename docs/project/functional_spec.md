# 低成本 PCB AOI 系統 — 功能說明書

> **文件版本**: 1.0  
> **最後更新**: 2026-01-13  
> **專案名稱**: Low-Cost PCB AOI System (低成本 PCB 自動光學檢測系統)

---

## 目錄

1. [專案概述](#1-專案概述)
2. [系統整體架構](#2-系統整體架構)
3. [硬體功能規格](#3-硬體功能規格)
4. [軟體功能規格](#4-軟體功能規格)
5. [Edge 邊緣單元功能](#5-edge-邊緣單元功能)
6. [Training Host 訓練主機功能](#6-training-host-訓練主機功能)
7. [資料交換契約](#7-資料交換契約)
8. [AI 視覺辨識流程](#8-ai-視覺辨識流程)
9. [使用者介面](#9-使用者介面)
10. [部署環境](#10-部署環境)
11. [階段實施計畫](#11-階段實施計畫)
12. [附錄：與商用 AOI 差異分析](#12-附錄與商用-aoi-差異分析)

---

## 1. 專案概述

### 1.1 專案目標

建構一套 **低成本、開源、可自主部署** 的 PCB 自動光學檢測 (AOI) 系統，使小型電子製造商、PCB 打樣廠、維修站與 DIY 愛好者能夠以約 NT$16,500 的硬體成本，獲得具備 AI 深度學習缺陷辨識能力的自動化光學檢測方案。

### 1.2 適用場景

- PCB 內層板 (Inner Layer) 棕化面檢測
- 軟硬結合板 (Rigid-Flex PCB) 外觀檢測
- 金手指 (Gold Finger) 表面異物與間距檢測
- 軟板成型邊緣毛邊/撕裂檢測
- 小批量產線或打樣站品質檢驗

### 1.3 核心設計原則

| 原則 | 說明 |
|:---|:---|
| **低成本** | 優先選用樹莓派、開源韌體、通用硬體，捨棄非必要功能以控制成本 |
| **邊緣運算** | AI 推理在機台端即時執行，無需依賴雲端或區域網路 |
| **模組化** | Edge 機台與 Training Host 明確分工，透過標準化契約交換資料 |
| **開源可複製** | 所有軟體、BOM、機構設計皆開源，任何人都可自行複製搭建 |

---

## 2. 系統整體架構

系統由兩大實體與三個部署環境組成：

```mermaid
graph TD
    subgraph "訓練主機 (Training Host)"
        HostPC["工作站/PC 具備 GPU"]
        HostStorage["資料集 & 模型存放"]
        LabelStudio["標註工具 (Label Studio)"]
        Docker["Docker 容器環境"]
        HostPC <-->|"模型部署/更新"| EdgeUnit
    end

    subgraph "邊緣運算單元 (Edge Unit)"
        EdgeSBC["Raspberry Pi 5 + Hailo 8L"]
        Camera["USB 全域快門相機<br>(IMX296 Global Shutter)"]
        Lighting["LED 光源 (環形燈/同軸光)"]
        Monitor["觸控 HDMI 螢幕"]
        MCU["運動控制 MCU<br>(ESP32/FluidNC 或 SKR Pico/Klipper)"]
        Motors["步進馬達 (X, Y 軸)"]
    end

    EdgeSBC -->|"USB3.0"| Camera
    EdgeSBC -->|"GPIO/Relay"| Lighting
    EdgeSBC -->|"HDMI"| Monitor
    EdgeSBC <-->|"USB/UART (G-code)"| MCU
    MCU -->|"脈衝/方向"| Motors
```

### 2.1 三種部署環境

| 環境 | 用途 | 說明 |
|:---|:---|:---|
| **Windows Edge 模擬** | 開發/測試 | `edge-backend` + `edge-frontend` 以 Docker Compose 在 Windows 本機執行，`SIMULATION_MODE=true` 模擬相機與運動控制 |
| **Raspberry Pi Edge 實機** | 產線部署 | `raspberry-pi/` 目錄下的原生部署，搭配 Hailo 8L 進行硬體加速推理 |
| **Training Host** | 訓練/管理 | PC 或工作站執行，提供資料集管理、YOLO 訓練、模型發布 API |

---

## 3. 硬體功能規格

### 3.1 BOM 與費用一覽

| 類別 | 金額 (TWD) |
|:---|:---:|
| 核心運算與視覺 | $8,100 |
| 運動控制系統 | $1,100 |
| 機構與傳動 (800×600mm) | $5,750 |
| 線材與電源 | $1,540 |
| **總計** | **$16,490** |

### 3.2 核心組件規格

| 組件 | 型號/規格 | 功能 |
|:---|:---|:---|
| **SBC 主板** | Raspberry Pi 5 8GB | AI 推理核心、系統控制、UI 伺服 |
| **AI 加速器** | Hailo-8L M.2 Kit (13 TOPS) | YOLO 模型硬體加速推理 |
| **相機** | Arducam IMX296 Global Shutter USB | 全域快門，適合動態拍攝，USB 3.0 介面 |
| **鏡頭** | 16mm C-Mount Machine Vision Lens | 工作距離 ~13cm，FOV 30mm×30mm，解析度 36 px/mm |
| **運動主控板** | BTT SKR Pico V1.0 (RP2040) 或 ESP32 | 執行 Klipper 或 FluidNC 韌體，產生步進脈衝 |
| **馬達驅動** | TMC2209 (UART Mode) | 靜音驅動，支援 Sensorless Homing |
| **加速度計** | ADXL345 (SPI) | Klipper Input Shaping 共振補償 |
| **機構** | OpenBuilds V-Slot 2040 鋁擠型 | 龍門式 XY 平台，行程 800×600mm |

### 3.3 光學系統規格

| 項目 | 規格 |
|:---|:---|
| **感測器解析度** | 1440 × 1080 (IMX296) |
| **視野 (FOV)** | 30mm × 30mm |
| **解析能力** | 36 pixels/mm |
| **最小可檢測缺陷** | 0.1mm (4 mil)，約 3.6 像素 |
| **推薦光圈** | F/8.0 (兼顧景深與進光量) |
| **景深** | ~3.2mm (理論值 @ F/8.0) |
| **光源方案** | 白色同軸光 (金手指檢測) + 環形光 (棕化面/軟板) |

---

## 4. 軟體功能規格

### 4.1 軟體技術堆疊

#### Edge 邊緣後端 (Python)

| 元件 | 版本/技術 |
|:---|:---|
| **語言** | Python 3.10 / 3.11 |
| **Web 框架** | FastAPI (v0.109+) + Uvicorn |
| **電腦視覺** | OpenCV-Python (v4.9+) |
| **AI 推理** | ONNX Runtime (v1.16+) / HailoRT (v4.16+) |
| **序列通訊** | pyserial (v3.5) |

#### Edge 邊緣前端 (Web UI)

| 元件 | 版本/技術 |
|:---|:---|
| **Runtime** | Node.js v20 LTS |
| **框架** | React v18.2+ |
| **建置工具** | Vite v5.0+ |
| **UI 程式庫** | ShadcnUI (Radix UI + Tailwind CSS v3.4) |

#### Training Host 訓練主機

| 元件 | 版本/技術 |
|:---|:---|
| **作業系統** | Windows 10/11 或 Ubuntu 22.04 LTS |
| **AI 框架** | PyTorch v2.1+, Torchvision |
| **物件偵測** | Ultralytics YOLO11 |
| **CUDA** | v12.1 (NVIDIA GPU 環境) |
| **容器化** | Docker + Docker Compose |

### 4.2 訓練主機 Docker 服務

| 服務 | Port | 用途 |
|:---|:---:|:---|
| `training-backend` | 8000 | 核心訓練後端 API (FastAPI) |
| `training-frontend` | 3000 | 訓練儀表板 UI (Nginx) |
| `redis` | 6379 | 非同步任務佇列 |
| `tensorboard` | 6006 | 訓練可視化 |
| `label-studio` | 8080 | 資料標註工具 |

---

## 5. Edge 邊緣單元功能

### 5.1 檢測流程 (Inspection Pipeline)

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ 載入掃描  │───▶│ 移至目標  │───▶│ 相機拍攝  │───▶│ AI 推理   │───▶│ 結果判定  │
│ 程式      │    │ 點位      │    │          │    │ (YOLO)   │    │ OK/NG    │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                                    │
                                                                    ▼
                                                        ┌──────────────────┐
                                                        │ 生成報告 & 上傳  │
                                                        │ 至 Training Host │
                                                        └──────────────────┘
```

### 5.2 核心功能列表

| 功能 | 說明 | 狀態 |
|:---|:---|---:|
| **掃描程式管理** | 載入/儲存/執行掃描路徑 (G-code Program) | ✅ |
| **運動控制** | 透過序列埠發送 G-code，控制 XY 龍門定位 | ✅ |
| **相機控制** | USB 3.0 全域快門相機觸發拍攝與參數設定 | ✅ |
| **光源控制** | 透過 GPIO/Relay 切換光源 (環形燈/同軸光) | ✅ |
| **AI 推理** | 載入 Hailo .hef 模型，執行 YOLO 物件偵測 | ✅ |
| **即時影像** | 低延遲相機串流顯示於前端 UI | ✅ |
| **缺陷標記** | 在 PCB 縮圖上標記缺陷位置 (Defect Map) | ✅ |
| **OK/NG 指示** | 全螢幕紅綠燈號，醒目提示檢測結果 | ✅ |
| **報告生成** | 輸出 `report.json`，包含每個檢測點結果與影像路徑 | ✅ |
| **資料上傳** | 將 Run Bundle (影像+報告) 上傳至 Training Host | ✅ |
| **手動 Jog** | 工程模式下手動移動龍門 | ✅ |
| **參數設定** | 調整馬達速度、相機曝光、推理門檻值 | ✅ |

### 5.3 狀態機 (Orchestrator State Machine)

| 狀態 | 說明 |
|:---|:---|
| `Idle` | 待機，等待操作指令 |
| `Loading` | 載入掃描程式 |
| `Moving` | 龍門移動至目標點位 |
| `Capturing` | 相機拍攝中 |
| `Inferring` | AI 推理執行中 |
| `Completed` | 檢測完成 |
| `Error` | 錯誤狀態 (可復原) |

---

## 6. Training Host 訓練主機功能

### 6.1 功能列表

| 功能 | API 端點 | 說明 |
|:---|:---|---:|
| **資料集匯入** | `POST /api/datasets/import-run` | 接收 Edge 上傳的 Run Bundle Zip |
| **資料集瀏覽** | `GET /api/datasets` | 檢視已上傳的 PCB 影像與標註 |
| **訓練任務啟動** | `POST /api/training/start` | 啟動物件偵測模型訓練 (YOLO11) |
| **訓練監控** | (整合 TensorBoard) | 即時 Loss / mAP 曲線 |
| **模型列表** | `GET /api/training/models` | 列出可發布的 Hailo 模型包 |
| **模型下載** | `GET /api/training/models/{id}/download` | 下載 `.hef` 模型包供 Edge 使用 |
| **模型匯出** | `POST /api/training/models/{id}/export` | 將 PyTorch 權重轉為 ONNX 再編譯為 Hailo .hef |

### 6.2 缺陷分類定義

| 類別 ID | 缺陷名稱 | 說明 | 建議光源 |
|:---|:---|:---|:---|
| `fm_on_gold` | 金手指表面異物 | 同軸光下呈黑點 | 同軸光 |
| `fm_in_gap` | 金手指間距異物 | 短路風險 | 同軸光 |
| `oxidized_surface_scratch` | 內層棕化面刮傷 | 銅面刮傷/氧化 | 環形光 |
| `edge_burr` | 軟板成形毛邊 | 切割邊緣毛刺 | 環形光 |
| `edge_tear` | 軟板撕裂/缺角 | 邊緣缺損 | 環形光 |

### 6.3 模型格式

| 階段          | 格式              | 說明                                          |
| :---------- | :-------------- | :------------------------------------------ |
| 訓練中         | `.pt` (PyTorch) | Ultralytics YOLO11 權重格式                     |
| 中間格式        | `.onnx`         | ONNX Runtime 通用格式                           |
| **Edge 部署** | **`.hef`**      | Hailo-8L 專用格式，需經 Hailo Dataflow Compiler 編譯 |
| 部署附帶        | `manifest.json` | 符合 `model_manifest.schema.json` 的模型中繼資料     |

---

## 7. 資料交換契約

### 7.1 Run Bundle (Edge → Training Host)

Edge 每次檢測完成後，可將一個 Run Bundle 壓縮為 Zip 上傳至 Training Host。

**Bundle 目錄結構：**

```
run_bundle_20260113_103042.zip
├── manifest.json       # 符合 dataset_bundle.schema.json
├── report.json         # 符合 inspection_run.schema.json
├── program.json        # 本次檢測使用的掃描程式
└── images/
    ├── 001.jpg
    ├── 002.jpg
    └── ...
```

**`report.json` 主要欄位：**

| 欄位 | 類型 | 說明 |
|:---|:---|---:|
| `metadata.program_name` | string | 掃描程式名稱 |
| `metadata.part_no` | string | PCB 料號 |
| `metadata.batch_no` | string | 批號 |
| `metadata.machine_id` | string | 機台 ID |
| `metadata.model_id` | string | AI 模型 ID |
| `total_points` | integer | 總檢測點數 |
| `results[].point_id` | integer | 點位編號 |
| `results[].x, y` | number | 物理座標 (mm) |
| `results[].result` | string | `"OK"` 或 `"NG"` |
| `results[].detections[].label` | string | 缺陷類別名稱 |
| `results[].detections[].confidence` | number | 信心度 (0~1) |
| `results[].detections[].box` | [number×4] | 像素座標 `[x, y, w, h]` |
| `results[].image_path` | string | 對應 images/ 下的檔名 |
| `status` | string | `"completed"` / `"error"` / `"stopped"` |

### 7.2 Model Manifest (Training Host → Edge)

| 欄位 | 類型 | 說明 |
|:---|:---|---:|
| `model_id` | string | 模型唯一識別碼 |
| `format` | string | 固定為 `"hailo-hef"` |
| `source_yolo_model` | string | 原始 YOLO 模型名稱 (如 `yolo11n`) |
| `classes` | string[] | 缺陷類別名稱列表 |
| `input_size` | [int, int] | 模型輸入尺寸 (如 `[640, 640]`) |
| `postprocess.type` | string | 後處理類型 |
| `postprocess.confidence_threshold` | number | 信心度門檻 (預設 0.5) |
| `postprocess.iou_threshold` | number | IOU 門檻 |
| `checksum.sha256` | string | 模型檔案的 SHA256 校驗 |

---

## 8. AI 視覺辨識流程

### 8.1 訓練流程 (Training Host)

```mermaid
graph LR
    A[收集 PCB 影像] --> B[標註缺陷<br>Label Studio]
    B --> C[資料增強<br>Augmentation]
    C --> D[YOLO11 訓練<br>遷移學習]
    D --> E[模型評估<br>mAP / Precision / Recall]
    E --> F[匯出 ONNX]
    F --> G[Hailo 編譯<br>.hef]
    G --> H[發布模型包<br>manifest + .hef]
```

### 8.2 邊緣推理流程 (Edge)

```
輸入影像 (相機拍攝)
    │
    ▼
① 預處理 (Preprocessing)
   - 裁切 ROI (如有)
   - 縮放至模型輸入尺寸 (640×640)
   - 正規化 (0~1)
    │
    ▼
② AI 推理 (Inference)
   - HailoRT 載入 .hef 模型
   - 執行前向傳播
    │
    ▼
③ 後處理 (Post-Processing)
   - 非極大值抑制 (NMS)
   - 信心度門檻過濾 (> threshold)
    │
    ▼
④ 座標映射 (Coordinate Mapping)
   - 將 640×640 像素座標轉為 PCB 物理座標 (mm)
   - 結合當前龍門位置 (X, Y)
    │
    ▼
⑤ 結果判定
   - 有缺陷 → NG，標記缺陷框與類別
   - 無缺陷 → OK
    │
    ▼
⑥ 結果儲存與顯示
```

### 8.3 訓練策略

- **遷移學習**: 基於 YOLO11 預訓練權重，使用少量 PCB 缺陷樣本進行 Fine-Tune
- **缺陷合成**: (選用) 在良品 PCB 影像上數位合成常見缺陷，增加負樣本數量
- **資料增強**: 旋轉、亮度調整、雜訊添加、模糊模擬，提升模型泛化能力
- **模型量化**: 訓練後轉換為 ONNX，再以 INT8 量化編譯為 Hailo .hef 格式

---

## 9. 使用者介面

### 9.1 Edge 機台操作介面 (Edge Operator UI)

專為產線作業員設計，強調直覺、簡單、大按鈕。

| 畫面 | 功能 |
|:---|:---|
| **操作面板** | 開始/停止/暫停掃描、即時狀態顯示 (Idle/Moving/Capturing) |
| **即時影像** | 低延遲相機串流畫面 |
| **OK/NG 指示燈** | 全螢幕紅綠燈號，醒目提示 |
| **缺陷地圖** | PCB 縮圖上以標記點顯示所有缺陷位置 |
| **工程模式** | 解鎖後可手動 Jog、調整參數 (速度、曝光、門檻)、校準 |

### 9.2 訓練主機儀表板 (Host Training Dashboard)

專為 AI 工程師設計，管理模型與數據。

| 畫面 | 功能 |
|:---|:---|
| **資料集瀏覽器** | 檢視 Edge 上傳的 PCB 影像與檢測結果 |
| **標註整合** | 內嵌連結至 Label Studio |
| **新建訓練** | 選擇資料集、模型架構、設定超參數 |
| **訓練監控** | Loss 曲線、mAP 即時圖表 (TensorBoard 整合) |
| **模型版本管理** | 比較不同版本的準確率、一鍵匯出 .hef 模型包 |
| **模型發布** | 將模型包推送至 Edge 機台下載 |

---

## 10. 部署環境

### 10.1 Windows Edge 模擬 (開發環境)

```bash
docker-compose -f docker-compose.edge.yml up -d --build
```

| 服務 | URL |
|:---|:---:|
| 前端 UI | `http://localhost:3001` |
| 後端 API | `http://localhost:8001/docs` |

後端以 `SIMULATION_MODE=true` 啟動，模擬相機拍攝、運動控制與檢測流程，適合不連接實體硬體時的開發與測試。

### 10.2 Raspberry Pi Edge 實機 (產線環境)

部署流程：

```
① Windows 編譯前端 dist/
         │
         ▼
② 將 dist/ 傳送到 Raspberry Pi
         │
         ▼
③ Pi 執行後端部署腳本
   raspberry-pi/backend/deploy-pi-backend.sh
         │
         ▼
④ Pi 執行前端部署腳本
   raspberry-pi/frontend/deploy-pi-frontend.sh
         │
         ▼
⑤ 將 Training Host 產出的 Hailo 模型包
   放入 raspberry-pi/backend/models/current/
```

Pi 後端會讀取模型目錄下的：
- `manifest.json` — 模型中繼資料
- `model.hef` — Hailo 編譯後的模型檔案
- `labels.txt` 或 `classes.json` — (選用) 類別標籤檔案

### 10.3 Training Host 訓練環境

```bash
cd training-host
docker-compose up -d --build
```

| 服務 | URL |
|:---|:---:|
| 儀表板 | `http://localhost:3000` |
| 後端 API | `http://localhost:8000/docs` |
| TensorBoard | `http://localhost:6006` |
| Label Studio | `http://localhost:8080` |

Edge 使用環境變數 `AOI_TRAINING_HOST_URL` 指定上傳目標，預設為 `http://127.0.0.1:8000`。

---

## 11. 階段實施計畫

### Phase 1: 主機端開發 (Host Logic & Training)

- **目標**: 驗證 AI 對 PCB 缺陷的辨識能力
- **作法**: 不連接實體硬體，使用 Docker 架設訓練伺服器，上傳歷史圖片進行標註與訓練
- **產出**: 可用的 YOLO11 模型 (.pt → .onnx)

### Phase 2: 半自動 AOI (Static Edge Inference)

- **目標**: 驗證現場光學環境與 Edge 算力
- **作法**: 作業員手動放置 PCB → 點擊 UI「截圖檢測」→ Pi 拍照推論 → 顯示結果
- **硬體**: 僅需相機 + RPi，不連接運動控制板

### Phase 3: 導入運動控制 (Motion Integration)

- **目標**: 實現自動化掃描大尺寸 Panel
- **作法**: 連接 ESP32/FluidNC 或 SKR Pico/Klipper，載入掃描路徑 G-code，執行「移-停-拍」循環

### Phase 4: 完整部署 (Full Deployment)

- **目標**: 產線整合與穩定性驗證
- **項目**: 壓力測試、使用者權限管理、模型持續迭代機制

---

## 12. 附錄：與商用 AOI 差異分析

| 特性 | 本專案 | 商用專業 AOI | 差距與影響 |
|:---|:---|:---|:---|
| **光源系統** | 單色環形燈 + 同軸光 | 多角度 RGB 塔狀光 | 無法以色差判別焊錫爬升角度 |
| **運動精度** | 步進馬達 (開迴路) | 線性馬達 + 光學尺 (閉迴路) | 重複精度 ~0.05mm vs 1μm |
| **編程方式** | 手動教導 / 簡易掃描 | CAD/Gerber 匯入自動生成 | 換線速度較慢 |
| **鏡頭光學** | 標準 C-Mount FA 鏡頭 | 遠心鏡頭 (Telecentric) | 邊緣視差需軟體校正 |
| **深度檢測** | 2D 影像 + AI | 3D 結構光 / 雲紋干涉 | 無法檢測元件浮高 |
| **系統整合** | 單機作業 + 內網 API | SMEMA / MES 自動連線 | 需手動上下料 |
| **價格** | **~NT$16,500** | **NT$100萬~500萬** | 成本不到 1/60 |

### 12.1 第一版暫不包含的功能

- Gerber/CAD 匯入 — 依賴手動設定掃描區域
- 條碼讀取 (Barcode/DataMatrix) — 可透過軟體擴充
- 自動寬度調整 — 機構為固定式或手動調整
- 離線編程 — 需在實機上訓練/設定

---

> **文件結束**
