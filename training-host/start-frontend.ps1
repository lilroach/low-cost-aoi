param(
    [int]$Port = 3000,
    [string]$HostName = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$FrontendDir = Join-Path $ScriptDir "frontend"

Set-Location $FrontendDir

if (!(Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Write-Host "安裝前端套件..."
    npm install
}

Write-Host "啟動 Training Host 前端：http://$HostName`:$Port"
npm run dev -- --host $HostName --port $Port
