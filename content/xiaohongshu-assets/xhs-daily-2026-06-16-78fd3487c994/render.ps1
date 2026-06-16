
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
  @{ file="E:\workshop\interview-hub\content\xiaohongshu-assets\xhs-daily-2026-06-16-78fd3487c994\01-card.png"; kicker=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5pys56+H6YCf6KeI")); title=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5o6o55CG6YOo572yIC8g5qih5Z6L5Y6L57yp")); body=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5pa55ZCR77ya5o6o55CG6YOo572yIC8g5qih5Z6L5Y6L57ypCumimOebru+8mktWIGNhY2hlIOaYvuWtmOWmguS9lemajyBiYXRjaOOAgeW6j+WIl+mVv+W6puOAgeWxguaVsOOAgWhlYWQg5pWw5ZKMIGhpZGRlbiBzaXplIOWinumVv++8nw==")); footer=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("SW50ZXJ2aWV3IEh1YiDCtyDpnaLor5Xpopjnsr7orrIgICAxLzU=")) },
  @{ file="E:\workshop\interview-hub\content\xiaohongshu-assets\xhs-daily-2026-06-16-78fd3487c994\02-card.png"; kicker=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6Z2i6K+V6aKY55uu")); title=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5LuK5aSp6YeN54K555yL6L+Z5Yeg6aKY")); body=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("MS4gS1YgY2FjaGUg5pi+5a2Y5aaC5L2V6ZqPIGJhdGNo44CB5bqP5YiX6ZW/5bqm44CB5bGC5pWw44CBaGVhZCDmlbDlkowgaGlkZGVuIHNpemUg5aKe6ZW/77yfCgoyLiBQYWdlZEF0dGVudGlvbiDkuLrku4DkuYjog73mj5DljYfmmL7lrZjliKnnlKjnjofvvIzlkozov57nu60gS1YgY2FjaGUg5YiG6YWN5pyJ5LuA5LmI5Yy65Yir77yf")); footer=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6aKY55uu5ZKM5p2l5rqQ5LiA6Ie077yM562U5qGI6YCQ6aKY5bGV5byAICAgMi81")) },
  @{ file="E:\workshop\interview-hub\content\xiaohongshu-assets\xhs-daily-2026-06-16-78fd3487c994\03-card.png"; kicker=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6K+m57uG6Kej562UIDE=")); title=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("S1YgY2FjaGUg5pi+5a2Y5aaC5L2V6ZqPIGJhdGNo44CB5bqP5YiX6ZW/5bqm44CB5bGC5pWw44CBaGVhZCDmlbDlkowgaGlkZGVuIHNpemUg5aKe6ZW/77yf")); body=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("S1YgY2FjaGUg5L+d5a2Y5q+P5bGCIGF0dGVudGlvbiDnmoQga2V5L3ZhbHVl77yM55So5p2l6YG/5YWN55Sf5oiQ5pawIHRva2VuIOaXtumHjeWkjeiuoeeul+WOhuWPsuS4iuS4i+aWh+OAguWug+eahOaYvuWtmOWkp+iHtOmajyBiYXRjaCBzaXpl44CB5bqP5YiX6ZW/5bqm44CB5bGC5pWw44CBS1YgaGVhZCDmlbDjgIFoZWFkIGRpbWVuc2lvbiDlkozmlbDmja7nsbvlnovnur/mgKflop7plb/jgILorq3nu4Pml7bkuLvopoHmmL7lrZjljovlipvmnaXoh6rlj4LmlbDjgIHmoq/luqbjgIHkvJjljJblmajnirbmgIHlkozmv4DmtLvlgLzvvJvmjqjnkIbml7bmsqHmnInmoq/luqblkozkvJjljJblmajnirbmgIHvvIzplb/kuIrkuIvmlofkuIsgS1YgY2FjaGUg5Lya5oiQ5Li65qC45b+D55O26aKI44CC5LyY5YyW5omL5q615YyF5ousIE1RQS9HUUEg5YeP5bCRIEtWIGhlYWTjgIFQYWdlZEF0dGVudGlvbiDpmY3kvY7noo7niYfjgIFLViBjYWNoZSDph4/ljJbjgIFwcmVmaXggY2FjaGUg5aSN55So44CB5ruR5Yqo56qX5Y+j5oiWIEtWIGV2aWN0aW9u44CC6Z2i6K+V6YeM5pyA5aW96IO96K+05piOIFRURlQg5Y+XIHByZWZpbGwg5b2x5ZON77yMVFBPVCDlj5cgZGVjb2RlIOmYtuauteWSjCBLViDor7vlj5blvbHlk43jgII=")); footer=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5py65Yi2IC0+IOW3peeoi+WPluiIjSAtPiDpo47pmakgLT4g5oyH5qCHICAgMy81")) },
  @{ file="E:\workshop\interview-hub\content\xiaohongshu-assets\xhs-daily-2026-06-16-78fd3487c994\04-card.png"; kicker=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6K+m57uG6Kej562UIDI=")); title=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("UGFnZWRBdHRlbnRpb24g5Li65LuA5LmI6IO95o+Q5Y2H5pi+5a2Y5Yip55So546H77yM5ZKM6L+e57utIEtWIGNhY2hlIOWIhumFjeacieS7gOS5iOWMuuWIq++8nw==")); body=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5Lyg57uf6L+e57utIEtWIGNhY2hlIOW+gOW+gOS4uuavj+S4quivt+axgumihOeVmeS4gOautei/nue7reaYvuWtmO+8jOW6j+WIl+mVv+W6puS4jeS4gOiHtOaXtuWuueaYk+S6p+eUn+a1qui0ueWSjOeijueJh+OAglBhZ2VkQXR0ZW50aW9uIOWAn+mJtOaTjeS9nOezu+e7n+WIhumhteaAneaDs++8jOaKiiBLViBjYWNoZSDliIfmiJDlm7rlrprlpKflsI/nmoQgYmxvY2vvvIzpgJrov4fpobXooajmiorpgLvovpHluo/liJfkvY3nva7mmKDlsITliLDniannkIblnZfjgILov5nmoLfnn63or7fmsYLkuI3kvJrljaDnlKjov4flpKfnmoTov57nu63nqbrpl7TvvIzplb/or7fmsYLlj6/ku6XmjInpnIDmianlsZXvvIzlpJrkuKror7fmsYLosIPluqbml7bkuZ/mm7TlrrnmmJPlpI3nlKjlkozlm57mlLbjgILlroPmj5DljYfnmoTmmK/mmL7lrZjliKnnlKjnjoflkowgYmF0Y2gg6LCD5bqm54G15rS75oCn77yM5LiN5piv5pS55Y+YIGF0dGVudGlvbiDnmoTmlbDlrabnu5PmnpzjgILlt6XnqIvpo47pmanlnKggYmxvY2sgc2l6ZeOAgemhteihqOeuoeeQhuOAgeWGheWtmOiuv+mXruWxgOmDqOaAp+WSjOiwg+W6puWkjeadguW6pu+8jOmcgOimgeeUqOWQnuWQkOOAgeaYvuWtmOawtOS9jeOAgeeijueJh+eOh+OAgVRURlQg5ZKMIFRQT1Qg5LiA6LW36K+E5Lyw44CC")); footer=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5py65Yi2IC0+IOW3peeoi+WPluiIjSAtPiDpo47pmakgLT4g5oyH5qCHICAgNC81")) },
  @{ file="E:\workshop\interview-hub\content\xiaohongshu-assets\xhs-daily-2026-06-16-78fd3487c994\05-card.png"; kicker=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("5byV55So5p2l5rqQ")); title=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("55+l5LmO")); body=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("55+l5LmOIMK3IDIwMjYtMDYtMTQKaHR0cHM6Ly96aHVhbmxhbi56aGlodS5jb20vcC8yMDE0NjQzODI5ODQ0NzcwOTIz")); footer=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("6ZO+5o6l5Lmf5Lya5pS+5Zyo5q2j5paH6YeMICAgNS81")) }
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
