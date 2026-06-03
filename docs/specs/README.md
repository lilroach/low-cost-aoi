# AOI 規格文件索引

此資料夾集中放置專案規格、硬體規格、部署規劃、進度紀錄與參考資料。

## 核心規格

- [低成本 PCB AOI 方案簡介 2026-06-03](solution_brief_2026_06_03.md)
- [開發路線圖](development_roadmap.md)
- [功能說明書](functional_spec.md)
- [實作計畫與架構](implementation_plan.md)

## 硬體與部署

- [硬體規格與費用估算](spec_and_cost.md)
- [相機與光學設置指南](camera_optics.md)
- [Raspberry Pi OS 到 AOI Edge 專案安裝指南](raspberry_pi_os_project_install.md)
- [320 x 300mm CoreXY / GT2 9mm AOI BOM](corexy_320x300_gt2_9mm_bom.md)
- [龍門架尺寸與重量方案比較](gantry_size_weight_options.md)
- [SKR Pico / Klipper AOI 下位機架構](skr_pico_klipper_aoi_architecture.md)
- [運動控制方案選擇](motion_control_selection.md)
- [ESP32 / FluidNC 下位機評估報告](esp32_fluidnc_evaluation.md)
- [Klipper 設定教學](klipper_setup.md)

## 進度與工作項目

- [進度報告 2026-01-13](status_report_2026_01_13.md)
- [進度報告 2026-03-25](status_report_2026_03_25.md)
- [成果日誌 2026-05-28](status_report_2026_05_28.md)
- [修正日誌 2026-05-29](status_report_2026_05_29.md)
- [待辦事項](tasks.md)
- [Capture 模式優化備忘](待修改功能.md)
- [建置日誌](build_log.txt)

## 開發筆記

- [Docker 容器接入網路攝影機分析筆記](../note/docker_webcam_access_note_2026_05_29.md)

## 參考資料

- [參考資料](references.md)

## 資料契約

資料與模型契約保留在 `../../shared/contracts/`，因為它們同時是規格與程式可引用的資料來源：

- `../../shared/contracts/inspection_run.schema.json`
- `../../shared/contracts/dataset_bundle.schema.json`
- `../../shared/contracts/model_manifest.schema.json`
