# Low-Cost PCB AOI System (Training Host)

This is the Training Host module of the Low-Cost AOI System.
It runs on a PC/Workstation with NVIDIA GPU support.

## Prerequisites
- Docker Desktop
- NVIDIA Drivers (if using GPU)

## Quick Start

1. Open a terminal in this directory (`low-cost-aoi/training-host`).
2. Run the following command to build and start services:
   ```powershell
   docker-compose up --build -d
   ```
3. Access the services:
   - **Dashboard UI**: http://localhost:3000
   - **API Docs**: http://localhost:8000/docs
   - **TensorBoard**: http://localhost:6006

## Development
- **Backend**: Located in `backend/`. Uses FastAPI.
- **Frontend**: Located in `frontend/`. Uses React + Vite.
