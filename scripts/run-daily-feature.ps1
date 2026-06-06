$ErrorActionPreference = "Stop"

Set-Location "E:\workshop\interview-hub"

$logDir = "E:\workshop\interview-hub\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"[$stamp] Daily feature started" | Out-File -FilePath "$logDir\daily-feature-last.log" -Encoding utf8

node scripts\generate-daily-feature.mjs --push 2>&1 | Tee-Object -FilePath "$logDir\daily-feature-last.log" -Append
node scripts\publish-xiaohongshu.mjs --push 2>&1 | Tee-Object -FilePath "$logDir\daily-feature-last.log" -Append

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"[$stamp] Daily feature finished" | Out-File -FilePath "$logDir\daily-feature-last.log" -Encoding utf8 -Append
