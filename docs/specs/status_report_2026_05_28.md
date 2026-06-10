# AOI Project 成果日誌 - 2026-05-28

## 今日目標

- 整理 AOI 專案的階段式開發路線。
- 明確切分 `training-host/`、`windows-edge-simulator/`、`raspberry-pi/` 三個執行環境的責任。
- 補強 Capture 模式，讓截圖、結果清單、人工 OK/NG、資料匯出成為後續訓練資料回收的核心流程。
- 規劃模型部署包與 Edge 端多模型管理的技術路線。

## 架構決策

### 三個執行環境

專案維持三個主要執行環境：

```text
training-host/
windows-edge-simulator/
raspberry-pi/
```

職責切分：

- `training-host/`：負責資料接收、資料管理、標註、訓練、模型管理。
- `windows-edge-simulator/`：負責在 Windows 上模擬 Edge 操作流程，讓 UI/API 可先於硬體完成。
- `raspberry-pi/`：負責最終邊緣端部署，包含相機、模型載入、結果回傳與後續運動控制。

### 階段式開發

重新整理開發路線為四個階段：

```text
Phase 1: 專案架構規劃、介面撰寫與 YOLO 訓練環境
Phase 2: Raspberry Pi 截圖部署
Phase 3: Raspberry Pi 截圖 + 邊緣辨識流程
Phase 4: Raspberry Pi 移動架構整合
```

階段判斷原則：

- 需要 Raspberry Pi 相機實機者，至少屬於 Phase 2。
- 需要模型載入、YOLO/Hailo 推理或 OK/NG 自動判定者，至少屬於 Phase 3。
- 需要運動控制、Jog、點位路徑或自動掃描者，屬於 Phase 4。
- 只影響訓練環境、文件、資料契約、UI 雛形或 Windows 模擬者，歸入 Phase 1。

## 文件整理

### specs 文件集中

將硬體、專案、資源、狀態報告等文件集中到：

```text
docs/specs/
```

主要文件包含：

- `development_roadmap.md`
- `functional_spec.md`
- `implementation_plan.md`
- `tasks.md`
- `camera_optics.md`
- `motion_control_selection.md`
- `klipper_setup.md`
- `spec_and_cost.md`
- `references.md`

### 開發路線圖

新增/更新：

```text
docs/specs/development_roadmap.md
```

內容定義：

- 各階段目標。
- 各階段交付成果。
- 各階段不包含項目。
- 功能對照表。
- 後續開發判斷規則。

此文件作為後續功能撰寫與開發排序的主要依據。

## Capture 模式成果

### Capture 核心定位

Capture 模式被定義為後續資料蒐集、結果回查、人工標註與模型迭代訓練的核心基礎模式。

主要流程：

```text
SNAP / 截圖
-> 儲存圖片
-> 建立 Capture Result List 紀錄
-> 人工 OK/NG
-> Export
-> Training Host 回收資料
```

### Capture Result List

Capture Result List 規劃/實作重點：

- 顯示截圖結果。
- 保留圖片檔名。
- 保留模型欄位。
- 保留模型辨識結果欄位。
- 保留人工 OK/NG 欄位。
- 保留辨識錯誤欄位。
- 支援點選單筆圖片開啟詳細資料窗格。

Phase 2 行為：

- 預設不選模型。
- 不執行模型辨識。
- 只儲存圖片與紀錄。
- 由使用者人工填寫 OK/NG。

### 詳細資料窗格

詳細資料窗格目標：

- 可檢視單張截圖。
- 可連續上一張 / 下一張切換。
- 可修改 PART / BATCH。
- 可人工覆判 OK / NG。
- 保留模型欄位，作為 Phase 3 重新指定模型推論的基礎。
- 窗格高度需穩定，切換 OK/NG 或顯示辨識錯誤時不應造成高度跳動。

### 清除清單

規劃清除 Capture Result List：

- 只清除清單紀錄。
- 不刪除已儲存圖片檔案。

這讓使用者能重置 UI 資料檢視，同時保留原始圖片供後續追查。

## Export 與 Training Host 回收格式

### Export UI

Capture 模式需提供 Export UI，讓使用者在匯出前可檢視：

- 匯出摘要。
- 可訓練資料數量。
- 辨識錯誤數。
- 資料明細。

### USB 離線轉移

匯出設計支援 USB 離線搬移，方便 Raspberry Pi / Edge 與 Training Host 分離部署。

Export ZIP 需包含：

```text
manifest.json
report.json
program.json
images/
```

目標是符合 Training Host `import-run` 資料格式，使截圖資料與人工判定可回收進訓練資料流程。

## Teaching / Run / Review 介面方向

### Teaching View

已規劃/補強 Teaching View 行為：

- 支援點位管理。
- 支援拖曳與編輯點位。
- 不應在使用者編輯時自動跳動到其他點位。

Teaching View 是後續 Phase 4 移動平台點位與掃描路徑管理的前置基礎。

### Run / Review

Run / Review 介面定位：

- `Run`：後續自動檢測流程執行入口。
- `Review`：檢測結果、歷史紀錄與資料回查入口。

目前以 UI/API 雛形為主，實際自動掃描與運動控制屬於 Phase 4。

## Training Host 方向

### 初步職責

Training Host 方向整理為：

- 管理資料集。
- 接收 Edge / Raspberry Pi 回傳資料。
- 提供模型列表與模型下載/管理。
- 建立 YOLO 訓練與匯出流程雛形。
- 後續整合 Label Studio 作為標註介面。

### Phase 1 交付目標

Training Host 在 Phase 1 需要具備：

- 可啟動的開發環境。
- 基礎 UI/API 流程。
- YOLO 訓練環境。
- 初版資料契約與模型契約。

完整訓練 UI、自動訓練與 model bundle 打包列入後續開發。

## Raspberry Pi 模型部署路線

### Model Bundle 儲存結構

初步確立模型部署包方向：

```text
models/<model_id>/
  manifest.json
  model.hef
  classes.json 或 labels.txt
```

每個 `models/<model_id>/` 資料夾是一個完整 bundle。

### 多模型管理

因不同料號會使用不同模型，後續需支援：

- 掃描多個 model bundle。
- 透過 manifest 驗證模型資訊。
- 使用 `part_no`、`version`、`model_id` 管理模型。
- 使用 active model 記錄不同料號預設模型。

### Phase 2 / Phase 3 分界

Phase 2：

- 只保留模型欄位與資料結構。
- 不啟用自動推論。

Phase 3：

- 啟用模型選擇。
- 啟用 YOLO / Hailo 推論。
- 建立模型辨識結果。
- 支援人工覆判與辨識錯誤回收。

## 運動控制研究

### Motion Control Alternatives

整理運動控制替代方案：

- FluidNC
- Klipper / Moonraker
- LinuxCNC
- GRBL 或等效方案

後續方向：

- Phase 4 才導入運動控制。
- Klipper / Moonraker 可作為候選方案。
- 需先完成 Capture、資料回收與模型驗證，再進入移動平台整合。

## 今日驗證

已完成/確認：

- 文件結構整理。
- 四階段開發路線整理。
- Capture 模式需求與行為定義。
- Capture Result List、詳細資料窗格、人工 OK/NG、Export 的資料流方向。
- Training Host 回收 ZIP 格式方向。
- Raspberry Pi Phase 2 / Phase 3 邊界。
- Model Bundle 與多模型管理技術路線。
- Motion Control 替代方案列入 Phase 4。

## 目前限制

- 尚未完成正式 Training Host 訓練 UI。
- 尚未完成 Label Studio 與 Training Host 的完整 UI 整合。
- 尚未接入 Raspberry Pi 實體相機。
- Phase 2 不執行模型推論，只保留欄位與資料結構。
- Phase 3 的 Hailo / YOLO 邊緣推論尚未進入實機驗證。
- Phase 4 的移動平台整合尚未開始。

## 下一步建議

1. 啟動 Training Host 與 Label Studio，完成初步資料標註流程。
2. 使用 Label Studio 匯出 YOLO 格式資料集。
3. 以 YOLO11 建立第一版 smoke model。
4. 將第一版模型放入 Windows Edge Simulator 測試 model bundle 與推論流程。
5. 在 Raspberry Pi 端加入 model registry / active.json 結構，但先鎖住推論功能以維持 Phase 2。
6. 等截圖與資料回收流程穩定後，再進入 Phase 3 邊緣辨識。

## 補充修正筆記

### 5/28 的核心成果

5/28 的重點不是模型精度，而是把整體系統拆成可逐步驗證的流程：

```text
先完成資料流
再完成訓練
再完成邊緣推論
最後才接移動平台
```

這個順序可避免同時處理相機、模型、資料、UI、運動控制造成問題難以定位。

### 與 5/29 的分工

5/28：

- 架構、文件、Capture 模式、資料回收、模型部署路線。

5/29：

- YOLO11 smoke model 訓練、Edge Simulator 載入模型、模擬相機輪播、本機 VLM 輔助判讀。
