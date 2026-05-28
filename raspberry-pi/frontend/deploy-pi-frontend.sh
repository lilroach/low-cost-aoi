#!/bin/bash

# ==============================================================================
# 低成本 PCB AOI 系統 - 樹莓派前端原生部署腳本
# 適用環境：Raspberry Pi 5 (Debian/Raspberry Pi OS)
# ==============================================================================

# 設定顏色輸出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # 無顏色

echo -e "${GREEN}=== 開始進行樹莓派前端原生部署 ===${NC}"

# 1. 檢查是否以 root 或 sudo 權限執行
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}錯誤：此腳本必須以 sudo 權限執行。請使用: sudo ./deploy-pi-frontend.sh${NC}"
  exit 1
fi

# 2. 檢查並安裝 Nginx
if ! command -v nginx &> /dev/null; then
  echo -e "${YELLOW}偵測到系統未安裝 Nginx，正在為您安裝...${NC}"
  apt update && apt install nginx -y
  if [ $? -ne 0 ]; then
    echo -e "${RED}錯誤：Nginx 安裝失敗！請檢查網路連線。${NC}"
    exit 1
  fi
  echo -e "${GREEN}Nginx 安裝成功。${NC}"
else
  echo -e "${GREEN}Nginx 已安裝，跳過安裝步驟。${NC}"
fi

# 3. 建立前端網站根目錄
WEB_ROOT="/var/www/aoi-frontend"
echo -e "${YELLOW}正在建立網站根目錄: ${WEB_ROOT}...${NC}"
mkdir -p ${WEB_ROOT}

# 4. 前端打包檔案來源選擇
echo -e "\n${YELLOW}請選擇前端靜態檔案的來源方式：${NC}"
echo "1) [推薦] 從 Windows 開發機編譯並傳輸至本機的 dist 目錄"
echo "2) [警告：需足夠記憶體/Swap] 直接在樹莓派本機執行 npm run build"
read -p "請輸入選項 (1 或 2): " DEPLOY_MODE

if [ "$DEPLOY_MODE" == "1" ]; then
  echo -e "\n${GREEN}您選擇了模式 1 (遠端編譯傳輸)${NC}"
  echo "請確保您已在 Windows 下執行 npm run build，並將產出的 raspberry-pi/frontend/dist 目錄內容複製到本機以下路徑："
  echo -e "${YELLOW}$(pwd)/dist${NC}"

  if [ ! -d "./dist" ]; then
    echo -e "${RED}錯誤：未在本機目錄偵測到 dist 資料夾！${NC}"
    echo "請在 Windows Terminal 執行以下指令，將編譯好的檔案傳送至樹莓派："
    echo -e "${YELLOW}# 在 Windows 的 low-cost-aoi 目錄下：${NC}"
    echo -e "${YELLOW}cd raspberry-pi/frontend && npm run build${NC}"
    echo -e "${YELLOW}scp -r dist pi@<樹莓派IP>:/home/pi/low-cost-aoi/raspberry-pi/frontend/${NC}"
    exit 1
  fi

  echo -e "${GREEN}偵測到 dist 目錄，正在複製檔案至網站根目錄...${NC}"
  cp -r ./dist/* ${WEB_ROOT}/

elif [ "$DEPLOY_MODE" == "2" ]; then
  echo -e "\n${RED}[重要警告]${NC} 樹莓派 5 4GB 版在本機執行 tsc (TypeScript) 編譯時可能會因記憶體不足而當機。"
  echo "請確保您的樹莓派已設定 2GB 以上的 Swap 空間。"
  read -p "您確定要繼續在本機編譯嗎？(y/N): " CONFIRM
  if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "已取消部署。"
    exit 0
  fi

  # 檢查 node 與 npm
  if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo -e "${RED}錯誤：本機編譯需要 Node.js 與 npm。請先安裝 Node.js (v20+)。${NC}"
    exit 1
  fi

  echo -e "${YELLOW}正在本機安裝前端相依套件...${NC}"
  npm install

  echo -e "${YELLOW}正在本機編譯前端...${NC}"
  npm run build
  if [ $? -ne 0 ]; then
    echo -e "${RED}錯誤：前端編譯失敗！這可能是由於記憶體不足。建議改用模式 1。${NC}"
    exit 1
  fi

  echo -e "${GREEN}編譯完成，正在複製檔案至網站根目錄...${NC}"
  cp -r ./dist/* ${WEB_ROOT}/

else
  echo -e "${RED}無效的選項，終止部署。${NC}"
  exit 1
fi

# 5. 配置權限
chown -R www-data:www-data ${WEB_ROOT}
chmod -R 755 ${WEB_ROOT}

# 6. 套用 Nginx 設定
NGINX_CONF_SRC="./nginx.pi.conf"
NGINX_CONF_DEST="/etc/nginx/sites-available/aoi"

if [ ! -f "${NGINX_CONF_SRC}" ]; then
  echo -e "${RED}錯誤：找不到 Nginx 設定檔: ${NGINX_CONF_SRC}${NC}"
  exit 1
fi

echo -e "${YELLOW}正在複製 Nginx 設定檔至 ${NGINX_CONF_DEST}...${NC}"
cp ${NGINX_CONF_SRC} ${NGINX_CONF_DEST}

# 建立軟連結啟用站台
ln -sf ${NGINX_CONF_DEST} /etc/nginx/sites-enabled/aoi

# 停用預設的 default 網站，避免 Port 80 衝突
if [ -f "/etc/nginx/sites-enabled/default" ]; then
  echo -e "${YELLOW}正在移除預設的 Nginx default 站台以避免衝突...${NC}"
  rm /etc/nginx/sites-enabled/default
fi

# 7. 測試並重啟 Nginx
echo -e "${YELLOW}正在測試 Nginx 設定檔是否正確...${NC}"
nginx -t
if [ $? -ne 0 ]; then
  echo -e "${RED}錯誤：Nginx 設定檢查失敗！請確認 ${NGINX_CONF_DEST} 的配置。${NC}"
  exit 1
fi

echo -e "${YELLOW}正在重啟 Nginx 服務...${NC}"
systemctl restart nginx

echo -e "\n${GREEN}=== 部署完成！ ===${NC}"
echo -e "前端 UI 已在本機 Nginx 部署成功，監聽埠: ${YELLOW}80${NC}。"
echo -e "您可以透過網頁瀏覽器存取: ${YELLOW}http://<樹莓派IP>/${NC}"
echo -e "注意：請確認 Nginx 設定檔中的 '/api' 已正確指向您的後端位址。"
