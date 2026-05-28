# 專案進度報告：低成本 PCB AOI 系統 (2026-03-25)

## 1. 執行摘要 (Executive Summary)
本專案旨在開發一套適用於電子製造與 DIY 愛好者的經濟型開源自動光學檢測 (AOI) 系統。目前已完成核心架構設計、硬體方案評選、以及邊緣系統 (Edge System) 的初步功能實作。今日已額外建立 **Agent 開發基礎設施**，標準化後續的 AI 協作流程。

## 2. 硬體與成本現狀
- **核心架構**：Raspberry Pi 5 + FluidNC/Klipper 運動控制。
- **預估成本**：約 **$16,430 TWD**，遠低於工業級方案。
- **硬體進度**：已完成各方案比較與 BOM 表草案。

## 3. 軟體開發進度

### ✅ 已完成功能
- **系統架構**：建立 Edge System 與 Training Host 的 Docker 部署環境。
- **教學模組 (Teaching)**：實作手動控制 (Jog)、點位排序 (Drag-and-drop)、以及座標編輯。
- **資料管理 (Data)**：實作檢測歷史紀錄查詢、CSV 資料匯出與刪除功能。
- **開發基礎設施 (New)**：
    - **Agent Skills**：建立前端 (React)、後端 (FastAPI) 與運動控制 (Motion/Vision) 的專屬開發規範。
    - **Workflows**：建立 `/start_edge_env`, `/start_training_env`, `/check_edge_logs` 等自動化工作流。

### 🚧 進行中與後續計畫
- **Klipper 深度整合**：將運動控制後端由初步設計轉向 Klipper/Moonraker API 整合。
- **視覺自動對位**：開發基於 OpenCV Template Matching 的自動參考點 (Fiducial) 對位功能。
- **CAD/CSV 導入**：開發從 PCB 設計檔案自動生成檢測點位的功能。

## 4. 基礎設施配置說明
已配置 `.agents/` 目錄，確保 AI 助手在開發時遵循：
- **語言規範**：UI/註解使用正體中文，程式碼使用英文。
- **架構規範**：後端嚴格遵守 `api/service/repository` 三層結構。
- **安全規範**：環境變數管理與 Pydantic 資料驗證。

---
**報告人**: Antigravity (AI Assistant)
**日期**: 2026-03-25
