import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POST_ID = "auto-20260620-afe145f2f169";
const ASSET_ID = "xhs-daily-2026-06-23-646a5c9ac389";
const ASSET_DIR = path.join(ROOT, "content", "xiaohongshu-assets", ASSET_ID);

const fixed = {
  title: "VLM检测定位题目精讲",
  coverTitle: "VLM检测定位题目精讲",
  coverSubtitle: "多模态大模型 高频题",
  company: "",
  body: [
    "每日精选：VLM 检测定位题目精讲。今天把面试题目、完整解答、追问方向整理成图卡。",
    "引用来源：B站，2026-06-20",
    "原文链接：https://www.bilibili.com/video/BV1Ds7z63E2u/",
    "完整回答已拆成图卡，建议按顺序复习。",
    "#B站 #VLM #多模态大模型 #目标检测 #大模型面试 #AI学习",
  ].join("\n"),
  coverCard: {
    kind: "cover",
    kicker: "本篇速览",
    title: "VLM｜检测定位",
    body: [
      "方向：多模态大模型",
      "题目：为什么通用 VLM 的检测能力通常弱于 YOLO，如何增强其定位和检测能力？",
    ].join("\n"),
    footer: "Interview Hub · 面试题精讲",
  },
};

function rel(file) {
  return path.relative(ROOT, file).replaceAll("\\", "/");
}

function escapePs(value) {
  return String(value).replaceAll("`", "``").replaceAll("\"", "`\"");
}

async function writeJson(file, data) {
  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function updateRecord(record) {
  if (!record) return;
  record.title = fixed.title;
  record.coverTitle = fixed.coverTitle;
  record.coverSubtitle = fixed.coverSubtitle;
  record.company = fixed.company;
  record.body = fixed.body;
  record.companyAuditNote = "Qwen is a model family/product name in this source, not a confirmed interview company.";
  record.companyAuditUpdatedAt = new Date().toISOString();
  if (Array.isArray(record.imageCards)) {
    record.imageCards[0] = fixed.coverCard;
  }
}

async function updateDataFiles() {
  const queueFile = path.join(ROOT, "data", "publish-queue.json");
  const queue = JSON.parse(await fs.readFile(queueFile, "utf8"));
  updateRecord(queue.find((item) => item.postId === POST_ID));
  await writeJson(queueFile, queue);

  const featureFile = path.join(ROOT, "data", "daily-features.json");
  const features = JSON.parse(await fs.readFile(featureFile, "utf8"));
  const feature = features.find((item) => item.postId === POST_ID);
  if (feature) {
    feature.company = "";
    feature.direction = "多模态大模型";
    feature.companyAuditNote = "Qwen is a model family/product name in this source, not a confirmed interview company.";
    feature.companyAuditUpdatedAt = new Date().toISOString();
  }
  await writeJson(featureFile, features);

  const postsFile = path.join(ROOT, "data", "posts.json");
  const posts = JSON.parse(await fs.readFile(postsFile, "utf8"));
  const post = posts.find((item) => item.id === POST_ID);
  if (post) {
    post.company = "";
    post.companyAuditNote = "Qwen is a model family/product name in this source, not a confirmed interview company.";
    post.companyAuditUpdatedAt = new Date().toISOString();
  }
  await writeJson(postsFile, posts);

  const registryFile = path.join(ROOT, "data", "published-question-registry.json");
  try {
    const registry = JSON.parse(await fs.readFile(registryFile, "utf8"));
    for (const item of registry) {
      if (item.postId === POST_ID) {
        item.title = fixed.title;
        item.company = "";
      }
    }
    await writeJson(registryFile, registry);
  } catch {}
}

async function renderCards() {
  const queue = JSON.parse(await fs.readFile(path.join(ROOT, "data", "publish-queue.json"), "utf8"));
  const post = queue.find((item) => item.postId === POST_ID);
  if (!post) throw new Error(`Post not found: ${POST_ID}`);
  const cards = post.imageCards.map((card, index) => ({
    ...card,
    index: index + 1,
    total: post.imageCards.length,
    file: path.join(ROOT, post.imageCardFiles[index]),
  }));
  await writeJson(path.join(ASSET_DIR, "cards.json"), cards);
  const ps = `
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = "Stop"
$jsonPath = "${escapePs(path.join(ASSET_DIR, "cards.json"))}"
$cards = Get-Content -LiteralPath $jsonPath -Encoding UTF8 | ConvertFrom-Json
function Draw-Card($card) {
  $bmp = New-Object System.Drawing.Bitmap 1080, 1440
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle 0,0,1080,1440),
    [System.Drawing.Color]::FromArgb(6,14,28),
    [System.Drawing.Color]::FromArgb(12,38,48),
    45
  )
  $g.FillRectangle($bg, 0, 0, 1080, 1440)
  $linePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(72, 92, 255, 229)), 2
  for ($i = 0; $i -lt 9; $i++) {
    $y = 180 + $i * 125
    $g.DrawLine($linePen, 90, $y, 990, $y + 26)
  }
  $cyan = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 92, 255, 229))
  $green = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 102, 255, 194))
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(246, 246, 250, 255))
  $muted = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 181, 211, 232))
  $panel = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(78, 7, 18, 28))
  $accent = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(215, 92, 255, 229)), 3
  $fontKicker = New-Object System.Drawing.Font "Microsoft YaHei UI", 32, ([System.Drawing.FontStyle]::Bold)
  $fontTitle = New-Object System.Drawing.Font "Microsoft YaHei UI", 42, ([System.Drawing.FontStyle]::Bold)
  $fontBody = New-Object System.Drawing.Font "Microsoft YaHei UI", 28, ([System.Drawing.FontStyle]::Regular)
  $fontFooter = New-Object System.Drawing.Font "Microsoft YaHei UI", 24, ([System.Drawing.FontStyle]::Bold)
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = [System.Drawing.StringAlignment]::Near
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Near
  $fmt.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
  $g.FillRectangle($panel, 90, 150, 900, 1060)
  $g.DrawRectangle($accent, 90, 150, 900, 1060)
  $g.DrawString([string]$card.kicker, $fontKicker, $cyan, (New-Object System.Drawing.RectangleF 130, 200, 820, 70), $fmt)
  $g.DrawString([string]$card.title, $fontTitle, $white, (New-Object System.Drawing.RectangleF 130, 310, 820, 220), $fmt)
  $g.DrawString([string]$card.body, $fontBody, $muted, (New-Object System.Drawing.RectangleF 130, 575, 820, 585), $fmt)
  $g.DrawString([string]$card.footer, $fontFooter, $green, (New-Object System.Drawing.RectangleF 130, 1230, 650, 72), $fmt)
  $g.DrawString(("{0}/{1}" -f $card.index, $card.total), $fontFooter, $cyan, (New-Object System.Drawing.RectangleF 840, 1235, 120, 60), $fmt)
  $g.Dispose()
  $bmp.Save([string]$card.file, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
foreach ($card in $cards) { Draw-Card $card }
`;
  const psFile = path.join(ASSET_DIR, "render-repaired.ps1");
  await fs.writeFile(psFile, `\uFEFF${ps}`, "utf8");
  execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", psFile], { cwd: ROOT, stdio: "inherit" });
  post.imageCardFiles = cards.map((card) => rel(card.file));
}

await updateDataFiles();
await renderCards();
console.log(JSON.stringify({ ok: true, postId: POST_ID, title: fixed.title }, null, 2));
