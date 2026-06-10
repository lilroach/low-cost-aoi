# AOI Project 修正日誌 - 2026-05-30

## 今日目標

- 將 Training Host 訓練流程 UI 化，讓使用者不需要手動輸入 terminal 指令。
- 將訓練端 UI 改為中文，並加入具體操作步驟的說明書頁面。
- 加入模型驗證流程與合格率，支援額外驗證資料包。
- 確認驗證資料是否需要標註，並保留 Label Studio 作為標註來源。
- 將 Training Host 後端由 Docker 後端改為本機終端機部署。
- 重整資料集管理頁，改為檢視與管理各類資料、模型與報告清單。

## Training Host 後端終端機部署

- Training Host 後端不再以 Docker backend / Redis 作為預設執行方式。
- 新增 `training-host/start-backend.ps1`，用於建立或使用 `.venv`、安裝後端依賴、設定資料與模型目錄，並以 uvicorn 啟動 API。
- 新增 `training-host/start-frontend.ps1`，用於安裝前端依賴並啟動 Vite 開發伺服器。
- 後端新增本機路徑偵測，支援 Windows 終端機與容器環境兩種目錄結構。
- `/api/health` 回傳目前為 `terminal` 部署模式，並顯示實際資料目錄。
- Docker Compose 調整為保留前端與 Label Studio，Training Host API 改由本機終端機提供。
- 前端 nginx 代理 `/api` 至 `host.docker.internal:8000`，用於 Docker 前端連接本機後端。
- 移除 Training Host 後端對 Redis / Celery 的依賴。

## 訓練流程 UI 化

- 訓練頁面改為中文操作介面。
- 使用者可以在 UI 選擇資料集、基礎模型、epoch、影像尺寸、batch size 與 run name。
- 訓練按鈕會呼叫後端 `/api/training/start`，由後端啟動真實 YOLO 訓練流程。
- 後端以 subprocess 執行 Ultralytics YOLO 訓練，並將 stdout / stderr 串流至前端。
- UI 顯示完整終端機指令與完整訓練 log，不再只顯示摘要或假進度。
- 支援停止訓練、查詢目前狀態、列出已完成訓練 run。
- 已完成訓練會記錄 best.pt、metrics、log 與 run metadata。
- 同時支援新的 `training-host/models/training-runs` 與舊的 `runs/models/training-runs` 目錄。

## 模型驗證功能

- 新增驗證資料集清單 API：`GET /api/training/validation-datasets`。
- 新增可驗證模型清單 API：`GET /api/training/validation-models`。
- 新增模型驗證 API：`POST /api/training/validate`。
- 驗證流程使用額外驗證資料包，將模型預測結果與 ground truth label 比對。
- 驗證資料需要標註；若影像有 YOLO label，視為 NG 樣本，若 label 空白或不存在，視為 OK 樣本。
- Label Studio 可以作為驗證資料標註工具，匯出 YOLO 格式後放入驗證資料集目錄。
- 驗證資料集目錄支援：
  - `images/`
  - `labels/`
  - `classes.txt` 或 `data.yaml`
- 已放寬後端判斷，只要有 `images/` 並且存在 `classes.txt` 或 `data.yaml` 即可列入驗證資料集。
- 新增驗證報告輸出至 `training-host/models/validation-reports`。

## 驗證指標

- 驗證報告包含整體合格率。
- OK accuracy：OK 樣本判斷正確率。
- NG recall：NG 樣本抓出率。
- false pass：NG 被誤判為 OK。
- false reject：OK 被誤判為 NG。
- class recall：各缺陷類別召回率。
- 驗證報告保留失敗範例，方便後續追查資料或模型問題。

## 驗證資料包修正

- 協助讀取使用者新增的驗證資料集 `project-4-at-2026-05-30-16-49-205f5cda`。
- 該資料集原本有 `images/`、`labels/`、`classes.txt`、`notes.json`，但沒有 `data.yaml`。
- 已補上 `data.yaml`，類別包含：
  - `122`
  - `123`
  - `124`
  - `殘肉`
  - `毛絲`
- 修正後驗證資料集可被 UI 與 API 正確讀取。

## 部署模型包

- 將「建立模型包」改名為「建立部署模型包」。
- 將建立部署模型包區塊移至驗證流程下方，避免使用者尚未驗證就直接打包。
- 後續又將「訓練+驗證」與「部署」拆成兩個標籤頁。
- 部署頁可選擇已完成訓練 run，設定料號、版本、信心閾值與 IoU 閾值。
- 建立後輸出部署模型包，內容包含：
  - `manifest.json`
  - `best.pt`
- manifest 會記錄模型 ID、料號、版本、類別、閾值、來源 best.pt 與權重 hash。
- 部署頁新增獨立終端機 console，顯示打包 API、payload、成功或失敗結果。

## 前端導覽與說明書

- 主導覽調整為：
  - 資料集
  - 標註
  - 訓練+驗證
  - 部署
  - 說明書
- 新增說明書頁面，提供具體操作步驟：
  - 上傳或準備圖片資料
  - 使用 Label Studio 標註
  - 建立訓練資料集
  - 啟動 YOLO 訓練
  - 準備驗證資料包
  - 執行模型驗證
  - 檢查合格率與錯誤樣本
  - 建立部署模型包
  - 下載或放入 Edge Simulator 使用
- 「訓練+驗證」與「部署」兩個頁面皆具備各自的終端機 console。

## 資料集管理重整

- 原本的圖片上傳式資料集管理頁改為資產清單儀表板。
- 新增後端 API：`GET /api/datasets/inventory`。
- 新增後端 API：`POST /api/datasets/open-folder/{category}/{item_id}`。
- 資料集管理頁現在可檢視：
  - 標註完成資料集
  - 訓練完成資料集
  - 驗證完成資料集
  - 驗證資料集
  - 可部署模型
- 每個項目會顯示相關資訊，例如圖片數、label 數、類別、路徑、建立時間、驗證指標或模型格式。
- 支援從 UI 打開對應資料夾，方便使用者管理檔案。
- 可部署模型項目提供下載連結。

## Label Studio

- 啟動 Label Studio 服務，用於標註訓練資料與驗證資料。
- Label Studio 位址：`http://127.0.0.1:8080`
- 預設登入資訊：
  - 帳號：`admin@aoi.com`
  - 密碼：`password123`
- 驗證資料若要計算合格率，需要有標註資料；可使用 Label Studio 匯出 YOLO 格式。

## 今日驗證

- 後端 Python 編譯檢查通過：`python -m compileall training-host/backend/app`。
- 前端建置通過：`npm run build`。
- API 健康檢查通過：`/api/health`。
- 驗證資料集 API 可讀取新增驗證資料。
- 驗證模型 API 可列出已完成訓練模型。
- 模型驗證 API 可產生驗證報告。
- 資料集 inventory API 可列出標註、訓練、驗證與部署模型資產。

## 目前限制

- 目前驗證邏輯是 image-level OK / NG 驗證；有 label 視為 NG，空 label 或無 label 視為 OK。
- 驗證流程目前是單次 API 執行，尚未加入像訓練一樣的即時 websocket log。
- 部署模型包目前仍是 Ultralytics `.pt` 格式，Hailo `.hef` 轉換尚未串接。
- Label Studio 仍透過 Docker service 啟動，尚未完全改成本機終端機服務。
- 打開資料夾功能需要後端在本機桌面環境執行，遠端或純容器環境可能無法開啟檔案總管。

## 下一步建議

- 為模型驗證加入即時 console log 與進度顯示。
- 加入 Label Studio YOLO 匯出檔的匯入精靈，自動建立驗證資料集與 `data.yaml`。
- 加入驗證 threshold sweep，協助找出最佳 confidence / IoU 閾值。
- 將驗證合格率與報告 ID 寫入部署模型包 manifest。
- 資料集管理增加刪除、封存、重新命名與重新整理單一資料夾功能。
- 將部署模型包安裝流程串接到 Edge Simulator 或實際推論端。
