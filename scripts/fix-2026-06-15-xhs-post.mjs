import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POST_ID = "auto-20260614-94c21883b138";
const QUEUE_ID = "xhs-daily-2026-06-15-680ffa613f61";
const FEATURE_ID = "daily-2026-06-15-680ffa613f61";
const ASSET_ID = "xhs-daily-2026-06-15-680ffa613f61";
const ASSET_DIR = path.join(ROOT, "content", "xiaohongshu-assets", ASSET_ID);
const SOURCE_URL = "https://www.xiaohongshu.com/explore/6a2cd7840000000015024480?xsec_token=ABph78W1r_ZHk8bqDtoizWXOd456YhxOU55Eab6_ooDKc%3D&xsec_source=pc_search";

const questions = [
  "具身智能任务中，episode 如何切分，成功、失败、中断和人为接管如何标注？",
  "VLA 系统如何从 imitation learning 过渡到在线强化学习并控制安全风险？",
  "sim-to-real 中，视觉随机化、动力学随机化和真实少样本微调分别解决什么问题？",
  "长程具身任务如何处理记忆、子目标分解、环境变化和动作不可逆错误？",
  "具身智能评估为什么不能只看成功率，还需要哪些安全性和泛化指标？",
];

const answers = [
  "episode 切分要围绕任务语义和控制连续性，而不是机械按固定时长切。一次 episode 通常从任务指令下发、机器人进入初始状态或人工开始遥操作时开始，到任务完成、失败、超时、中断或人为接管时结束。标注时至少记录起止时间、任务目标、关键阶段、动作轨迹、观察流、成功状态和终止原因。成功样本要标注是否完全达成目标、是否有轻微碰撞或多余动作；失败样本要标注失败发生点、失败类型、是否可恢复、是否由感知、规划、控制或环境变化导致；中断样本要区分系统异常、传感器丢失、用户暂停和安全策略触发；人为接管要记录接管时刻、接管前模型输出、人工修正动作和接管原因。这样做的价值是后续可以训练策略、失败检测、恢复策略和 reward/critic，而不是只得到一个粗糙的成功率。",
  "从 imitation learning 过渡到在线强化学习，通常不能直接把策略放到真实环境里自由探索。更稳的路径是先用高质量遥操作或人类演示训练 BC/SFT 策略，再用离线 RL、偏好数据或仿真环境做策略改进，最后在真实环境中做受限在线探索。安全风险控制要有几层保护：动作空间限幅、速度/力矩/碰撞约束、安全区域和规则过滤器；策略侧保留不确定性估计、异常检测和可回退的保守策略；数据侧把 near miss、接管、碰撞和失败恢复样本纳入训练；评估侧先过仿真、离线 replay、影子模式和小流量灰度。面试时要强调在线 RL 的收益是优化长期目标和恢复能力，但代价是安全、样本效率和分布漂移，因此必须用 human-in-the-loop 和安全 shield 逐步放开。",
  "视觉随机化、动力学随机化和真实少样本微调解决的是 sim-to-real gap 的不同来源。视觉随机化改变纹理、光照、背景、相机位姿、噪声和遮挡，让视觉 encoder 不依赖仿真里的固定外观，主要提升感知鲁棒性。动力学随机化改变质量、摩擦、关节阻尼、延迟、执行器噪声和接触参数，让策略适应真实物理误差，主要提升控制和接触操作稳定性。真实少样本微调用少量真实机器人数据校准仿真学到的策略或表征，弥补随机化覆盖不到的系统偏差。好的回答要补充取舍：随机化太弱会过拟合仿真，太强会让训练任务不稳定；真实微调数据少但价值高，要优先采集失败、接触、遮挡和边界工况，并用成功率、碰撞率、恢复率和跨场景泛化来评估。",
  "长程具身任务要把高层规划和低层控制分开处理。高层用语言或视觉语言模型做任务分解，把目标拆成可执行子目标，并维护环境状态、已完成步骤、物体位置和历史失败；低层用 VLA policy、diffusion policy 或控制器执行抓取、移动、放置等短程技能。环境变化需要持续重感知和状态更新，不能只依赖初始计划；动作不可逆错误要提前做风险评估，比如倒水、碰撞、丢物体、关门后无法再观察等步骤要设置确认、回退或人工接管。记忆可以分成短期上下文、场景地图、对象状态和任务日志。评估不能只看最终成功，还要看子目标成功率、重规划次数、无效动作比例、错误恢复率、任务时长和安全事件。",
  "具身智能不能只看成功率，因为同样成功可能对应完全不同的安全性、效率和泛化能力。一个策略可能 90% 成功，但剩下 10% 是高风险碰撞或不可恢复错误，这在线上不可接受。除了成功率，还要看碰撞率、接管率、near miss、力/速度越界、任务完成时间、轨迹平滑度、能耗、恢复成功率、失败类型分布和长尾场景覆盖。泛化指标要覆盖新物体、新背景、新光照、新相机位姿、新任务组合和不同机器人平台。对于 VLA/具身系统，还要评估语言指令理解、视觉 grounding、动作可执行性、跨 episode 一致性和安全约束遵守率。面试里可以总结为：成功率回答“能不能做成”，安全和泛化指标回答“能不能稳定、低风险、可规模化地做成”。",
];

function readJson(file) {
  return fs.readFile(file, "utf8").then(JSON.parse);
}

async function writeJson(file, value) {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function keyFor(question, index) {
  const prefix = ["episode", "online_rl", "sim2real", "long_horizon", "embodied_eval"][index] || "embodied";
  return `${prefix}:${Buffer.from(question).toString("hex").slice(0, 12)}`;
}

function buildCards(queueItem) {
  const qaCards = questions.map((question, index) => ({
    kind: "answer",
    kicker: `详细解答 ${index + 1}`,
    title: question,
    body: answers[index],
    footer: "机制 -> 工程取舍 -> 风险 -> 指标",
  }));
  return [
    {
      kind: "cover",
      kicker: "本篇速览",
      title: "字节｜VLA / 具身智能",
      body: `公司：字节\n方向：VLA / 具身智能\n题目：${questions[0]}`,
      footer: "Interview Hub · 面试题精讲",
    },
    {
      kind: "questions",
      kicker: "面试题目",
      title: "今天重点看这几题",
      body: questions.map((question, index) => `${index + 1}. ${question}`).join("\n\n"),
      footer: "先能 30 秒讲清楚，再展开细节",
    },
    ...qaCards,
  ].map((card, index, all) => ({
    ...card,
    index: index + 1,
    total: all.length,
    file: path.join(ASSET_DIR, `${String(index + 1).padStart(2, "0")}-${card.kind}.png`),
  }));
}

function buildBody() {
  return [
    "每日精选：字节｜VLA / 具身智能题目精讲",
    "",
    "本篇重点拆解 episode 标注、在线 RL 安全、sim-to-real、长程任务和具身评估。第一页先看公司、方向、题目，后面按顺序给出详细回答。",
    "",
    "引用来源：小红书，2026-06-14",
    `原文链接：${SOURCE_URL}`,
    "",
    "#小红书 #字节 #VLA #具身智能 #机器人数据 #大模型面试 #AI学习",
  ].join("\n");
}

function buildMarkdown() {
  return `# 每日精选面试题精讲：字节｜VLA / 具身智能

## 面试题目
${questions.map((question, index) => `${index + 1}. ${question}`).join("\n")}

## 逐题解答
${questions.map((question, index) => `### 题目 ${index + 1}：${question}

${answers[index]}`).join("\n\n")}

## 面经信息
- 公司：字节
- 方向：VLA / 具身智能
- 来源：小红书 2026-06-14
- 原始链接：${SOURCE_URL}

## 小红书发布文案
${buildBody()}
`;
}

function escapePs(value) {
  return String(value || "").replace(/`/g, "``").replace(/"/g, '`"');
}

async function renderCards(cards) {
  await fs.mkdir(ASSET_DIR, { recursive: true });
  const jsonFile = path.join(ASSET_DIR, "cards.json");
  await fs.writeFile(jsonFile, JSON.stringify(cards, null, 2), "utf8");
  const ps = `
Add-Type -AssemblyName System.Drawing
$jsonPath = "${escapePs(jsonFile)}"
$cards = Get-Content -LiteralPath $jsonPath -Encoding UTF8 | ConvertFrom-Json
function Draw-WrappedText($g, $text, $font, $brush, $x, $y, $w, $h) {
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = [System.Drawing.StringAlignment]::Near
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Near
  $fmt.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
  $rect = New-Object System.Drawing.RectangleF $x, $y, $w, $h
  $g.DrawString([string]$text, $font, $brush, $rect, $fmt)
}
foreach ($card in $cards) {
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
  $fontTitle = New-Object System.Drawing.Font "Microsoft YaHei UI", 40, ([System.Drawing.FontStyle]::Bold)
  $fontBody = New-Object System.Drawing.Font "Microsoft YaHei UI", 27, ([System.Drawing.FontStyle]::Regular)
  $fontFooter = New-Object System.Drawing.Font "Microsoft YaHei UI", 24, ([System.Drawing.FontStyle]::Bold)
  $g.FillRectangle($panel, 90, 150, 900, 1060)
  $g.DrawRectangle($accent, 90, 150, 900, 1060)
  $g.DrawString([string]$card.kicker, $fontKicker, $green, 130, 205)
  Draw-WrappedText $g ([string]$card.title) $fontTitle $white 130 315 820 170
  Draw-WrappedText $g ([string]$card.body) $fontBody $muted 130 535 820 565
  $g.DrawString([string]$card.footer, $fontFooter, $green, 130, 1250)
  $g.DrawString(("{0}/{1}" -f $card.index, $card.total), $fontFooter, $green, 895, 1250)
  $g.Dispose()
  $bmp.Save([string]$card.file, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
`;
  execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], { cwd: ROOT, stdio: "inherit" });
}

async function main() {
  const postsPath = path.join(ROOT, "data", "posts.json");
  const queuePath = path.join(ROOT, "data", "publish-queue.json");
  const dailyPath = path.join(ROOT, "data", "daily-features.json");
  const registryPath = path.join(ROOT, "data", "published-question-registry.json");
  const posts = await readJson(postsPath);
  const queue = await readJson(queuePath);
  const daily = await readJson(dailyPath);
  const registry = await readJson(registryPath);

  const post = posts.find((item) => item.id === POST_ID);
  if (!post) throw new Error(`post not found: ${POST_ID}`);
  post.sourceUrl = SOURCE_URL;
  post.questions = questions;
  post.questionAnswers = questions.map((question, index) => ({
    key: keyFor(question, index),
    question,
    answer: answers[index],
    answerStatus: "verified",
    updatedAt: new Date().toISOString(),
  }));

  const body = buildBody();
  const cards = buildCards();
  const queueItem = queue.find((item) => item.id === QUEUE_ID);
  if (!queueItem) throw new Error(`queue not found: ${QUEUE_ID}`);
  Object.assign(queueItem, {
    title: "字节具身智能任务题目精讲",
    primaryQuestion: questions[0],
    topic: "具身智能任务",
    body,
    sourceUrl: SOURCE_URL,
    sourcePlatform: "小红书",
    sourceDate: "2026-06-14",
    imageCards: cards.map(({ file, ...card }) => card),
    imageCardFiles: cards.map((card) => path.relative(ROOT, card.file).replaceAll("\\", "/")),
    coverImage: path.relative(ROOT, cards[0].file).replaceAll("\\", "/"),
    updatedAt: new Date().toISOString(),
  });

  const dailyItem = daily.find((item) => item.id === FEATURE_ID);
  if (dailyItem) dailyItem.sourceUrl = SOURCE_URL;

  for (const item of registry) {
    if (item.queueId === QUEUE_ID) {
      const index = questions.indexOf(item.question);
      if (index >= 0) {
        item.key = keyFor(item.question, index);
        item.title = queueItem.title;
        item.sourceUrl = SOURCE_URL;
        item.updatedAt = new Date().toISOString();
      }
    }
  }

  await writeJson(postsPath, posts);
  await writeJson(queuePath, queue);
  await writeJson(dailyPath, daily);
  await writeJson(registryPath, registry);
  await fs.writeFile(path.join(ROOT, "content", "xiaohongshu-drafts", "2026-06-15-680ffa613f61.md"), buildMarkdown(), "utf8");
  await renderCards(cards);
  console.log(JSON.stringify({ fixed: QUEUE_ID, sourceUrl: SOURCE_URL, imageCount: cards.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
