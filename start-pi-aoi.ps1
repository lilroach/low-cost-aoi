param(
    [ValidateSet("start", "restart", "stop", "status")]
    [string]$Action = "start",

    [string]$PiHost = $env:AOI_PI_HOST,
    [string]$PiUser = $(if ($env:AOI_PI_USER) { $env:AOI_PI_USER } else { "pi" }),
    [string]$KeyPath = $env:AOI_PI_SSH_KEY,
    [string]$RemoteScript = $(if ($env:AOI_PI_REMOTE_SCRIPT) { $env:AOI_PI_REMOTE_SCRIPT } else { "~/low-cost-aoi/raspberry-pi/start-aoi.sh" })
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$localScript = Join-Path $repoRoot "raspberry-pi\start-aoi.sh"

if ([string]::IsNullOrWhiteSpace($PiHost)) {
    throw "Set -PiHost or AOI_PI_HOST to the Raspberry Pi hostname, LAN IP, or Tailscale IP."
}

if ([string]::IsNullOrWhiteSpace($KeyPath)) {
    throw "Set -KeyPath or AOI_PI_SSH_KEY to your local SSH private key path."
}

$remote = "${PiUser}@${PiHost}"
$remoteDir = Split-Path -Parent $RemoteScript

if (-not (Test-Path $localScript)) {
    throw "Cannot find local script: $localScript"
}

Write-Host "Syncing AOI quick-start script to $remote..."
ssh -i $KeyPath -o StrictHostKeyChecking=accept-new $remote "mkdir -p '$remoteDir'"
scp -i $KeyPath -o StrictHostKeyChecking=accept-new $localScript "${remote}:$RemoteScript"
ssh -i $KeyPath -o StrictHostKeyChecking=accept-new $remote "chmod +x '$RemoteScript'"

Write-Host "Running AOI action: $Action"
ssh -i $KeyPath -o StrictHostKeyChecking=accept-new $remote "bash '$RemoteScript' '$Action'"
