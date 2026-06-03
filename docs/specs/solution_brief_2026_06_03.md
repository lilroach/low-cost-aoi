# 低成本 PCB AOI 方案簡介

> 更新日期: 2026-06-03  
> 幣別: 新台幣 TWD；美元品項以 `1 USD ~= NT$31.46` 暫估。  
> 定位: 第一版以 Raspberry Pi 5 4GB 實機完成取像、資料回收與人工覆判；後續再逐步導入邊緣 AI 推論與移動平台。

## 1. 各階段任務

本專案採四階段推進，避免同時導入相機、AI、移動平台與訓練流程而增加除錯難度。每一階段都要能獨立驗證，並能把成果交給下一階段使用。

- Phase 1: 架構與訓練環境
  - 任務重點: 建立 `training-host/`、`windows-edge-simulator/`、`raspberry-pi/` 三環境；完成 UI/API 雛形、資料契約與 YOLO 訓練流程。
  - 主要交付: Training Host、Windows Edge Simulator、基礎 Edge UI/API、資料/模型契約。
- Phase 2: Raspberry Pi 截圖部署
  - 任務重點: 將 Raspberry Pi 實機部署成可用 Edge；完成相機取像、截圖保存、人工 OK / NG、Export / Transfer 與模型包管理入口。
  - 主要交付: Pi backend / frontend、camera status、Capture UI、人工覆判、資料回收 ZIP。
- Phase 3: 邊緣辨識流程
  - 任務重點: 在 Pi 上導入 Hailo / YOLO 推論；支援模型選擇、模型包安裝、熱切換、截圖後辨識與辨識錯誤回收。
  - 主要交付: 可部署模型包、Edge 推論結果、人工覆判比對、可再訓練資料。
- Phase 4: 移動平台整合
  - 任務重點: 導入 CoreXY / Klipper / Moonraker，完成多點位自動掃描、移動控制、拍照、推論與 run bundle 報告。
  - 主要交付: 自動掃描流程、座標與圖片紀錄、檢測報告、Training Host 回收資料。

目前實際進度位於 **Phase 2: Raspberry Pi 截圖部署**。現階段優先把 Pi 取像、資料保存、人工覆判與資料回收流程穩定下來；AI 推論與移動平台分別放在 Phase 3 與 Phase 4。

## 2. 方案原理

本方案以低成本邊緣裝置取代傳統大型 AOI 設備，將 PCB 檢測拆成「取像、資料管理、模型訓練、邊緣辨識、移動掃描」五個可分階段驗證的模組。

核心分工如下:

- Raspberry Pi Edge
  - 角色: 現場檢測端。
  - 原理: 執行 FastAPI backend、Web UI、相機取像、資料打包與後續 Hailo 推論。
- 相機與光源
  - 角色: 影像來源。
  - 原理: 以固定曝光、固定解析度與穩定光源取得 PCB 局部影像，優先避免動態拍攝變形與反光干擾。
- Training Host
  - 角色: 訓練端。
  - 原理: 接收 Edge 回傳圖片與人工 OK / NG 結果，建立資料集並訓練 YOLO 類模型。
- 模型包
  - 角色: 部署單位。
  - 原理: 以完整 model bundle 管理 `manifest.json`、模型檔、類別與 checksum，避免裸模型檔散落。
- 移動平台
  - 角色: 自動掃描端。
  - 原理: Phase 4 才導入 CoreXY / Klipper，執行「移動 -> 拍照 -> 推論 -> 記錄」流程。

設計重點是先讓資料閉環成立: Raspberry Pi 拍照並保存結果，人工覆判產生可訓練資料，Training Host 訓練後再把模型包送回 Edge。等模型與相機流程穩定後，才讓移動平台加入自動掃描。

## 3. 預計達成效果

- 低成本建置
  - 預計效果: 以約 NT$8,000 到 NT$13,500 完成不含移動機構的第一版邊緣取像與邊緣辨識硬體估算；若採較正式 USB3 工業相機，預算上緣需上修。
  - 驗收方式: BOM 與採購單比對。
- 現場取像
  - 預計效果: Raspberry Pi 可直接拍照、預覽、保存圖片與記錄 PART / BATCH。
  - 驗收方式: Capture UI、`/api/camera/status`、snap 檔案驗證。
- 人工覆判與資料回收
  - 預計效果: Phase 2 可在未啟用 AI 前先累積 OK / NG 樣本。
  - 驗收方式: Export / Transfer ZIP 可被 Training Host 匯入。
- 邊緣辨識
  - 預計效果: Phase 3 導入 Hailo / YOLO 後，拍照後回傳 OK / NG 與缺陷資訊。
  - 驗收方式: 模型包安裝、啟用、推論結果與人工覆判比對。
- 自動化掃描
  - 預計效果: Phase 4 導入 CoreXY 後，支援多點位掃描與 run bundle 報告。
  - 驗收方式: 掃描路徑、座標、圖片、結果 JSON 完整保存。

第一版不追求商用 AOI 的高速產線節拍、3D AOI 或 MES / SMEMA 整合；重點是用較低成本建立可驗證、可迭代、可回收資料的 AOI 原型。

## 4. 現階段進度

目前狀態屬於 Phase 2: Raspberry Pi 截圖部署，且已完成多項實機驗證。

已完成:

- 專案已拆分為 `training-host/`、`windows-edge-simulator/`、`raspberry-pi/` 三個執行環境。
- Raspberry Pi backend 已部署為 `aoi-edge-backend` systemd service，frontend 已由 nginx 提供。
- Raspberry Pi 已可透過 Tailscale 維護連線。
- Pi 上 `/api/health` 已驗證為正常。
- USB camera 已在 Pi 上以 V4L2 讀取，確認 `1920x1080`、`30 FPS`、MJPG 設定可取得有效 frame。
- Capture UI、結果清單、人工 OK / NG、Export / Transfer UI、模型包上傳入口已建立。
- Training Host 已具備資料集、標註與訓練流程基礎。
- Windows Edge Simulator 保留作為 UI/API 開發與資料流測試環境。

尚未完成:

- Phase 3 的 Raspberry Pi / Hailo 實際 YOLO 推論尚未正式啟用。
- 模型辨識錯誤自動標註與重新指定模型推論仍待 Phase 3 完成。
- Phase 4 的 CoreXY 移動平台、Klipper / Moonraker 串接、自動掃描流程尚未導入。
- 光源、鏡頭倍率、工作距離與實際 PCB 缺陷樣本仍需實測定版。

## 5. 最新硬體價格更新

價格為 2026-06-03 線上查詢結果。Raspberry Pi 相關品項近期受記憶體價格上漲影響，Raspberry Pi 官方於 2026-02-02 公告 4GB 產品增加 US$15、8GB 增加 US$30、16GB 增加 US$60，因此舊版 2026-01-13 BOM 中 Raspberry Pi 5 4GB 的 NT$3,200 已偏低。

本節費用估計只計算 Raspberry Pi Edge、相機、電源、散熱、邊緣 AI 與基本儲存/線材。移動機構硬體不納入本次總額，包含但不限於 CoreXY 龍門架、鋁擠型、線性導軌、馬達、同步帶、同步輪、惰輪、拖鏈、限位開關、24V 馬達電源、加工件與組裝治具。BTT SKR Pico 僅列為 Phase 4 參考價格，不併入下方預算區間。

- SBC 主板
  - 建議規格: Raspberry Pi 5 4GB。
  - 最新查詢價格: RS Taiwan 含稅 NT$4,394.25；勝特力 NT$4,999。
  - 更新估算: NT$4,400 到 NT$5,000。
  - 備註: 舊估 NT$3,200，需上修。
- 散熱
  - 建議規格: Raspberry Pi 5 Active Cooler。
  - 最新查詢價格: 莓亞 NT$238；米羅 NT$240 起。
  - 更新估算: NT$240。
  - 備註: 維持主動散熱。
- 電源
  - 建議規格: 官方 27W USB-C PD。
  - 最新查詢價格: 莓亞 NT$458。
  - 更新估算: NT$460。
  - 備註: Pi 5 建議供電規格。
- 邊緣 AI
  - 建議規格: Raspberry Pi AI HAT+ 13 TOPS。
  - 最新查詢價格: 官方起價 US$70。
  - 更新估算: 約 NT$2,200。
  - 備註: Phase 3 選配；AI Kit 已標示停產，新客戶應改買 AI HAT+。
- 下位機
  - 建議規格: BTT SKR Pico V1.0。
  - 最新查詢價格: BIQU 官方 US$29.89。
  - 更新估算: 約 NT$940。
  - 備註: Phase 4 用於 Klipper / CoreXY；屬移動平台控制相關項目，本次費用估計不納入總額。
- 預算型全域快門相機
  - 建議規格: Waveshare IMX296 Global Shutter。
  - 最新查詢價格: US$60.95 到 US$62.99。
  - 更新估算: 約 NT$1,920 到 NT$1,980。
  - 備註: 低成本候選，需確認介面與線長限制。
- Raspberry Pi 官方全域快門相機
  - 建議規格: Raspberry Pi Global Shutter Camera。
  - 最新查詢價格: Waveshare US$79.31 到 US$79.99。
  - 更新估算: 約 NT$2,500。
  - 備註: CSI 生態成熟，但移動龍門需處理排線或 Pi 隨相機移動問題。
- USB3 工業 IMX296 相機
  - 建議規格: InnoMaker U3V-CAM-IMX296。
  - 最新查詢價格: 特價 US$179。
  - 更新估算: 約 NT$5,630。
  - 備註: 較符合相機與 Pi 分離、拖鏈走線與工業觸發需求。

### 更新後硬體預算區間

- Phase 2 實機截圖版
  - 內容: Pi 5 4GB、散熱、電源、既有 USB camera 或低成本全域快門相機、儲存與基本線材；不含 AI HAT+ 與移動平台。
  - 預估總額: 約 NT$8,000 到 NT$11,000。
- Phase 3 邊緣辨識版
  - 內容: Phase 2 + AI HAT+ 13 TOPS + 模型包部署流程。
  - 預估總額: 約 NT$10,200 到 NT$13,500。
- Phase 3 + USB3 工業相機版
  - 內容: Phase 3 改採 USB3 工業 IMX296 相機，仍不含移動機構硬體。
  - 預估總額: 約 NT$13,900 到 NT$17,200。
- Phase 4 自動掃描版
  - 內容: Phase 4 會導入移動平台，但移動機構硬體費用本版方案簡介不計算。
  - 預估總額: 不納入本次費用估計，需另開機構 BOM 與採購估算。

## 6. 建議下一步

1. 先固定 Phase 2 實機流程: camera status、snap、人工 OK / NG、Export / Transfer 都要能穩定重複操作。
2. 補足光源與鏡頭測試樣本，建立至少一批 OK / NG 圖片資料集。
3. 以 Training Host 訓練第一版 YOLO 模型，封裝成 model bundle。
4. 在 Raspberry Pi 上導入 AI HAT+ / Hailo 推論，完成 Phase 3 截圖後辨識。
5. 待取像與推論穩定後，再進入 Phase 4 的 CoreXY / Klipper 自動掃描。

## 參考來源

- Raspberry Pi 官方 Pi 5 產品頁: https://www.raspberrypi.com/products/raspberry-pi-5/
- Raspberry Pi 官方記憶體漲價公告，2026-02-02: https://www.raspberrypi.com/news/more-memory-driven-price-rises/
- RS Taiwan Raspberry Pi 5 4GB: https://twen.rs-online.com/web/p/raspberry-pi/0219253
- 勝特力 Raspberry Pi 5 4GB: https://www.100y.com.tw/product/154532
- Raspberry Pi AI HAT+: https://www.raspberrypi.com/products/ai-hat/
- Raspberry Pi AI Kit: https://www.raspberrypi.com/products/ai-kit/
- BIQU BTT SKR Pico V1.0: https://biqu.equipment/products/btt-skr-pico-v1-0
- Waveshare Global Shutter Cameras: https://www.waveshare.com/product/raspberry-pi/cameras/global-shutter-cameras.htm
- InnoMaker U3V-CAM-IMX296: https://www.inno-maker.com/product/u3v-imx296-gs/
- Wise USD/TWD 匯率查詢: https://wise.com/gb/currency-converter/usd-to-twd-rate?amount=1
