import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const outDir = "E:\\workshop\\xhs-updated-covers";
fs.mkdirSync(outDir, { recursive: true });

const items = [
  {
    file: "01-byte-multimodal.png",
    title: "字节多模态大模型题目精讲",
    company: "字节",
    direction: "多模态大模型",
    question: "Vision encoder 输出如何与 LLM token 空间对齐？Linear projector、Q-Former、cross-attention adapter 的差异是什么？",
  },
  {
    file: "02-general-vla.png",
    title: "VLA具身智能题目精讲",
    company: "综合",
    direction: "VLA / 具身智能",
    question: "VLA 中 action token、连续动作回归和 diffusion policy 各自适合什么控制场景？",
  },
  {
    file: "03-ali-multimodal.png",
    title: "阿里多模态大模型题目精讲",
    company: "阿里",
    direction: "多模态大模型",
    question: "多模态模型如何评估 grounding、OCR、空间关系、幻觉和多轮视觉对话能力？",
  },
  {
    file: "04-byte-vla.png",
    title: "字节VLA具身智能题目精讲",
    company: "字节",
    direction: "VLA / 具身智能",
    question: "VLA 中 action token、连续动作回归和 diffusion policy 各自适合什么控制场景？",
  },
  {
    file: "05-nio-vla.png",
    title: "蔚来VLA具身智能题目精讲",
    company: "蔚来",
    direction: "VLA / 具身智能 / 世界模型 / 自动驾驶",
    question: "自动驾驶世界模型如何从 BEV、occupancy、轨迹预测和仿真闭环中学习环境动态？",
  },
  {
    file: "06-byte-infra.png",
    title: "字节训练框架推理优化题目精讲",
    company: "字节",
    direction: "训练框架 / 推理优化",
    question: "DeepSpeed ZeRO、Megatron 张量并行、流水并行和数据并行分别解决什么瓶颈？",
  },
];

function esc(value) {
  return String(value).replaceAll("`", "``").replaceAll('"', '`"');
}

function psFor(item) {
  const target = path.join(outDir, item.file);
  return `
Add-Type -AssemblyName System.Drawing
$path = "${esc(target)}"
$bmp = New-Object System.Drawing.Bitmap 1080, 1440
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$rect = New-Object System.Drawing.Rectangle 0,0,1080,1440
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(5,14,24)), ([System.Drawing.Color]::FromArgb(10,42,52)), 45
$g.FillRectangle($bg, $rect)
$gridPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(44, 92, 255, 229)), 2
for ($i = 0; $i -lt 10; $i++) {
  $y = 180 + $i * 118
  $g.DrawLine($gridPen, 90, $y, 990, $y + 22)
}
$cyan = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 93, 255, 229))
$green = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 103, 255, 196))
$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(248, 250, 255))
$muted = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 184, 211, 232))
$yellow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 211, 94))
$panel = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(92, 8, 19, 31))
$line = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(190, 92, 255, 229)), 3
$hot = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(220, 255, 211, 94)), 6
$fontKicker = New-Object System.Drawing.Font "Microsoft YaHei UI", 34, ([System.Drawing.FontStyle]::Bold)
$fontTitle = New-Object System.Drawing.Font "Microsoft YaHei UI", 48, ([System.Drawing.FontStyle]::Bold)
$fontLabel = New-Object System.Drawing.Font "Microsoft YaHei UI", 34, ([System.Drawing.FontStyle]::Bold)
$fontBody = New-Object System.Drawing.Font "Microsoft YaHei UI", 32, ([System.Drawing.FontStyle]::Bold)
$fontQuestion = New-Object System.Drawing.Font "Microsoft YaHei UI", 32, ([System.Drawing.FontStyle]::Bold)
$fontFooter = New-Object System.Drawing.Font "Microsoft YaHei UI", 24, ([System.Drawing.FontStyle]::Bold)
$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment = [System.Drawing.StringAlignment]::Near
$fmt.LineAlignment = [System.Drawing.StringAlignment]::Near
$fmt.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
$g.FillRectangle($panel, 90, 120, 900, 1140)
$g.DrawRectangle($line, 90, 120, 900, 1140)
$g.DrawLine($hot, 90, 120, 990, 120)
$g.DrawString("本篇速览", $fontKicker, $green, 130, 170)
$g.DrawString("${esc(item.title)}", $fontTitle, $white, (New-Object System.Drawing.RectangleF 130, 250, 820, 140), $fmt)
$g.DrawString("公司", $fontLabel, $yellow, 130, 460)
$g.DrawString("${esc(item.company)}", $fontBody, $white, (New-Object System.Drawing.RectangleF 250, 458, 690, 70), $fmt)
$g.DrawString("方向", $fontLabel, $yellow, 130, 560)
$g.DrawString("${esc(item.direction)}", $fontBody, $white, (New-Object System.Drawing.RectangleF 250, 558, 690, 95), $fmt)
$g.DrawString("题目", $fontLabel, $yellow, 130, 700)
$g.DrawString("${esc(item.question)}", $fontQuestion, $white, (New-Object System.Drawing.RectangleF 130, 770, 820, 270), $fmt)
$g.DrawString("先知道考什么，再看后面的详细拆解。", $fontBody, $muted, (New-Object System.Drawing.RectangleF 130, 1068, 820, 60), $fmt)
$g.DrawString("Interview Hub", $fontFooter, $green, 130, 1200)
$g.DrawString("1/7", $fontFooter, $cyan, 870, 1200)
$g.Dispose()
$bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
`;
}

for (const item of items) {
  execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psFor(item)], { stdio: "inherit" });
  console.log(path.join(outDir, item.file));
}
