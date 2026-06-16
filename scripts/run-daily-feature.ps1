param(
  [string]$Slot = "morning",
  [string]$PublishTime = ""
)

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

function Invoke-LoggedCommand {
  param(
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$LogFile
  )
  $tempLog = Join-Path $logDir ("native-" + [Guid]::NewGuid().ToString("N") + ".log")
  $previousErrorAction = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    & $FilePath @Arguments *> $tempLog
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorAction
  }
  if (Test-Path $tempLog) {
    Get-Content -Path $tempLog -Encoding UTF8 -ErrorAction SilentlyContinue |
      Out-File -FilePath $LogFile -Encoding utf8 -Append
    Remove-Item -Path $tempLog -Force -ErrorAction SilentlyContinue
  }
  return $exitCode
}

function Invoke-CandidateRefresh {
  param([string]$LogFile)

  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  "[$stamp] No publishable candidate found. Refreshing interview candidates, deduping questions, and retrying once." |
    Out-File -FilePath $LogFile -Encoding utf8 -Append

  $env:CHROME_CDP = "http://127.0.0.1:9222"

  $updateExit = Invoke-LoggedCommand -FilePath "node" -Arguments @("scripts\update-interviews.mjs", "--max-new=1000") -LogFile $LogFile
  if ($updateExit -ne 0) {
    throw "candidate refresh failed: update-interviews exited with code $updateExit. Start controllable Chrome on 127.0.0.1:9222 and rerun the task."
  }

  $boostExit = Invoke-LoggedCommand -FilePath "node" -Arguments @("scripts\boost-interview-questions.mjs", "--write", "--min-new=20") -LogFile $LogFile
  if ($boostExit -ne 0) {
    throw "candidate refresh failed: boost-interview-questions exited with code $boostExit"
  }

  $dedupeExit = Invoke-LoggedCommand -FilePath "node" -Arguments @("scripts\dedupe-post-questions.mjs", "--write") -LogFile $LogFile
  if ($dedupeExit -ne 0) {
    throw "candidate refresh failed: dedupe-post-questions exited with code $dedupeExit"
  }

  $auditExit = Invoke-LoggedCommand -FilePath "node" -Arguments @("scripts\audit-xhs-publish.mjs", "--fix") -LogFile $LogFile
  if ($auditExit -ne 0) {
    throw "candidate refresh failed: audit-xhs-publish exited with code $auditExit"
  }
}

try {
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  "[$stamp] Daily feature started: slot=$Slot publishTime=$PublishTime" |
    Out-File -FilePath "$logDir\daily-feature-last.log" -Encoding utf8

  $auditBeforeExit = Invoke-LoggedCommand -FilePath "node" -Arguments @("scripts\audit-xhs-publish.mjs", "--fix", "--fail-on-risk") -LogFile "$logDir\daily-feature-last.log"
  if ($auditBeforeExit -ne 0) {
    throw "pre-generate audit-xhs-publish exited with code $auditBeforeExit"
  }

  $generateArgs = @("scripts\generate-daily-feature.mjs", "--slot=$Slot")
  if ($PublishTime) {
    $generateArgs += "--publish-time=$PublishTime"
  }

  $dailyLog = "$logDir\daily-feature-last.log"
  $generateExit = Invoke-LoggedCommand -FilePath "node" -Arguments $generateArgs -LogFile $dailyLog
  if ($generateExit -ne 0) {
    Invoke-CandidateRefresh -LogFile $dailyLog
    $generateExit = Invoke-LoggedCommand -FilePath "node" -Arguments $generateArgs -LogFile $dailyLog
    if ($generateExit -ne 0) {
      throw "generate-daily-feature exited with code $generateExit"
    }
  }

  $publishExit = Invoke-LoggedCommand -FilePath "node" -Arguments @("scripts\publish-xiaohongshu.mjs") -LogFile "$logDir\daily-feature-last.log"
  if ($publishExit -ne 0) {
    throw "publish-xiaohongshu exited with code $publishExit"
  }

  $auditAfterExit = Invoke-LoggedCommand -FilePath "node" -Arguments @("scripts\audit-xhs-publish.mjs", "--fix", "--fail-on-risk") -LogFile "$logDir\daily-feature-last.log"
  if ($auditAfterExit -ne 0) {
    throw "post-publish audit-xhs-publish exited with code $auditAfterExit"
  }

  $today = Get-Date -Format "yyyy-MM-dd"
  $gitAddExit = Invoke-LoggedCommand -FilePath "git" -Arguments @(
    "-c", "safe.directory=E:/workshop/interview-hub",
    "add",
    "data/daily-features.json",
    "data/publish-queue.json",
    "data/published-question-registry.json",
    "content/xiaohongshu-drafts",
    "content/xiaohongshu-assets"
  ) -LogFile "$logDir\daily-feature-last.log"
  if ($gitAddExit -ne 0) {
    throw "git add exited with code $gitAddExit"
  }

  $changes = git -c safe.directory=E:/workshop/interview-hub diff --cached --name-only
  if ($changes) {
    $commitExit = Invoke-LoggedCommand -FilePath "git" -Arguments @(
      "-c", "safe.directory=E:/workshop/interview-hub",
      "commit",
      "-m", "Daily Xiaohongshu publish ($today $Slot)"
    ) -LogFile "$logDir\daily-feature-last.log"
    if ($commitExit -ne 0) {
      throw "git commit exited with code $commitExit"
    }

    $pushExit = Invoke-LoggedCommand -FilePath "git" -Arguments @(
      "-c", "safe.directory=E:/workshop/interview-hub",
      "-c", "http.proxy=http://127.0.0.1:10809",
      "-c", "https.proxy=http://127.0.0.1:10809",
      "push"
    ) -LogFile "$logDir\daily-feature-last.log"
    if ($pushExit -ne 0) {
      throw "git push exited with code $pushExit"
    }
  }

  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  "[$stamp] Daily feature finished" | Out-File -FilePath "$logDir\daily-feature-last.log" -Encoding utf8 -Append
} finally {
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}
