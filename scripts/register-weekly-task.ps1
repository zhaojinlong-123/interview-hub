param(
  [string]$TaskName = "InterviewHubWeeklyUpdate",
  [string]$Time = "20:30",
  [string]$Day = "FRI"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Node = (Get-Command node -ErrorAction Stop).Source
$Script = Join-Path $RepoRoot "scripts\update-interviews.mjs"
$LogDir = Join-Path $RepoRoot "logs"
$RunScript = Join-Path $RepoRoot "scripts\run-weekly-update.ps1"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$RunContent = @"
`$ErrorActionPreference = "Stop"
Set-Location "$RepoRoot"
`$env:CHROME_CDP = "http://127.0.0.1:9222"
& "$Node" "$Script" --push *> "$LogDir\weekly-task-last.log"
"@

Set-Content -Path $RunScript -Value $RunContent -Encoding UTF8

$Action = "powershell.exe"
$Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$RunScript`""

schtasks /Create /F /TN $TaskName /SC WEEKLY /D $Day /ST $Time /TR "`"$Action`" $Arguments"

Write-Host "Registered task: $TaskName"
Write-Host "Schedule: every $Day at $Time"
Write-Host "Runner: $RunScript"
Write-Host "Log: $LogDir\weekly-task-last.log"
