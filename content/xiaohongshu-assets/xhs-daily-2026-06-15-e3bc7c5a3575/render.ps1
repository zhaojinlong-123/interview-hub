
Add-Type -AssemblyName System.Drawing
function Draw-WrappedText($g, $text, $font, $brush, $x, $y, $w, $lineHeight, $maxLines) {
  $words = $text -split ""
  $line = ""
  $lines = New-Object System.Collections.Generic.List[string]
  foreach ($ch in $words) {
    $next = $line + $ch
    if ($g.MeasureString($next, $font).Width -gt $w -and $line.Length -gt 0) {
      $lines.Add($line)
      $line = $ch
      if ($lines.Count -ge $maxLines) { break }
    } else {
      $line = $next
    }
  }
  if ($lines.Count -lt $maxLines -and $line.Length -gt 0) { $lines.Add($line) }
  for ($i = 0; $i -lt $lines.Count; $i++) {
    $g.DrawString($lines[$i], $font, $brush, $x, $y + $i * $lineHeight)
  }
}
$cards = @(
  @{ file="E:\workshop\interview-hub\content\xiaohongshu-assets\xhs-daily-2026-06-15-e3bc7c5a3575\01-card.png"; kicker=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5pys56+H6YCf6KeI")); title=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6KeG6aKRIC8g6KeG6KeJ55CG6Kej")); body=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5pa55ZCR77ya6KeG6aKRIC8g6KeG6KeJ55CG6KejCumimOebru+8muinhumikeeQhuino+S4reW4p+mHh+agt+OAgXRlbXBvcmFsIHRva2VuIOWOi+e8qeWSjCBsb25nLWNvbnRleHQgYXR0ZW50aW9uIOWmguS9leWPluiIje+8nw==")); footer=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("SW50ZXJ2aWV3IEh1YiDCtyDpnaLor5Xpopjnsr7orrIgICAxLzU=")) },
  @{ file="E:\workshop\interview-hub\content\xiaohongshu-assets\xhs-daily-2026-06-15-e3bc7c5a3575\02-card.png"; kicker=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6Z2i6K+V6aKY55uu")); title=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5LuK5aSp6YeN54K555yL6L+Z5Yeg6aKY")); body=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("MS4g6KeG6aKR55CG6Kej5Lit5bin6YeH5qC344CBdGVtcG9yYWwgdG9rZW4g5Y6L57yp5ZKMIGxvbmctY29udGV4dCBhdHRlbnRpb24g5aaC5L2V5Y+W6IiN77yfCgoyLiDop4bpopHpl67nrZTlpoLkvZXor4TkvLDliqjkvZznkIbop6PjgIHkuovku7bovrnnlYzjgIHlm6DmnpzlhbPns7vlkozot6jplZzlpLTkuIDoh7TmgKfvvJ8=")); footer=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6aKY55uu5ZKM5p2l5rqQ5LiA6Ie077yM562U5qGI6YCQ6aKY5bGV5byAICAgMi81")) },
  @{ file="E:\workshop\interview-hub\content\xiaohongshu-assets\xhs-daily-2026-06-15-e3bc7c5a3575\03-card.png"; kicker=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6K+m57uG6Kej562UIDE=")); title=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6KeG6aKR55CG6Kej5Lit5bin6YeH5qC344CBdGVtcG9yYWwgdG9rZW4g5Y6L57yp5ZKMIGxvbmctY29udGV4dCBhdHRlbnRpb24g5aaC5L2V4oCm")); body=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6L+Z6aKY6KaB5YWI6K+05piO5LiJ6ICF6Kej5Yaz55qE5piv5ZCM5LiA5Liq55+b55u+77ya6KeG6aKR5L+h5oGv6YeP5b6I5aSn77yM5L2G5qih5Z6L5LiK5LiL5paH44CB5pi+5a2Y5ZKM5bu26L+f5pyJ6ZmQ44CC5bin6YeH5qC35Yaz5a6a5oqK5ZOq5Lqb5Y6f5aeL5bin6YCB6L+b5qih5Z6L77yM6YCC5ZCI5LuO6L6T5YWl5L6n6ZmN5L2O5oiQ5pys77ybdGVtcG9yYWwgdG9rZW4g5Y6L57yp5piv5Zyo54m55b6B5L6n5ZCI5bm25YaX5L2Z5pe26Ze05L+h5oGv77yM6YCC5ZCI5L+d55WZ6ZW/6KeG6aKR5YWo5bGA6K+t5LmJ77ybbG9uZy1jb250ZXh0IGF0dGVudGlvbiDliJnlsL3ph4/kv53nlZnmm7TlpJogdG9rZW7vvIzorqnmqKHlnovnm7TmjqXlu7rmqKHplb/nqIvkvp3otZbjgILlt6XnqIvkuIrvvIznn63op4bpopHliqjkvZzor4bliKvlj6/ku6XnlKjovoPlr4bph4fmoLfvvIzplb/op4bpopHpl67nrZTmm7Tkvp3otZblhbPplK7luKfliqDniYfmrrXmo4DntKLvvJvlpoLmnpzku7vliqHpnIDopoHnu4bnspLluqbliqjkvZzovrnnlYzvvIzkuI3og73ljovlvpflpKrni6DvvJvlpoLmnpzku7vliqHmm7TlgY/mkZjopoHmiJblnLrmma/nkIbop6PvvIzlj6/ku6Xmm7Tmv4Dov5vljovnvKnjgILpnaLor5Xph4zopoHooaXor4TkvLDmjIfmoIfvvJrliqjkvZzor4bliKvlh4bnoa7njofjgIHkuovku7bovrnnlYzlrprkvY3jgIHot6jniYfmrrXkuIDoh7TmgKfjgIHpppYgdG9rZW4g5bu26L+f5ZKM5Y2V5L2N6KeG6aKR5oiQ5pys44CC")); footer=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5py65Yi2IC0+IOW3peeoi+WPluiIjSAtPiDpo47pmakgLT4g5oyH5qCHICAgMy81")) },
  @{ file="E:\workshop\interview-hub\content\xiaohongshu-assets\xhs-daily-2026-06-15-e3bc7c5a3575\04-card.png"; kicker=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6K+m57uG6Kej562UIDI=")); title=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6KeG6aKR6Zeu562U5aaC5L2V6K+E5Lyw5Yqo5L2c55CG6Kej44CB5LqL5Lu26L6555WM44CB5Zug5p6c5YWz57O75ZKM6Leo6ZWc5aS05LiA6Ie05oCn77yf")); body=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6KeG6aKR6Zeu562U6K+E5Lyw5LiN6IO95Y+q55yL562U5qGI5piv5ZCm6K+t5LmJ55u46L+R77yM6KaB5oyJ6IO95Yqb5ouG6Kej44CC5Yqo5L2c55CG6Kej55yL5qih5Z6L6IO95ZCm5Yy65YiG5ou/6LW344CB5pS+5LiL44CB5omT5byA44CB5YWz6Zet562J5pe26Ze055u45YWz5Yqo5L2c77yb5LqL5Lu26L6555WM55yL6IO95ZCm5a6a5L2N5Yqo5L2c5byA5aeL5ZKM57uT5p2f77yM6ICM5LiN5piv5Y+q6K+G5Yir6Z2Z5oCB55S76Z2i77yb5Zug5p6c5YWz57O755yL5piv5ZCm6IO95Zue562U5Zug5Li65YmN6Z2i5Y+R55Sf5LqG5LuA5LmI5omA5Lul5ZCO6Z2i57uT5p6c5aaC5L2V77yb6Leo6ZWc5aS05LiA6Ie05oCn55yL5ZCM5LiA5Lq654mp44CB54mp5L2T5oiW54q25oCB5Zyo5aSa5Liq54mH5q616YeM5piv5ZCm5L+d5oyB5LiA6Ie044CC5pWw5o2u6ZuG6K6+6K6h5LiK6KaB5pyJ5pe26Ze05oiz5qCH5rOo44CB5bmy5omw5bin44CB55u45Ly85Yqo5L2c6LSf5L6L5ZKM6Leo54mH5q616Zeu6aKY44CC57q/5LiK6K+E5Lyw6L+Y6KaB55yL5bm76KeJ546H5ZKM5LiN56Gu5a6a5oCn6KGo6L6+77ya6KeG6aKR6YeM5rKh5pyJ5Ye6546w55qE5L+h5oGv77yM5qih5Z6L5bqU6K+l6K+05peg5rOV5Yik5pat77yM6ICM5LiN5piv6KGl5Ymn5oOF44CC")); footer=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5py65Yi2IC0+IOW3peeoi+WPluiIjSAtPiDpo47pmakgLT4g5oyH5qCHICAgNC81")) },
  @{ file="E:\workshop\interview-hub\content\xiaohongshu-assets\xhs-daily-2026-06-15-e3bc7c5a3575\05-card.png"; kicker=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5byV55So5p2l5rqQ")); title=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("Q1NETg==")); body=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("Q1NETiDCtyAyMDI2LTA2LTE0Cmh0dHBzOi8vYmxvZy5jc2RuLm5ldC9xcV80NTkzNDI4NS9hcnRpY2xlL2RldGFpbHMvMTQzMjYxMzE3")); footer=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6ZO+5o6l5Lmf5Lya5pS+5Zyo5q2j5paH6YeMICAgNS81")) }
)
foreach ($card in $cards) {
  $bmp = New-Object System.Drawing.Bitmap 1080, 1440
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle 0,0,1080,1440),
    [System.Drawing.Color]::FromArgb(6,14,28),
    [System.Drawing.Color]::FromArgb(13,42,52),
    45
  )
  $g.FillRectangle($bg, 0, 0, 1080, 1440)
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(115, 92, 255, 218)), 3
  $g.DrawRectangle($pen, 70, 84, 940, 1210)
  $thin = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(50, 92, 255, 218)), 1
  for ($y = 190; $y -lt 1240; $y += 150) { $g.DrawLine($thin, 72, $y, 1008, $y + 34) }
  $accent = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(98, 255, 205))
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(242, 248, 255))
  $muted = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(185, 206, 224))
  $yellow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 218, 92))
  $fontK = New-Object System.Drawing.Font "Microsoft YaHei UI", 30, ([System.Drawing.FontStyle]::Bold)
  $fontT = New-Object System.Drawing.Font "Microsoft YaHei UI", 48, ([System.Drawing.FontStyle]::Bold)
  $fontB = New-Object System.Drawing.Font "Microsoft YaHei UI", 31, ([System.Drawing.FontStyle]::Regular)
  $fontF = New-Object System.Drawing.Font "Microsoft YaHei UI", 27, ([System.Drawing.FontStyle]::Bold)
  $g.DrawString($card.kicker, $fontK, $accent, 112, 135)
  Draw-WrappedText $g $card.title $fontT $white 112 245 850 62 4
  Draw-WrappedText $g $card.body $fontB $muted 112 545 850 47 13
  $g.DrawString($card.footer, $fontF, $yellow, 112, 1240)
  $bmp.Save([string]$card.file, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}
