#!/bin/bash

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="aoi-edge-backend"
PYTHON_BIN="${PYTHON_BIN:-python3}"
DATA_DIR="${AOI_EDGE_DATA_DIR:-${APP_DIR}/data}"
MODEL_DIR="${AOI_EDGE_MODEL_DIR:-${APP_DIR}/models}"
MODEL_INFERENCE_ENABLED="${AOI_EDGE_MODEL_INFERENCE_ENABLED:-false}"
TRAINING_HOST_URL="${AOI_TRAINING_HOST_URL:-http://127.0.0.1:8000}"
MACHINE_ID="${AOI_MACHINE_ID:-raspberry-pi-edge}"
CAMERA_INDEX="${AOI_CAMERA_INDEX:-0}"
CAMERA_WIDTH="${AOI_CAMERA_WIDTH:-1920}"
CAMERA_HEIGHT="${AOI_CAMERA_HEIGHT:-1080}"
CAMERA_FPS="${AOI_CAMERA_FPS:-30}"
CAMERA_FOURCC="${AOI_CAMERA_FOURCC:-MJPG}"
APP_USER="${SUDO_USER:-$(logname 2>/dev/null || echo pi)}"
APP_GROUP="$(id -gn "${APP_USER}" 2>/dev/null || echo "${APP_USER}")"

echo -e "${GREEN}=== 開始進行樹莓派後端原生部署 ===${NC}"

if [ "$EUID" -ne 0 ]; then
  echo "請使用 sudo 執行: sudo ./deploy-pi-backend.sh"
  exit 1
fi

echo -e "${YELLOW}安裝系統相依套件...${NC}"
apt update
apt install -y python3 python3-venv python3-pip python3-numpy python3-opencv libglib2.0-0 libgl1 python3-hailort || \
  apt install -y python3 python3-venv python3-pip python3-numpy python3-opencv libglib2.0-0 libgl1
usermod -aG video "${APP_USER}" || true

echo -e "${YELLOW}建立 Python 虛擬環境...${NC}"
if [ ! -d "${APP_DIR}/.venv-pi" ]; then
  "${PYTHON_BIN}" -m venv --system-site-packages "${APP_DIR}/.venv-pi"
fi

"${APP_DIR}/.venv-pi/bin/pip" install --upgrade pip
"${APP_DIR}/.venv-pi/bin/pip" install -r "${APP_DIR}/requirements.txt"

mkdir -p "${DATA_DIR}/programs" "${DATA_DIR}/history" "${MODEL_DIR}"
chown -R "${APP_USER}:${APP_GROUP}" "${DATA_DIR}" "${MODEL_DIR}" "${APP_DIR}/.venv-pi"

echo -e "${YELLOW}建立 systemd 服務...${NC}"
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=AOI Edge Backend
After=network.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment=AOI_EDGE_DATA_DIR=${DATA_DIR}
Environment=AOI_EDGE_MODEL_DIR=${MODEL_DIR}
Environment=AOI_EDGE_MODEL_INFERENCE_ENABLED=${MODEL_INFERENCE_ENABLED}
Environment=AOI_TRAINING_HOST_URL=${TRAINING_HOST_URL}
Environment=AOI_MACHINE_ID=${MACHINE_ID}
Environment=AOI_CAMERA_INDEX=${CAMERA_INDEX}
Environment=AOI_CAMERA_WIDTH=${CAMERA_WIDTH}
Environment=AOI_CAMERA_HEIGHT=${CAMERA_HEIGHT}
Environment=AOI_CAMERA_FPS=${CAMERA_FPS}
Environment=AOI_CAMERA_FOURCC=${CAMERA_FOURCC}
ExecStart=${APP_DIR}/.venv-pi/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"

echo -e "${GREEN}後端部署完成。${NC}"
echo "狀態檢查: systemctl status ${SERVICE_NAME}"
echo "API: http://127.0.0.1:8000/api/health"
