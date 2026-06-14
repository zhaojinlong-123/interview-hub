$ErrorActionPreference = "Stop"
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Set-Location "E:\workshop\interview-hub"

$logDir = "E:\workshop\interview-hub\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$mutex = New-Object System.Threading.Mutex($false, "Global\InterviewHubDailyFeatureRunner")
if (-not $mutex.WaitOne(0, $false)) {
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  "[$stamp] Daily feature skipped: another runner is already active" |
    Out-File -FilePath "$logDir\daily-feature-last.log" -Encoding utf8 -Append
  exit 0
}

try {
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  "[$stamp] Daily feature started" | Out-File -FilePath "$logDir\daily-feature-last.log" -Encoding utf8

  try {
    node scripts\generate-daily-feature.mjs --push 2>&1 | Tee-Object -FilePath "$logDir\daily-feature-last.log" -Append
    if ($LASTEXITCODE -ne 0) {
      throw "generate-daily-feature exited with code $LASTEXITCODE"
    }
  } catch {
    $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "[$stamp] Daily feature generation failed, continuing to publish latest draft: $($_.Exception.Message)" |
      Out-File -FilePath "$logDir\daily-feature-last.log" -Encoding utf8 -Append
  }

  node scripts\publish-xiaohongshu.mjs --push 2>&1 | Tee-Object -FilePath "$logDir\daily-feature-last.log" -Append
  if ($LASTEXITCODE -ne 0) {
    throw "publish-xiaohongshu exited with code $LASTEXITCODE"
  }

  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  "[$stamp] Daily feature finished" | Out-File -FilePath "$logDir\daily-feature-last.log" -Encoding utf8 -Append
} finally {
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}
