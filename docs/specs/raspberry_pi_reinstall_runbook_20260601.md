# Raspberry Pi AOI Reinstall Runbook

Date: 2026-06-01

This note summarizes the working setup that was verified before the SD card failure.
Do not store Wi-Fi passwords, Linux user passwords, SSH private keys, WireGuard private keys, or Tailscale auth keys in this file.

## Target State

- Device: Raspberry Pi 5, 4GB RAM.
- OS: Raspberry Pi OS / Debian trixie, 64-bit.
- Hostname: `ray-chang`.
- User: `ray-chang`.
- AOI web UI: `http://<pi-ip>/`.
- Backend service: `aoi-edge-backend`.
- Backend local API: `http://127.0.0.1:8000/api/health`.
- Frontend served by nginx from `/var/www/aoi-frontend`.
- Project path on Pi: `/home/ray-chang/low-cost-aoi/raspberry-pi`.
- Tailscale device name: `ray-chang-aoi`.

## Proven Windows SSH Command

Use the existing Windows private key:

```powershell
ssh -i C:\Users\bboy0\.ssh\aoi_pi_ed25519 ray-chang@<pi-ip>
```

After Tailscale is authorized:

```powershell
ssh -i C:\Users\bboy0\.ssh\aoi_pi_ed25519 ray-chang@100.89.61.101
```

The old Tailscale IP may change after reinstall. Always confirm with:

```bash
tailscale ip -4
```

## First Boot Checklist

1. Flash Raspberry Pi OS 64-bit with Raspberry Pi Imager.
2. Set hostname to `ray-chang`.
3. Enable SSH.
4. Create user `ray-chang`.
5. Configure Wi-Fi.
6. Boot Pi and confirm SSH from Windows.

## Install Required System Packages

Run on Pi:

```bash
sudo apt update
sudo apt install -y \
  git curl nginx \
  python3 python3-venv python3-pip \
  python3-numpy python3-opencv python3-hailort \
  libglib2.0-0 libgl1 \
  v4l-utils zbar-tools \
  iptables
sudo usermod -aG video ray-chang
```

Reboot once after adding the user to the `video` group:

```bash
sudo reboot
```

## Chinese Locale And Input Method

Install Traditional Chinese fonts, locale support, and Fcitx5 Chewing input:

```bash
sudo apt update
sudo apt install -y \
  locales \
  fonts-noto-cjk fonts-noto-cjk-extra \
  fcitx5 fcitx5-config-qt fcitx5-frontend-gtk3 fcitx5-frontend-gtk4 fcitx5-frontend-qt5 \
  fcitx5-chewing im-config
```

Enable Taiwan Traditional Chinese locale:

```bash
sudo sed -i 's/^# *zh_TW.UTF-8 UTF-8/zh_TW.UTF-8 UTF-8/' /etc/locale.gen
sudo sed -i 's/^# *en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen
sudo locale-gen
sudo update-locale LANG=zh_TW.UTF-8 LC_CTYPE=zh_TW.UTF-8
```

Set Fcitx5 as the input method for the desktop user:

```bash
im-config -n fcitx5
mkdir -p ~/.config/autostart
cp /usr/share/applications/org.fcitx.Fcitx5.desktop ~/.config/autostart/ 2>/dev/null || true
```

Add Fcitx5 environment variables:

```bash
cat >> ~/.profile <<'EOF'

# Fcitx5 Chinese input
export GTK_IM_MODULE=fcitx
export QT_IM_MODULE=fcitx
export XMODIFIERS=@im=fcitx
EOF
```

Reboot:

```bash
sudo reboot
```

After reboot:

1. Open `Fcitx 5 Configuration`.
2. Add `Chewing` / `新酷音`.
3. Switch input method with `Ctrl+Space` or the panel input-method icon.

If the desktop does not show the Fcitx icon, run:

```bash
fcitx5 -d
fcitx5-configtool
```

## Copy AOI Project From Windows To Pi

From Windows workspace root:

```powershell
ssh -i C:\Users\bboy0\.ssh\aoi_pi_ed25519 ray-chang@<pi-ip> "mkdir -p /home/ray-chang/low-cost-aoi/raspberry-pi/frontend /home/ray-chang/low-cost-aoi/raspberry-pi/backend"

scp -i C:\Users\bboy0\.ssh\aoi_pi_ed25519 -r `
  raspberry-pi/backend/app `
  raspberry-pi/backend/requirements.txt `
  raspberry-pi/backend/deploy-pi-backend.sh `
  ray-chang@<pi-ip>:/home/ray-chang/low-cost-aoi/raspberry-pi/backend/

scp -i C:\Users\bboy0\.ssh\aoi_pi_ed25519 -r `
  raspberry-pi/frontend/dist `
  raspberry-pi/frontend/nginx.pi.conf `
  raspberry-pi/frontend/deploy-pi-frontend.sh `
  ray-chang@<pi-ip>:/home/ray-chang/low-cost-aoi/raspberry-pi/frontend/
```

If frontend `dist` is missing, build on Windows first:

```powershell
cd E:\Docker\low-cost-aoi\raspberry-pi\frontend
npm run build
```

## Deploy Backend

On Pi:

```bash
cd /home/ray-chang/low-cost-aoi/raspberry-pi/backend
sed -i 's/\r$//' deploy-pi-backend.sh
sudo bash ./deploy-pi-backend.sh
```

Important deployment behavior:

- The backend venv uses `--system-site-packages` so Debian/Pi OpenCV and numpy are visible.
- Service should run with:

```text
ExecStart=/home/ray-chang/low-cost-aoi/raspberry-pi/backend/.venv-pi/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Verify:

```bash
systemctl is-active aoi-edge-backend
curl http://127.0.0.1:8000/api/health
```

Expected:

```json
{"status":"ok","mode":"raspberry-pi"}
```

## Deploy Frontend And Nginx

On Pi:

```bash
sudo mkdir -p /var/www/aoi-frontend
sudo rm -rf /var/www/aoi-frontend/*
sudo cp -r /home/ray-chang/low-cost-aoi/raspberry-pi/frontend/dist/* /var/www/aoi-frontend/
sudo cp /home/ray-chang/low-cost-aoi/raspberry-pi/frontend/nginx.pi.conf /etc/nginx/sites-available/aoi-edge
sudo ln -sf /etc/nginx/sites-available/aoi-edge /etc/nginx/sites-enabled/aoi-edge
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

Verify:

```bash
curl -I http://127.0.0.1/
```

## Camera Setup

Install/check USB camera:

```bash
lsusb
v4l2-ctl --list-devices
ls -l /dev/video*
```

Previously verified camera:

```text
AVerMedia Live Streamer CAM 313
/dev/video0
/dev/video1
```

After plugging in the camera, restart backend:

```bash
sudo systemctl restart aoi-edge-backend
journalctl -u aoi-edge-backend -n 80 --no-pager
```

Expected log:

```text
Camera initialized: [REAL] Physical hardware detected.
```

The important fix already in `raspberry-pi/backend/app/api/camera.py`:

- Real camera uses a background capture thread.
- Live feed and SNAP read the latest cached frame instead of competing on `cv2.VideoCapture.read()`.
- This fixes SNAP hanging while live feed is open.

Verify live feed and SNAP:

```bash
timeout 3 curl -sS http://127.0.0.1:8000/api/camera/feed -o /tmp/aoi-feed-sample.mjpg
curl -sS -X POST "http://127.0.0.1:8000/api/capture/snap?part_no=TEST&batch_no=REINSTALL&model_id=none"
curl -sS http://127.0.0.1:8000/api/capture/list
```

## Capture UI Fixes Already In Repo

Files to keep:

- `raspberry-pi/backend/app/api/capture.py`
- `raspberry-pi/backend/app/api/camera.py`
- `raspberry-pi/frontend/src/features/capture/CaptureView.tsx`
- `raspberry-pi/frontend/src/context/AppContext.tsx`
- `raspberry-pi/backend/deploy-pi-backend.sh`
- `raspberry-pi/backend/requirements.txt`

Behavior verified:

- Capture page opens by default.
- Live camera feed appears.
- SNAP saves image.
- Capture list updates.
- Manual OK/NG works.
- Export endpoints exist.
- Frontend no longer reports false `Capture failed` after a successful SNAP.

## Tailscale Setup

Recommended for external SSH access.

Install Tailscale.
If Pi apt download is slow, download the ARM64 `.deb` on Windows and `scp` it to Pi.

Working version previously installed:

```text
tailscale 1.98.4 arm64
```

Pi install from local `.deb`:

```bash
sudo dpkg -i /tmp/tailscale_1.98.4_arm64.deb
sudo apt-get -f install -y
sudo systemctl enable --now tailscaled
```

Start login:

```bash
sudo tailscale up --ssh --hostname=ray-chang-aoi --accept-dns=false
```

Open the login URL shown by:

```bash
tailscale status
```

After login:

```bash
tailscale ip -4
tailscale status
```

External SSH:

```powershell
ssh -i C:\Users\bboy0\.ssh\aoi_pi_ed25519 ray-chang@<tailscale-ip>
```

## WireGuard Notes

WireGuard was installed and QR decode tools were tested, but Tailscale is preferred.

Installed tools:

```bash
sudo apt install -y wireguard wireguard-tools resolvconf zbar-tools
```

QR decode path used:

```text
/home/ray-chang/wg-qr.png
```

Safe split tunnel setting used to avoid breaking local LAN SSH:

```ini
AllowedIPs = 10.13.13.0/24
```

Do not enable full tunnel `0.0.0.0/0, ::/0` while Pi is still on the same home LAN unless you are prepared to recover locally from HDMI/keyboard.

Desktop shortcuts created previously:

- `AOI VPN Connect`
- `AOI VPN Disconnect`
- `AOI VPN Status`

These are optional if using Tailscale.

## Known Failure From Video

Bootloader screen showed:

```text
Progress: Trying boot mode SD
Failed to open partition 1
Unable to read partition as FAT
Failed to open partition ...
```

Meaning:

- Pi bootloader could not read the FAT boot partition on the SD card.
- This points to SD card partition damage, card contact issue, or a bad/unfinished image.
- It is not an HDMI, VPN, or AOI application issue.

Recovery order:

1. Power off.
2. Reseat SD card.
3. Try boot again.
4. If still failing, inspect SD on Windows.
5. Do not format if Windows prompts for the Linux partition.
6. If no repair is possible, reflash Raspberry Pi OS and rerun this runbook.
