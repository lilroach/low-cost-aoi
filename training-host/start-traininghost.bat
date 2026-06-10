@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "PS=powershell.exe"

echo ============================================================
echo  AOI Training Host 一鍵啟動
echo ============================================================
echo.
echo 後端 API:  http://127.0.0.1:8000
echo 前端 UI:   http://127.0.0.1:3000
echo 標註服務:  http://127.0.0.1:8080  ^(使用 /label 可啟動^)
echo.

if /I "%~1"=="/label" (
    echo 啟動 Label Studio Docker 服務...
    start "AOI Label Studio" powershell.exe -NoExit -ExecutionPolicy Bypass -Command "Set-Location -LiteralPath '%SCRIPT_DIR%'; docker compose up -d label-studio; Write-Host 'Label Studio 已啟動：http://127.0.0.1:8080'"
    timeout /t 2 /nobreak >nul
)

echo 啟動 Training Host 後端...
start "AOI Training Host Backend" %PS% -NoExit -ExecutionPolicy Bypass -File "%SCRIPT_DIR%start-backend.ps1"

timeout /t 3 /nobreak >nul

echo 啟動 Training Host 前端...
start "AOI Training Host Frontend" %PS% -NoExit -ExecutionPolicy Bypass -File "%SCRIPT_DIR%start-frontend.ps1"

timeout /t 6 /nobreak >nul

echo 開啟瀏覽器...
start "" "http://127.0.0.1:3000"

echo.
echo 已送出啟動指令。
echo.
echo 使用方式：
echo   start-traininghost.bat        只啟動後端與前端
echo   start-traininghost.bat /label 同時啟動 Label Studio
echo.
echo 若要停止服務，請關閉剛剛開啟的後端/前端視窗。
echo.
pause
