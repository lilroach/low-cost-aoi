# Tasks

- [x] Search for existing BOM or hardware documentation <!-- id: 0 -->
- [x] Draft hardware cost breakdown structure <!-- id: 1 -->
- [x] Fill in prices and details for Raspberry Pi, MCU, Gantry, and Cables <!-- id: 2 -->
- [x] Create `hardware_cost.md` artifact <!-- id: 3 -->
- [x] Add scenario comparison table (DIY vs Finished Motion vs Industrial Cam) <!-- id: 4 -->
- [x] Plan frontend enhancements (Data Export, Management) <!-- id: 5 -->
- [x] Implement History/Data Management View <!-- id: 6 -->
- [x] Implement System Export functionality <!-- id: 7 -->
- [x] Enhance Teaching View (Drag-and-drop, Edit Points, No auto-jump) <!-- id: 8 -->
- [x] Research Motion Control Alternatives (FluidNC vs Klipper vs LinuxCNC) <!-- id: 11 -->
- [ ] **[Next]** Integrate SKR Pico / Klipper / Moonraker with Backend <!-- id: 12 -->
- [ ] **[Next]** Implement Auto-Alignment (OpenCV Template Matching) <!-- id: 9 -->
- [ ] Implement CAD/CSV Import for Teaching <!-- id: 10 -->

## Edge Model Bundle Loading Roadmap

These items define the technical route for Raspberry Pi model installation and loading.

- [x] Define model bundle storage as `models/<model_id>/`, where each folder is one complete deployable bundle containing `manifest.json`, `model.hef`, and optional `classes.json` or `labels.txt`. <!-- id: 13 -->
- [x] Extend `manifest.json` usage to include `part_no` and `version` for multi-part-number model management while keeping `model_id` as the bundle folder name. <!-- id: 14 -->
- [x] Replace the single `models/current/` assumption with a model registry that scans all `models/<model_id>/` folders, validates manifest fields, validates `model.hef` SHA-256, and reports invalid bundles without blocking valid ones. <!-- id: 15 -->
- [x] Add `models/active.json` to map each `part_no` to its default active `model_id`, for example `{ "PCB-A001": "PCB-A001-yolo-v2" }`. <!-- id: 16 -->
- [x] Add Raspberry Pi backend model APIs: `GET /api/models`, `POST /api/models/install`, `POST /api/models/refresh`, `POST /api/models/{model_id}/activate`, and `GET /api/models/active`. <!-- id: 17 -->
- [x] Support installing a new model bundle without restarting the backend service: upload or copy the bundle, validate it, add it to the registry, and optionally activate it for its `part_no`. <!-- id: 18 -->
- [x] Add locked hot model switching path without restarting the backend service: the active record can change now, while actual Hailo adapter loading remains gated by `AOI_EDGE_MODEL_INFERENCE_ENABLED`. <!-- id: 19 -->
- [x] Keep service restart as an error recovery path only for HailoRT runtime or driver failures, not as the normal model installation flow. <!-- id: 20 -->
- [x] Update Capture model selection so Raspberry Pi uses the model registry instead of a hard-coded model list; default behavior remains "No model" while Phase 2 locks inference. <!-- id: 21 -->
- [x] Keep Windows Edge simulator aligned with the Raspberry Pi model APIs using mock model bundles and mock inference, so Phase 3 UI can be developed before Hailo hardware is available. <!-- id: 22 -->

## Raspberry Pi Phase 2 Deployment Roadmap

- [x] Install and authorize Tailscale on Raspberry Pi, using a device-specific Tailscale IP for remote maintenance. <!-- id: 31 -->
- [x] Deploy Raspberry Pi backend as `aoi-edge-backend` systemd service and frontend through nginx. <!-- id: 32 -->
- [x] Add quick start scripts for Pi-local service control and Windows remote control through Tailscale. <!-- id: 33 -->
- [x] Install required Pi packages, Hailo runtime dependencies, V4L2 tools, and Traditional Chinese locale/font/input packages. <!-- id: 34 -->
- [x] Add Edge Transfer UI for uploading ready capture bundles to Training Host and installing model bundle zip files on Edge. <!-- id: 35 -->
- [x] Keep Windows Edge Simulator aligned with the same Transfer UI workflow for simulator-to-Training Host validation. <!-- id: 36 -->
- [x] Configure the new USB CCD camera through V4L2/OpenCV, including camera environment variables and `GET /api/camera/status`. <!-- id: 37 -->
- [x] Verify live camera feed and snap capture on Pi at 1920x1080 MJPG 30 FPS. <!-- id: 38 -->
- [ ] Write an operator SOP for Tailscale connection, camera check, data upload, model upload, and service recovery. <!-- id: 39 -->

## Training Host Automation Roadmap

These items track the next step after the YOLO11 terminal smoke training flow.

- [x] Build Training Host training UI for selecting dataset, base model, epochs, image size, batch size, and run name. <!-- id: 23 -->
- [x] Add Training Host backend endpoint/job wrapper for launching YOLO11 training without manual PowerShell commands. <!-- id: 24 -->
- [x] Add training run status/log view and result path display in Training Host UI. <!-- id: 25 -->
- [x] Add model bundle packaging action from a completed `best.pt`, producing `models/<model_id>/manifest.json` plus weights for simulator validation and later Hailo export. <!-- id: 26 -->
- [ ] Add a dataset quality checklist for minimum OK / 毛絲 / 殘肉 image counts before starting a new training run. <!-- id: 27 -->

## SSH Edge Manual Sync Roadmap

- [x] Add a readonly Raspberry Pi history run bundle endpoint with safe run ID validation. <!-- id: 40 -->
- [x] Add Training Host OpenSSH reader with key authentication, known_hosts verification, fixed command allowlist, timeouts, and sensitive-path redaction. <!-- id: 41 -->
- [x] Reuse one validated run importer for HTTP uploads and SSH synchronization. <!-- id: 42 -->
- [x] Track added, skipped, updated, and failed bundles while preserving Edge source data and prior Training Host versions. <!-- id: 43 -->
- [x] Save camera, model, disk, service, and journal diagnostic snapshots separately from training data. <!-- id: 44 -->
- [x] Add Training Host UI for connection testing, manual synchronization, summaries, item errors, and recent logs. <!-- id: 45 -->
- [x] Document local device configuration and operator workflow without committing real credentials. <!-- id: 46 -->

## Simulator-Only Feature Cleanup Roadmap

- [ ] Keep `sim-camera` image carousel documented as a Windows Edge Simulator-only development tool. Remove or disable it for Raspberry Pi production deployment. <!-- id: 28 -->
- [ ] Keep local Ollama VLM analysis documented as a Windows Edge Simulator-only annotation/debug aid. Remove or disable it for Raspberry Pi production deployment. <!-- id: 29 -->
- [ ] Add Windows local edge-backend launch path for webcam validation using OpenCV `VideoCapture`, instead of trying to access Windows webcam from Docker Linux containers. <!-- id: 30 -->
