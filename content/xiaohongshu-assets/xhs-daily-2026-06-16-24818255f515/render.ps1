
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = "Stop"

function Wrap-Line($g, $text, $font, $maxWidth) {
  $lines = New-Object System.Collections.Generic.List[string]
  $current = ""
  foreach ($rawCh in $text.ToCharArray()) {
    $ch = [string]$rawCh
    $next = $current + $ch
    if ($g.MeasureString($next, $font).Width -gt $maxWidth -and $current.Length -gt 0) {
      $lines.Add($current)
      $current = $ch
    } else {
      $current = $next
    }
  }
  if ($current.Length -gt 0) { $lines.Add($current) }
  if ($lines.Count -eq 0) { $lines.Add("") }
  return $lines
}

function Draw-WrappedBlock($g, $text, $font, $brush, $x, $y, $w, $lineHeight, $maxLines) {
  $drawn = 0
  $paragraphs = ($text -replace "\r\n", "\n" -replace "\r", "\n") -split "\n"
  foreach ($para in $paragraphs) {
    if ($drawn -ge $maxLines) { break }
    if ([string]::IsNullOrWhiteSpace($para)) {
      $y += [int]($lineHeight * 0.55)
      continue
    }
    $wrapped = Wrap-Line $g $para.Trim() $font $w
    foreach ($line in $wrapped) {
      if ($drawn -ge $maxLines) { break }
      $output = $line
      if ($drawn -eq ($maxLines - 1) -and ($wrapped.IndexOf($line) -lt ($wrapped.Count - 1))) {
        while ($g.MeasureString(($output + "..."), $font).Width -gt $w -and $output.Length -gt 1) {
          $output = $output.Substring(0, $output.Length - 1)
        }
        $output = $output + "..."
      }
      $g.DrawString($output, $font, $brush, $x, $y)
      $y += $lineHeight
      $drawn += 1
    }
    $y += 8
  }
  return $y
}

$cards = @(
  @{ file="E:\workshop\interview-hub\content\xiaohongshu-assets\xhs-daily-2026-06-16-24818255f515\01-card.png"; kicker=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5pys56+H6YCf6KeI")); title=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5a2X6IqC772c5aSa5qih5oCB5aSn5qih5Z6L")); body=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5YWs5Y+477ya5a2X6IqCCuaWueWQke+8muWkmuaooeaAgeWkp+aooeWeiwrpopjnm67vvJrpq5jliIbovqjnjoflm77niYfovpPlhaXml7bvvIzliqjmgIHliIbovqjnjofjgIF0aWxlIOWIh+WIhuWSjCB0b2tlbiDljovnvKnlpoLkvZXlj5boiI3vvJ8=")); footer=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("SW50ZXJ2aWV3IEh1YiDCtyDpnaLor5Xpopjnsr7orrIgICAxLzU=")) },
  @{ file="E:\workshop\interview-hub\content\xiaohongshu-assets\xhs-daily-2026-06-16-24818255f515\02-card.png"; kicker=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6Z2i6K+V6aKY55uu")); title=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5LuK5aSp6YeN54K555yL6L+Z5Yeg6aKY")); body=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("MS4g6auY5YiG6L6o546H5Zu+54mH6L6T5YWl5pe277yM5Yqo5oCB5YiG6L6o546H44CBdGlsZSDliIfliIblkowgdG9rZW4g5Y6L57yp5aaC5L2V5Y+W6IiN77yfCgoyLiBWaXNpb24gZW5jb2RlciDovpPlh7rlpoLkvZXkuI4gTExNIHRva2VuIOepuumXtOWvuem9kO+8n0xpbmVhciBwcm9qZWN0b3LjgIFRLUZvcm1lcuOAgWNyb3NzLWF0dGVudGlvbiBhZGFwdGVyIOeahOW3ruW8guaYr+S7gOS5iO+8nw==")); footer=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6aKY55uu5ZKM5p2l5rqQ5LiA6Ie077yM562U5qGI6YCQ6aKY5bGV5byAICAgMi81")) },
  @{ file="E:\workshop\interview-hub\content\xiaohongshu-assets\xhs-daily-2026-06-16-24818255f515\03-card.png"; kicker=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6K+m57uG6Kej562UIDE=")); title=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6auY5YiG6L6o546H5Zu+54mH6L6T5YWl5pe277yM5Yqo5oCB5YiG6L6o546H44CBdGlsZSDliIfliIblkowgdG9rZW4g5Y6L57yp5aaC5L2V5Y+W6IiN77yf")); body=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6auY5YiG6L6o546H6L6T5YWl55qE5qC45b+D55+b55u+5piv57uG6IqC5L+h5oGv5ZKMIHRva2VuIOaIkOacrOOAguWKqOaAgeWIhui+qOeOh+S8muagueaNruWbvueJh+mVv+WuveavlOWSjOWGheWuueWkjeadguW6pumAieaLqei+k+WFpeWwuuW6pu+8jOS8mOeCueaYr+mBv+WFjeaJgOacieWbvueJh+mDveaMieacgOWkp+WIhui+qOeOh+WkhOeQhu+8m3RpbGUg5YiH5YiG5oqK5aSn5Zu+5ouG5oiQ5bGA6YOo5Z2X77yM6YCC5ZCIIE9DUuOAgeWbvuihqOOAgemBpeaEn+WSjOe7hueykuW6puajgOa1i++8jOS9huS8muWinuWKoOi3qCB0aWxlIOiejeWQiOmavuW6pu+8m3Rva2VuIOWOi+e8qemAmui/hyBwb29saW5n44CBcXVlcnkg5Y6L57yp5oiWIHRva2VuIHBydW5pbmcg5YeP5bCR6KeG6KeJIHRva2Vu77yM6YCC5ZCI6ZmN5L2OIExMTSDkvqfkuIrkuIvmlofljovlipvjgILlj5boiI3kuIrvvIzlpoLmnpzku7vliqHkvp3otZblsYDpg6jmloflrZflkozlsI/nm67moIfvvIzlupTkvJjlhYjkv53nlZnpq5jliIbovqjnjocgdGlsZe+8m+WmguaenOS7u+WKoeWBj+aVtOS9k+WcuuaZr+eQhuino++8jOWPr+S7peabtOW8uuWOi+e8qeOAgumdouivleWbnuetlOimgeiQveWIsOaMh+agh++8muWHhuehrueOh+OAgU9DUiDlj6zlm57jgIHlubvop4nnjofjgIHop4bop4kgdG9rZW4g5pWw44CB5pi+5a2Y5ZKM6aaWIHRva2VuIOW7tui/n+OAgg==")); footer=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5py65Yi2IC0+IOW3peeoi+WPluiIjSAtPiDpo47pmakgLT4g5oyH5qCHICAgMy81")) },
  @{ file="E:\workshop\interview-hub\content\xiaohongshu-assets\xhs-daily-2026-06-16-24818255f515\04-card.png"; kicker=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6K+m57uG6Kej562UIDI=")); title=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("VmlzaW9uIGVuY29kZXIg6L6T5Ye65aaC5L2V5LiOIExMTSB0b2tlbiDnqbrpl7Tlr7npvZDvvJ9MaW5lYXIgcHJvamVjdG9y44CB4oCm")); body=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6KeG6KeJIGVuY29kZXIg6L6T5Ye66YCa5bi45piv6L+e57ut6KeG6KeJ54m55b6B77yM6ICMIExMTSDmjqXmlLbnmoTmmK/or63oqIAgdG9rZW4gZW1iZWRkaW5n77yM5Zug5q2k6ZyA6KaB6L+e5o6l5bGC5oqK6KeG6KeJ54m55b6B5pig5bCE5YiwIExMTSDlj6/nlKjnqbrpl7TjgIJMaW5lYXIgcHJvamVjdG9yIOacgOeugOWNle+8jOebtOaOpee6v+aAp+aYoOWwhOinhuiniSBwYXRjaCB0b2tlbu+8jOW7tui/n+S9juOAgeiuree7g+eos+Wumu+8jOS9huWOi+e8qeWSjOmAieaLqeiDveWKm+W8se+8m1EtRm9ybWVyIOS9v+eUqOWPr+WtpuS5oCBxdWVyeSDku47op4bop4nnibnlvoHph4zmir3lj5blm7rlrprmlbDph4/nmoTop4bop4nmkZjopoHvvIzog73lh4/lsJEgdG9rZW7vvIzkvYblj6/og73kuKLnu4boioLvvJtjcm9zcy1hdHRlbnRpb24gYWRhcHRlciDorqnor63oqIDkvqflkozop4bop4nkvqfkuqTkupLmm7TlhYXliIbvvIzooajovr7og73lipvlvLrvvIzkvYborq3nu4PlkozmjqjnkIbmiJDmnKzmm7Tpq5jjgILlt6XnqIvkuIrluLjmjInku7vliqHpgInmi6nvvJpPQ1Ig5ZKM57uG57KS5bqmIGdyb3VuZGluZyDmm7TpnIDopoHkv53nlZnlsYDpg6ggdG9rZW7vvIzpgJrnlKjpl67nrZTlj6/ku6XnlKggcXVlcnkg5Y6L57yp44CC6K+E5Lyw6KaB55yL5Zu+5paH5a+56b2Q44CBZ3JvdW5kaW5n44CBT0NS44CB56m66Ze05YWz57O75ZKM5bm76KeJ546H44CC")); footer=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5py65Yi2IC0+IOW3peeoi+WPluiIjSAtPiDpo47pmakgLT4g5oyH5qCHICAgNC81")) },
  @{ file="E:\workshop\interview-hub\content\xiaohongshu-assets\xhs-daily-2026-06-16-24818255f515\05-card.png"; kicker=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5byV55So5p2l5rqQ")); title=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("55+l5LmO")); body=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("55+l5LmOIMK3IDIwMjYtMDYtMTQKaHR0cHM6Ly96aHVhbmxhbi56aGlodS5jb20vcC8yMDE0MzE0NzgwODAyOTY3NDcz")); footer=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6ZO+5o6l5Lmf5Lya5pS+5Zyo5q2j5paH6YeMICAgNS81")) }
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
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(120, 92, 255, 218)), 3
  $g.DrawRectangle($pen, 70, 84, 940, 1210)
  $thin = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(42, 92, 255, 218)), 1
  for ($y = 190; $y -lt 1240; $y += 150) { $g.DrawLine($thin, 72, $y, 1008, $y + 34) }

  $accent = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(98, 255, 205))
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(242, 248, 255))
  $muted = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(185, 206, 224))
  $yellow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 218, 92))
  $fontK = New-Object System.Drawing.Font "Microsoft YaHei UI", 30, ([System.Drawing.FontStyle]::Bold)
  $fontT = New-Object System.Drawing.Font "Microsoft YaHei UI", 43, ([System.Drawing.FontStyle]::Bold)
  $fontB = New-Object System.Drawing.Font "Microsoft YaHei UI", 29, ([System.Drawing.FontStyle]::Regular)
  $fontF = New-Object System.Drawing.Font "Microsoft YaHei UI", 27, ([System.Drawing.FontStyle]::Bold)

  $g.DrawString($card.kicker, $fontK, $accent, 112, 135)
  $afterTitle = Draw-WrappedBlock $g $card.title $fontT $white 112 245 850 62 4
  $bodyY = [Math]::Max(465, $afterTitle + 48)
  Draw-WrappedBlock $g $card.body $fontB $muted 112 $bodyY 850 48 13 | Out-Null
  $g.DrawString($card.footer, $fontF, $yellow, 112, 1240)

  $bmp.Save([string]$card.file, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}
