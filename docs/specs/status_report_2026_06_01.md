# AOI Project 修正日誌 - 2026-06-01

## 今日目標

- 讓樹莓派 AOI Edge 可以透過 Tailscale 從外網穩定連線。
- 補齊 Raspberry Pi 部署 AOI 系統所需套件、中文語系與啟動設定。
- 將 AOI Edge 前後端完整部署到 Pi，並確認本機可讀取 Pi 上服務。
- 新增快速啟動檔，方便啟動、重啟、停止與查詢 AOI Edge 服務。
- 新增資料與模型傳輸 UI，支援 Edge Simulator / Pi 與本機 Training Host 互傳資料。
- 重新設定新插入的 CCD / USB camera 介面，讓 AOI 拍照與串流可用。

## Tailscale 外網連線

- 在 Raspberry Pi 安裝 Tailscale。
- 啟用 Tailscale SSH 與固定裝置名稱。
- 目前建議使用 Tailscale 連線 Pi：
  - `ssh -i <path-to-private-key> <pi-user>@<pi-tailscale-ip>`
- 舊的 Pi 區網 IP 曾經變動：
  - 不建議寫入文件，後續以 Tailscale 裝置 IP 或 DNS 名稱為準。
- 後續不同熱點或外網環境下，只要本機與 Pi 都在線上並登入同一個 Tailscale tailnet，就可以透過 Tailscale 連線。

## Raspberry Pi 系統更新與中文語系

- 修復並完成未完成的 apt 更新流程。
- 執行系統套件更新、升級與必要套件安裝。
- 安裝 AOI 部署與硬體檢測常用套件：
  - `nginx`
  - `python3`
  - `python3-venv`
  - `python3-pip`
  - `numpy`
  - `opencv`
  - `v4l-utils`
  - `zbar-tools`
  - HailoRT 相關套件
- 安裝繁體中文語系與字型：
  - `zh_TW.UTF-8`
  - `en_US.UTF-8`
  - `fonts-noto-cjk`
  - `fonts-noto-cjk-extra`
  - `fcitx5`
  - `fcitx5-chewing`
- 設定 `/etc/default/locale`：
  - `LANG=zh_TW.UTF-8`
  - `LC_CTYPE=zh_TW.UTF-8`
- 在使用者 `~/.profile` 補上 Fcitx5 與 AOI 預設語系設定。
- 已執行 Pi 重開機並確認服務可恢復。
- 重開後確認 kernel：`6.18.29+rpt-rpi-2712`。

## AOI Edge 部署

- 將 Raspberry Pi 版 AOI backend / frontend 部署到 Pi。
- Backend 部署為 systemd service：
  - `aoi-edge-backend`
- Frontend 部署到 nginx：
  - `/var/www/aoi-frontend`
- nginx 對外提供 AOI UI。
- 已驗證：
  - `http://<pi-tailscale-ip>/` 回應 200。
  - `http://<pi-tailscale-ip>/api/health` 回傳 `{"status":"ok","mode":"raspberry-pi"}`。
  - `ssh`、`tailscaled`、`aoi-edge-backend`、`nginx` 服務皆為 active。

## 快速啟動檔

- 新增 Pi 端快速啟動腳本：
  - `raspberry-pi/start-aoi.sh`
- 支援動作：
  - `start`
  - `restart`
  - `stop`
  - `status`
- 腳本會管理：
  - `aoi-edge-backend`
  - `nginx`
- 新增本機 Windows 快速執行腳本：
  - `start-pi-aoi.ps1`
- 預設連線：
  - host：透過 `AOI_PI_HOST` / `AOI_PI_USER` 指定。
  - key：透過 `AOI_PI_SSH_KEY` 指定。
- 已更新 `raspberry-pi/README.md`，加入快速啟動用法。
- 已驗證 `status` 與 `restart` 可正常執行。

## Transfer UI

- 在 Raspberry Pi 前端新增資料傳輸頁。
- 在 Windows Edge Simulator 前端也新增相同傳輸 UI。
- 新增檔案：
  - `raspberry-pi/frontend/src/features/transfer/TransferView.tsx`
  - `windows-edge-simulator/edge-frontend/src/features/transfer/TransferView.tsx`
- 更新導覽與 app context：
  - `raspberry-pi/frontend/src/App.tsx`
  - `raspberry-pi/frontend/src/context/AppContext.tsx`
  - `windows-edge-simulator/edge-frontend/src/App.tsx`
  - `windows-edge-simulator/edge-frontend/src/context/AppContext.tsx`
- Transfer UI 功能：
  - 設定 Training Host URL，預設 `http://127.0.0.1:8000`。
  - 從 Edge 匯出 ready captures bundle。
  - 將 capture bundle 上傳到 Training Host `/api/datasets/import-run`。
  - 手動選擇既有 capture bundle zip 並上傳到 Training Host。
  - 從本機選擇模型包 zip，上傳到 Edge `/api/models/install`。
  - 讀取 Edge `/api/models`，支援刷新與啟用模型。
- 已完成兩邊前端 build：
  - `raspberry-pi/frontend`
  - `windows-edge-simulator/edge-frontend`
- 已部署 Pi 前端到 nginx。
- 已驗證 Pi 上新前端資產包含 Transfer UI。

## 桌面快捷連結

- 在 Pi 桌面建立快速進入 UI 的捷徑：
  - `~/Desktop/AOI Edge UI.desktop`
- 捷徑開啟：
  - `http://127.0.0.1/`
- 已設定可執行權限，並嘗試標記為 trusted desktop launcher。

## CCD / Camera 介面設定

- 新插入 CCD / USB camera 已被 Pi 偵測。
- `lsusb` 裝置：
  - `0c45:64ab Microdia USB2M Cam`
- `v4l2-ctl --list-devices`：
  - `USB2M Cam`
  - `/dev/video0`
  - `/dev/video1`
- 判斷結果：
  - `/dev/video0` 是實際影像擷取介面。
  - `/dev/video1` 是 metadata capture，不作為 AOI 取像來源。
- 支援格式確認：
  - MJPG `1920x1080` 30 FPS。
  - MJPG `1280x1024`、`1280x960`、`1280x720`、`800x600`、`640x480`。
  - YUYV `640x480`。
- 原先 OpenCV 預設 backend 可開啟 camera，但讀不到有效畫面，拍照結果為黑圖。
- 測試確認使用 `cv2.CAP_V4L2` 可以成功讀取：
  - frame shape：`1080x1920`
  - mean 約 `45.49`

## Camera 程式修正

- 更新 Pi backend camera config：
  - `AOI_CAMERA_INDEX`
  - `AOI_CAMERA_WIDTH`
  - `AOI_CAMERA_HEIGHT`
  - `AOI_CAMERA_FPS`
  - `AOI_CAMERA_FOURCC`
- 更新 camera API：
  - 使用 `cv2.VideoCapture(index, cv2.CAP_V4L2)`。
  - 設定 MJPG、解析度、FPS 與 buffer size。
  - 加入背景擷取 thread，保留最新 frame。
  - 新增 `GET /api/camera/status`。
- 更新 backend systemd 部署腳本，寫入 camera 環境變數：
  - `AOI_CAMERA_INDEX=0`
  - `AOI_CAMERA_WIDTH=1920`
  - `AOI_CAMERA_HEIGHT=1080`
  - `AOI_CAMERA_FPS=30`
  - `AOI_CAMERA_FOURCC=MJPG`
- 已重新部署並啟動 Pi backend。
- 因舊 camera feed 連線導致 service restart 一度等待，後續使用 systemd kill / reset-failed / start 恢復。

## Camera 驗證結果

- `GET /api/camera/status` 確認：
  - requested width：`1920`
  - requested height：`1080`
  - requested fps：`30`
  - actual width：`1920`
  - actual height：`1080`
  - actual fps：`30`
  - has_frame：`true`
- Live feed 測試：
  - 3 秒 mjpg 串流可保存，大小約 12 MB。
- Snap 測試：
  - 測試影像：`CCD_TEST_V4L2_130909_082.jpg`
  - shape：`1080x1920`
  - mean：約 `45.58`
- `/api/health` 維持正常。

## 目前可用連線與服務

- AOI UI：
  - `http://<pi-tailscale-ip>/`
- AOI backend health：
  - `http://<pi-tailscale-ip>/api/health`
- Camera status：
  - `http://<pi-tailscale-ip>/api/camera/status`
- SSH：
  - `ssh -i <path-to-private-key> <pi-user>@<pi-tailscale-ip>`
- Pi 端服務：
  - `sudo systemctl status aoi-edge-backend`
  - `sudo systemctl status nginx`
  - `sudo systemctl status tailscaled`
- 本機快速啟動：
  - `.\start-pi-aoi.ps1 status`
  - `.\start-pi-aoi.ps1 restart`

## 注意事項與後續建議

- Transfer UI 上傳 capture bundle 到 Training Host 時，本機 Training Host backend 必須先啟動並可從瀏覽器連到指定 URL。
- 若瀏覽器在 Pi UI 開啟，`127.0.0.1:8000` 會指向 Pi 本機；若要傳到 Windows Training Host，Training Host URL 需填 Windows 主機可被 Pi 或瀏覽器存取的位址。
- 目前模型安裝與啟用流程已接 UI；實際 AOI inference 仍需依 Phase 2 模型流程與可用模型包確認。
- 若 camera live feed 仍被瀏覽器長時間開啟，重啟 backend 可能等待舊連線結束；必要時可先關閉 feed 分頁或使用 systemd 強制停止後再啟動。
- 建議後續補一份「外網操作 SOP」：
  - 連 Tailscale。
  - 開 AOI UI。
  - 檢查 camera status。
  - 拍照。
  - 上傳資料到 Training Host。
  - 上傳模型包到 Edge。
  - 重啟服務與故障排除。
