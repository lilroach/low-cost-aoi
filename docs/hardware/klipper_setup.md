# Klipper Input Shaping Setup Guide

您的 Raspberry Pi 5 效能強大，非常適合直接用來跑 Input Shaping 校正，這能大幅減少機器高速移動時的殘影震動 ("Ringing")。

## 1. 硬體連接 (ADXL345)

請購買 **ADXL345 加速度規** (建議買有杜邦接頭的版本)，並接到 Pi 5 的 GPIO。

### Pi 5 GPIO 接法
*   **VCC** -> 3.3V (Pin 1)
*   **GND** -> Ground (Pin 6)
*   **CS** -> GPIO 8 (Pin 24)
*   **SDO** -> GPIO 9 (Pin 21)
*   **SDA** -> GPIO 10 (Pin 19)
*   **SCL** -> GPIO 11 (Pin 23)

### (替代方案) 連接至 MCU
如果您使用如 SKR Mini E3 或 SKR Pico 等支援 SPI 的 MCU，也可連接至 MCU 上的 SPI 接口。
*   **注意**: 需在 `printer.cfg` 中指定正確的 `cs_pin` 和 `spi_bus`。

## 2. 啟用 SPI (Raspberry Pi)

Pi 5 預設可能沒開 SPI，請執行：
```bash
sudo raspi-config
# 選擇 Interfacing Options -> SPI -> Yes
sudo reboot
```

## 3. 安裝軟體依賴

回到 Pi 的終端機，安裝運算所需的 Python 函式庫：
```bash
sudo apt update
sudo apt install python3-numpy python3-matplotlib libatlas-base-dev
~/klippy-env/bin/pip install -v numpy
```

## 4. 修改 printer.cfg

在 Klipper 設定檔 (`printer.cfg`) 中加入 Pi 當作 Second MCU：

```ini
[mcu rpi]
serial: /tmp/klipper_host_mcu

[adxl345]
cs_pin: rpi:None

[resonance_tester]
accel_chip: adxl345
probe_points:
    100, 100, 20  # 請修改為您機台的中間點座標 (X, Y, Z)
```

## 5. 執行校正

1.  在 Mainsail/Fluidd 網頁介面的 Console 輸入 `SHAPER_CALIBRATE`。
2.  機器會開始高頻震動 (會有刺耳聲音是正常的測試音)。
3.  測試完成後，Console 會顯示建議的 Shaper Type (如 `mzv`, `ei`) 與頻率。
4.  輸入 `SAVE_CONFIG`，Klipper 會自動把最佳參數寫入設定檔最下方。
