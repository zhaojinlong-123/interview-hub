
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
  @{ file="E:\workshop\interview-hub\content\xiaohongshu-assets\xhs-daily-2026-06-15-7365dd0ad34a\01-card.png"; kicker=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5pys56+H6YCf6KeI")); title=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5by65YyW5a2m5LmgIC8g5a+56b2Q6K6t57uD")); body=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5pa55ZCR77ya5by65YyW5a2m5LmgIC8g5a+56b2Q6K6t57uDCumimOebru+8mlJMSEbjgIFEUE/jgIFHUlBP44CBUFBPIOeahOS8mOWMluebruagh+OAgeiuree7g+aVsOaNruWSjOeos+WumuaAp+mXrumimOWIhuWIq+aYr+S7gOS5iO+8nw==")); footer=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("SW50ZXJ2aWV3IEh1YiDCtyDpnaLor5Xpopjnsr7orrIgICAxLzU=")) },
  @{ file="E:\workshop\interview-hub\content\xiaohongshu-assets\xhs-daily-2026-06-15-7365dd0ad34a\02-card.png"; kicker=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6Z2i6K+V6aKY55uu")); title=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5LuK5aSp6YeN54K555yL6L+Z5Yeg6aKY")); body=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("MS4gUkxIRuOAgURQT+OAgUdSUE/jgIFQUE8g55qE5LyY5YyW55uu5qCH44CB6K6t57uD5pWw5o2u5ZKM56iz5a6a5oCn6Zeu6aKY5YiG5Yir5piv5LuA5LmI77yfCgoyLiBSZXdhcmQgbW9kZWwg5aaC5L2V5p6E6YCg5YGP5aW95pWw5o2u77yM5aaC5L2V5aSE55CGIHJld2FyZCBoYWNraW5n44CB6ZW/5bqm5YGP572u5ZKM5YiG5biD5aSW5Zue562U77yf")); footer=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6aKY55uu5ZKM5p2l5rqQ5LiA6Ie077yM562U5qGI6YCQ6aKY5bGV5byAICAgMi81")) },
  @{ file="E:\workshop\interview-hub\content\xiaohongshu-assets\xhs-daily-2026-06-15-7365dd0ad34a\03-card.png"; kicker=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6K+m57uG6Kej562UIDE=")); title=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("UkxIRuOAgURQT+OAgUdSUE/jgIFQUE8g55qE5LyY5YyW55uu5qCH44CB6K6t57uD5pWw5o2u5ZKM56iz5a6a5oCn6Zeu6aKY5YiG5Yir5piv5LuA5LmI77yf")); body=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("UkxIRiDmmK/kuIDlpZfku47kurrnsbvlgY/lpb3liLDnrZbnlaXkvJjljJbnmoTmtYHnqIvvvIzluLjop4HlgZrms5XmmK/lhYjorq3nu4MgcmV3YXJkIG1vZGVs77yM5YaN55SoIFBQTyDkvJjljJbnrZbnlaXvvJtQUE8g6ZyA6KaB6YeH5qC344CBcmV3YXJkIG1vZGVsIOWSjCBLTCDnuqbmnZ/vvIzngbXmtLvkvYbmiJDmnKzpq5jjgIHnqLPlrprmgKfmlY/mhJ/jgIJEUE8g5LiN5pi+5byP6K6t57uDIHJld2FyZCBtb2RlbO+8jOiAjOaYr+ebtOaOpeeUqOWBj+WlveWvueS8mOWMluetlueVpe+8jOiuqeWBj+Wlveagt+acrOS4reeahCBjaG9zZW4g5q+UIHJlamVjdGVkIOabtOWPr+iDve+8jOW3peeoi+abtOeugOWNleeos+Wumu+8jOS9huW8uuS+nei1luWBj+WlveaVsOaNrui0qOmHj+OAgkdSUE8g55So57uE5YaF55u45a+55aWW5Yqx6ZmN5L2O5a+5IHZhbHVlIG1vZGVsIOeahOS+nei1lu+8jOW4uOeUqOS6juaVsOWtpuaOqOeQhuetieWPr+aJuemHj+mHh+agt+avlOi+g+eahOWcuuaZr+OAgumdouivleWbnuetlOimgeiusuaVsOaNruadpea6kOOAgUtMIOe6puadn+OAgXJld2FyZCBoYWNraW5n44CB6ZW/5bqm5YGP572u44CB6K+E5Lyw5oyH5qCH5ZKM57q/5LiK5a6J5YWo6L6555WM44CC")); footer=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5py65Yi2IC0+IOW3peeoi+WPluiIjSAtPiDpo47pmakgLT4g5oyH5qCHICAgMy81")) },
  @{ file="E:\workshop\interview-hub\content\xiaohongshu-assets\xhs-daily-2026-06-15-7365dd0ad34a\04-card.png"; kicker=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6K+m57uG6Kej562UIDI=")); title=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("UmV3YXJkIG1vZGVsIOWmguS9leaehOmAoOWBj+WlveaVsOaNru+8jOWmguS9leWkhOeQhiByZXdhcmQgaGFja2luZ+OAgemVv+W6puWBj+e9ruWSjOWIhuW4g+WkluWbnuetlO+8nw==")); body=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("UmV3YXJkIG1vZGVsIOeahOWBj+WlveaVsOaNrumAmuW4uOadpeiHquWQjOS4gCBwcm9tcHQg5LiL5aSa5Liq5Zue562U55qE5Lq65bel5o6S5bqP44CB5LiT5a625qCH5rOo5oiW5qih5Z6L6L6F5Yqp5qCH5rOo44CC5YWz6ZSu5piv6K6pIGNob3Nlbi9yZWplY3RlZCDopobnm5bnnJ/lrp7otKjph4/lt67lvILvvIzogIzkuI3mmK/lj6ropobnm5bmoLzlvI/lt67lvILjgILplb/luqblgY/nva7lj6/ku6XpgJrov4fplb/luqbliIbmobbjgIHmmL7lvI/mg6nnvZrjgIFwYWlyIOmHh+agt+W5s+ihoeWSjOivhOS8sOaXtuaOp+WItuWbnuetlOmVv+W6pue8k+ino++8m3Jld2FyZCBoYWNraW5nIOimgeeUqCBoZWxkLW91dCDkurror4TjgIHop4TliJnmoKHpqozjgIHnuqLpmJ/moLfmnKzlkozlpJrnu7QgcmV3YXJkIOebkeaOp++8m+WIhuW4g+WkluWbnuetlOWImemcgOimgeWKoOWFpeaLkuetlOOAgeWuieWFqOOAgeS6i+WunuaAp+WSjOWkjeadguS7u+WKoeagt+acrOOAguWlveeahCByZXdhcmQgbW9kZWwg5LiN5bqU5Y+q57uZ6auY5YiG77yM6ICM6KaB6IO95Yy65YiG5pyJ55So5oCn44CB55yf5a6e5oCn44CB5a6J5YWo5oCn5ZKM5oyH5Luk6YG15b6q77yM5bm25oyB57ut55So57q/5LiKIGJhZGNhc2Ug5Zue5rWB5L+u5q2j44CC")); footer=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5py65Yi2IC0+IOW3peeoi+WPluiIjSAtPiDpo47pmakgLT4g5oyH5qCHICAgNC81")) },
  @{ file="E:\workshop\interview-hub\content\xiaohongshu-assets\xhs-daily-2026-06-15-7365dd0ad34a\05-card.png"; kicker=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5byV55So5p2l5rqQ")); title=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("54mb5a6i")); body=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("54mb5a6iIMK3IDIwMjYtMDYtMTQKaHR0cHM6Ly93d3cubm93Y29kZXIuY29tL2ZlZWQvbWFpbi9kZXRhaWwvZDliMmZmNmQ3NDhjNDgyN2FiYTNhMDIyN2E3MzNkMGY=")); footer=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6ZO+5o6l5Lmf5Lya5pS+5Zyo5q2j5paH6YeMICAgNS81")) }
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
