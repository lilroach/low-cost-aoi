# Raspberry Pi OS 到 AOI Edge 專案安裝指南

> 日期: 2026-05-31  
> 目標硬體: Raspberry Pi 5 4GB  
> 範圍: Raspberry Pi OS、相機 / Capture、FastAPI 後端、Nginx 前端、模型包管理、HailoRT 可選安裝。  
> 不包含: SKR Pico、Klipper、Moonraker、CoreXY、馬達、限位、移動架構。

## 1. 安裝範圍總覽

本指南只建立 Raspberry Pi Edge 的非移動版本:

```text
Raspberry Pi OS
  -> system packages
  -> Python venv
  -> AOI FastAPI backend
  -> camera / capture API
  -> model registry
  -> optional HailoRT runtime
  -> Nginx static frontend
```

第一階段建議先達成:

- Pi 可開機並 SSH。
- 後端 API 可啟動。
- USB 相機可被 OpenCV 讀取。
- 前端可透過瀏覽器開啟。
- Capture / Export / Upload workflow 可跑。
- 不啟動運動控制。

## 2. Raspberry Pi OS 細部安裝流程

### 2.1 準備物品

| 項目 | 建議 |
|:---|:---|
| Raspberry Pi | Raspberry Pi 5 4GB |
| 電源 | 官方或等效 USB-C PD 5V/5A，建議 27W |
| 散熱 | Raspberry Pi 5 Active Cooler |
| 儲存 | NVMe SSD 優先；初期可用 32GB 以上 microSD |
| 燒錄工具 | Raspberry Pi Imager |
| 網路 | Ethernet 優先；Wi-Fi 可備用 |
| 操作方式 | Headless SSH 優先；必要時接 HDMI/鍵盤 |

儲存容量建議:

| 用途 | 最低 | 建議 |
|:---|---:|---:|
| OS + 後端 + 前端 | 32GB | 64GB |
| 含 AOI 圖片歷史 | 64GB | 128GB 以上或 NVMe |
| 長期收圖 / 多批次 | 128GB | 512GB NVMe |

Pi 5 4GB 請避免把它當訓練主機使用。前端 build、YOLO 訓練、Label Studio、Hailo 編譯都建議在 Windows / Training Host 完成。

### 2.2 下載 Raspberry Pi Imager

在 Windows / macOS / Linux 開發機安裝 Raspberry Pi Imager:

```text
https://www.raspberrypi.com/software/
```

官方文件說明 Raspberry Pi Imager 可在寫入 OS 時預先設定 hostname、user、network 與 SSH，適合無螢幕的 headless 安裝。

### 2.3 選擇 OS

打開 Raspberry Pi Imager:

1. 點 **Choose Device**。
2. 選 **Raspberry Pi 5**。
3. 點 **Choose OS**。
4. 依用途選 OS:

| 情境 | OS |
|:---|:---|
| 產線部署 / headless | Raspberry Pi OS Lite 64-bit |
| 開發初期 / 接螢幕調相機 | Raspberry Pi OS with desktop 64-bit |

本專案偏向先用:

```text
Raspberry Pi OS Lite (64-bit)
```

若你想在 Pi 上直接接 HDMI 螢幕操作 UI 或調相機，可選 Desktop 版。

### 2.4 選擇儲存裝置

點 **Choose Storage**:

- microSD 測試: 選 microSD card。
- NVMe 安裝: 選對應 USB/NVMe 讀卡器或 SSD。

注意:

- 燒錄會清空目標儲存裝置。
- 若使用 NVMe 開機，請確認 Pi 5 的 NVMe HAT 與 bootloader 支援狀態。
- 初期若 NVMe 開機不穩，可先用 microSD 開機，資料目錄再掛 NVMe。

### 2.5 OS Customisation 設定

按 **Next** 後，Imager 會詢問是否套用 OS customization。選:

```text
Edit Settings
```

#### General

| 欄位 | 建議值 |
|:---|:---|
| Hostname | `aoi-edge-pi` |
| Username | `pi` 或自訂，例如 `aoi` |
| Password | 設定強密碼，不使用預設密碼 |
| Wireless LAN | 有 Wi-Fi 需求才填；產線建議 Ethernet |
| Wireless LAN country | `TW` |
| Locale / timezone | `Asia/Taipei` |
| Keyboard layout | `us` 或實際鍵盤配置 |

#### Services

啟用 SSH:

```text
Enable SSH
```

登入方式二選一:

| 方式 | 建議 |
|:---|:---|
| Password authentication | 初期最簡單 |
| Public-key authentication | 長期部署較安全 |

初期建議先用 password，確認部署流程跑通後再改 SSH key。

#### Options

建議:

- 勾選 eject media when finished。
- telemetry 是否啟用依個人偏好。

### 2.6 開始燒錄

1. 確認 device / OS / storage 正確。
2. 點 **Write**。
3. 等待 write + verify 完成。
4. Imager 顯示完成後，安全退出儲存裝置。

### 2.7 第一次開機

1. 將 microSD 或 NVMe 接到 Raspberry Pi。
2. 接上 Ethernet。
3. 接上 USB-C 電源。
4. 等待 2~5 分鐘完成首次開機設定。

若有接螢幕，應看到登入畫面或桌面。若 headless，從開發機找 Pi。

### 2.8 找到 Raspberry Pi IP

方式一，用 hostname:

```bash
ping aoi-edge-pi.local
ssh pi@aoi-edge-pi.local
```

若使用自訂使用者:

```bash
ssh aoi@aoi-edge-pi.local
```

方式二，到路由器 DHCP client list 找 `aoi-edge-pi`。

方式三，若 `.local` 無法解析，直接用 IP:

```bash
ssh pi@<raspberry-pi-ip>
```

Windows 若 `.local` 解析失敗，可先用路由器查 IP，或安裝 Bonjour / 使用網路掃描工具。

### 2.9 首次登入後確認系統

登入後:

```bash
uname -a
cat /etc/os-release
getconf LONG_BIT
free -h
df -h
```

期望:

| 檢查 | 期望 |
|:---|:---|
| OS | Raspberry Pi OS / Debian Bookworm |
| 架構 | 64-bit |
| RAM | 約 4GB |
| Disk | 看到 microSD / NVMe 容量 |

### 2.10 更新系統

```bash
sudo apt update
sudo apt full-upgrade -y
sudo reboot
```

重開後再登入:

```bash
ssh pi@aoi-edge-pi.local
```

### 2.11 基礎設定

執行:

```bash
sudo raspi-config
```

建議確認:

| 選單 | 設定 |
|:---|:---|
| System Options | Hostname 是否為 `aoi-edge-pi` |
| Interface Options | SSH enabled |
| Localisation Options | Timezone `Asia/Taipei` |
| Advanced Options | Expand filesystem，若是 microSD 可確認 |

一般 USB camera 不需要啟用 CSI camera interface。若後續改用 Pi CSI camera，再另外設定 camera interface。

### 2.12 建議啟用 2GB swap 或 zram

Pi 5 4GB 雖可跑本專案 Edge，但 build 或套件安裝時可能吃 RAM。若預設 swap 不夠，可調大 swap 作緩衝。

檢查:

```bash
free -h
swapon --show
```

若要使用傳統 swapfile，可調整:

```bash
sudo nano /etc/dphys-swapfile
```

設定:

```text
CONF_SWAPSIZE=2048
```

套用:

```bash
sudo systemctl restart dphys-swapfile
swapon --show
free -h
```

注意: swap 只是避免偶發安裝或建置爆 RAM，不應讓 AOI 正常運作依賴 swap。

### 2.13 固定 IP，建議但非必要

產線部署建議固定 IP，方便 Training Host 與前端連線。可用兩種方式:

1. 在路由器 DHCP reservation 綁定 Pi 的 MAC address。
2. 在 Raspberry Pi OS 內設定 NetworkManager static IP。

初期建議先用路由器 DHCP reservation，比較不容易設定錯。

## 3. 基礎系統套件

登入 Pi 後安裝必要套件:

```bash
sudo apt update
sudo apt install -y \
  git \
  curl \
  python3 \
  python3-venv \
  python3-pip \
  nginx \
  libglib2.0-0 \
  libgl1 \
  v4l-utils
```

用途:

| 套件 | 用途 |
|:---|:---|
| `git` | 取得專案程式碼 |
| `python3`, `python3-venv`, `python3-pip` | 後端 Python runtime |
| `nginx` | 服務前端靜態檔與 reverse proxy `/api` |
| `libglib2.0-0`, `libgl1` | OpenCV runtime 依賴 |
| `v4l-utils` | 檢查 USB camera / `/dev/video*` |

將使用者加入 camera/video 權限群組:

```bash
sudo usermod -aG video $USER
sudo reboot
```

## 4. 取得專案

建議放在使用者家目錄:

```bash
cd ~
git clone <your-repo-url> low-cost-aoi
cd ~/low-cost-aoi
```

若不是從 Git 取得，也可用 `scp` 或 USB 將專案資料夾複製到:

```text
/home/pi/low-cost-aoi
```

## 5. Python 後端安裝

### 5.1 專案後端依賴

目前 Raspberry Pi backend 的 Python 依賴位於:

```text
raspberry-pi/backend/requirements.txt
```

內容:

```text
fastapi==0.109.0
uvicorn==0.27.0
numpy==1.26.3
opencv-python-headless==4.9.0.80
pydantic==2.5.3
requests==2.31.0
python-multipart==0.0.9
```

### 5.2 建立 venv 並安裝

```bash
cd ~/low-cost-aoi/raspberry-pi/backend
python3 -m venv .venv-pi
./.venv-pi/bin/pip install --upgrade pip
./.venv-pi/bin/pip install -r requirements.txt
```

手動測試後端:

```bash
cd ~/low-cost-aoi/raspberry-pi/backend
AOI_EDGE_MODEL_INFERENCE_ENABLED=false \
./.venv-pi/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

另開 SSH 視窗測試:

```bash
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8000/api/inference/model/status
```

## 6. 使用部署腳本建立 systemd

專案已有部署腳本:

```bash
cd ~/low-cost-aoi/raspberry-pi/backend
sudo chmod +x deploy-pi-backend.sh
sudo AOI_EDGE_MODEL_INFERENCE_ENABLED=false \
     AOI_TRAINING_HOST_URL=http://<training-host-ip>:8000 \
     ./deploy-pi-backend.sh
```

部署腳本會做:

- 安裝 Python / OpenCV runtime 相關 apt 套件。
- 嘗試安裝 `python3-hailort`，若套件不存在則略過。
- 建立 `.venv-pi`。
- 安裝 `requirements.txt`。
- 建立資料目錄與模型目錄。
- 建立 `aoi-edge-backend.service`。

檢查服務:

```bash
systemctl status aoi-edge-backend
journalctl -u aoi-edge-backend -f
curl http://127.0.0.1:8000/api/health
```

## 7. 環境變數

後端支援:

| 變數 | 建議值 | 說明 |
|:---|:---|:---|
| `AOI_EDGE_DATA_DIR` | `raspberry-pi/backend/data` | 程式、history、圖片資料 |
| `AOI_EDGE_MODEL_DIR` | `raspberry-pi/backend/models` | 模型包目錄 |
| `AOI_EDGE_MODEL_INFERENCE_ENABLED` | `false` for Phase 2 | 先只做 capture，不載入 Hailo 推論 |
| `AOI_TRAINING_HOST_URL` | `http://<host-ip>:8000` | Training Host 上傳目標 |
| `AOI_MACHINE_ID` | `raspberry-pi-edge` | 機台識別 |

Phase 2 建議:

```text
AOI_EDGE_MODEL_INFERENCE_ENABLED=false
```

等 Hailo runtime、模型包與推論流程驗證完成後再改成:

```text
AOI_EDGE_MODEL_INFERENCE_ENABLED=true
```

## 8. 相機檢查

插入 USB 相機後:

```bash
ls /dev/video*
v4l2-ctl --list-devices
v4l2-ctl --device=/dev/video0 --all
```

快速用 OpenCV 測試:

```bash
cd ~/low-cost-aoi/raspberry-pi/backend
./.venv-pi/bin/python - <<'PY'
import cv2

cap = cv2.VideoCapture(0)
print("opened:", cap.isOpened())
ok, frame = cap.read()
print("read:", ok, None if frame is None else frame.shape)
cap.release()
PY
```

若 `opened: False`:

- 檢查 USB 線是否為資料線。
- 檢查相機是否需要額外電源。
- 檢查使用者是否已加入 `video` group。
- 嘗試 `/dev/video1` 或不同 camera index。

## 9. HailoRT 可選安裝

若目前只做 Capture / 人工 OK-NG，HailoRT 可先不裝。

若要啟用 Hailo 8L 推論，需安裝 Hailo runtime 與 Python binding。專案部署腳本會嘗試:

```bash
sudo apt install -y python3-hailort
```

驗證:

```bash
python3 - <<'PY'
import hailo_platform
print("hailo_platform import ok")
PY
```

若 `python3-hailort` 不在 apt source 中，需要依 Hailo 官方文件安裝對應 Raspberry Pi / Hailo-8L 的 driver、runtime 與 Python binding。安裝完成後再將:

```text
AOI_EDGE_MODEL_INFERENCE_ENABLED=true
```

本專案模型包預期放在:

```text
raspberry-pi/backend/models/<model_id>/
  manifest.json
  model.hef
  classes.json 或 labels.txt
```

## 10. 前端部署

### 10.1 建議方式: 在 Windows / Training Host 編譯

Pi 5 4GB 不建議常態執行 `npm run build`。

在 Windows / Training Host:

```bash
cd raspberry-pi/frontend
npm install
npm run build
scp -r dist pi@<raspberry-pi-ip>:/home/pi/low-cost-aoi/raspberry-pi/frontend/
```

在 Pi:

```bash
cd ~/low-cost-aoi/raspberry-pi/frontend
sudo chmod +x deploy-pi-frontend.sh
sudo ./deploy-pi-frontend.sh
```

選擇:

```text
1) 從 Windows 開發機編譯並傳輸至本機的 dist 目錄
```

檢查:

```bash
sudo nginx -t
systemctl status nginx
```

開啟:

```text
http://<raspberry-pi-ip>/
```

### 10.2 不建議方式: 在 Pi 本機編譯

只有在臨時測試時才考慮:

```bash
sudo apt install -y nodejs npm
npm install
npm run build
```

Pi 5 4GB 可能因 TypeScript / Vite build 記憶體不足而卡住或失敗，因此不作為標準流程。

## 11. Nginx 與 API proxy

前端部署腳本會安裝 Nginx，並使用:

```text
raspberry-pi/frontend/nginx.pi.conf
```

Nginx 應提供:

```text
/                 -> React static frontend
/api              -> http://127.0.0.1:8000/api
/data/history     -> http://127.0.0.1:8000/data/history
```

測試:

```bash
curl http://127.0.0.1/api/health
curl http://<raspberry-pi-ip>/api/health
```

## 12. 安裝後驗證清單

| 項目 | 指令 / 檢查 | 期望 |
|:---|:---|:---|
| OS | `cat /etc/os-release` | Raspberry Pi OS 64-bit |
| Python | `python3 --version` | Python 3.10/3.11 系列 |
| 後端服務 | `systemctl status aoi-edge-backend` | active |
| 後端 API | `curl http://127.0.0.1:8000/api/health` | 回傳 OK |
| Nginx | `systemctl status nginx` | active |
| 前端 | `http://<pi-ip>/` | UI 可開啟 |
| Camera | `ls /dev/video*` | 看到 video device |
| OpenCV | `cv2.VideoCapture(0)` | 可讀 frame |
| Hailo 可選 | `import hailo_platform` | 若已安裝則成功 |
| Training Host | Upload API | 可連到 `<training-host-ip>:8000` |

## 13. 4GB RAM 注意事項

Pi 5 4GB 可負荷本專案 Edge 端，但要遵守:

- 不在 Pi 上訓練 YOLO。
- 不在 Pi 上跑 Label Studio。
- 不在 Pi 上常態執行前端 build。
- 不一次載入多個 Hailo 模型。
- Capture / inference 只保留必要 frame buffer。
- History / Review 頁面需分頁，不一次讀取大量圖片。

建議可加 2GB swap 或 zram 作緩衝，但不應依賴 swap 作為正常記憶體。

## 14. 常用維護指令

```bash
# 後端狀態
systemctl status aoi-edge-backend
journalctl -u aoi-edge-backend -f

# 重啟後端
sudo systemctl restart aoi-edge-backend

# Nginx 狀態
systemctl status nginx
sudo nginx -t
sudo systemctl restart nginx

# Camera
v4l2-ctl --list-devices
ls /dev/video*

# 磁碟與記憶體
df -h
free -h
```

## 15. 不納入本指南的項目

以下移動架構相關項目另見 SKR Pico / Klipper 文件，本指南不處理:

- SKR Pico 韌體燒錄。
- Klipper / Moonraker 安裝。
- CoreXY `printer.cfg`。
- 馬達、限位、皮帶、Input Shaping。
- AOI backend 與 Moonraker motion adapter。
