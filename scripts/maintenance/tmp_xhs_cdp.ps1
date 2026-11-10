param(
  [string]$Expression = "",
  [string]$Screenshot = "",
  [string]$UploadFile = "",
  [string]$Drag = ""
)
$ErrorActionPreference = "Stop"

function Connect-CdpPage {
  $pages = Invoke-RestMethod "http://127.0.0.1:9222/json/list"
  $page = $pages | Where-Object { $_.url -like "https://creator.xiaohongshu.com/new/note-manager*" -or $_.url -like "https://creator.xiaohongshu.com/*" } | Select-Object -First 1
  if (-not $page) { throw "No Xiaohongshu creator page found on 127.0.0.1:9222" }
  $script:CdpId = 0
  $script:Ws = [System.Net.WebSockets.ClientWebSocket]::new()
  $script:Ws.ConnectAsync([Uri]$page.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
}

function Send-Cdp {
  param([string]$Method, [hashtable]$Params = @{})
  $script:CdpId += 1
  $payload = @{ id = $script:CdpId; method = $Method; params = $Params } | ConvertTo-Json -Depth 20 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
  $script:Ws.SendAsync([ArraySegment[byte]]::new($bytes), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  while ($true) {
    $buffer = New-Object byte[] 1048576
    $out = [System.Collections.Generic.List[byte]]::new()
    do {
      $res = $script:Ws.ReceiveAsync([ArraySegment[byte]]::new($buffer), [Threading.CancellationToken]::None).GetAwaiter().GetResult()
      if ($res.Count -gt 0) { $out.AddRange([byte[]]($buffer[0..($res.Count - 1)])) }
    } while (-not $res.EndOfMessage)
    $json = [Text.Encoding]::UTF8.GetString($out.ToArray()) | ConvertFrom-Json
    if ($json.id -eq $script:CdpId) { return $json }
  }
}

Connect-CdpPage
Send-Cdp "Runtime.enable" | Out-Null
Send-Cdp "Page.bringToFront" | Out-Null

if ($Expression) {
  $res = Send-Cdp "Runtime.evaluate" @{ expression = $Expression; awaitPromise = $true; returnByValue = $true }
  $res | ConvertTo-Json -Depth 30
}

if ($Screenshot) {
  $shot = Send-Cdp "Page.captureScreenshot" @{ format = "png"; fromSurface = $true }
  [IO.File]::WriteAllBytes($Screenshot, [Convert]::FromBase64String($shot.result.data))
}

if ($UploadFile) {
  Send-Cdp "DOM.enable" | Out-Null
  Send-Cdp "DOM.getDocument" @{ depth = -1; pierce = $true } | Out-Null
  $evalInput = Send-Cdp "Runtime.evaluate" @{ expression = "document.querySelectorAll('input[type=file]')[0]"; awaitPromise = $true; returnByValue = $false }
  $objectId = $evalInput.result.result.objectId
  if (-not $objectId) { throw "No file input found" }
  $requested = Send-Cdp "DOM.requestNode" @{ objectId = $objectId }
  $nodeId = $requested.result.nodeId
  if (-not $nodeId) { throw ("No file input node id found: " + ($requested | ConvertTo-Json -Depth 10 -Compress)) }
  $files = @($UploadFile -split "\|")
  Send-Cdp "DOM.setFileInputFiles" @{ nodeId = $nodeId; files = $files } | Out-Null
  Start-Sleep -Seconds 5
  "uploaded $UploadFile"
}

if ($Drag) {
  $parts = $Drag -split ","
  if ($parts.Count -ne 4) { throw "Drag must be x1,y1,x2,y2" }
  $x1 = [double]$parts[0]; $y1 = [double]$parts[1]; $x2 = [double]$parts[2]; $y2 = [double]$parts[3]
  Send-Cdp "Input.dispatchMouseEvent" @{ type = "mouseMoved"; x = $x1; y = $y1; button = "none" } | Out-Null
  Start-Sleep -Milliseconds 200
  Send-Cdp "Input.dispatchMouseEvent" @{ type = "mousePressed"; x = $x1; y = $y1; button = "left"; clickCount = 1 } | Out-Null
  Start-Sleep -Milliseconds 300
  for ($i = 1; $i -le 12; $i++) {
    $x = $x1 + (($x2 - $x1) * $i / 12)
    $y = $y1 + (($y2 - $y1) * $i / 12)
    Send-Cdp "Input.dispatchMouseEvent" @{ type = "mouseMoved"; x = $x; y = $y; button = "left"; buttons = 1 } | Out-Null
    Start-Sleep -Milliseconds 80
  }
  Send-Cdp "Input.dispatchMouseEvent" @{ type = "mouseReleased"; x = $x2; y = $y2; button = "left"; clickCount = 1 } | Out-Null
  Start-Sleep -Seconds 2
  "dragged"
}

$script:Ws.Dispose()
