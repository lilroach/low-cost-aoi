#!/usr/bin/env bash

set -euo pipefail

ACTION="${1:-start}"
BACKEND_SERVICE="${AOI_BACKEND_SERVICE:-aoi-edge-backend}"
FRONTEND_SERVICE="${AOI_FRONTEND_SERVICE:-nginx}"
API_URL="${AOI_API_URL:-http://127.0.0.1:8000/api/health}"
WEB_URL="${AOI_WEB_URL:-http://127.0.0.1/}"

if [ "${EUID}" -eq 0 ]; then
  SUDO=()
else
  SUDO=(sudo)
fi

show_status() {
  echo "=== AOI service status ==="
  systemctl is-active "${BACKEND_SERVICE}" >/dev/null 2>&1 && \
    echo "backend:  active (${BACKEND_SERVICE})" || \
    echo "backend:  inactive (${BACKEND_SERVICE})"
  systemctl is-active "${FRONTEND_SERVICE}" >/dev/null 2>&1 && \
    echo "frontend: active (${FRONTEND_SERVICE})" || \
    echo "frontend: inactive (${FRONTEND_SERVICE})"
}

health_check() {
  echo "=== AOI health check ==="
  if command -v curl >/dev/null 2>&1; then
    echo -n "api: "
    curl -fsS "${API_URL}" || echo "unavailable"
    echo
    echo -n "web: "
    curl -fsSI "${WEB_URL}" | head -n 1 || echo "unavailable"
  else
    echo "curl is not installed; skip health check."
  fi
}

wait_for_api() {
  if ! command -v curl >/dev/null 2>&1; then
    return 0
  fi

  echo "Waiting for backend API..."
  for _ in $(seq 1 30); do
    if curl -fsS "${API_URL}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "Backend API did not become ready within 30 seconds."
  return 1
}

case "${ACTION}" in
  start)
    echo "Starting AOI backend and frontend..."
    "${SUDO[@]}" systemctl start "${BACKEND_SERVICE}"
    wait_for_api || true
    "${SUDO[@]}" nginx -t >/dev/null 2>&1
    "${SUDO[@]}" systemctl start "${FRONTEND_SERVICE}"
    show_status
    health_check
    ;;
  restart)
    echo "Restarting AOI backend and frontend..."
    "${SUDO[@]}" systemctl restart "${BACKEND_SERVICE}"
    wait_for_api || true
    "${SUDO[@]}" nginx -t >/dev/null 2>&1
    "${SUDO[@]}" systemctl restart "${FRONTEND_SERVICE}"
    show_status
    health_check
    ;;
  stop)
    echo "Stopping AOI backend and frontend..."
    "${SUDO[@]}" systemctl stop "${BACKEND_SERVICE}"
    "${SUDO[@]}" systemctl stop "${FRONTEND_SERVICE}"
    show_status
    ;;
  status)
    show_status
    health_check
    ;;
  *)
    echo "Usage: $0 [start|restart|stop|status]"
    exit 2
    ;;
esac
