import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const QUEUE_FILE = path.join(ROOT, "data", "publish-queue.json");

const TARGET_POST_IDS = new Set([
  "missed-20260615-afternoon-video",
  "missed-20260616-morning-byte-vlm",
  "missed-20260616-afternoon-inference",
  "missed-20260615-morning-rl",
]);

function psString(value) {
  return `[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("${Buffer.from(String(value || ""), "utf8").toString("base64")}"))`;
}

function psPath(value) {
  return String(value).replace(/`/g, "``").replace(/"/g, '`"');
}

async function main() {
  const queue = JSON.parse(await fs.readFile(QUEUE_FILE, "utf8"));
  const targets = queue.filter((item) => TARGET_POST_IDS.has(item.postId));
  if (!targets.length) throw new Error("No target posts found in publish queue.");

  for (const post of targets) {
    const cards = post.imageCards.map((card, index) => ({
      ...card,
      file: path.join(ROOT, post.imageCardFiles[index]),
      index: index + 1,
      total: post.imageCards.length,
    }));
    const ps = `
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
  $paragraphs = ($text -replace "\\r\\n", "\\n" -replace "\\r", "\\n") -split "\\n"
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
${cards.map((card) => `  @{ file="${psPath(card.file)}"; kicker=${psString(card.kicker)}; title=${psString(card.title)}; body=${psString(card.body)}; footer=${psString(`${card.footer}   ${card.index}/${card.total}`)} }`).join(",\n")}
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
`;
    const psFile = path.join(path.dirname(cards[0].file), "render.ps1");
    await fs.writeFile(psFile, `\uFEFF${ps}`, "utf8");
    execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", psFile], { cwd: ROOT, stdio: "inherit" });
    console.log(`rerendered ${post.id}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
