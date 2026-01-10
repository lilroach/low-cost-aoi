# 低成本 PCB AOI 系統 - 階段性任務清單 (Phased Roadmap)

- [ ] **Phase 1: 主機端開發與模型訓練 (Host Dev & Training)**
    - *目標: 建立 Docker 環境，完成訓練流程，並透過 Host UI 驗證缺點辨識能力。*
    - [x] 建立 Training Host Docker 環境 (PyTorch, YOLO11, Redis)
    - [x] 開發 **Host Training Dashboard** (React)
        - [x] 資料集管理 (上傳金色樣本/缺陷圖)
        - [x] 標註工具整合
    - [ ] 實作 AI 訓練流程 (針對軟硬板缺陷)
    - [ ] === 里程碑 1: 可在電腦上訓練模型並手動上傳圖片測試辨識結果 ===

- [ ] **Phase 2: 半自動 AOI 辨識 (Manual IO)**
    - *目標: 在邊緣硬體上執行，人工移動板子，手動觸發相機與辨識。*
    - [ ] 建置 Edge 運算環境 (RPi 5, FastAPI, ONNX Runtime)
    - [ ] 開發 **Edge Operator UI** (基礎版)
        - [ ] 相機即時串流顯示 (Livestream)
        - [ ] 「手動截圖檢測」按鈕功能
    - [ ] 部署訓練好的 ONNX 模型至 Edge
    - [ ] === 里程碑 2: 作業員手動檢測站 (無馬達控制) ===

- [ ] **Phase 3: 導入運動控制 (Motion Integration)**
    - *目標: 加入龍門控制，實現自動化掃描。*
    - [ ] 實作 MCU 韌體與 Serial 通訊模組
    - [ ] 開發 Orchestrator 的「路徑掃描邏輯」
    - [ ] 整合 Motion 與 Vision (移動 -> 停止 -> 拍照 -> 移動)
    - [ ] Edge UI 新增「自動掃描」與「復歸原點」功能
    - [ ] === 里程碑 3: 全自動掃描原型 ===

- [ ] **Phase 4: 完整部署與優化 (Deployment)**
    - *目標: 效能調優與產線整合。*
    - [ ] 效能優化 (FPS 提升, 多執行緒)
    - [ ] 針對特殊缺陷 (軟板毛邊/金手指) 的模型微調
    - [ ] 壓力測試與穩定性驗證
    - [ ] === 里程碑 4: 正式上線 ===
