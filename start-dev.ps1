param(
  [string]$PythonCmd = "python",
  [int]$BackendPort = 8000,
  [string]$FrontendCmd = "npm run dev",
  [string]$BackendEnvFile = ".env"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"

if (-not (Test-Path $BackendDir)) {
  throw "Backend directory not found: $BackendDir"
}

if (-not (Test-Path $FrontendDir)) {
  throw "Frontend directory not found: $FrontendDir"
}

Write-Host "Starting backend on http://localhost:$BackendPort ..." -ForegroundColor Cyan
$backendArgs = @("-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "$BackendPort", "--reload")

$backendEnvPath = Join-Path $BackendDir $BackendEnvFile
if (Test-Path $backendEnvPath) {
  Write-Host "Loading backend env from $backendEnvPath" -ForegroundColor DarkGray
  Get-Content $backendEnvPath | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $parts = $line.Split("=", 2)
    if ($parts.Count -ne 2) { return }
    $key = $parts[0].Trim()
    $value = $parts[1].Trim()
    [Environment]::SetEnvironmentVariable($key, $value, "Process")
  }
}

$backendProc = Start-Process `
  -FilePath $PythonCmd `
  -ArgumentList $backendArgs `
  -WorkingDirectory $BackendDir `
  -PassThru

Write-Host "Backend PID: $($backendProc.Id)" -ForegroundColor DarkGray
Write-Host "Starting frontend in $FrontendDir ..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop both services." -ForegroundColor Yellow

try {
  Push-Location $FrontendDir
  Invoke-Expression $FrontendCmd
}
finally {
  Pop-Location
  if ($null -ne $backendProc -and -not $backendProc.HasExited) {
    Write-Host "Stopping backend..." -ForegroundColor Yellow
    try {
      taskkill /PID $backendProc.Id /T /F | Out-Null
    }
    catch {
      Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue
    }
  }
}
