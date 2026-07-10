# SSH 邊緣裝置資料同步設計

## 1. 目標

在 Training Host 提供手動操作入口，透過 SSH 從 Raspberry Pi Edge 讀取下列資料：

- Capture 圖片、人工 OK/NG 與辨識結果。
- 完整檢測歷史與 run bundle。
- Backend、相機、磁碟、模型、systemd 服務狀態與最近日誌。

第一版只實際設定一台 Raspberry Pi，但裝置設定與 API 回應採多裝置結構，後續可加入更多 Edge。同步是唯讀操作；成功後不刪除、不修改 Edge 原始資料。

## 2. 已確認的使用方式

- 使用者在 Training Host UI 手動按下「從 Edge 同步」。
- Training Host 主動建立 SSH 連線，Edge 不需要主動連回 Training Host。
- SSH 使用現有 Tailscale 位址與 SSH 金鑰。
- 第一版不提供排程同步。
- 第一版不提供 Edge 資料清除功能。
- 系統狀態與日誌只作診斷，不進入模型訓練資料。

## 3. 方案選擇

採用 Training Host 呼叫系統 OpenSSH 的方式。

### 選擇原因

- 專案現有 `start-pi-aoi.ps1` 已使用系統 `ssh` 與 `scp`，部署方式一致。
- 不需新增 Paramiko 等 Python SSH 相依套件。
- 可用 `BatchMode`、`known_hosts` 與固定指令白名單限制權限。
- 可透過 SSH 標準輸出串流 JSON 或 ZIP，不需在 Edge 建立額外暫存檔。

### 未採用方案

- Paramiko/SFTP：需新增相依套件，且逐檔讀取較難保證同一份資料快照。
- SSH Tunnel + HTTP API：Capture bundle 適合，但仍需另外處理 systemd 狀態與日誌，第一版元件較多。

## 4. 整體架構

```text
Training Host UI
      │ 手動按「測試連線」或「從 Edge 同步」
      ▼
Training Host FastAPI
      │ 系統 OpenSSH + SSH key + Tailscale
      ▼
Raspberry Pi Edge
      ├─ 讀取本機 FastAPI：health、camera、models、capture、history
      ├─ 串流 Capture bundle 與 run bundle
      └─ 讀取磁碟、systemd 狀態與最近日誌
```

瀏覽器只呼叫 Training Host API。SSH 私鑰、遠端使用者與實際連線指令都留在 Training Host 後端。

## 5. 元件邊界

### 5.1 Edge 裝置設定

Training Host 從本機設定檔讀取裝置陣列。正式設定檔不提交 Git；專案只提供範例檔。

每台裝置包含：

- `device_id`：Training Host 使用的穩定識別值。
- `name`：UI 顯示名稱。
- `host`：LAN、DNS 或 Tailscale 位址。
- `port`：SSH 連接埠，預設 22。
- `user`：SSH 使用者。
- `identity_file`：Training Host 本機私鑰路徑。
- `known_hosts_file`：Training Host 本機主機指紋檔路徑。

第一版設定檔只有一筆資料，但讀取器與 API 使用陣列回傳，避免日後更改公開介面。

### 5.2 SSH 讀取服務

Training Host 後端以 `subprocess` 執行系統 `ssh`，並符合以下規則：

- 使用參數陣列與 `shell=False`。
- 啟用 `BatchMode=yes`，禁止執行期間等待密碼輸入。
- 指定 `UserKnownHostsFile`，主機指紋不符時拒絕連線。
- 設定連線與執行逾時。
- 遠端操作只能由後端固定白名單產生，前端不能傳入 shell 指令。
- JSON、ZIP 與文字日誌皆由標準輸出讀回；標準錯誤只作錯誤訊息。

白名單能力包含：

- 測試 SSH 連線。
- 呼叫 Edge 本機 `127.0.0.1:8000` 的唯讀 API。
- 讀取 `df` 磁碟摘要。
- 讀取 `aoi-edge-backend`、nginx、tailscaled 的 active 狀態。
- 讀取 `aoi-edge-backend` 最近 200 行 journal。

### 5.3 Raspberry Pi Edge 唯讀匯出

沿用既有 API：

- `GET /api/health`
- `GET /api/camera/status`
- `GET /api/models`
- `GET /api/capture/list`
- `GET /api/capture/export/bundle`
- `GET /api/orchestrator/history`

新增唯讀 API：

- `GET /api/orchestrator/history/{run_id}/bundle`

新增 API 會使用既有 `create_run_bundle` 建立相容於 Training Host `import-run` 的 ZIP。`run_id` 必須驗證為單一安全路徑名稱，不得包含斜線或路徑跳脫字元。

### 5.4 Training Host 同步服務

同步服務負責：

- 讀取指定裝置設定。
- 取得 Edge 狀態快照與資料清單。
- 判斷資料是否已同步或內容是否更新。
- 串流下載 bundle 至 Training Host 暫存目錄。
- 驗證 ZIP、manifest、JSON 與圖片路徑。
- 將有效 bundle 交給現有資料集匯入流程。
- 保存同步摘要與診斷快照。

現有 `POST /api/datasets/import-run` 的核心匯入邏輯會抽成可重用函式，HTTP 上傳與 SSH 同步共用相同驗證與落盤行為，避免兩套格式逐漸分歧。

### 5.5 Training Host API

新增：

- `GET /api/edges`：列出裝置與最近一次同步摘要，不回傳私鑰路徑。
- `POST /api/edges/{device_id}/test`：測試 SSH 與 Edge Backend 連線。
- `POST /api/edges/{device_id}/sync`：執行一次手動同步。
- `GET /api/edges/{device_id}/latest`：讀取最近診斷快照與同步結果。

同步 API 第一版採同步請求並設整體逾時。若實機資料量證明超過一般 HTTP 請求可接受時間，再另案改為背景工作；本設計不先加入工作佇列。

### 5.6 Training Host UI

在資料集管理畫面上方新增 Edge 同步區塊，內容包含：

- Edge 名稱與連線狀態。
- Backend、相機、磁碟與模型摘要。
- 「測試連線」按鈕。
- 「從 Edge 同步」按鈕。
- 最近同步時間。
- 新增、跳過、更新、失敗的數量與原因。
- 可展開查看最近服務日誌。

UI 不顯示私鑰內容，也不提供任意 SSH 指令輸入欄位。

## 6. 同步資料流

1. 使用者在 Training Host 按下「從 Edge 同步」。
2. Training Host 以 SSH 測試裝置連線。
3. 讀取 health、相機、模型、磁碟、systemd 與最近日誌。
4. 讀取 Capture 與歷史 run 清單。
5. 比對本機同步紀錄。
6. 只下載尚未匯入或內容已改變的 bundle。
7. 在暫存目錄驗證 bundle。
8. 驗證成功後，以原子性目錄移動方式寫入正式資料目錄。
9. 儲存同步報告並回傳 UI。
10. Edge 原始資料保持不變。

## 7. 重複資料與更新規則

規則使用容易理解的兩層判斷：

- `device_id + run_id`：判斷是不是同一筆來源資料。
- bundle SHA-256：判斷該筆資料的內容有沒有改變。

行為如下：

- 第一次看到該資料：匯入並標記為「新增」。
- 同一筆資料且 SHA-256 相同：不重複匯入，標記為「跳過」。
- 同一筆資料但 SHA-256 不同：代表 Edge 上的人工判定或內容後來被修改，另存新版本並標記為「更新」。
- 新版本不得靜默覆蓋已被訓練流程使用的舊資料。

Capture bundle 使用 manifest 內的 `run_id` 作為資料編號；歷史 run 使用路徑中的安全 `run_id`，並核對 bundle manifest 內容一致。

## 8. 本機保存方式

```text
training-host/data/
├─ imported_runs/
│  └─ <既有匯入資料與更新版本>
└─ edge_sync/
   └─ <device_id>/
      ├─ latest.json
      └─ history/
         └─ <timestamp>.json
```

Capture 圖片、人工 OK/NG 與完整 run bundle 進入現有資料集匯入流程，可供資料集整理與模型訓練使用。

相機狀態、服務狀態、磁碟、模型清單與日誌只保存在 `edge_sync` 診斷快照，不混入訓練資料。

## 9. 安全設計

- 只支援 SSH 金鑰驗證，不在 UI 保存或傳送密碼。
- 私鑰路徑只存在 Training Host 本機設定。
- 正式連線必須通過 `known_hosts` 主機指紋驗證。
- SSH subprocess 使用 `shell=False`。
- API 的 `device_id` 只能對應已載入的設定項目。
- run ID、檔名與 ZIP 內容都需防止路徑跳脫。
- 遠端指令是固定白名單，不能由 HTTP payload 組成任意命令。
- 設定 SSH 輸出大小、bundle 大小與執行逾時上限。
- 日誌回應不包含私鑰參數，錯誤訊息需遮蔽敏感路徑。
- Edge SSH 使用者只需讀取 AOI 資料與 journal，不授予不必要的 root 寫入權限。

## 10. 錯誤處理

- SSH 無法連線：整次同步回報失敗，不改變既有資料。
- Edge Backend 無回應：仍嘗試讀取 systemd 與 journal，協助診斷。
- 單一 bundle 損壞：只將該筆標記失敗，其餘 bundle 繼續處理。
- 診斷項目失敗：資料同步仍可繼續，回應中列出失敗項目。
- 同步中斷：未完成檔案留在暫存區並在請求結束時清理，不移入正式資料集。
- ZIP 或 manifest 驗證失敗：拒絕匯入並保留可理解的錯誤原因。
- 同一裝置同時收到第二次同步：回傳衝突錯誤，避免兩個流程寫入相同資料。

同步結果固定包含：

- `added`：首次匯入。
- `skipped`：內容完全相同。
- `updated`：同一來源資料有新內容版本。
- `failed`：下載或驗證失敗。

## 11. 測試策略

### Edge Backend

- 合法 run ID 能下載符合契約的 bundle。
- 不存在的 run 回傳 404。
- 包含斜線或路徑跳脫的 run ID 被拒絕。

### Training Host Backend

- SSH 指令使用參數陣列、`shell=False` 與固定白名單。
- 未知 `device_id` 被拒絕。
- 私鑰路徑不出現在 API 回應。
- 第一次同步產生 `added`。
- 相同內容再次同步產生 `skipped`。
- 相同 run ID、不同 SHA-256 產生 `updated` 並保留舊版本。
- 損壞 ZIP 產生單筆 `failed`，其他項目仍能完成。
- SSH 中斷不會留下正式資料集的半成品。
- 診斷讀取失敗不會阻止有效 bundle 匯入。

測試以替代的 subprocess runner 模擬 SSH 邊界，不連線真實 Edge；匯入與 ZIP 驗證使用真實暫存檔案。

### Training Host Frontend

- 建置與 TypeScript 檢查通過。
- 測試連線與同步按鈕在執行中會停用。
- 正確顯示新增、跳過、更新與失敗摘要。
- 部分失敗時仍顯示成功同步的資料。

### 實機驗收

- 透過 Tailscale 與既有 SSH 金鑰連線 Raspberry Pi。
- Training Host 能讀取 health、相機、模型、磁碟與日誌。
- Training Host 能下載一份 Capture bundle 與一份歷史 run bundle。
- 第二次同步不重複建立相同資料。
- Edge 上的圖片、紀錄與服務狀態未被同步流程修改。

## 12. 完成條件

- Training Host UI 可手動測試並同步已設定的 Edge。
- Capture、人工判定與歷史 run 能安全匯入現有資料流程。
- 系統狀態、模型清單與日誌能在 UI 查看。
- 重複同步不產生重複資料；內容更新保留版本。
- 任一失敗不會破壞已存在的 Training Host 或 Edge 資料。
- 設定與 API 不洩漏 SSH 私鑰內容。
- 後端測試與前端建置通過。

## 13. 不在第一版範圍

- 排程或背景自動同步。
- 從 Training Host 刪除 Edge 資料。
- 透過 SSH 重新啟動服務、切換模型或修改檢測結果。
- 在 UI 新增、編輯 SSH 裝置或上傳私鑰。
- 同時同步多台 Edge；介面只預留裝置陣列與 `device_id`。
- 佇列服務、Redis 或額外工作程序。
