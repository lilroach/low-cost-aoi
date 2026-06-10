# Windows Edge Simulator

此資料夾是 Windows 本機的邊緣裝置模擬環境，包含 Edge 後端與前端：

```text
windows-edge-simulator/
├── edge-backend/             # FastAPI Edge backend 模擬
├── edge-frontend/            # React/Vite Edge UI 模擬
└── docker-compose.edge.yml   # Windows Docker Compose 啟動設定
```

## 設計邊界

- 只負責 Windows 本機開發、UI/API 測試與流程模擬。
- 後端以 `SIMULATION_MODE=true` 執行，模擬相機、運動控制與檢測流程。
- 程式設計需假設最終會落在 Raspberry Pi 等級的邊緣裝置上，避免使用訓練主機等級的 CPU/GPU 資源。
- 實機上位機為 Raspberry Pi 5 4GB；模擬器新增功能時需同步考慮 4GB RAM 上限，避免一次載入大量模型、圖片或歷史資料。
- Raspberry Pi 實機部署腳本、systemd、Nginx 原生部署與 Hailo 模型包放在 `../raspberry-pi/`。
- 訓練、資料集管理、模型轉換與模型發布放在 `../training-host/`。

## 啟動

```bash
cd windows-edge-simulator
docker-compose -f docker-compose.edge.yml up -d --build
```

- 前端 UI: http://localhost:3001
- 後端 API: http://localhost:8001/docs

## 與 Raspberry Pi 版本的關係

`windows-edge-simulator/` 是可快速迭代的模擬版本；`raspberry-pi/` 是同一 Edge 功能的實機部署版本。兩者都應遵守 `../shared/contracts/` 中的資料與模型契約。
