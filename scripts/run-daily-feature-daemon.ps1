$ErrorActionPreference = "Stop"
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$projectRoot = "E:\workshop\interview-hub"
$dailyRunner = Join-Path $projectRoot "scripts\run-daily-feature.ps1"
$weeklyRunner = Join-Path $projectRoot "scripts\run-weekly-update.ps1"
$settingsFile = Join-Path $projectRoot "data\daily-settings.json"
$logDir = Join-Path $projectRoot "logs"
$stateFile = Join-Path $logDir "daily-feature-daemon-state.json"
$logFile = Join-Path $logDir "daily-feature-daemon.log"

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

function Read-State {
  if (-not (Test-Path $stateFile)) {
    return [pscustomobject]@{
      dailyRuns = [pscustomobject]@{}
      weeklyRuns = [pscustomobject]@{}
      updatedAt = ""
    }
  }
  try {
    $state = Get-Content -Path $stateFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if (-not $state.dailyRuns) { $state | Add-Member -NotePropertyName dailyRuns -NotePropertyValue ([pscustomobject]@{}) }
    if (-not $state.weeklyRuns) { $state | Add-Member -NotePropertyName weeklyRuns -NotePropertyValue ([pscustomobject]@{}) }
    return $state
  } catch {
    Write-DaemonLog "State read failed, resetting state: $($_.Exception.Message)"
    return [pscustomobject]@{
      dailyRuns = [pscustomobject]@{}
      weeklyRuns = [pscustomobject]@{}
      updatedAt = ""
    }
  }
}

function Save-State {
  param([object]$State)
  $State.updatedAt = (Get-Date).ToString("s")
  $State | ConvertTo-Json -Depth 8 | Out-File -FilePath $stateFile -Encoding utf8
}

function Test-StateKey {
  param([object]$Map, [string]$Key)
  return [bool]($Map.PSObject.Properties.Name -contains $Key)
}

function Set-StateKey {
  param([object]$Map, [string]$Key)
  if (-not (Test-StateKey $Map $Key)) {
    $Map | Add-Member -NotePropertyName $Key -NotePropertyValue $true
  }
}

function Read-Settings {
  try {
    return Get-Content -Path $settingsFile -Raw -Encoding UTF8 | ConvertFrom-Json
  } catch {
    Write-DaemonLog "Settings read failed, using defaults: $($_.Exception.Message)"
    return [pscustomobject]@{}
  }
}

function Get-DailySchedules {
  param([object]$Settings)
  if ($Settings.publishTimes) {
    return @($Settings.publishTimes)
  }
  $time = if ($Settings.publishTime) { [string]$Settings.publishTime } else { "09:30" }
  return @([pscustomobject]@{ time = $time; slot = "morning" })
}

function Get-TargetTime {
  param([string]$TimeText)
  $parts = $TimeText.Split(":")
  return Get-Date -Hour ([int]$parts[0]) -Minute ([int]$parts[1]) -Second 0
}

function Get-WeekKey {
  param([datetime]$Now)
  $culture = [System.Globalization.CultureInfo]::InvariantCulture
  $week = $culture.Calendar.GetWeekOfYear(
    $Now,
    [System.Globalization.CalendarWeekRule]::FirstFourDayWeek,
    [System.DayOfWeek]::Monday
  )
  return "{0}-W{1:D2}" -f $Now.Year, $week
}

function Invoke-DailyFeature {
  param([string]$Slot, [string]$TimeText)
  Write-DaemonLog "Starting daily feature runner: slot=$Slot time=$TimeText"
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File $dailyRunner -Slot $Slot -PublishTime $TimeText 2>&1 |
    Tee-Object -FilePath $logFile -Append
  if ($LASTEXITCODE -ne 0) {
    throw "daily runner exited with code $LASTEXITCODE"
  }
  Write-DaemonLog "Daily feature runner finished: slot=$Slot"
}

function Invoke-WeeklyUpdate {
  Write-DaemonLog "Starting weekly interview update runner"
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File $weeklyRunner 2>&1 |
    Tee-Object -FilePath $logFile -Append
  if ($LASTEXITCODE -ne 0) {
    throw "weekly update runner exited with code $LASTEXITCODE"
  }
  Write-DaemonLog "Weekly interview update runner finished"
}

Write-DaemonLog "Daemon started: daily publish schedules from settings, weekly interview search enabled"

while ($true) {
  $now = Get-Date
  $today = $now.ToString("yyyy-MM-dd")
  $settings = Read-Settings
  $state = Read-State

  foreach ($schedule in (Get-DailySchedules $settings)) {
    $timeText = [string]$schedule.time
    $slot = if ($schedule.slot) { [string]$schedule.slot } else { $timeText.Replace(":", "") }
    $target = Get-TargetTime $timeText
    $key = "$today|$slot|$timeText"
    if ($now -ge $target -and -not (Test-StateKey $state.dailyRuns $key)) {
      try {
        Invoke-DailyFeature -Slot $slot -TimeText $timeText
        Set-StateKey $state.dailyRuns $key
        Save-State $state
      } catch {
        Write-DaemonLog "Daily feature failed: slot=$slot time=$timeText error=$($_.Exception.Message)"
      }
    }
  }

  $weekly = $settings.weeklySearch
  if (-not $weekly) {
    $weekly = [pscustomobject]@{ enabled = $true; dayOfWeek = "Friday"; time = "10:30" }
  }
  if ($weekly.enabled -ne $false) {
    $targetDay = if ($weekly.dayOfWeek) { [string]$weekly.dayOfWeek } else { "Friday" }
    $targetTime = if ($weekly.time) { [string]$weekly.time } else { "10:30" }
    $target = Get-TargetTime $targetTime
    $weekKey = "$(Get-WeekKey $now)|$targetDay|$targetTime"
    if ($now.DayOfWeek.ToString() -eq $targetDay -and $now -ge $target -and -not (Test-StateKey $state.weeklyRuns $weekKey)) {
      try {
        Invoke-WeeklyUpdate
        Set-StateKey $state.weeklyRuns $weekKey
        Save-State $state
      } catch {
        Write-DaemonLog "Weekly interview update failed: $($_.Exception.Message)"
      }
    }
  }

  Start-Sleep -Seconds 300
}
