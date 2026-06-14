$ErrorActionPreference = "Stop"
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Set-Location "E:\workshop\interview-hub"

$logDir = "E:\workshop\interview-hub\logs"
$today = Get-Date -Format "yyyy-MM-dd"
$logFile = Join-Path $logDir "weekly-task-last.log"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$mutex = New-Object System.Threading.Mutex($false, "Global\InterviewHubWeeklyUpdateRunner")
if (-not $mutex.WaitOne(0, $false)) {
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  "[$stamp] Weekly update skipped: another runner is already active" |
    Out-File -FilePath $logFile -Encoding utf8 -Append
  exit 0
}

function Write-Step {
  param([string]$Message)
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  "[$stamp] $Message" | Tee-Object -FilePath $logFile -Append
}

try {
  "" | Out-File -FilePath $logFile -Encoding utf8
  Write-Step "Weekly interview update started"

  $env:CHROME_CDP = "http://127.0.0.1:9222"
  node scripts\update-interviews.mjs --max-new=1000 2>&1 | Tee-Object -FilePath $logFile -Append
  if ($LASTEXITCODE -ne 0) {
    throw "update-interviews exited with code $LASTEXITCODE"
  }

  node scripts\boost-interview-questions.mjs --write --min-new=20 2>&1 | Tee-Object -FilePath $logFile -Append
  if ($LASTEXITCODE -ne 0) {
    throw "boost-interview-questions exited with code $LASTEXITCODE"
  }

  node scripts\dedupe-post-questions.mjs --write 2>&1 | Tee-Object -FilePath $logFile -Append
  if ($LASTEXITCODE -ne 0) {
    throw "dedupe-post-questions exited with code $LASTEXITCODE"
  }

  node scripts\audit-xhs-publish.mjs --fix 2>&1 | Tee-Object -FilePath $logFile -Append
  if ($LASTEXITCODE -ne 0) {
    throw "audit-xhs-publish exited with code $LASTEXITCODE"
  }

  git -c safe.directory=E:/workshop/interview-hub add data/posts.json data/published-question-registry.json logs 2>&1 | Tee-Object -FilePath $logFile -Append
  $changes = git -c safe.directory=E:/workshop/interview-hub diff --cached --name-only
  if ($changes) {
    git -c safe.directory=E:/workshop/interview-hub commit -m "Weekly interview question update ($today)" 2>&1 |
      Tee-Object -FilePath $logFile -Append
    git -c safe.directory=E:/workshop/interview-hub -c http.proxy=http://127.0.0.1:10809 -c https.proxy=http://127.0.0.1:10809 push 2>&1 |
      Tee-Object -FilePath $logFile -Append
  } else {
    Write-Step "No repository changes to commit"
  }

  Write-Step "Weekly interview update finished"
} finally {
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}
