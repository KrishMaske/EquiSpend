<# 
    EquiSpend Backend Startup Script
    ================================
    Starts both the FastAPI backend (uvicorn) and ngrok tunnel
    so your mobile phone can reach the API at a fixed URL.

    Usage:  .\start.ps1
    Stop:   Press Ctrl+C (stops both uvicorn and ngrok)
#>

$ErrorActionPreference = "Stop"

# Ensure ngrok is on PATH
if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    $ngrokPath = "$env:LOCALAPPDATA\ngrok"
    if (Test-Path "$ngrokPath\ngrok.exe") {
        $env:Path += ";$ngrokPath"
    } else {
        Write-Host "ERROR: ngrok not found. Install it: winget install ngrok.ngrok" -ForegroundColor Red
        exit 1
    }
}

# Read NGROK_DOMAIN from .env
$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: .env file not found in backend/" -ForegroundColor Red
    exit 1
}

$ngrokDomain = $null
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*NGROK_DOMAIN\s*=\s*"?([^"]+)"?\s*$') {
        $ngrokDomain = $Matches[1]
    }
}

if (-not $ngrokDomain) {
    Write-Host "ERROR: NGROK_DOMAIN not set in .env" -ForegroundColor Red
    exit 1
}

$ngrokUrl = "https://$ngrokDomain"

Write-Host ""
Write-Host "  EquiSpend Backend" -ForegroundColor Magenta
Write-Host "  =================" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Local:    http://localhost:8000" -ForegroundColor Cyan
Write-Host "  Public:   $ngrokUrl" -ForegroundColor Green
Write-Host "  ngrok UI: http://localhost:4040" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  This URL is permanent — use it in the mobile app." -ForegroundColor Yellow
Write-Host "  Press Ctrl+C to stop everything." -ForegroundColor DarkGray
Write-Host ""

# Start ngrok in background with the static domain
$ngrokProcess = Start-Process ngrok `
    -ArgumentList "http", "--url=$ngrokDomain", "8000" `
    -PassThru -WindowStyle Hidden

# Give ngrok a moment to start
Start-Sleep -Seconds 2

# Verify ngrok tunnel is up
try {
    $tunnels = (Invoke-RestMethod http://127.0.0.1:4040/api/tunnels -ErrorAction Stop).tunnels
    if ($tunnels.Count -gt 0) {
        Write-Host "  ngrok tunnel active" -ForegroundColor Green
    }
} catch {
    Write-Host "  WARNING: Could not verify ngrok tunnel" -ForegroundColor Yellow
}

Write-Host ""

# Start uvicorn in foreground (Ctrl+C will stop it)
try {
    python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
} finally {
    # When uvicorn stops, also stop ngrok
    Write-Host "`nShutting down ngrok..." -ForegroundColor Yellow
    Stop-Process -Id $ngrokProcess.Id -Force -ErrorAction SilentlyContinue
    Write-Host "Done." -ForegroundColor Green
}
