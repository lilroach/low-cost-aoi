# Learning Resources for Low-Cost AOI Project

本文件整理了針對您 AOI 專案所需的 **開源課程** 與 **精選教學影片**，涵蓋機構組裝、電控設定到 AI 模型訓練。

## 1. 龍門機構組裝 (Gantry Assembly)
您的硬體清單使用 2020/2040 鋁擠型與 OpenBuilds 風格的 V-Slot 滑輪。以下資源將教您如何組裝這類結構。

### 📺 推薦影片 (YouTube)
*   **[必看] OpenBuilds ACRO System Assembly**
    *   **內容**: 官方組裝教學，詳細展示 V-Slot、滑輪偏心柱調整、皮帶張力設定。這是最接近您 CoreXY/Gantry 設計的標準教學。
    *   **關鍵詞**: `OpenBuilds ACRO Assembly`, `Eccentric Spacer Adjustment`
*   **DIY CNC Router Build (2020 Profile)**
    *   **內容**: 展示如何僅用 2020 鋁擠型與 3D 列印件搭建穩固的龍門架構。
    *   **學習點**: 鋁擠型直角連接 (Corner Bracket) 的技巧、T 型螺母 (T-Nut) 的正確用法。

### 📚 關鍵知識點
*   **偏心柱 (Eccentric Spacers)**: 用於消除滑輪與軌道間的間隙 (Play)，這是精度關鍵。
*   **皮帶張力 (Belt Tension)**: 太鬆會導致背隙 (Backlash)，太緊會磨損馬達軸承。

---

## 2. 運動控制器設定 (FluidNC / ESP32)
您使用 BTT FluidNC 主板，這不需要編寫程式碼，而是透過 **YAML 設定檔** 來定義機器參數。

### 📺 推薦影片 & 文件
*   **[必看] FluidNC Wiki & Web Installer**
    *   **連結**: [FluidNC Wiki](http://wiki.fluidnc.com/)
    *   **內容**: 如何使用網頁瀏覽器直接刷寫 ESP32 韌體，以及如何上傳 `config.yaml`。
*   **Bart Dring's FluidNC Deep Dive**
    *   **內容**: FluidNC 作者親自解說架構，包含 Step Generation 原理。
*   **ESP32 CNC Controller Setup**
    *   **內容**: 通用的 ESP32 CNC 設定教學，包含 TMC2209 驅動器的 UART 模式設定 (這對靜音與電流控制很重要)。

### 🔧 核心任務
*   **Config.yaml**: 您需要編寫一份對應您機構的設定檔 (定義步進馬達解析度、最大速度、加速度)。
*   **TMC2209 UART**: 確保跳線 (Jumper) 設定正確，以便透過軟體設定電流 (Current Limit)。

---

## 3. AI 模型訓練 (YOLOv8)
我們建議使用 **Ultralytics YOLOv8**，它是目前最易用且效能強大的物件偵測模型。

### 📺 推薦影片 (YouTube)
*   **Ultralytics YOLOv8 Custom Object Detection Tutorial**
    *   **內容**: 從頭教您如何準備自己的資料集 (標註圖片)、在 Colab 上訓練模型、並匯出模型。
    *   **搜尋**: `YOLOv8 custom dataset training`
*   **Roboflow Workflow for PCB Defect Detection**
    *   **內容**: 使用 Roboflow 工具來標註 PCB (電容、電阻、空焊)，並自動增強數據 (Augmentation) 來提升模型魯棒性。

### 🚀 實戰建議
1.  **資料集準備**: 先自行拍攝 50-100 張您的 PCB 照片 (清晰、不同角度)。
2.  **標註工具**: 使用 [LabelImg](https://github.com/heartexlabs/labelImg) 或 [Roboflow](https://roboflow.com/) (線上版) 進行標註。
3.  **類別定義**: 建議先從簡單的開始，例如 `component`, `missing`, `solder_bridge`。

---

## 4. 參考開源專案 (Reference Projects)
參考別人的程式碼可以少走彎路。

*   **Openpnp**
    *   雖然是貼片機 (Pick and Place)，但其 **Computer Vision (CV)** 模組非常強大，包含自動定位點 (Fiducial) 搜尋、元件中心校正。其 Pipeline 概念值得參考。
*   **Any-AOI (或類似 GitHub 專案)**
    *   搜尋 `github pcb aoi opencv` 可以找到許多使用傳統 CV (Template Matching) 進行比對的專案，這適合作為 AI 的輔助 (例如先用 CV 定位，再用 AI 判斷缺陷)。

6. Klipper Input Shaping Setup (Raspberry Pi 5)
您的 Raspberry Pi 5 效能強大，非常適合直接用來跑 Input Shaping 校正。

### 步驟 1：硬體連接 (ADXL345)
請購買 **ADXL345 加速度規** (建議買有杜邦接頭的版本)，並接到 Pi 5 的 GPIO。
*   **VCC** -> 3.3V (Pin 1)
*   **GND** -> Ground (Pin 6)
*   **CS** -> GPIO 8 (Pin 24)
*   **SDO** -> GPIO 9 (Pin 21)
*   **SDA** -> GPIO 10 (Pin 19)
*   **SCL** -> GPIO 11 (Pin 23)

### 步驟 2：啟用 SPI 介面
Pi 5 預設可能沒開 SPI，請執行：
```bash
sudo raspi-config
# 選擇 Interfacing Options -> SPI -> Yes
sudo reboot
```

### 步驟 3：安裝軟體依賴
回到 Pi 的終端機，安裝運算所需的 Python 函式庫：
```bash
sudo apt update
sudo apt install python3-numpy python3-matplotlib libatlas-base-dev
~/klippy-env/bin/pip install -v numpy
```

### 步驟 4：修改 printer.cfg
在 Klipper 設定檔中加入 Pi 當作 Second MCU：
```ini
[mcu rpi]
serial: /tmp/klipper_host_mcu

[adxl345]
cs_pin: rpi:None

[resonance_tester]
accel_chip: adxl345
probe_points:
    100, 100, 20  # 您機台的中間點座標 (X, Y, Z)
```

### 步驟 5：執行校正
1.  在網頁介面 Console 輸入 `SHAPER_CALIBRATE`。
2.  機器會開始高頻震動 (會有怪聲是正常的)。
3.  完成後輸入 `SAVE_CONFIG`，Klipper 會自動把最佳參數寫入設定檔。

