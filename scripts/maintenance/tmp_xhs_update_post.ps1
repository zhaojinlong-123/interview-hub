param(
  [Parameter(Mandatory=$true)][string]$Title,
  [Parameter(Mandatory=$true)][string]$Cover,
  [Parameter(Mandatory=$true)][string]$DetailDir
)
$ErrorActionPreference = "Stop"

function Connect-CdpPage {
  $raw = Invoke-WebRequest "http://127.0.0.1:9222/json/list" -UseBasicParsing | Select-Object -ExpandProperty Content
  $pages = $raw | ConvertFrom-Json
  $page = $pages | Where-Object { $_.type -eq "page" -and $_.url -like "https://creator.xiaohongshu.com/*" } | Select-Object -First 1
  if (-not $page) { throw "No Xiaohongshu creator page found" }
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

function Eval-Js {
  param([string]$Expression, [bool]$ByValue = $true)
  $res = Send-Cdp "Runtime.evaluate" @{ expression = $Expression; awaitPromise = $true; returnByValue = $ByValue }
  return $res.result.result.value
}

function Wait-Until {
  param([string]$Expression, [int]$Seconds = 30)
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    $value = Eval-Js $Expression
    if ($value) { return $value }
    Start-Sleep -Milliseconds 800
  }
  return $null
}

function Upload-Files {
  param([string[]]$Files)
  Send-Cdp "DOM.enable" | Out-Null
  Send-Cdp "DOM.getDocument" @{ depth = -1; pierce = $true } | Out-Null
  $evalInput = Send-Cdp "Runtime.evaluate" @{ expression = "document.querySelectorAll('input[type=file]')[0]"; awaitPromise = $true; returnByValue = $false }
  $objectId = $evalInput.result.result.objectId
  if (-not $objectId) { throw "No image file input found" }
  $requested = Send-Cdp "DOM.requestNode" @{ objectId = $objectId }
  $nodeId = $requested.result.nodeId
  if (-not $nodeId) { throw "No file input node id found" }
  Send-Cdp "DOM.setFileInputFiles" @{ nodeId = $nodeId; files = $Files } | Out-Null
  Start-Sleep -Seconds 5
}

Connect-CdpPage
Send-Cdp "Runtime.enable" | Out-Null
Send-Cdp "Page.bringToFront" | Out-Null

Eval-Js "location.href='https://creator.xiaohongshu.com/new/note-manager'" | Out-Null
Wait-Until "location.href.includes('/new/note-manager') && document.querySelectorAll('.note-card').length > 0" 30 | Out-Null

$titleJson = $Title | ConvertTo-Json -Compress
$openEdit = @"
(() => {
  const title = $titleJson;
  const cards = Array.from(document.querySelectorAll('.note-card'));
  const card = cards.find(c => (c.querySelector('.note-card__title')?.textContent || '').trim() === title);
  if (!card) return { ok:false, reason:'card not found', titles: cards.map(c => c.querySelector('.note-card__title')?.textContent?.trim()) };
  const btn = card.querySelectorAll('.note-card__action-btn')[2];
  if (!btn) return { ok:false, reason:'edit button not found' };
  btn.click();
  return { ok:true };
})()
"@
$opened = Eval-Js $openEdit
Start-Sleep -Seconds 5
if (-not (Eval-Js "location.href.includes('/publish/update')")) { throw "Failed to open edit page for $Title" }

Upload-Files @($Cover)
Wait-Until "document.querySelectorAll('.img-idx').length >= 7" 30 | Out-Null

Eval-Js "(async () => { const sleep=ms=>new Promise(r=>setTimeout(r,ms)); for (let i=0;i<6;i++){ const btns=Array.from(document.querySelectorAll('.close-btn')); if(btns.length < 1) return false; btns[0].click(); await sleep(450); } return true; })()" | Out-Null
Wait-Until "document.querySelectorAll('.img-idx').length === 1" 30 | Out-Null

$detailFiles = Get-ChildItem -Path $DetailDir -Filter *.png | Sort-Object Name | Where-Object { $_.Name -ne "01-cover.png" } | Select-Object -ExpandProperty FullName
if ($detailFiles.Count -lt 1) { throw "No detail images found in $DetailDir" }
Upload-Files @($detailFiles)
Wait-Until "document.querySelectorAll('.img-idx').length >= 5" 30 | Out-Null

$publish = Eval-Js "(async () => { const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const el = document.elementFromPoint(779, 888); if (!el) return false; el.click(); await sleep(9000); return document.body.innerText.includes('编辑于') || document.body.innerText.includes('发布'); })()"
Write-Host "Updated $Title => $publish"

$script:Ws.Dispose()
