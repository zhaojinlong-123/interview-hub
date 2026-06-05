$ErrorActionPreference = "Stop"
Set-Location "E:\workshop\interview-hub"
$env:CHROME_CDP = "http://127.0.0.1:9222"
& "C:\Program Files\nodejs\node.exe" "E:\workshop\interview-hub\scripts\update-interviews.mjs" --push *> "E:\workshop\interview-hub\logs\weekly-task-last.log"
