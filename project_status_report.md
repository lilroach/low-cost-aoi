# Project Status Report: Low-Cost PCB AOI System
**Date**: 2026-01-13
**Version**: 1.0

## 1. Executive Summary
This project aims to build a low-cost, open-source Automated Optical Inspection (AOI) system for electronics manufacturing. We have successfully implemented a dual-architecture system (Edge vs. Host) and completed the core "Teaching" and "Review" software modules. The hardware budget is estimated at approximately **$16,430 TWD**, offering a significant cost advantage over commercial industrial solutions (> $80,000 TWD).

## 2. Hardware Budget Estimate
*Based on the optimized "Pi 5 + FluidNC" Architecture.*

| Category | Estimated Cost (TWD) | Key Components |
| :--- | :--- | :--- |
| **Compute Core** | $7,000 | Raspberry Pi 5 (8GB), NVMe SSD 512GB, Pi Camera |
| **Motion Control** | $2,140 | BTT FluidNC Board (ESP32), TMC2209 Drivers |
| **Gantry Mechanics** | $5,750 | 800x600mm Alum Profile, NEMA 17 Motors, Belts |
| **Power & Misc** | $1,540 | 24V PSU, Drag Chains, Cabling |
| **Total Estimate** | **$16,430** | *Excluding shipping/tools* |

## 3. Development Progress

### ✅ Completed Features
*   **System Architecture**: Established "Edge System" (Runtime) and "Training Host" (Dev) Docker environments.
*   **Teaching Module**:
    *   Manual Jog Control via Web UI.
    *   **New**: Drag-and-drop point reordering.
    *   **New**: Inline coordinate editing and "Move Camera" verification tool.
    *   No automatic page jumping (improved workflow).
*   **Data Management**:
    *   Full inspection run history.
    *   **New**: CSV Export of inspection results.
    *   **New**: Ability to delete old run data.

### 🚧 In Progress / Next Steps
*   **Auto-Alignment**: Implementing OpenCV Template Matching to replace manual fiducial alignment.
*   **CAD Import**: Developing a CSV importer to generate inspection programs from PCB design files.
*   **AI Model Integration**: Connecting real-time camera feed to PyTorch/TensorFlow inference engine.

## 4. Architecture Overview
The system uses a decoupled architecture for maximum stability:

*   **Edge Unit (Raspberry Pi 5)**:
    *   Runs the React Frontend (Operator UI) and FastAPI Backend.
    *   Handles high-level logic, file management, and AI inference.
*   **Motion Controller (ESP32)**:
    *   Runs FluidNC firmware.
    *   Handles real-time step generation (G-Code execution), ensuring smooth motor movement regardless of Pi CPU load.

## 5. Resources
*   **Source Code**: Hosted on GitHub.
*   **Documentation**: See `README.md` for quick start instructions.
