# 硬體費用估算表 (Hardware Cost Breakdown)

> [!NOTE]
> 以下價格為**新台幣 (TWD)** 預估值，實際費用可能因供應商、匯率與購買數量變動。
> 預設架構：Raspberry Pi 上位機 + BTT FluidNC 下位機 + 鋁擠型龍門架結構。

## 1. 樹莓派硬體 (Raspberry Pi Hardware)

| 項目 (Item) | 規格/說明 (Spec) | 數量 (Qty) | 單價 (Unit Price) | 總價 (Total) | 備註 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **主板 (SBC)** | Raspberry Pi 5 (8GB) | 1 | $3,200 | $3,200 | 最新一代，大幅提升 AI 效能 |
| **散熱殼** | 鋁合金被動散熱或帶風扇殼 | 1 | $300 | $300 | 避免 AI 運算過熱降頻 |
| **儲存裝置** | NVMe M.2 SSD 512GB | 1 | $1,200 | $1,200 | 大容量高速儲存 (取代記憶卡) |
| **擴充板** | Pi 5 PCIe to M.2 NVMe HAT | 1 | $600 | $600 | 建構 PCIe SSD 必要轉接板 |
| **電源供應器** | 27W USB-C PD 電源 (官方建議) | 1 | $500 | $500 | Pi 5 需 5V/5A 供電以發揮全效能 |
| **相機模組** | Raspberry Pi Camera v2 / v3 或 USB Webcam | 1 | $1,200 | $1,200 | 視需求選擇全域快門或高畫素 |
| **小計** | | | | **$7,000** | |

## 2. 移動機構 MCU 主板 (Motion Control MCU)

| 項目 (Item) | 規格/說明 (Spec) | 數量 (Qty) | 單價 (Unit Price) | 總價 (Total) | 備註 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **主控板** | BIGTREETECH Rodent / Manta (FluidNC) | 1 | $1,500 | $1,500 | ESP32 為核心，內建或外掛 TMC 驅動，支援 WiFi/WebUI |
| **驅動器** | TMC2209 (若主板未內建) | 4 | $150 | $600 | 靜音驅動，支援 UART 模式 |
| **散熱片** | 驅動器散熱片 | 4 | $10 | $40 | |
| **小計** | | | | **$2,140** | |

## 3. 龍門架機構 (Gantry Frame 800x600mm)

此部分為 DIY 鋁擠型結構估算，若購買現成套件 (如 OpenBuilds ACRO 系統) 價格會較高。

| 項目 (Item) | 規格/說明 (Spec) | 數量 (Qty) | 單價 (Unit Price) | 總價 (Total) | 備註 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **鋁擠型 (X軸)** | 2040 歐規鋁型材 (800mm) | 2 | $300 | $600 | Y軸軌道用 |
| **鋁擠型 (Y軸)** | 2020/2040 歐規鋁型材 (600mm) | 1 | $200 | $200 | X軸橫樑 |
| **鋁擠型 (框架)** | 2020 鋁型材 (底部框架與支腳) | 1式 | $1,000 | $1,000 | 依設計圖裁切 |
| **步進馬達** | NEMA 17 (42型) 1.5A | 3 | $350 | $1,050 | 雙Y軸 + 單X軸 |
| **傳動皮帶** | GT2 6mm 皮帶 | 5米 | $100 | $500 | |
| **滑輪組** | V-Slot 滑輪 (Pom輪+軸承) | 20 | $40 | $800 | 含偏心柱與墊片 |
| **龍門板** | 鋁合金或壓克力龍門板 (X/Y軸用) | 1組 | $800 | $800 | |
| **聯軸器/惰輪** | GT2 20齒同步輪、光軸惰輪 | 1式 | $300 | $300 | |
| **螺絲/角碼** | M4/M5 T型螺母、內六角螺絲、直角件 | 1包 | $500 | $500 | 組裝耗材 |
| **小計** | | | | **$5,750** | |

## 4. 其餘若干線材 (Cables & Misc)

| 項目 (Item) | 規格/說明 (Spec) | 數量 (Qty) | 單價 (Unit Price) | 總價 (Total) | 備註 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **馬達延長線** | 4 Pin 杜邦/XH2.54 端子線 (1-2米) | 3 | $50 | $150 | 需支援拖鏈運動 |
| **限位開關** | 微動開關 (Micro Switch) | 3 | $30 | $90 | X, Y, Z 歸零用 |
| **拖鏈** | 10x15mm 尼龍拖鏈 | 2米 | $250 | $500 | 保護線材整線用 |
| **電源供應器** | 12V/24V 10A 工業電源 (供馬達用) | 1 | $600 | $600 | 獨立供電給 MCU/Driver |
| **電源線** | 110V AC 線與 DC 電源線 | 1組 | $100 | $100 | |
| **主機連接線** | USB Type-C (Pi 5 to MCU) | 1 | $100 | $100 | 資料傳輸 |
| **小計** | | | | **$1,540** | |

---

## 總計預估 (Grand Total Estimate)

| 類別 (Category) | 金額 (TWD) |
| :--- | :--- |
| 1. 樹莓派硬體 | $7,000 |
| 2. MCU 主板 | $2,140 |
| 3. 龍門架機構 | $5,750 |
| 4. 線材與電源 | $1,540 |
| **總計 (Total)** | **$16,430** |

*註：不含運費、工具費用及開發工時。*

---

## 5. 方案比較 (Scenario Comparison)

針對不同需求與預算，提供以下三種配置方案比較：

| 比較項目 | **方案 1: 極致 CP 值 (DIY)** | **方案 2: 建議優化架構** | **方案 3: 專業檢測 (工業級)** |
| :--- | :--- | :--- | :--- |
| **核心配置** | Pi 4 + Arduino/GRBL + DIY機構 | **Pi 5 + FluidNC + DIY機構** | IPC + PLC + 工業滑台 |
| **主機費用** | ~$4,350 (Pi 4/4G) | **$7,000** (Pi 5/8G/SSD) | >$30,000 (i5 IPC) |
| **控制器** | ~$710 (Uno+CNC Shield) | **$2,140** (ESP32/FluidNC) | >$10,000 (PLC/運動控制卡) |
| **機構費用** | ~$5,750 | **~$5,750** | >$25,000 |
| **視覺系統** | WebCam | **Raspberry Pi Cam** | 工業相機 |
| **預估總價** | **~$12,350** | **~$16,430** | **>$80,000** |
| **優點** | 成本最低，社群資源多 | **AI 算力強，通訊穩定，擴充性佳** | 穩定性最高，精度高 |
| **缺點** | Pi 4 AI 較慢，GRBL 功能受限 | 成本稍增，需處理 PySerial 通訊 | 成本極高 |
| **適用對象** | 入門學習 | **本專案推薦 (AOI 邊緣運算)** | 高階產線 |

---

## 6. 建議優化架構與可行性分析 (Optimized Architecture)

針對您的 AOI 專案需求，我們提出以下優化架構，結合了**邊緣運算效能**與**即時運動控制**的最佳平衡。

### 系統架構圖 (System Architecture)

```mermaid
graph TD
    User[使用者/操作員] -->|操作| Frontend[Edge Frontend (React)]
    
    subgraph "Raspberry Pi 5 (Edge Unit)"
        Frontend -->|HTTP API| Backend[Edge Backend (FastAPI)]
        Backend -->|Image Capture| Camera[Camera Service]
        Backend -->|G-Code| Serial[PySerial Service]
        Camera -->|Inference| AI[AI Model (TensorFlow/PyTorch)]
    end
    
    subgraph "Motion Controller"
        Serial <-->|USB/UART (G-Code)| FluidNC[BTT FluidNC Board (ESP32)]
        FluidNC -->|Pulse/Dir| Drivers[TMC2209 Drivers]
    end
    
    subgraph "Hardware"
        Drivers -->|Power| Motors[Stepper Motors]
        CameraHardware[Pi Camera] -->|CSI/USB| Camera
    end
```

### 優化重點分析

1.  **專用通訊分流 (Separation of Concerns)**
    *   **非即時層 (Non-Realtime)**: 樹莓派 (Pi 5) 專注於 **AI 影像辨識**、**Web 伺服器** 與 **人機介面**。Pi 5 的 8GB RAM 與 NVMe SSD 能確保在執行 Docker 與 AI 模型時不卡頓。
    *   **硬即時層 (Hard-Realtime)**: BTT FluidNC (ESP32) 專注於 **發送脈波 (Pulse)** 控制馬達。ESP32 雙核架構比傳統 Arduino 8-bit 更強大，能處理更高速平滑的加減速運算 (S-Curve)，且不會因樹莓派的 CPU 負載波動而導致馬達掉步 (Step Loss)。

2.  **軟體控制整合 (Software Integration)**
    *   **前端發令，後端執行**: 您目前的 `edge-frontend` 透過 REST API 發送 `/jog` 或 `/home` 指令。
    *   **透明傳輸**: `edge-backend` 僅需擔任 "翻譯官"，將 API 請求轉換為 G-Code (如 `G0 X10`)，透過 USB Serial 丟給 FluidNC。
    *   **優勢**: 不需要依賴 FluidNC 的原生 Web 介面，您的 React App 擁有 100% 的控制權，操作體驗更一致。

3.  **彈性擴充 (Scalability)**
    *   **介面保留**: FluidNC 板載 WiFi 功能可保留作為 "除錯通道" (Debug Channel)。若樹莓派當機或通訊異常，工程師仍可透過手機連入 FluidNC 進行緊急歸零或診斷，無需拆機。

### 結論
此架構在成本增加不到 $4,000 TWD 的情況下 (Pi 4 -> 5, Arduino -> ESP32)，獲得了 **接近工業級的運動平滑度** 與 **足夠的 AI 邊緣算力**，是性價比最高的選擇。
