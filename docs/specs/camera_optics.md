# 相機與光學設置指南 (Camera & Optics Guide)

## 1. 樹莓派 5 相機連接 (Pi 5 Camera Connection)

Raspberry Pi 5 的相機接口與舊版 (Pi 3/4) 不同，這點非常關鍵。

*   **舊版接口 (Pi 3/4)**: 普通 CSI 接口 (15-pin, 1mm 間距)。
*   **新版接口 (Pi 5 / Zero 2W)**: Mini CSI 接口 (22-pin, 0.5mm 間距)。
*   **您的相機**: 大多數 IMX296 模組出廠預設為 15-pin 排線。

> [!WARNING]
> **關於軟排線長度的重要建議 (Cable Length & Mounting Strategy)**
> 
> 若您希望能 **減輕龍門架重量 (Lightweight Gantry)**，讓樹莓派固定在電控箱，只移動相機，我們提供以下兩套方案：
>
> ### 方案 A：改用 USB 3.0 全域快門相機 (推薦)
> *   **核心概念**: 放棄 CSI 介面，改用 USB 3.0 傳輸影像。
> *   **推薦型號**: **Arducam IMX296 Global Shutter USB Camera** (這是一體式模組，內建 USB 介面)。
> *   **優點**: USB 3.0 線材 (3米內) 訊號穩定，且比 HDMI 線更柔軟 (需選購柔軟細線)，適合走拖鏈。
> *   **重量**: 僅相機模組重量，極輕。
>
> ### 方案 B：使用 CSI 轉 HDMI 延長套件
> *   **核心概念**: 使用 Arducam CSI to HDMI Cable Extension Kit。
> *   **原理**: Pi 端(CSI轉HDMI) -> HDMI 線 (可達 3~5米) -> 相機端(HDMI轉CSI) -> IMX296 相機。
> *   **優點**: 沿用原本的 CSI 相機，成本增加最少 (套件約 $500 TWD)。
> *   **缺點**: 兩端都需要轉接板，接點多了一倍，震動環境下可能有接觸不良風險。且標準 HDMI 線較硬，需特挑 "極細 HDMI 線" 才能入拖鏈。
> 
> ---
> 
> **若您決定維持「Pi on Gantry (Pi 鎖在龍門架上)」的原始方案：**
> *   **CSI 排線極限**: 建議**不要超過 30cm**。
> *   **唯一解法**: 請將 Raspberry Pi 5 與相機鎖在一起移動。
> *   **拖鏈走線**: 拖鏈內只需走 USB-C 電源線與 Ethernet 網路線。

**連接步驟 (針對原始 CSI 方案)**:
1.  **斷電**: 務必先將樹莓派關機斷電。
2.  **辨識接口**: Pi 5 上有 CAM0 與 CAM1 兩個接口，建議先接 **CAM1** (靠近 USB 孔的那一個)。
3.  **接線方向**: 排線的金屬接點 (Contacts) 通常**朝向電路板面** (Face Down)，藍色/黑色補強板朝上。請參考該排線的具體說明。
4.  **固定**: 輕輕扣上卡扣。

---

## 2. 光學需求分析 (Optical Analysis)

針對您的需求：
*   **目標缺點 (Defect Size)**: 4 mil ~ 12 mil (0.1mm ~ 0.3mm)
*   **確認視野 (FOV)**: **3cm x 3cm (30mm x 30mm)**
*   **相機**: IMX296

### 2.1 解析度檢核 (Resolution Check)

*   **IMX296 解析度**: 1440 x 1080
*   **視野**: 30mm (短邊)
*   **解析能力**: $1080 / 30 = \textbf{36 pixels/mm}$
*   **最小缺點 (4 mil = 0.1mm)**:
    $$ 0.1 \text{ mm} \times 36 \text{ pixels/mm} \approx \textbf{3.6 pixels} $$
    
**結論**:
*   此配置下，4mil 缺點佔 3.6 個像素，**檢測穩定性高**，符合專案需求。

### 2.2 鏡頭選型 (Lens Selection)

我們設定目標視野為 **30mm**。
假設工作距離 (WD) 保持在 **13cm ~ 15cm** 之間。

公式: $f \approx WD \times \frac{\text{Sensor Size}}{\text{FOV}}$
$f \approx 130 \text{mm} \times \frac{3.73}{30} \approx 16.1 \text{mm}$

**最終規格確認**:
*   **鏡頭焦距**: **16mm C-Mount Lens**
*   **工作距離**: 安裝高度約 **13cm** (鏡頭前端至 PCB 表面)。
*   此配置可完美達成 3cm FOV。

### 2.3 鏡頭種類選購指南 (Lens Buying Guide)

市面上有許多 "16mm C-Mount" 鏡頭，但品質差異巨大。針對 AOI 檢測 (尤其是 4mil 微小缺點)，請務必挑選 **機器視覺專用鏡頭 (Machine Vision Lens)**，而非一般的 CCTV 監控鏡頭。

**關鍵差異**:
1.  **低畸變 (Low Distortion)**:
    *   **Machine Vision Lens**: 畸變率通常 < 0.1%。這對 AOI 至關重要，確保直線不會變成弧線，且邊緣解析度與中心一致。
    *   **CCTV Lens**: 畸變較大 (Barrel Distortion)，邊緣畫質鬆散，容易導致誤判。
2.  **百萬畫素等級 (MP Rating)**:
    *   請選購標示支援 **"3MP" 或 "5MP"** 以上的鏡頭。雖然 IMX296 只有 1.6MP，但高標示的鏡頭光學解析力較好，能確保每個像素都清晰。
3.  **光圈固定 (Locking Screws)**:
    *   工業鏡頭通常有 **光圈與對焦鎖定螺絲**。這是為了防止機台震動導致焦距跑掉。一般的 CCTV 鏡頭沒有鎖定功能，震久了就會糊掉。

**推薦關鍵字**:
*   搜尋時請用: `16mm C-Mount Machine Vision Lens 3MP`
*   避開便宜的 (< $300 TWD) "CCTV Lens" 或 "Security Lens"。
*   預算建議: **$600 ~ $1,500 TWD** 之間的鏡頭通常性價比最好 (例如 Arducam 或 Fujinon/Computar 的入門款)。

---

## 3. 應對板彎與起伏問題 (Handling Board Warpage)

內層板 (Inner Layer) 常因為沒有鑽孔或銅箔應力而產生起伏。若起伏超過鏡頭的「景深 (Depth of Field, DOF)」，影像就會模糊，導致誤判。

### 3.1 景深計算 (DOF Analysis)
針對您的配置：
*   **鏡頭**: 16mm
*   **工作距離**: 130mm
*   **光圈 (Aperture)**: 可調整 (F1.6 ~ F16)

根據光學公式計算，您的有效景深 (DOF) 如下：

| 光圈值 (F-Stop) | 理論景深 (Theoretical DOF) | 實際可用景深 (Safe DOF) | 備註 |
| :--- | :--- | :--- | :--- |
| **F/2.8** | ~1.1 mm | **~0.6 mm** | 僅適用於非常平整的板子 |
| **F/5.6** | ~2.2 mm | **~1.1 mm** | 普通設定，亮度適中 |
| **F/8.0** | ~3.2 mm | **~1.6 mm** | **AOI 推薦起點** (兼顧清晰度與進光量) |
| **F/16** | ~6.4 mm | **~3.2 mm** | 景深最深，但**需要極強光源** |

> [!TIP]
> **光學解法 (Optical Solution)**:
> 將光圈縮小至 **F/8 或 F/11**，您可以獲得約 **2~3mm** 的垂直容許度。這可以解決輕微的板彎。但副作用是畫面變暗，因此您的**LED 光源必須夠亮** (這就是為什麼 BOM 表中列了環形燈)。

### 3.2 機構壓平解法 (Mechanical Solution)
若板彎超過 3mm，單靠光學無法解決 (畫面會太暗或解析度下降)，必須使用物理方式壓平：

1.  **真空吸盤平台 (Vacuum Table)**:
    *   **原理**: 製作一個多孔平面，下方接真空產生器 (或簡單的吸塵器改裝)，利用負壓將板子牢牢吸平。
    *   **優點**: 全平面平整，不遮擋相機視野。
    *   **Low-Cost 實作**: 使用 3D 列印製作中空夾層板，表面鑽細孔，側面接氣管。

2.  **邊緣壓夾 (Edge Clamps)**:
    *   **原理**: 使用快速夾具 (Toggle Clamps) 或磁性壓條壓住 PCB 邊緣。
    *   **缺點**: 只能壓邊緣，中間仍可能隆起 (Pillow effect)。

3.  **透明壓板 (Transparent Plate)** - *不推薦*
    *   雖可用玻璃壓平，但玻璃會反光 (Reflection) 且容易髒污，嚴重干擾 AOI 判讀，除非使用高價的抗反射玻璃 (AR Glass)。

**結論**: 優先嘗試 **縮光圈 (F/8) + 強光**。若無效，再考慮製作 **DIY 真空吸盤**。
