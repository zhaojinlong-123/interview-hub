param(
  [string]$MorningTime = "09:30",
  [string]$AfternoonTime = "15:30"
)

$ErrorActionPreference = "Stop"

$scriptPath = "E:\workshop\interview-hub\scripts\run-daily-feature.ps1"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Unregister-ScheduledTask -TaskName "InterviewHubDailyFeature" -Confirm:$false -ErrorAction SilentlyContinue

function Register-DailyFeatureTask {
  param(
    [string]$TaskName,
    [string]$Slot,
    [string]$Time
  )

  $argument = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -Slot $Slot -PublishTime $Time"
  $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argument
  $trigger = New-ScheduledTaskTrigger -Daily -At $Time

  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
  Write-Host "Registered $TaskName at $Time daily."
}

Register-DailyFeatureTask -TaskName "InterviewHubDailyFeatureMorning" -Slot "morning" -Time $MorningTime
Register-DailyFeatureTask -TaskName "InterviewHubDailyFeatureAfternoon" -Slot "afternoon" -Time $AfternoonTime
