import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const OUT_DIR = path.join(ROOT, "content", "xiaohongshu-edit-assets");

const items = [
  {
    id: "compliance-embodied-data-20260615",
    onlineTitle: "字节具身智能任务题目精讲",
    title: "具身数据标注题目精讲",
    company: "综合",
    direction: "VLA / 具身智能",
    sourcePlatform: "GitHub / OpenVLA",
    sourceUrl: "https://github.com/openvla/openvla",
    questions: [
      "VLA 训练数据中，语言指令、视觉观测和动作轨迹如何组织成可训练样本？",
      "机器人数据为什么要标注成功、失败、接管和终止原因？这些标签分别服务哪些模型能力？",
    ],
    answers: [
      "VLA 样本通常要把任务语言、视觉观测和动作序列放在同一个时间轴上。语言指令描述目标，视觉观测提供 RGB/RGB-D、腕部相机或多视角上下文，动作轨迹记录末端位姿、关节角、速度、夹爪状态或离散动作 token。训练时可以做行为克隆、动作预测或多步轨迹预测，但核心是保证观测和动作严格对齐：图像帧、机器人本体状态和动作命令要按 timestamp 对齐，不能把失败后的重试轨迹混成一条成功样本。工程上还要保存 episode id、任务阶段、起止时间和采集设备版本，方便后续做去重、质检和失败样本回流。",
      "成功/失败/接管/终止原因不是简单统计字段，而是训练闭环的重要监督信号。成功标签用于衡量策略是否真正达成目标；失败标签能训练失败检测、恢复策略和 hard negative；接管标签记录模型在什么状态下不可靠，可用于偏好学习、安全策略和人工接管预测；终止原因区分任务完成、超时、碰撞、传感器异常、用户中断和安全规则触发。没有这些标签，模型只能学到平均动作，难以知道哪些动作危险、哪些失败可恢复，也无法把线上 badcase 精确回流到数据和 reward/critic 训练中。",
    ],
  },
  {
    id: "compliance-training-memory-20260615",
    onlineTitle: "字节训练框架/显存优化题目精讲",
    title: "训练显存优化题目精讲",
    company: "综合",
    direction: "训练框架 / 显存优化",
    sourcePlatform: "CSDN",
    sourceUrl: "https://blog.csdn.net/libaiup/article/details/152087779",
    questions: [
      "大模型训练显存如何拆解到参数、梯度、优化器状态、激活值和临时 buffer？",
      "ZeRO、gradient checkpointing、混合精度和 offload 分别减少哪一部分显存？",
    ],
    answers: [
      "训练显存一般可以拆成五块：参数、梯度、优化器状态、激活值和临时 buffer。参数显存和模型规模、精度直接相关；梯度通常与参数同量级；Adam 优化器会保存一阶和二阶矩，显存经常比参数本身还大；激活值随 batch size、序列长度和层数增长，在长上下文训练中很容易成为瓶颈；临时 buffer 来自 attention、中间矩阵和通信缓存。面试时最好不要只说“显存不够用 ZeRO”，而要先说明是哪一块显存爆了，再选择对应手段。",
      "ZeRO 主要切分优化器状态、梯度和参数，让这些状态分布在多卡上；gradient checkpointing 不保存全部激活值，通过反向时重算前向来省激活显存，代价是训练时间增加；混合精度把部分参数、激活和梯度从 FP32 降到 BF16/FP16，降低显存和带宽压力，但要处理数值稳定；offload 把优化器状态或参数迁移到 CPU/NVMe，适合显存极紧张场景，代价是通信和 IO 延迟。好的回答要把节省对象、代价和适用场景一一对应。",
    ],
  },
  {
    id: "compliance-video-understanding-20260615",
    onlineTitle: "VLA/机器人动作题目精讲",
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
      "视频理解不能只看单帧问答准确率，要拆成时序一致性、动作理解、事件边界和身份保持几类能力。时序一致性看模型是否理解先后顺序和因果关系；动作理解看是否识别动作类别、动作对象和动作变化；事件边界看能否定位开始、结束和关键转折点；身份保持看跨镜头、遮挡和长视频中人物或物体是否被混淆。工程评估要报告采样帧数、视频长度、token 预算、延迟和显存，因为很多视频模型失败不是不会看图，而是关键帧没被保留或时序信息被压缩掉。",
      "temporal token 压缩的目标是把大量帧 token 变成少量高信息密度的时序 token。常见做法包括时间窗口池化、关键帧选择、query token 汇聚、运动显著性筛选和片段级摘要。它的优点是显著降低长视频 attention 成本，让模型能处理更长上下文；代价是短暂动作、细粒度事件和跨帧身份变化容易被压掉。短视频细粒度动作识别更适合保留更多帧和局部 token，长视频问答、检索和摘要更适合先压缩成片段记忆，再做跨片段推理。",
    ],
  },
  {
    id: "compliance-multi-image-vlm-20260615",
    onlineTitle: "多图多轮视觉问答题目精讲",
    title: "多图多轮视觉问答题目精讲",
    company: "综合",
    direction: "多模态大模型",
    sourcePlatform: "知乎专栏",
    sourceUrl: "https://zhuanlan.zhihu.com/p/2014314780802967473",
    questions: [
      "多图理解任务中，如何保证跨图实体一致性、顺序理解和比较推理能力？",
      "VLM 产生视觉幻觉的常见原因有哪些，数据、模型和解码侧分别怎么缓解？",
    ],
    answers: [
      "多图理解不是把几张图简单拼接，而是要让模型知道每张图的身份、顺序和引用关系。输入侧可以给每张图增加 image id、位置标记或时间顺序标记；表示侧使用共享 vision encoder，再通过 cross-attention、多图 memory 或图间关系模块融合；推理侧要显式处理比较、变化检测、跨图指代和多轮上下文。评估时要单独看跨图实体一致性、图间顺序理解、差异比较、引用定位和多轮追问稳定性，否则模型很容易把不同图片里的对象混在一起。",
      "VLM 幻觉常来自四层：数据侧图文不匹配、caption 模板化、OCR 泄漏或评测集污染；模型侧视觉 token 被过度压缩，LLM 语言先验压过视觉证据；训练侧指令微调偏向迎合用户，缺少拒答和不确定性样本；解码侧温度过高或没有视觉一致性约束。缓解也要分层：数据清洗和困难负样本、区域级 grounding、加入不确定性表达、降低解码温度、要求引用视觉证据，并用 hallucination rate、grounding accuracy、OCR 准确率和人工 badcase 复测来验证。",
    ],
  },
  {
    id: "compliance-world-model-planning-20260615",
    onlineTitle: "世界模型规划题目精讲",
    title: "世界模型规划题目精讲",
    company: "综合",
    direction: "世界模型",
    sourcePlatform: "51CTO",
    sourceUrl: "https://www.51cto.com/article/820298.html",
    questions: [
      "世界模型训练中，latent dynamics、reward model 和 rollout horizon 如何影响规划效果？",
      "世界模型和传统感知-预测-规划链路相比，优势和风险分别是什么？",
    ],
    answers: [
      "latent dynamics 决定模型在隐空间里如何预测下一步状态，既要压缩又不能丢掉和控制相关的几何、速度、接触和物体关系。reward model 决定什么轨迹算好，如果 reward 太短视会贪心，太稀疏会让长程规划不稳定。rollout horizon 决定向未来展开多远：短 horizon 稳但容易短视，长 horizon 能看长期收益但误差会累积。工程上通常用多步预测损失、latent consistency、不确定性估计和闭环评测约束世界模型，而不是只看生成画面质量。",
      "传统链路把感知、预测和规划拆开优化，边界清楚、可解释性强；世界模型试图学习环境随动作和时间变化的统一表示，能做反事实推演和闭环策略搜索。优势是更适合长程交互、仿真 rollout 和数据增强；风险是模型误差沿时间累积，分布外场景可能生成看似合理但错误的未来，规划器还可能利用 reward 漏洞。面试回答要强调安全兜底：不确定性估计、失败检测、真实闭环评测和规则约束缺一不可。",
    ],
  },
  {
    id: "compliance-ali-multimodal-20260615",
    onlineTitle: "阿里多模态大模型题目精讲",
    title: "多模态连接层题目精讲",
    company: "阿里",
    direction: "多模态大模型",
    sourcePlatform: "掘金",
    sourceUrl: "https://juejin.cn/post/7546495958554755098",
    questions: [
      "Vision encoder 输出如何与 LLM token 空间对齐？Linear projector、Q-Former、cross-attention adapter 的差异是什么？",
      "图文/视频指令微调数据如何构造，如何控制噪声、偏见和 OCR 泄漏？",
    ],
    answers: [
      "视觉 encoder 先把图像或视频变成视觉 token，连接层再把这些 token 映射到 LLM 能理解的语义空间。Linear projector 简单高效，适合视觉 token 和语言空间差距不大、追求低成本的场景；Q-Former 用少量可学习 query 从视觉特征中抽取信息，能压缩 token，但可能丢细节；cross-attention adapter 交互更充分，适合复杂 grounding 和多轮视觉任务，但计算更贵。回答时要补充训练目标：图文对齐、指令微调、grounding、OCR 和幻觉评估。",
      "图文/视频指令数据通常来自 caption、VQA、OCR、检测框、人工标注和合成指令。构造时要先覆盖任务类型，再控制质量：去重、过滤模板化答案、隔离评测集、加入困难负样本，并检查图文是否匹配。OCR 泄漏会让模型通过文字捷径答题，低质量 caption 会让模型学到套话，标注偏见会放大错误关联。工程闭环要包含来源、清洗、标注、质量打分、负样本、评测隔离和线上 badcase 回流。",
    ],
  },
  {
    id: "compliance-openvla-action-20260615",
    onlineTitle: "字节VLA具身智能题目精讲",
    title: "VLA动作表示题目精讲",
    company: "综合",
    direction: "VLA / 具身智能",
    sourcePlatform: "GitHub / OpenVLA",
    sourceUrl: "https://github.com/openvla/openvla",
    questions: [
      "VLA 中 action token、连续动作回归和 diffusion policy 各自适合什么控制场景？",
      "VLA 系统如何在语言规划、视觉 grounding 和低层控制之间分层？",
    ],
    answers: [
      "action token 是把动作离散成 token，让 VLA 像生成语言一样生成技能或离散动作，适合高层规划、技能选择和跨任务统一动作词表；连续动作回归直接输出关节角、末端位姿、速度或夹爪开合，适合低层实时控制、抓取对齐、插孔等精细操作；diffusion policy 生成一段连续动作轨迹，适合多解、轨迹平滑和模仿学习数据分布复杂的任务。核心取舍是：token 更利于统一建模和长程推理，回归更实时，diffusion 更能表达多峰动作但推理成本更高。",
      "VLA 系统通常可以分成三层：语言规划层理解任务目标并拆成子目标；视觉 grounding 层把语言中的对象、位置和状态落到图像或场景表示上；低层控制层把目标转成可执行动作。分层的好处是可解释、可调试，也便于在不同层加入安全约束；风险是层间误差会传递，例如 grounding 错了会导致控制再精准也执行错对象。面试时要讲清楚每层输入输出、失败模式和评估指标：语言成功率、grounding accuracy、动作成功率、碰撞率和接管率。",
    ],
  },
  {
    id: "compliance-autodrive-data-20260615",
    onlineTitle: "自动驾驶数据闭环题目精讲",
    title: "自动驾驶数据闭环题目精讲",
    company: "综合",
    direction: "自动驾驶 / 世界模型",
    sourcePlatform: "51CTO",
    sourceUrl: "https://www.51cto.com/article/821686.html",
    questions: [
      "自动驾驶数据筛选时，如何识别 corner case、near miss、接管片段和标注不确定样本？",
      "多传感器数据中，相机、激光雷达、毫米波雷达、定位和车控状态如何做时间空间对齐？",
    ],
    answers: [
      "自动驾驶数据筛选不是随机抽样，而是围绕高价值片段做闭环。corner case 可以从感知低置信度、预测分歧、规划急刹、规则冲突、罕见天气和异常交通参与者中挖掘；near miss 看 TTC、最小距离、急刹、接管前后轨迹和安全员干预；接管片段要标出接管原因、接管前模型输出、人工修正动作和是否可恢复；标注不确定样本来自多标注员分歧、模型 ensemble 分歧、遮挡严重和传感器缺失。最后要聚类去重、人工复核并回流训练。",
      "多传感器对齐要同时处理时间对齐和空间标定。时间上，每路传感器都有 timestamp，常以主相机或融合时间轴为基准，对点云、雷达目标、定位姿态、车速和控制信号做插值或最近邻匹配，高速运动场景还要做运动补偿。空间上，需要外参把不同传感器统一到车体坐标系或世界坐标系，再投影到 BEV 或图像平面。难点包括时钟漂移、丢帧、曝光延迟、外参松动和定位跳变，必须用重投影误差、动态目标一致性和线上 badcase 持续校验。",
    ],
  },
  {
    id: "compliance-inference-kvcache-20260615",
    onlineTitle: "字节训练框架推理优化题目精讲",
    title: "推理部署KVCache题目精讲",
    company: "综合",
    direction: "推理部署 / 模型压缩",
    sourcePlatform: "CSDN",
    sourceUrl: "https://blog.csdn.net/libaiup/article/details/152087779",
    questions: [
      "KV cache、PagedAttention、continuous batching 和 speculative decoding 如何提升推理吞吐？",
      "INT8/INT4 量化、AWQ/GPTQ、LoRA 合并和蒸馏分别适合哪些部署场景？",
    ],
    answers: [
      "KV cache 避免每次生成都重复计算历史 token 的 K/V，是自回归推理的基础优化；PagedAttention 像分页内存一样管理 KV cache，减少碎片并提高并发；continuous batching 让不同请求动态进入 batch，降低空等并提高吞吐；speculative decoding 用小模型先草拟、大模型验证，减少平均解码成本。面试回答要区分 prefill 和 decode：prefill 更像大矩阵并行计算，decode 更受 KV cache、调度和单 token 延迟影响。",
      "INT8/INT4 量化降低权重或激活精度，减少显存和带宽压力；GPTQ 偏离线权重量化，适合部署前压缩；AWQ 保护重要通道，通常更关注推理质量；LoRA 合并适合把微调增量合入基座模型，减少线上 adapter 分支；蒸馏适合把大模型能力迁移到小模型，降低成本和延迟。取舍是：量化可能损伤长尾能力，蒸馏依赖 teacher 和数据质量，LoRA 合并后不如多 adapter 灵活。上线前要对核心任务、长上下文、代码数学和安全拒答做回归测试。",
    ],
  },
];

function splitText(text, limit = 190) {
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

function cardsFor(item) {
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
  item.questions.forEach((question, questionIndex) => {
    splitText(item.answers[questionIndex]).forEach((body, chunkIndex, chunks) => {
      cards.push({
        kind: "answer",
        kicker: chunks.length > 1 ? `详细回答 ${questionIndex + 1}-${chunkIndex + 1}` : `详细回答 ${questionIndex + 1}`,
        title: question,
        body,
        footer: "机制 -> 取舍 -> 工程指标",
      });
    });
  });
  return cards;
}

function escapePs(value) {
  return String(value || "").replace(/`/g, "``").replace(/"/g, '`"');
}

async function renderItem(item) {
  const dir = path.join(OUT_DIR, item.id);
  await fs.mkdir(dir, { recursive: true });
  const cards = cardsFor(item).map((card, index, all) => ({
    ...card,
    index: index + 1,
    total: all.length,
    file: path.join(dir, `${String(index + 1).padStart(2, "0")}-${card.kind}.png`),
  }));
  await fs.writeFile(path.join(dir, "cards.json"), JSON.stringify(cards, null, 2), "utf8");
  await fs.writeFile(path.join(dir, "post.json"), JSON.stringify({
    id: item.id,
    title: item.title,
    onlineTitle: item.onlineTitle,
    body: [
      `每日精选：${item.company}｜${item.direction}题目精讲`,
      "",
      "本篇图卡包含：面试题目、完整解答、追问方向。第一页先看公司、方向、题目，后面按顺序复习答案。",
      "",
      `引用来源：${item.sourcePlatform}`,
      `原文链接：${item.sourceUrl}`,
      "",
      "#面经 #大模型面试 #AI学习 #多模态 #VLA #世界模型 #视频理解",
    ].join("\n"),
    imageFiles: cards.map((card) => path.relative(ROOT, card.file).replaceAll("\\", "/")),
    sourcePlatform: item.sourcePlatform,
    sourceUrl: item.sourceUrl,
    questions: item.questions,
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
    [System.Drawing.Color]::FromArgb(10,42,48),
    42
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
  $muted = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(225, 181, 211, 232))
  $panel = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(86, 7, 18, 28))
  $accent = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(215, 92, 255, 229)), 3
  $fontKicker = New-Object System.Drawing.Font "Microsoft YaHei UI", 34, ([System.Drawing.FontStyle]::Bold)
  $fontTitle = New-Object System.Drawing.Font "Microsoft YaHei UI", 42, ([System.Drawing.FontStyle]::Bold)
  $fontBody = New-Object System.Drawing.Font "Microsoft YaHei UI", 29, ([System.Drawing.FontStyle]::Regular)
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
  return { id: item.id, title: item.title, imageCount: cards.length };
}

const results = [];
for (const item of items) {
  results.push(await renderItem(item));
}
console.log(JSON.stringify(results, null, 2));
