import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const OUT_DIR = path.join(ROOT, "content", "xiaohongshu-edit-assets");

const replacements = [
  {
    id: "replace-video-understanding-20260615",
    oldTitle: "VLA/机器人动作题目精讲",
    oldDate: "2026-06-14 10:34",
    title: "视频理解时序建模题目精讲",
    company: "综合",
    direction: "视频 / 视觉理解",
    sourcePlatform: "CSDN",
    sourceUrl: "https://blog.csdn.net/qq_45934285/article/details/143261317",
    questions: [
      "视频模型如何评估时序一致性、动作理解、事件边界和身份保持？",
      "temporal token 压缩如何保留动作变化和事件顺序，相比长上下文 attention 有什么取舍？",
    ],
    answers: [
      "这题要先把视频理解拆成表示、时序建模和评估三层。表示层通常从均匀采样、关键帧采样或运动感知采样得到帧序列，再用视觉 encoder 得到 frame token 或 patch token；时序层再通过 temporal attention、时序卷积、状态空间模型、memory token 或片段级检索，把动作变化、事件先后和跨镜头实体关系建起来。评估时不能只看单帧问答准确率，要分别看动作类别、事件边界定位、人物或物体身份保持、跨帧指代、因果顺序和长视频问答。工程上还要报告帧数、采样策略、token 压缩比例、延迟和显存，因为视频模型的瓶颈常常不是会不会看图，而是能不能在有限 token 预算下保留关键运动信息。",
      "temporal token 压缩的核心是把大量帧 token 变成少量但信息密度更高的时序 token。常见做法包括按时间窗口池化、关键帧选择、query token 汇聚、运动显著性筛选和分层摘要。它的优点是显著降低长视频 attention 成本，让模型能处理更长上下文；代价是细粒度动作、短暂事件和物体身份变化容易被压掉。直接长上下文 attention 信息保留更完整，但显存和延迟随帧数快速上升。面试里可以这样回答：短视频、细粒度动作识别优先保留更多帧和局部 token；长视频问答、检索和摘要更适合先压缩成片段记忆，再做跨片段推理。最后一定要用事件边界、动作顺序和跨帧一致性指标验证压缩没有丢关键动态。",
    ],
  },
  {
    id: "replace-world-model-planning-20260615",
    oldTitle: "VLA具身智能题目精讲",
    oldDate: "2026-06-13 12:10",
    title: "世界模型规划题目精讲",
    company: "综合",
    direction: "世界模型",
    sourcePlatform: "51CTO",
    sourceUrl: "https://www.51cto.com/article/820298.html",
    questions: [
      "世界模型训练中 latent dynamics、reward model 和 rollout horizon 如何影响规划效果？",
      "世界模型如何学习环境动态，和传统感知预测规划模块相比优势和风险是什么？",
    ],
    answers: [
      "latent dynamics 决定模型在隐空间里怎么预测下一步状态，它要足够压缩，又不能丢掉和控制有关的物体、几何、速度和接触关系。reward model 决定规划时什么轨迹算好，如果 reward 只覆盖短期目标，模型容易学到投机策略；如果 reward 太稀疏，长程规划会不稳定。rollout horizon 决定向未来展开多远：短 horizon 更稳定但容易贪心，长 horizon 能看见长期收益但误差会累积。工程上通常用多步预测损失、latent consistency、终止/失败预测和不确定性估计来约束世界模型，再用 MPC、beam search 或策略网络在模型内 rollout。面试回答重点是：规划效果不是只由生成质量决定，而由动态预测误差、奖励设计、展开长度和不确定性共同决定。",
      "世界模型试图学习环境状态随时间和动作变化的规律，而传统模块通常把感知、预测、规划拆开优化。它的优势是可以在统一表示里做反事实推演，例如如果机器人这样抓、车这样变道，未来会发生什么；也能用仿真式 rollout 支持策略搜索和数据增强。风险在于模型误差会沿时间累积，分布外场景可能生成看似合理但错误的未来，闭环规划还可能利用 reward 漏洞。回答时可以对比：感知预测规划链路更可解释、边界更清楚；世界模型更适合长程交互和策略评估，但需要不确定性、失败检测、真实闭环评测和安全约束兜底。",
    ],
  },
  {
    id: "replace-autodrive-data-20260615",
    oldTitle: "蔚来VLA具身智能题目精讲",
    oldDate: "2026-06-13 12:06",
    title: "自动驾驶数据闭环题目精讲",
    company: "综合专题",
    direction: "自动驾驶 / 世界模型",
    sourcePlatform: "Interview Hub 题库专题",
    sourceUrl: "https://zhaojinlong-123.github.io/interview-hub/",
    questions: [
      "自动驾驶数据筛选时，如何识别 corner case、near miss、接管片段和标注不确定样本？",
      "多传感器数据中，相机、激光雷达、毫米波雷达、定位和车控状态如何做时间空间对齐？",
    ],
    answers: [
      "自动驾驶数据筛选不是随机抽样，而是围绕高价值片段做闭环。corner case 可以从感知低置信度、预测分歧、规划急刹急转、规则冲突、罕见天气和异常交通参与者中挖掘；near miss 看 TTC、最小距离、急刹、接管前后轨迹和安全员干预；接管片段要标出接管原因、接管前模型输出、人工修正动作和是否可恢复；标注不确定样本则来自多标注员分歧、模型 ensemble 分歧、遮挡严重和传感器缺失。好答案要强调优先级：先用自动规则和模型分数召回，再聚类去重，最后人工复核和回流训练。指标看长尾覆盖率、重复率、标注一致性、线上问题复现率和回流后 badcase 修复率。",
      "多传感器对齐要同时做时间对齐和空间标定。时间上，每路传感器都有 timestamp，常以主相机或融合时间轴为基准，对激光雷达点云、毫米波雷达目标、定位姿态、车速和控制信号做插值或最近邻匹配；高速运动场景还要做运动补偿，否则点云和图像会错位。空间上，需要外参把不同传感器统一到车体坐标系或世界坐标系，再投影到 BEV 或图像平面。工程难点包括时钟漂移、丢帧、曝光延迟、滚动快门、外参松动和定位跳变。面试里可以用一句话收束：对齐质量决定融合上限，必须用重投影误差、时序残差、动态目标一致性和线上 badcase 来持续校验。",
    ],
  },
  {
    id: "replace-multimodal-multiimage-20260615",
    oldTitle: "字节多模态大模型题目精讲",
    oldDate: "2026-06-13 12:14",
    title: "多图多轮视觉问答题目精讲",
    company: "字节",
    direction: "多模态大模型",
    sourcePlatform: "知乎",
    sourceUrl: "https://zhuanlan.zhihu.com/p/2014314780802967473",
    questions: [
      "多图理解任务中，如何保证跨图实体一致性、顺序理解和比较推理能力？",
      "VLM 产生视觉幻觉的常见原因有哪些，数据、模型和解码侧分别怎么缓解？",
    ],
    answers: [
      "多图理解的关键不是把几张图简单拼接，而是让模型知道每张图的身份、顺序和引用关系。输入侧通常给每张图加 image id、位置标记或时间顺序标记，避免模型把不同图里的实体混在一起；表示侧可以用共享 vision encoder，再通过 cross-attention 或多图 memory 做融合；推理侧要显式处理比较、变化检测、跨图指代和多轮上下文。评估时要单独看跨图实体一致性、图间顺序理解、差异比较、引用定位和多轮追问稳定性。面试回答可以强调：多图任务最怕图像引用错位，所以数据构造和评测都要包含“第几张图”“上一张图中的对象”“两图差异”这类强约束问题。",
      "VLM 幻觉常见原因有四类：数据侧图文不匹配、caption 模板化、OCR 泄漏或评测集污染；模型侧视觉 token 被过度压缩，LLM 语言先验压过视觉证据；训练侧指令微调偏向迎合用户，缺少拒答和不确定性样本；解码侧温度过高或没有视觉一致性约束。缓解也要分层：数据上做图文一致性过滤、困难负样本和区域级标注；模型上增强 grounding、区域引用和高分辨率细节；训练上加入偏好对齐与不确定性表达；推理上降低温度、要求引用视觉证据，必要时做检测/OCR 工具校验。好的回答要落到指标：hallucination rate、grounding accuracy、OCR 准确率、区域问答和人工 badcase 复测。",
    ],
  },
];

function splitText(text, limit = 185) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  const chunks = [];
  let rest = value;
  while (rest.length > limit) {
    let cut = Math.max(rest.lastIndexOf("。", limit), rest.lastIndexOf("；", limit), rest.lastIndexOf("，", limit));
    if (cut < limit * 0.55) cut = limit;
    chunks.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function buildCards(item) {
  const cards = [
    {
      kind: "cover",
      kicker: "面试题目",
      title: item.title,
      body: `公司：${item.company}\n方向：${item.direction}\n题目：${item.questions[0]}`,
      footer: "第一页先看公司 / 方向 / 题目",
    },
    {
      kind: "questions",
      kicker: "本篇问题",
      title: "今天重点看这几题",
      body: item.questions.map((question, index) => `${index + 1}. ${question}`).join("\n\n"),
      footer: "后面按顺序给完整回答",
    },
  ];
  item.questions.forEach((question, index) => {
    splitText(item.answers[index], 180).forEach((body, chunkIndex, chunks) => {
      cards.push({
        kind: "answer",
        kicker: chunks.length > 1 ? `详细回答 ${index + 1}-${chunkIndex + 1}` : `详细回答 ${index + 1}`,
        title: question,
        body,
        footer: "机制 -> 取舍 -> 工程指标",
      });
    });
  });
  return cards;
}

function escapePs(value) {
  return String(value).replace(/`/g, "``").replace(/"/g, '`"');
}

async function render(item) {
  const dir = path.join(OUT_DIR, item.id);
  await fs.mkdir(dir, { recursive: true });
  const cards = buildCards(item).map((card, index, all) => ({
    ...card,
    index: index + 1,
    total: all.length,
    file: path.join(dir, `${String(index + 1).padStart(2, "0")}-${card.kind}.png`),
  }));
  await fs.writeFile(path.join(dir, "cards.json"), JSON.stringify(cards, null, 2), "utf8");
  await fs.writeFile(path.join(dir, "post.json"), JSON.stringify({
    ...item,
    body: [
      `每日精选：${item.company} ${item.direction}题目精讲。`,
      "本篇图卡包含：面试题目、完整解答、追问方向。第一页先看公司、方向、题目，后面按顺序复习答案。",
      `引用来源：${item.sourcePlatform}`,
      `原文链接：${item.sourceUrl}`,
      "#面经 #大模型面试 #AI学习 #多模态 #VLA #世界模型 #视频理解",
    ].join("\n"),
    imageFiles: cards.map((card) => path.relative(ROOT, card.file).replaceAll("\\", "/")),
  }, null, 2), "utf8");

  const ps = `
Add-Type -AssemblyName System.Drawing
$jsonPath = "${escapePs(path.join(dir, "cards.json"))}"
$cards = Get-Content -LiteralPath $jsonPath -Encoding UTF8 | ConvertFrom-Json
function Draw-Card($card) {
  $bmp = New-Object System.Drawing.Bitmap 1080, 1440
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle 0,0,1080,1440),
    [System.Drawing.Color]::FromArgb(5,14,26),
    [System.Drawing.Color]::FromArgb(11,42,48),
    42
  )
  $g.FillRectangle($bg, 0, 0, 1080, 1440)
  $linePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(70, 92, 255, 229)), 2
  for ($i = 0; $i -lt 9; $i++) {
    $y = 180 + $i * 125
    $g.DrawLine($linePen, 90, $y, 990, $y + 26)
  }
  $cyan = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 92, 255, 229))
  $green = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 102, 255, 194))
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(246, 246, 250, 255))
  $muted = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(225, 181, 211, 232))
  $panel = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(86, 7, 18, 28))
  $accent = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(215, 92, 255, 229)), 3
  $fontKicker = New-Object System.Drawing.Font "Microsoft YaHei UI", 34, ([System.Drawing.FontStyle]::Bold)
  $fontTitle = New-Object System.Drawing.Font "Microsoft YaHei UI", 43, ([System.Drawing.FontStyle]::Bold)
  $fontBody = New-Object System.Drawing.Font "Microsoft YaHei UI", 30, ([System.Drawing.FontStyle]::Regular)
  $fontFooter = New-Object System.Drawing.Font "Microsoft YaHei UI", 24, ([System.Drawing.FontStyle]::Bold)
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = [System.Drawing.StringAlignment]::Near
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Near
  $fmt.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
  $g.FillRectangle($panel, 90, 150, 900, 1060)
  $g.DrawRectangle($accent, 90, 150, 900, 1060)
  $g.DrawString([string]$card.kicker, $fontKicker, $cyan, (New-Object System.Drawing.RectangleF 130, 200, 820, 70), $fmt)
  $g.DrawString([string]$card.title, $fontTitle, $white, (New-Object System.Drawing.RectangleF 130, 310, 820, 250), $fmt)
  $g.DrawString([string]$card.body, $fontBody, $muted, (New-Object System.Drawing.RectangleF 130, 590, 820, 570), $fmt)
  $g.DrawString([string]$card.footer, $fontFooter, $green, (New-Object System.Drawing.RectangleF 130, 1230, 650, 72), $fmt)
  $g.DrawString(("{0}/{1}" -f $card.index, $card.total), $fontFooter, $cyan, (New-Object System.Drawing.RectangleF 840, 1235, 120, 60), $fmt)
  $g.Dispose()
  $bmp.Save([string]$card.file, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
foreach ($card in $cards) { Draw-Card $card }
`;
  execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], { stdio: "inherit" });
  return { id: item.id, files: cards.map((card) => card.file) };
}

const results = [];
for (const item of replacements) {
  results.push(await render(item));
}
console.log(JSON.stringify(results, null, 2));
