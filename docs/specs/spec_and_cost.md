# 硬體規格與費用估算 (Hardware Spec & Cost)

> [!NOTE]
> 本文件整合了 BOM 表與費用預估。
> **價格基準日**: 2026-01-13
> **幣別**: 新台幣 (TWD)
> **核心架構**: Raspberry Pi 5 4GB (上位機) + BTT SKR Pico / Klipper (下位機) + Global Shutter Camera

## 1. 核心運算與視覺單元 (Compute & Vision)

| 項目 (Item) | 規格 (Spec) | 數量 | 單價 | 總價 | 關鍵理由 / 備註 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SBC 主板** | Raspberry Pi 5 (4GB RAM) | 1 | $3,200 | $3,200 | 已採購 4GB 版；Edge / 模擬器功能需以 4GB RAM 為上限設計，避免記憶體峰值過高。 |
| **散熱模組** | Active Cooler (原廠主動散熱) | 1 | $300 | $300 | 防止 CPU 過熱降頻，確保穩定性。 |
| **儲存裝置** | NVMe M.2 SSD 512GB | 1 | $1,200 | $1,200 | 取代 SD 卡，提供高速 I/O 與更長壽命。 |
| **擴充板** | PCIe to M.2 NVMe HAT | 1 | $600 | $600 | 連接 SSD 必要配件。 |
| **電源供應** | 27W USB-C PD (5V/5A) | 1 | $500 | $500 | Pi 5 官方建議供電規格。 |
| **相機模組** | **Arducam IMX296 Global Shutter** | 1 | $1,600 | $1,600 | **關鍵元件**。全域快門 USB 3.0 介面，適合動態拍攝。 |
| **鏡頭** | **16mm C-Mount Lens** | 1 | $600 | $600 | 針對 3cm FOV 最佳化 (Work Distance ~13cm)。 |
| **傳輸線材** | USB 3.0 High-Flex Cable (3m) | 1 | $300 | $300 | 需選用耐彎折線材以利拖鏈佈線。 |
| **光源** | LED 環形燈或條燈 | 1 | - | - | (視機構設計選購，暫未列入總價) |
| **小計** | | | | **$8,100** | |

## 2. 運動控制系統 (Motion Control)

| 項目 (Item) | 規格 (Spec) | 數量 | 單價 | 總價 | 關鍵理由 / 備註 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **主控板** | **BTT SKR Pico V1.0** (RP2040) | 1 | $1,000 | $1,000 | 專為 Klipper 優化，體積小，內建 TMC2209。 |
| **驅動器** | Integrated TMC2209 | - | - | - | 內建於主板，支援 UART 電流控制與 Sensorless Homing。 |
| **加速度計** | **ADXL345** (SPI) | 1 | $100 | $100 | 用於 Klipper Input Shaping 共振補償校正。 |
| **小計** | | | | **$1,100** | |

## 3. 機構與傳動 (Gantry Mechanics)

*此部分為 DIY 估算，亦可參考 OpenBuilds ACRO 系統設計。龍門尺寸目前分為兩個候選，詳見 `gantry_size_weight_options.md`。*

| 方案 | 有效量測範圍 | 初步定位 | 建議 |
| :--- | :---: | :--- | :--- |
| 方案一 | 620 x 550mm | 大面積 PCB / 泛用平台 | 可行，但重量、慣量、皮帶長度與共振控制風險較高。 |
| 方案二 | 320 x 300mm | 第一版驗證機 / 小型 PCB | **第一版指定採用**：CoreXY + GT2 9mm 同步帶，較輕、速度足夠、較適合 SKR Pico 板載 TMC2209。 |

| 項目 (Item) | 規格 (Spec) | 數量 | 單價 | 總價 | 備註 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **鋁擠型 (Y軸)** | 方案一約 700~780mm；方案二約 420~480mm | 2 | $300 | $600 | Y軸軌道基座；實際長度需依有效量測範圍與端板預留量定版。 |
| **鋁擠型 (X軸)** | 方案一約 780mm；方案二約 480mm | 1 | $200 | $200 | X軸橫樑；方案一需評估 2020 撓曲，必要時改 2040 或加強。 |
| **框架/支腳** | 2020 鋁型材 | 1式 | $1,000 | $1,000 | 底部支撐結構。 |
| **步進馬達** | NEMA 17 (42型) 1.5A+ | 2 | $350 | $700 | CoreXY A/B motor；XY 平面不再使用雙 Y + 單 X 三馬達。 |
| **同步帶** | GT2 / 2GT 9mm open belt | 約 5m | 待詢價 | 待詢價 | 第一版指定 GT2 9mm，同步帶長度依 final belt path 裁切。 |
| **同步輪** | GT2 20T pulley, 9mm belt, 5mm bore | 2 | 待詢價 | 待詢價 | 裝於兩顆 NEMA17 A/B motor。 |
| **惰輪** | GT2 20T toothed idler, 9mm belt, 5mm bore | 約 8 | 待詢價 | 待詢價 | 參考 Voron 2.4 CoreXY 9mm belt 生態，實際數量依 belt path 定版。 |
| **線性導軌 / 滑輪組** | MGN12H 優先，V-Slot Wheels 候選 | X 1 + Y 2 | 待詢價 | 待詢價 | 同步帶只負責傳動，仍需獨立線性導引承重。 |
| **龍門板 / 皮帶夾** | 鋁合金或高強度列印件 | 1組 | $800 | $800 | 固定相機、光源、X carriage 與 9mm belt clamp。 |
| **小計** | | | | **$5,750** | |

## 4. 線材與電源 (Power & Accessories)

| 項目 (Item) | 規格 (Spec) | 數量 | 單價 | 總價 | 備註 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **系統電源** | 24V 10A DC Power Supply | 1 | $600 | $600 | 獨立供電給馬達與 MCU。 |
| **拖鏈** | 10x15mm 尼龍拖鏈 | 2m | $250 | $500 | 保護 X/Y 軸運動線材。 |
| **限位開關** | Micro Switch | 3 | $30 | $90 | 回歸原點 (Homing) 用。 |
| **馬達延長線** | 4-pin High-Flex | 3 | $50 | $150 | |
| **其他** | 電源線, USB-C 線 | 1式 | $200 | $200 | |
| **小計** | | | | **$1,540** | |

---

## 總計預估 (Grand Total Estimate)

| 類別 | 金額 (TWD) |
| :--- | :--- |
| 1. 核心運算與視覺 | $8,100 |
| 2. 運動控制 | $1,100 |
| 3. 機構與傳動 | $5,750 |
| 4. 線材與電源 | $1,540 |
| **總計** | **$16,490** |

*(不含運費、工具與組裝工時)*

---

## 5. 架構優化建議 (Optimized Architecture)

針對 AOI 專案，我們建議採用 **Raspberry Pi 5 + Klipper** 架構：

1.  **Klipper Input Shaping**: 利用 ADXL345 偵測並抵消機器震動，對於高倍率取像的穩定性至關重要。
2.  **分工明確**: Pi 5 負責複雜的 AI 運算與路徑規劃，SKR Pico (MCU) 專注於步進脈衝生成，兩者透過 USB 通訊，兼顧效能與即時性。
3.  **USB Global Shutter 相機**: 將相機與運算單元分離 (不同於 Pi Camera CSI 介面受限於排線長度)，讓相機模組更輕量，適合安裝於龍門架上快速移動。

## 6. Raspberry Pi 5 4GB 記憶體約束

實機上位機已採用 **Raspberry Pi 5 4GB**，後續所有 Edge / Windows Edge Simulator 功能都需避免以開發機記憶體容量為設計基準。

- 前端建置建議在 Windows / Training Host 完成，再部署 `dist/` 到 Pi；不以 Pi 本機建置作為常態流程。
- Edge backend 啟動時不可一次載入所有模型或大量歷史圖片；模型需採 lazy load，歷史資料需分頁或按需讀取。
- 相機與推理流程避免保留多份 full-resolution frame；完成推理與存檔後應釋放中間影像物件。
- Windows Edge Simulator 若新增功能，需同步檢查 Raspberry Pi 5 4GB 是否能承受其記憶體峰值。
