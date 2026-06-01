# AOI 開發路線圖

本文件是後續功能撰寫與開發排序的主要依據。若其他規格文件與本文件的階段範圍衝突，應先以本文件為準，再回頭同步更新相關規格。

## 開發原則

- 以四階段漸進式開發，不跨階段提前導入高風險功能。
- 每個階段都要能獨立驗證，避免同時混入相機、AI 推理、移動平台與訓練流程造成問題難以定位。
- `training-host/` 負責資料、訓練與模型管理；`windows-edge-simulator/` 負責 Windows 上的 Edge 流程模擬；`raspberry-pi/` 負責實機部署。
- schema 與資料/模型契約仍以 `shared/contracts/` 為準。

## Phase 1: 專案架構規劃、介面撰寫與 YOLO 訓練環境

### 階段目標

完成專案整體架構、主要介面雛形與 YOLO 訓練環境，讓後續 Raspberry Pi 部署與 Edge 流程有穩定的資料交換基礎。

### 功能描述

- 規劃並整理三個主要執行環境：
  - `training-host/`: Windows 本地訓練終端。
  - `windows-edge-simulator/`: Windows Edge 模擬環境。
  - `raspberry-pi/`: Raspberry Pi 實機部署版本。
- 建立 Training Host 的資料集管理、模型列表、模型下載與訓練流程雛形。
- 建立 Edge 操作介面雛形，包含 Capture、Run、Review、Teaching 等主要畫面。
- 建立 YOLO 訓練環境，支援模型訓練、匯出與後續部署封裝。
- 定義 Edge 與 Training Host 的資料交換格式，並維護 `shared/contracts/`。

### 交付成果

- 可啟動的 Training Host 開發環境。
- 可啟動的 Windows Edge 模擬環境。
- 基礎 UI/API 流程。
- 初版資料契約與模型契約。
- 可供後續階段使用的 YOLO 訓練與模型輸出流程。

### 本階段不包含

- Raspberry Pi 實機完整部署驗證。
- 真實邊緣推理效能驗證。
- 移動平台整合。

## Phase 2: Raspberry Pi 截圖部署

### 階段目標

實際部署 Raspberry Pi，先完成無移動架構、無邊緣運算的 Capture 核心流程。此階段驗證 Pi 前後端部署、相機連接、截圖存檔、結果清單、人工判定與後續訓練資料回收格式。

### 功能描述

- 將 Raspberry Pi 前後端部署為可開機後執行的服務。
- 透過 Tailscale 提供外網維護連線，讓開發機在不同網路下仍可使用固定 Tailscale IP 連到 Pi。
- 完成相機連接、拍照、存檔與基本錯誤回報。
- 相機介面需支援以環境變數指定 `/dev/video*` index、解析度、FPS 與 FOURCC，並提供 camera status API 供前端或維護人員確認實際取像狀態。
- 前端提供 Capture 操作入口，使用者可以按下 SNAP / 截圖按鈕並看到截圖結果。
- 建立模型選擇欄位，但預設為不選擇任何模型；Phase 2 不執行模型辨識，模型選擇只作為 Phase 3 的介面與資料欄位基礎。
- 截圖後若未選擇模型，系統只儲存圖片並略過模型辨識，由使用者在清單中手動記錄 OK / NG。
- 建立截圖結果清單，至少包含截圖時間、圖片檔名、使用模型、模型辨識結果、人工判定結果與檢視入口。
- Capture 主畫面需將相機畫面作為主要區域；結果清單可保留在右側輔助區，未展開時僅顯示圖片名稱、模型名稱與 YOLO OK / NG。
- 支援點選清單中的圖片檢視入口後開啟截圖詳細資料窗格；詳細窗格需提供上一張 / 下一張快速切換，方便連續檢視與覆判。
- 支援人工填寫或修改 OK / NG；人工覆判只在展開清單或詳細資料窗格中操作，點擊 OK / NG 不應自動開啟詳細資料窗格。Phase 2 的人工判定即為最終判定。
- 詳細資料窗格需維持穩定高度，切換 OK / NG 或顯示辨識錯誤時不應造成窗格高度跳動。
- 詳細資料窗格需支援修改 PART / BATCH 欄位；本階段先同步更新截圖紀錄，後續可延伸為同步修改檔名與圖片路徑。
- 預留「辨識錯誤」欄位與資料結構；Phase 2 因沒有模型辨識，不產生辨識錯誤標註。
- 提供清除清單功能，只清除 Capture Result List 的紀錄，不刪除已儲存的圖片檔案。
- 提供 Export UI，使用者可先檢視匯出摘要、可訓練資料數量、辨識錯誤數與資料明細，再下載可透過 USB 搬移的 Training Host 匯入 ZIP。
- 提供 Transfer UI，讓使用者可直接將 ready captures bundle 上傳至 Training Host，也可從本機選擇既有 capture bundle zip 上傳。
- 提供模型包上傳 UI，使用者可由本機選擇 model bundle zip 並送至 Edge 的 model registry。
- Export ZIP 必須包含圖片與 JSON，並符合 Training Host `import-run` 資料格式：`manifest.json`、`report.json`、`program.json`、`images/`。
- 截圖資料、人工判定與預留欄位需能保留，作為後續訓練資料回收與 Phase 3 模型驗證來源。
- Capture 模式是後續資料蒐集、結果回查、人工標註與模型迭代訓練的核心基礎模式。

### 交付成果

- Raspberry Pi 可執行前端與後端。
- Tailscale 外網維護連線。
- systemd backend、nginx frontend 與快速啟動腳本。
- 相機截圖 API 與前端操作流程。
- Camera status API 與可設定 V4L2 camera 參數。
- Capture 模式操作流程。
- 模型選擇欄位與預設不選擇模型的行為。
- 截圖檔案與結果清單。
- 人工 OK / NG 判定欄位。
- 模型辨識結果與辨識錯誤的預留欄位。
- 清除清單按鈕，不刪除圖片檔案。
- Export UI 與 Training Host 相容 ZIP 下載，支援 USB 離線傳輸。
- Transfer UI 與 Training Host 匯入 API 串接。
- 模型包上傳與模型 registry 管理入口。
- 可回收至 Training Host 的截圖資料與人工判定資料。

### 本階段不包含

- AI 邊緣推理。
- Hailo 模型載入。
- 有模型時的自動 YOLO / Hailo 辨識。
- 移動平台與運動控制。
- 自動掃描流程。

## Phase 3: Raspberry Pi 截圖 + 邊緣辨識流程

### 階段目標

在 Raspberry Pi 上導入邊緣運算，完成截圖後的模型辨識流程，但仍不導入移動架構。

### 功能描述

- 啟用 Capture 畫面的模型選擇與模型狀態顯示。
- 使用者截圖後，系統依模型選擇決定流程：
  - 未選擇模型：沿用 Phase 2 行為，只存圖，由人工填寫 OK / NG。
  - 已選擇模型：存圖後執行模型辨識，回傳 OK / NG 與缺陷資訊。
- 顯示模型辨識結果、人工判定結果與是否為辨識錯誤。
- 人工結果若與模型結果不同，需標註為模型辨識錯誤，供 Training Host 後續再學習。
- 詳細資料窗格需支援修改截圖使用的模型；模型變更後，系統需重新將該圖片送入對應模型推論並更新 YOLO OK / NG、缺陷資訊與辨識錯誤狀態。
- 支援載入 Hailo `.hef` 模型包或當前可用的 Pi 推理環境。
- 模型部署以完整 model bundle 為單位，不接受裸 `model.hef` 作為正式安裝格式；每個 `models/<model_id>/` 目錄即為一個完整部署包。
- 每個 model bundle 至少包含 `manifest.json` 與 `model.hef`，並可包含 `classes.json` 或 `labels.txt`；`manifest.json` 需記錄 `model_id`、`part_no`、`version`、`input_size`、`classes`、`postprocess` 與 `checksum.model_hef`。
- Edge 端需以 model registry 掃描 `models/<model_id>/`，驗證各模型包，並讓無效模型包不影響其他有效模型。
- Edge 端需使用 `models/active.json` 記錄各料號預設啟用模型，例如 `{ "PCB-A001": "PCB-A001-yolo-v2" }`。
- 新增 model bundle 後不需重啟 Raspberry Pi 後端服務；後端需支援刷新模型清單、安裝模型包與熱切換 active model。
- 切換模型時需避免推論中途替換 adapter；若 HailoRT 資源無法正常釋放，才提示使用者重啟服務作為錯誤復原。
- 檢測結果需符合 `shared/contracts/inspection_run.schema.json` 的方向維護。

### 交付成果

- Pi 上可執行的邊緣推理流程。
- 模型狀態、模型 registry、active model 與模型選擇 UI。
- Raspberry Pi model APIs：列出模型、安裝模型、刷新模型清單、啟用指定模型、查詢各料號 active model。
- 截圖 + 辨識 + 結果檢視流程。
- 人工覆判與辨識錯誤標註。
- 可回收至 Training Host 的訓練資料。

### 本階段不包含

- 移動平台與運動控制。
- 自動掃描路徑。
- 多點位自動檢測。

## Phase 4: Raspberry Pi 移動架構整合

### 階段目標

導入移動平台與運動控制，完成 Raspberry Pi 上的自動化 AOI 掃描流程。

### 功能描述

- 連接運動控制器與移動平台。第一版採用 BTT SKR Pico V1.0 + Klipper / Moonraker；FluidNC、GRBL 保留為備案研究。
- 建立掃描程式或點位路徑管理。
- 執行「移動 -> 截圖 -> 辨識 -> 記錄」流程。
- 前端顯示目前座標、移動狀態、檢測狀態與最終 OK / NG。
- 支援手動 Jog、歸零、速度設定與基本安全狀態。
- 完成檢測報告、圖片與掃描程式的 run bundle 打包。
- 支援將 run bundle 上傳至 Training Host。

### 交付成果

- Raspberry Pi + 相機 + 邊緣推理 + 移動平台整合。
- 自動化掃描流程。
- 檢測報告與 run bundle。
- Training Host 資料回收流程。
- 長時間運作測試與錯誤復原策略。

### 本階段不包含

- 商用 AOI 等級的 MES/SMEMA 整合。
- Gerber/CAD 自動匯入。
- 3D AOI 深度量測。

## 階段功能對照

| 功能 | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|:---|:---:|:---:|:---:|:---:|
| 專案架構整理 | 必要 | 維護 | 維護 | 維護 |
| Training Host 訓練環境 | 必要 | 維護 | 使用 | 使用 |
| Windows Edge 模擬 | 必要 | 參考 | 參考 | 參考 |
| Raspberry Pi 實機部署 | 準備 | 必要 | 必要 | 必要 |
| 相機截圖 | 模擬 | 必要 | 必要 | 必要 |
| 截圖結果清單 | 雛形 | 必要 | 必要 | 必要 |
| 人工 OK / NG 判定 | 雛形 | 必要 | 必要 | 必要 |
| 截圖詳細窗格與連續覆判 | 雛形 | 必要 | 必要 | 必要 |
| PART / BATCH 修改 | 準備 | 必要 | 必要 | 必要 |
| 模型選擇與模型狀態 | 準備 | 欄位預留 | 必要 | 必要 |
| 已截圖資料重新指定模型推論 | 準備 | 不做 | 必要 | 必要 |
| 邊緣推理 | 準備 | 不做 | 必要 | 必要 |
| 辨識錯誤標註 | 準備 | 欄位預留 | 必要 | 必要 |
| 移動控制 | 不做 | 不做 | 不做 | 必要 |
| 自動掃描 | 不做 | 不做 | 不做 | 必要 |
| Run bundle 上傳 | 準備 | 可選 | 必要 | 必要 |

## 後續開發判斷規則

- 若功能需要 Raspberry Pi 相機實機，至少屬於 Phase 2。
- 若功能需要模型載入、YOLO/Hailo 推理或 OK / NG 自動判定，至少屬於 Phase 3。
- 若功能需要運動控制、點位路徑、Jog 或自動掃描，屬於 Phase 4。
- 若功能只影響訓練環境、文件、資料契約、UI 雛形或 Windows 模擬，可歸入 Phase 1。
