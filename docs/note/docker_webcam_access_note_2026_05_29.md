# Docker 容器接入網路攝影機分析筆記 - 2026-05-29

## 問題

目前 Windows Edge Simulator 以 Docker 啟動：

```text
aoi-edge-backend
aoi-edge-frontend
```

使用者詢問目前 Docker 容器是否可以接入網路攝影機 / USB webcam。

## 檢查結果

目前 `docker-compose.edge.yml` 中 backend 服務沒有實際掛載攝影機裝置：

```yaml
services:
  edge-backend:
    ports:
      - "8001:8000"
    volumes:
      - ./edge-backend:/app
    environment:
      - SIMULATION_MODE=true
      - AOI_EDGE_MODEL_INFERENCE_ENABLED=true
    # devices:
    #   - "/dev/video0:/dev/video0"
```

`devices` 有預留註解，但尚未啟用。

容器實際檢查結果：

```text
HostConfig.Devices = null
Privileged = false
容器內沒有 /dev/video*
cv2.VideoCapture(0).isOpened() = False
```

因此目前 Docker backend 不能直接讀取 Windows 的 USB webcam。

## 現行程式行為

backend camera 初始化流程位於：

```text
windows-edge-simulator/edge-backend/app/api/camera.py
```

流程：

```text
嘗試 RealCamera(0)
-> 若失敗
-> fallback 到 MockCamera
```

目前因容器內沒有可用 `/dev/video0`，所以實際使用的是 mock / simulation camera。

## 原因分析

Windows Docker Desktop 使用 Linux container 時，Windows 的 USB webcam 不會自動變成容器內的：

```text
/dev/video0
```

即使 compose 中加入：

```yaml
devices:
  - "/dev/video0:/dev/video0"
```

也必須先讓 WSL2 / Linux 環境看得到 `/dev/video0`。在 Windows 上這通常需要額外使用 `usbipd-win` 或其他 USB device forwarding 方法，而且 webcam / UVC 裝置在 WSL2 + Docker 的穩定性不一定理想。

## 可行方案

### 方案一：攝影機接 Raspberry Pi

這是最接近正式部署的方案。

Raspberry Pi 上通常可直接看到：

```text
/dev/video0
```

正式部署時可在 Pi 的 Docker compose 或 service 設定中掛載 camera device。

適合用途：

- 最終實機部署。
- 驗證 Raspberry Pi camera / USB camera 實際輸入。
- 驗證 Hailo / edge inference 完整流程。

### 方案二：Windows 本機跑 backend，不用 Docker

這是後續建議的修正方向。

Windows 本機 Python / OpenCV 比 Docker Linux container 更容易直接讀取 Windows USB webcam：

```python
cv2.VideoCapture(0)
```

建議模式：

```text
edge-backend: Windows 本機 .venv 執行
edge-frontend: 可保留 Docker 或本機 nginx / dev server
```

優點：

- 較容易直接讀取 Windows webcam。
- 不需要處理 WSL2 `/dev/video0`。
- 適合在 Windows 開發機上快速驗證真實相機畫面。
- 可保留既有 FastAPI camera API：
  - `/api/camera/feed`
  - `/api/capture/snap`

缺點：

- 與正式 Docker / Raspberry Pi 部署環境略有差異。
- 需要整理一套 Windows local backend 啟動腳本。

### 方案三：Windows Docker + usbipd / WSL2 裝置轉發

理論可行，但不建議作為第一優先。

需要流程：

```text
Windows USB webcam
-> usbipd-win attach 到 WSL2
-> WSL2 內出現 /dev/video0
-> Docker compose devices 掛入 container
```

限制：

- 設定複雜。
- webcam / UVC 支援可能不穩。
- 除錯成本高。

## 後續修正方向

優先採用方案二：

```text
Windows 本機跑 edge-backend，直接使用 OpenCV 讀取 webcam。
```

預計修正項目：

1. 新增 Windows local backend 啟動文件或腳本。
2. 讓 `edge-backend` 可透過環境變數切換 camera source：
   - `mock`
   - `opencv-index`
   - `image-folder`
3. 支援指定 Windows camera index：

```powershell
$env:AOI_CAMERA_SOURCE="opencv-index"
$env:AOI_CAMERA_INDEX="0"
```

4. 前端 API base URL 可指向本機 backend：

```text
http://127.0.0.1:8001
```

5. 保留 Docker 流程給無相機模擬與後續正式部署。

## 結論

目前 Docker 容器不能直接接入 Windows webcam。

短期若只是驗證工作流，使用 `sim-camera` 圖片輪播最穩。

若要在 Windows 開發機驗證真實 webcam，後續應優先改為：

```text
Windows 本機 backend + OpenCV VideoCapture
```

正式 Raspberry Pi 部署時，再回到：

```text
Pi camera / USB camera -> /dev/video0 -> backend camera API
```
