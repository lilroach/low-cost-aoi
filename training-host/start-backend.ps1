param(
    [int]$Port = 8000,
    [string]$HostName = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ScriptDir "backend"
$VenvDir = Join-Path $BackendDir ".venv"
$PythonExe = Join-Path $VenvDir "Scripts\python.exe"

if (!(Test-Path $PythonExe)) {
    Write-Host "建立 Python 虛擬環境：$VenvDir"
    python -m venv $VenvDir
}

Write-Host "安裝/更新後端套件..."
& $PythonExe -m pip install --upgrade pip
& $PythonExe -m pip install -r (Join-Path $BackendDir "requirements.txt")

$env:AOI_TRAINING_APP_ROOT = $ScriptDir
$env:AOI_TRAINING_DATA_DIR = Join-Path $ScriptDir "data"
$env:AOI_TRAINING_MODELS_DIR = Join-Path $ScriptDir "models"

Write-Host "啟動 Training Host 後端：http://$HostName`:$Port"
Set-Location $BackendDir
& $PythonExe -m uvicorn app.main:app --host $HostName --port $Port --reload
