# Start the shipped Seoul demo UI (TripProfile → DNA chat → seoul-find).
# Usage: pwsh -File scripts\run_demo.ps1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$port = 8765
$existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  Select-Object -First 1 -ExpandProperty OwningProcess
if ($existing) {
  Write-Host "Port $port already in use (PID $existing). Open http://127.0.0.1:$port/"
  exit 0
}

Write-Host "Starting uvicorn on http://127.0.0.1:$port/ ..."
Write-Host "Steps in UI: 1 TripProfile 저장 → 2 채팅 시작·DNA 확정 → 3 서울에서 찾기"
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port $port
