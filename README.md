# Low-Cost PCB AOI System

An affordable, open-source Automated Optical Inspection (AOI) system designed for electronics manufacturing and DIY enthusiasts. This project consists of two main components: the **Edge System** (Raspberry Pi 5) for real-time inspection and the **Training Host** (PC) for AI model development.

## 📚 Documentation

Detailed documentation is available in the `docs/` directory:

- **Hardware**:
    - [Hardware Spec & Cost](docs/hardware/spec_and_cost.md)
    - [Camera & Optics Guide](docs/hardware/camera_optics.md)
    - [Motion Control Selection](docs/hardware/motion_control_selection.md)
    - [Klipper Setup](docs/hardware/klipper_setup.md)
- **Project**:
    - [Implementation Plan](docs/project/implementation_plan.md)
    - [Status Reports](docs/project/status_report_2026_01_13.md)
    - [Tasks](docs/project/tasks.md)
- **Resources**:
    - [Learning Resources](docs/resources/references.md)

## 🏗️ System Architecture

### 1. Edge System (Raspberry Pi 5)
The runtime environment located in `edge-backend` and `edge-frontend`.
- **Hardware**: Raspberry Pi 5 + FluidNC/Klipper Gantry + USB/CSI Camera.
- **Backend**: FastAPI (Python). Handles motion control (G-Code), camera streaming, and inference.
- **Frontend**: React + Vite (TypeScript). Provides the Operator UI for Teaching, Run, and Review.
- **Deployment**: Video and API services run in Docker containers via `docker-compose.edge.yml`.

### 2. Training Host (PC / Workstation)
The development environment located in `training-host`.
- **Purpose**: Managing datasets and training AI models (YOLO/MobileNet).
- **Stack**: Python, PyTorch/TensorFlow, Jupyter.
- **Deployment**: Runs via `docker-compose.yml` (standard).

---

## 🚀 Edge System Quick Start

The Edge System is the core interface for operating the AOI machine.

### Prerequisites
- Docker & Docker Compose
- Raspberry Pi 5 (Optimized for) or Linux PC

### Running the Edge Services
1. Navigate to the project root:
   ```bash
   cd low-cost-aoi
   ```
2. Start the Edge stack:
   ```bash
   docker-compose -f docker-compose.edge.yml up -d --build
   ```
3. Access the Interface:
   - **Frontend UI**: [http://localhost:3001](http://localhost:3001)
   - **Backend API**: [http://localhost:8000/docs](http://localhost:8000/docs)

### ✨ Key Features (Edge)
- **Teaching Mode**: 
  - Manual Jog Control.
  - Record Reference and Inspection Points.
  - **New**: Drag-and-drop point reordering, inline editing, and "Move Camera" tools.
- **Inspection Run**: 
  - Automated scanning sequence (Simulated or Real Motion).
  - Manual Alignment Wizard for PCB registration.
- **Review Dashboard**:
  - History of inspection runs.
  - **New**: CSV Data Export and History Management (Delete runs).

---

## 🖥️ Training Host Quick Start

For training new AI models or managing large datasets.

1. Navigate to `training-host` directory (if separate) or use root compose:
   ```bash
   docker-compose up -d --build
   ```
2. Access Services:
   - **Dashboard**: [http://localhost:3000](http://localhost:3000)
   - **TensorBoard**: [http://localhost:6006](http://localhost:6006)

---

## 📂 Project Structure

```
e:\Docker\low-cost-aoi\
├── docs/               # Documenation (Hardware, Project, Resources)
├── edge-backend/       # FastAPI app (Motion, Camera, Inference)
├── edge-frontend/      # React app (Operator UI)
├── training-host/      # Model training scripts & server
├── shared/             # Shared code/models
├── docker-compose.edge.yml  # Compose file for Edge System
└── docker-compose.yml       # Compose file for Training Host
```
