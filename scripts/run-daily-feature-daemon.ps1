$ErrorActionPreference = "Stop"

$projectRoot = "E:\workshop\interview-hub"
$runner = Join-Path $projectRoot "scripts\run-daily-feature.ps1"
$logDir = Join-Path $projectRoot "logs"
$stateFile = Join-Path $logDir "daily-feature-daemon-state.json"
$logFile = Join-Path $logDir "daily-feature-daemon.log"
$publishTime = "09:30"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$mutex = New-Object System.Threading.Mutex($false, "Global\InterviewHubDailyFeatureDaemon")
if (-not $mutex.WaitOne(0, $false)) {
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  "[$stamp] Another daemon instance is already running; exiting." |
    Out-File -FilePath $logFile -Encoding utf8 -Append
  exit 0
}

function Write-DaemonLog {
  param([string]$Message)
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  "[$stamp] $Message" | Out-File -FilePath $logFile -Encoding utf8 -Append
}

function Get-LastRunDate {
  if (-not (Test-Path $stateFile)) { return "" }
  try {
    $state = Get-Content -Path $stateFile -Raw -Encoding UTF8 | ConvertFrom-Json
    return [string]$state.lastRunDate
  } catch {
    return ""
  }
}

function Set-LastRunDate {
  param([string]$Date)
  @{ lastRunDate = $Date; updatedAt = (Get-Date).ToString("s") } |
    ConvertTo-Json |
    Out-File -FilePath $stateFile -Encoding utf8
}

function Invoke-DailyFeature {
  $today = Get-Date -Format "yyyy-MM-dd"
  if ((Get-LastRunDate) -eq $today) {
    Write-DaemonLog "Skip: already ran for $today"
    return
  }

  Write-DaemonLog "Starting daily feature runner"
  try {
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner 2>&1 |
      Tee-Object -FilePath $logFile -Append
    Set-LastRunDate $today
    Write-DaemonLog "Daily feature runner finished"
  } catch {
    Write-DaemonLog "Daily feature runner failed: $($_.Exception.Message)"
  }
}

Write-DaemonLog "Daemon started, target time $publishTime"

while ($true) {
  $now = Get-Date
  $target = Get-Date -Hour 9 -Minute 30 -Second 0
  $today = $now.ToString("yyyy-MM-dd")

  if ($now -ge $target -and (Get-LastRunDate) -ne $today) {
    Invoke-DailyFeature
  }

  $nextTarget = $target
  if ($now -ge $target) {
    $nextTarget = $target.AddDays(1)
  }

  $sleepSeconds = [Math]::Max(60, [Math]::Min(1800, ($nextTarget - (Get-Date)).TotalSeconds))
  Start-Sleep -Seconds $sleepSeconds
}
