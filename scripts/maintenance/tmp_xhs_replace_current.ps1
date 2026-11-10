param(
  [Parameter(Mandatory=$true)][string]$ImageDir,
  [Parameter(Mandatory=$true)][string]$BodyFile
)
$ErrorActionPreference = "Stop"

function Connect-CdpPage {
  $raw = Invoke-WebRequest "http://127.0.0.1:9222/json/list" -UseBasicParsing | Select-Object -ExpandProperty Content
  $pages = $raw | ConvertFrom-Json
  $page = $pages | Where-Object { $_.type -eq "page" -and $_.url -like "https://creator.xiaohongshu.com/publish/update*" } | Select-Object -First 1
  if (-not $page) { throw "No Xiaohongshu update page found" }
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
  param([string]$Expression, [bool]$ReturnByValue = $true)
  $res = Send-Cdp "Runtime.evaluate" @{ expression = $Expression; awaitPromise = $true; returnByValue = $ReturnByValue }
  return $res.result.result.value
}
function Wait-Until {
  param([string]$Expression, [int]$Seconds = 45)
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
  Start-Sleep -Seconds 6
}

$images = @(Get-ChildItem -Path $ImageDir -Filter *.png | Sort-Object Name | Select-Object -ExpandProperty FullName)
$body = Get-Content -Path $BodyFile -Raw -Encoding UTF8
Connect-CdpPage
Send-Cdp "Runtime.enable" | Out-Null
Send-Cdp "Page.bringToFront" | Out-Null

$oldCount = [int](Eval-Js "document.querySelectorAll('.img-idx').length")
Upload-Files $images
Wait-Until "document.querySelectorAll('.img-idx').length >= $($oldCount + $images.Count)" 45 | Out-Null
Eval-Js "(async () => { const sleep=ms=>new Promise(r=>setTimeout(r,ms)); for (let i=0;i<$oldCount;i++){ const btn=document.querySelector('.close-btn'); if(!btn) return false; btn.click(); await sleep(420); } return true; })()" | Out-Null
Wait-Until "document.querySelectorAll('.img-idx').length === $($images.Count)" 45 | Out-Null

$bodyJson = $body | ConvertTo-Json -Compress
Eval-Js @"
(() => {
  const body = $bodyJson;
  const fields = Array.from(document.querySelectorAll('textarea, [contenteditable=true], input[type=text]')).filter(el => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  });
  const bodyField = fields.find(el => (el.innerText || el.value || '').includes('每日精选')) || fields.find(el => el.tagName === 'TEXTAREA') || fields[1];
  if (!bodyField) return false;
  bodyField.focus();
  if (bodyField.isContentEditable) {
    const range = document.createRange();
    range.selectNodeContents(bodyField);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('insertText', false, body);
  } else {
    const setter = Object.getOwnPropertyDescriptor(bodyField.__proto__, 'value')?.set;
    if (setter) setter.call(bodyField, body);
    else bodyField.value = body;
  }
  bodyField.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: body }));
  bodyField.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()
"@ | Out-Null
Start-Sleep -Seconds 1
$published = Eval-Js "(async () => { const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const el = document.elementFromPoint(779, 888); if (!el) return false; el.click(); await sleep(9000); return document.body.innerText.includes('编辑于') || document.body.innerText.includes('刚刚'); })()"
Write-Host "Updated current page images=$($images.Count) published=$published"
$script:Ws.Dispose()
