param(
  [string]$Time = "09:30"
)

$ErrorActionPreference = "Stop"

$taskName = "InterviewHubDailyFeature"
$scriptPath = "E:\workshop\interview-hub\scripts\run-daily-feature.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null

Write-Host "Registered $taskName at $Time daily."
