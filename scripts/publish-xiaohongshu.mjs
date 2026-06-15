import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POSTS_FILE = path.join(ROOT, "data", "posts.json");
const FEATURES_FILE = path.join(ROOT, "data", "daily-features.json");
const QUEUE_FILE = path.join(ROOT, "data", "publish-queue.json");
const REGISTRY_FILE = path.join(ROOT, "data", "published-question-registry.json");
const ASSET_DIR = path.join(ROOT, "content", "xiaohongshu-assets");
const CDP = process.env.CHROME_CDP || "http://127.0.0.1:9222";
const SHOULD_PUSH = process.argv.includes("--push");
const SHOULD_OPEN_ONLY = process.argv.includes("--open-only");
const SHOULD_RENDER_COVER_ONLY = process.argv.includes("--render-cover-only");
const CREATOR_URL = process.env.XHS_CREATOR_URL || "https://creator.xiaohongshu.com/publish/publish?from=automation&target=image";

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hash(text) {
  return crypto.createHash("sha1").update(text).digest("hex").slice(0, 12);
}

function cleanLine(line) {
  return String(line || "").replace(/\s+/g, " ").trim();
}

function section(markdown, title) {
  const pattern = new RegExp(`^##\\s+${title}\\s*$([\\s\\S]*?)(?=^##\\s+|\\Z)`, "m");
  return cleanLine(markdown.match(pattern)?.[1] || "");
}

function rawSection(markdown, title) {
  const pattern = new RegExp(`^##\\s+${title}\\s*$([\\s\\S]*?)(?=^##\\s+|\\Z)`, "m");
  return String(markdown.match(pattern)?.[1] || "").trim();
}

function listFromSection(markdown, title, limit = 4) {
  const raw = markdown.match(new RegExp(`^##\\s+${title}\\s*$([\\s\\S]*?)(?=^##\\s+|\\Z)`, "m"))?.[1] || "";
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s+/, "").replace(/^\d+[.、)]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function questionsFromMarkdown(markdown, limit = 4) {
  return [
    ...listFromSection(markdown, "面试题目", limit),
    ...listFromSection(markdown, "核心考点速记", limit),
    ...listFromSection(markdown, "核心考点", limit),
  ]
    .filter(Boolean)
    .filter((item, index, items) => items.indexOf(item) === index)
    .slice(0, limit);
}

function titleForXhs(feature, post) {
  const direction = post?.direction || feature.direction || "大模型";
  const company = post?.company || feature.company || "今日";
  const subject = company === "综合" ? direction : `${company}${direction}`;
  return `${subject}题目精讲`.replace(/\s+/g, "").replace(/[|/｜]/g, "").slice(0, 20);
}

function subjectForCover(feature, post) {
  const direction = post?.direction || feature.direction || "大模型";
  const company = post?.company || feature.company || "";
  return company && company !== "综合" ? company : direction.replace(/\s+/g, "").replace(/[|/｜]/g, "");
}

function sourceHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const SELF_SOURCE_URL_PATTERNS = [
  "creator.xiaohongshu.com",
  "zhaojinlong-123.github.io/interview-hub",
  "xiaohongshu.com/explore/6a2cd7840000000015024480",
  "xiaohongshu.com/explore/6a2f55a50000000017028b54",
];

const GENERIC_ANSWER_PATTERNS = [
  "回答这类题要避免只背概念",
  "建议按四层组织",
  "如果题目来自真实面经",
  "先解释核心机制，再讲工程取舍",
  "先讲核心机制，再讲工程取舍",
];

function assertSourceUrl(sourcePlatform, sourceUrl) {
  const value = String(sourceUrl || "");
  if (!sourcePlatform || !value) {
    throw new Error("Source alignment check failed: source platform and source URL are required");
  }
  if (SELF_SOURCE_URL_PATTERNS.some((pattern) => value.includes(pattern))) {
    throw new Error(`Source alignment check failed: source URL points to self-published or internal content: ${value}`);
  }
  if (String(sourcePlatform).includes("小红书") && !/xiaohongshu\.com\/explore\/[A-Za-z0-9]+/.test(value)) {
    throw new Error("Source alignment check failed: Xiaohongshu source must be a concrete non-self note URL, not a search page or creator page");
  }
}

function assertNoGenericAnswer(text, context) {
  const value = String(text || "");
  const hit = GENERIC_ANSWER_PATTERNS.find((pattern) => value.includes(pattern));
  if (hit) {
    throw new Error(`Answer quality check failed: ${context} contains generic fallback phrase "${hit}"`);
  }
}

function compactTags(tags) {
  return tags
    .map((tag) => `#${String(tag).replace(/\s+/g, "").replace(/[|/｜]/g, "")}`)
    .join(" ");
}

function fitXhsBody(lines, maxLength = 930) {
  const result = [];
  for (const line of lines) {
    const next = [...result, line].join("\n");
    if (next.length > maxLength) break;
    result.push(line);
  }
  return result.join("\n");
}

function fitText(text, maxLength) {
  const value = cleanLine(text);
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function splitTextForCards(text, maxLength = 260) {
  const value = cleanLine(text);
  if (!value) return [];
  const chunks = [];
  let rest = value;
  while (rest.length > maxLength) {
    let cut = Math.max(
      rest.lastIndexOf("。", maxLength),
      rest.lastIndexOf("；", maxLength),
      rest.lastIndexOf("，", maxLength),
      rest.lastIndexOf(" ", maxLength),
    );
    if (cut < Math.floor(maxLength * 0.55)) cut = maxLength;
    chunks.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function buildRequiredXhsBody({ intro, xhsDraft, sourcePlatform, sourceDate, sourceUrl, tags }) {
  const required = [
    `引用来源：${sourcePlatform}${sourceDate ? `，${sourceDate}` : ""}`,
    sourceUrl ? `原文链接：${sourceUrl}` : "",
    "完整回答已拆成图卡，建议按顺序复习。",
    compactTags(tags),
  ].filter(Boolean);
  const requiredText = required.join("\n");
  const maxLength = 980;
  const available = Math.max(120, maxLength - requiredText.length - 4);
  const lead = cleanLine(xhsDraft || intro);
  const trimmedLead = lead.length > available ? `${lead.slice(0, available - 1)}…` : lead;
  return [trimmedLead, "", requiredText].filter(Boolean).join("\n");
}

function compactMarkdownLine(line) {
  return cleanLine(String(line || "")
    .replace(/^[-*]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .replace(/\*\*/g, ""));
}

function extractQuestionAnswers(markdown, fallbackQuestions) {
  const blocks = [];
  const pattern = /^###\s+(?:\u9898\u76ee|\u68f0\u6a0a\u7bad\u6d30)\s*(\d+)[^\p{L}\p{N}]+(.+)$/gmu;
  const matches = [...markdown.matchAll(pattern)];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : markdown.indexOf("\n## ", start);
    const raw = markdown.slice(start, end > -1 ? end : undefined);
    const body = raw
      .split(/\r?\n/)
      .map(compactMarkdownLine)
      .filter(Boolean)
      .filter((line) => !/^(?:\u8be6\u7ec6\u56de\u7b54|\u9762\u8bd5\u5c55\u5f00)/.test(line))
      .join("\n");
    blocks.push({
      question: compactMarkdownLine(matches[i][2]),
      answer: body,
    });
  }
  if (blocks.length) return blocks.slice(0, 4);
  throw new Error("Answer quality check failed: markdown has no per-question model answers; refusing to use generic fallback");
}
function cardText(text, limit) {
  const value = cleanLine(text);
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function topicFromQuestion(question) {
  const q = cleanLine(question);
  const rules = [
    [/KV cache|PagedAttention|continuous batching|speculative decoding/i, "KV Cache / 推理加速"],
    [/DeepSpeed|ZeRO|Megatron|并行|显存/i, "训练框架 / 显存优化"],
    [/LoRA|量化|INT4|INT8|AWQ|GPTQ|蒸馏/i, "量化压缩 / 微调部署"],
    [/VLA|action token|diffusion policy|机器人|遥操作/i, "VLA / 机器人动作"],
    [/世界模型|BEV|occupancy|轨迹|仿真/i, "世界模型 / 自动驾驶"],
    [/多模态|VLM|vision encoder|Q-Former|grounding|OCR/i, "多模态理解"],
  ];
  return rules.find(([pattern]) => pattern.test(q))?.[1] || cardText(q.replace(/[？?].*$/, ""), 14) || "核心考点";
}

function buildImageCards(payload, questions, qaBlocks) {
  const primaryQuestion = payload.primaryQuestion || questions[0] || "本篇核心面试题";
  const company = payload.company || "综合";
  const direction = payload.direction || "AI 面试";
  const cards = [
    {
      kind: "cover",
      kicker: "本篇速览",
      title: `${company}｜${direction}`,
      body: `公司：${company}\n方向：${direction}\n题目：${primaryQuestion}`,
      footer: "Interview Hub · 面试题精讲",
    },
    {
      kind: "questions",
      kicker: "面试题目",
      title: "今天重点看这几题",
      body: questions.slice(0, 4).map((item, index) => `${index + 1}. ${item}`).join("\n\n"),
      footer: "先能 30 秒讲清楚，再展开细节",
    },
  ];
  qaBlocks.slice(0, 4).forEach((item, index) => {
    const chunks = splitTextForCards(item.answer, 260);
    chunks.forEach((chunk, chunkIndex) => {
      cards.push({
        kind: "answer",
        kicker: chunks.length > 1 ? `详细解答 ${index + 1}-${chunkIndex + 1}` : `详细解答 ${index + 1}`,
        title: fitText(item.question, 54),
        body: chunk,
        footer: "机制 -> 取舍 -> 坑 -> 指标",
      });
    });
  });
  return cards.slice(0, 18);
}

function buildXhsPayload(feature, post, markdown) {
  const markdownQuestions = questionsFromMarkdown(markdown, 4);
  const postQuestions = Array.isArray(post?.questions) && post.questions.length
    ? post.questions.slice(0, 4)
    : [];
  const questions = markdownQuestions.length ? markdownQuestions : postQuestions;
  const detailedAnalysis = section(markdown, "详细解答与分析")
    || section(markdown, "今日结论")
    || section(markdown, "一句话总结");
  const conclusion = section(markdown, "今日结论") || `${feature.title}，适合作为今天的大模型面试复习材料。`;
  const sourcePlatform = feature.sourcePlatform || post?.sourcePlatform || "公开来源";
  const sourceDate = feature.sourceDate || post?.sourceDate || feature.date || "";
  const sourceUrl = feature.sourceUrl || post?.sourceUrl || "";
  const host = sourceHost(sourceUrl);
  const tags = [...new Set([
    ...(post?.tags || []),
    feature.company,
    feature.direction,
    "大模型面试",
    "AI学习",
  ])].filter(Boolean).slice(0, 8);
  const xhsDraft = rawSection(markdown, "小红书发布文案");
  const qaBlocks = extractQuestionAnswers(markdown, questions);
  const company = feature.company || post?.company || "综合";
  const direction = feature.direction || post?.direction || "AI 面试";
  const primaryQuestion = questions[0] || "本篇核心面试题";
  const topic = topicFromQuestion(primaryQuestion);

  const body = buildRequiredXhsBody({
    intro: `每日精选：${feature.company || post?.company || ""} ${feature.direction || post?.direction || "大模型"}题目精讲。今天把面试题目、完整解答、追问方向整理成图卡。`,
    xhsDraft: xhsDraft ? xhsDraft.replace(/\n{3,}/g, "\n\n").trim() : "",
    sourcePlatform,
    sourceDate,
    sourceUrl,
    tags,
  });

  return {
    id: `xhs-${feature.id || hash(feature.articlePath || feature.title)}`,
    title: `${company === "综合" ? "" : company}${topic}题目精讲`.replace(/\s+/g, "").slice(0, 20),
    coverTitle: `${subjectForCover(feature, post)}面试题精讲`,
    coverSubtitle: `${direction} 高频题`,
    company,
    direction,
    primaryQuestion,
    topic,
    body,
    sourcePlatform,
    sourceDate,
    sourceUrl,
    articlePath: feature.articlePath,
    featureId: feature.id,
    postId: feature.postId,
    coverImage: `content/xiaohongshu-assets/xhs-${feature.id || hash(feature.articlePath || feature.title)}-cover-v2.png`,
    imageCards: buildImageCards({
      coverTitle: `${subjectForCover(feature, post)}面试题精讲`,
      coverSubtitle: `${direction} 高频题`,
      company,
      direction,
      primaryQuestion,
      sourcePlatform,
      sourceDate,
      sourceUrl,
    }, questions, qaBlocks),
    createdAt: new Date().toISOString(),
  };
}

async function getJson(url) {
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    if (String(url).includes("127.0.0.1:9222")) {
      throw new Error("Chrome DevTools 端口不可用：请先启动带 --remote-debugging-port=9222 的已登录 Chrome");
    }
    throw error;
  }
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  return response.json();
}

function escapePs(value) {
  return String(value || "").replace(/`/g, "``").replace(/"/g, '`"');
}

async function ensureCoverImage(payload) {
  await fs.mkdir(ASSET_DIR, { recursive: true });
  const file = path.join(ASSET_DIR, `${payload.id}-cover-v2.png`);

  const title = escapePs(payload.coverTitle);
  const subtitle = escapePs(payload.coverSubtitle);
  const ps = `
Add-Type -AssemblyName System.Drawing
$path = "${escapePs(file)}"
$bmp = New-Object System.Drawing.Bitmap 1080, 1440
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Rectangle 0,0,1080,1440),
  [System.Drawing.Color]::FromArgb(6,14,28),
  [System.Drawing.Color]::FromArgb(14,43,55),
  45
)
$g.FillRectangle($bg, 0, 0, 1080, 1440)
$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(80, 99, 255, 218)), 2
for ($i = 0; $i -lt 9; $i++) {
  $y = 180 + $i * 120
  $g.DrawLine($pen, 90, $y, 990, $y + 28)
}
$accent = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(100, 255, 90, 95))
$cyan = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 92, 255, 229))
$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 246, 250, 255))
$muted = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(210, 175, 211, 232))
$fontSmall = New-Object System.Drawing.Font "Microsoft YaHei UI", 34, ([System.Drawing.FontStyle]::Bold)
$fontTitle = New-Object System.Drawing.Font "Microsoft YaHei UI", 58, ([System.Drawing.FontStyle]::Bold)
$fontSub = New-Object System.Drawing.Font "Microsoft YaHei UI", 34, ([System.Drawing.FontStyle]::Bold)
$fontBody = New-Object System.Drawing.Font "Microsoft YaHei UI", 32, ([System.Drawing.FontStyle]::Regular)
$fontBadge = New-Object System.Drawing.Font "Microsoft YaHei UI", 30, ([System.Drawing.FontStyle]::Bold)
$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment = [System.Drawing.StringAlignment]::Near
$fmt.LineAlignment = [System.Drawing.StringAlignment]::Near
$fmt.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
$g.FillRectangle($accent, 0, 0, 1080, 18)
$safe = New-Object System.Drawing.RectangleF 120,180,840,940
$badgeBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(42, 255, 90, 95))
$badgePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(210, 92, 255, 229)), 2
$g.FillRectangle($badgeBrush, 120, 170, 330, 76)
$g.DrawRectangle($badgePen, 120, 170, 330, 76)
$g.DrawString("每日面试题", $fontBadge, $cyan, 150, 187)
$g.DrawString("${title}", $fontTitle, $white, (New-Object System.Drawing.RectangleF 120, 310, 900, 220), $fmt)
$g.DrawString("${subtitle}", $fontSub, $cyan, (New-Object System.Drawing.RectangleF 120, 560, 900, 110), $fmt)
$g.DrawString("重点拆解", $fontSmall, $white, 120, 760)
$g.DrawString("面试题目 / 详细解答 / 追问方向", $fontBody, $muted, (New-Object System.Drawing.RectangleF 120, 835, 840, 100), $fmt)
$g.DrawString("Interview Hub", $fontSmall, $cyan, 120, 1120)
$g.DrawString("引用来源：公开面经整理", $fontBody, $muted, 120, 1185)
$g.Dispose()
$bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
`;
  execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], { stdio: "inherit" });
  return file;
}

function relativeAsset(file) {
  return path.relative(ROOT, file).replaceAll("\\", "/");
}

async function ensureXhsImages(payload) {
  await fs.mkdir(ASSET_DIR, { recursive: true });
  const dir = path.join(ASSET_DIR, payload.id);
  await fs.mkdir(dir, { recursive: true });
  const cards = (payload.imageCards || []).map((card, index) => ({
    ...card,
    index: index + 1,
    total: payload.imageCards.length,
    file: path.join(dir, `${String(index + 1).padStart(2, "0")}-${card.kind || "card"}.png`),
  }));
  const jsonFile = path.join(dir, "cards.json");
  await fs.writeFile(jsonFile, JSON.stringify(cards, null, 2), "utf8");

  const ps = `
Add-Type -AssemblyName System.Drawing
$jsonPath = "${escapePs(jsonFile)}"
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
  execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], { stdio: "inherit" });
  return cards.map((card) => card.file);
}

class CdpSession {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
  }

  async open() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (!data.id) return;
      const pending = this.pending.get(data.id);
      if (!pending) return;
      this.pending.delete(data.id);
      if (data.error) pending.reject(new Error(data.error.message));
      else pending.resolve(data.result);
    };
    return this;
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws?.close();
  }
}

async function createPublishTab() {
  const version = await getJson(`${CDP}/json/version`);
  const browser = await new CdpSession(version.webSocketDebuggerUrl).open();
  try {
    const created = await browser.send("Target.createTarget", { url: CREATOR_URL });
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const tabs = await getJson(`${CDP}/json/list`);
    const tab = tabs.find((item) => item.id === created.targetId) || tabs.find((item) => item.url.includes("creator.xiaohongshu.com"));
    if (!tab) throw new Error("未找到小红书发布页标签");
    return tab;
  } finally {
    browser.close();
  }
}

async function waitFor(send, expression, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.result?.value) return result.result.value;
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  return null;
}

async function uploadImages(send, imagePaths) {
  await send("DOM.enable");
  const root = await send("DOM.getDocument", { depth: -1, pierce: true });
  const input = await send("DOM.querySelector", { nodeId: root.root.nodeId, selector: "input[type=file]" });
  if (!input.nodeId) throw new Error("未找到小红书图片上传控件");
  await send("DOM.setFileInputFiles", { nodeId: input.nodeId, files: imagePaths });
}

async function tryPublish(payload, imagePaths) {
  const tab = await createPublishTab();
  const page = await new CdpSession(tab.webSocketDebuggerUrl).open();
  const send = page.send.bind(page);
  try {
    await send("Runtime.evaluate", { expression: "document.body.innerText", returnByValue: true });
    await uploadImages(send, imagePaths);

    const editorReady = await waitFor(send, `(() => {
      const visible = el => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
      };
      const inputs = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']")).filter(visible);
      return inputs.length >= 2;
    })()`, 45000);
    if (!editorReady) {
      return { ok: false, reason: "已上传封面，但未等到标题/正文编辑区，可能需要登录或安全验证", url: tab.url };
    }

    const fillResult = await send("Runtime.evaluate", {
      expression: `(async () => {
        const payload = ${JSON.stringify(payload)};
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
        const visible = el => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
        };
        const setValue = (el, value) => {
          el.focus();
          if (el.isContentEditable) {
            el.textContent = value;
          } else {
            const setter = Object.getOwnPropertyDescriptor(el.__proto__, "value")?.set;
            if (setter) setter.call(el, value);
            else el.value = value;
          }
          el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        };
        const inputs = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']")).filter(visible);
        const titleInput = inputs.find(el => /标题|title/i.test(el.placeholder || el.getAttribute("aria-label") || "")) || inputs.find(el => el.tagName === "INPUT");
        const contentInput = inputs.find(el => el.isContentEditable) || inputs.find(el => el !== titleInput && el.tagName === "TEXTAREA");
        if (!titleInput || !contentInput) return { ok: false, reason: "没有找到标题或正文输入框", url: location.href };
        setValue(titleInput, payload.title);
        await sleep(600);
        setValue(contentInput, payload.body);
        await sleep(1200);
        document.querySelector(".publish-page")?.scrollTo(0, document.querySelector(".publish-page").scrollHeight);
        await sleep(800);
        return { ok: true, url: location.href };
      })()`,
      returnByValue: true,
      awaitPromise: true,
    });
    const filled = fillResult.result?.value;
    if (!filled?.ok) return filled || { ok: false, reason: "填充发布内容失败", url: tab.url };
    if (SHOULD_OPEN_ONLY) {
      return { ok: false, reason: "已上传封面并填好内容，按 open-only 参数保留为人工发布", url: filled.url };
    }

    const buttonRect = await waitFor(send, `(() => {
      const el = document.querySelector("xhs-publish-btn");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    })()`, 15000);
    if (!buttonRect) {
      return { ok: false, reason: "已填好内容，但没有找到小红书发布按钮组件", url: filled.url };
    }

    const x = buttonRect.x + buttonRect.w * 0.61;
    const y = buttonRect.y + buttonRect.h * 0.62;
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none" });
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    await new Promise((resolve) => setTimeout(resolve, 12000));

    const status = await send("Runtime.evaluate", {
      expression: `(() => ({ url: location.href, text: document.body.innerText || "" }))()`,
      returnByValue: true,
    });
    const value = status.result?.value || {};
    if (String(value.url || "").includes("published=true") || /发布成功|审核中|已发布/.test(value.text || "")) {
      return { ok: true, reason: "已提交小红书发布，可能进入平台审核", url: value.url || filled.url };
    }
    if (/登录|验证码|安全验证|扫码|手机号/.test(value.text || "")) {
      return { ok: false, reason: "小红书需要登录或安全验证", url: value.url || filled.url };
    }
    return { ok: false, reason: "已点击发布，但未检测到成功标记，请人工确认", url: value.url || filled.url };
  } finally {
    page.close();
  }
}

async function updateQueue(payload, status, reason, url) {
  const queue = await readJson(QUEUE_FILE, []);
  const record = {
    ...payload,
    status,
    reason,
    publishUrl: url || "",
    updatedAt: new Date().toISOString(),
  };
  const index = queue.findIndex((item) => item.id === record.id);
  if (index >= 0) queue[index] = { ...queue[index], ...record };
  else queue.unshift(record);
  queue.sort((a, b) => String(b.featureId || b.id || "").localeCompare(String(a.featureId || a.id || "")));
  await writeJson(QUEUE_FILE, queue);
  return record;
}

function duplicateKey(record) {
  const direction = cleanLine(record.direction || record.coverSubtitle || "");
  const question = cleanLine(
    record.primaryQuestion
      || record.imageCards?.find((card) => card.kind === "questions")?.body?.split(/\r?\n/).find(Boolean)
      || record.imageCards?.find((card) => card.kind === "cover")?.body?.split(/\r?\n/).find((line) => /^题目[:：]/.test(line))?.replace(/^题目[:：]\s*/, "")
      || ""
  );
  const topic = cleanLine(record.topic || topicFromQuestion(question));
  return `${direction}|${topic}|${question}`.toLowerCase().replace(/\s+/g, "");
}

function normalizeQuestion(value) {
  return cleanLine(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function questionsFromPayload(payload) {
  const questionCard = payload.imageCards?.find((card) => card.kind === "questions");
  const fromCard = String(questionCard?.body || "")
    .split(/\r?\n/)
    .map((line) => cleanLine(line).replace(/^\d+[.、]\s*/, ""))
    .filter(Boolean);
  return [...new Set([payload.primaryQuestion, ...fromCard].filter(Boolean))];
}

async function findDuplicatePublished(payload) {
  const key = duplicateKey(payload);
  if (!key || key.endsWith("||")) return null;
  const queue = await readJson(QUEUE_FILE, []);
  const queueDuplicate = queue.find((item) =>
    item.id !== payload.id
    && ["published", "manual_required"].includes(item.status)
    && duplicateKey(item) === key
  ) || null;
  if (queueDuplicate) return queueDuplicate;

  const registry = await readJson(REGISTRY_FILE, []);
  const publishedQuestions = new Set(
    registry
      .map((item) => normalizeQuestion(item.question))
      .filter(Boolean)
  );
  const matchedQuestion = questionsFromPayload(payload)
    .find((question) => publishedQuestions.has(normalizeQuestion(question)));
  if (!matchedQuestion) return null;
  return {
    id: "published-question-registry",
    title: "published question registry",
    question: matchedQuestion,
  };
}

async function updateFeature(featureId, patch) {
  const features = await readJson(FEATURES_FILE, []);
  const index = features.findIndex((item) => item.id === featureId);
  if (index >= 0) {
    features[index] = { ...features[index], ...patch };
    if (patch.publishStatus === "published") delete features[index].publishFailureReason;
    await writeJson(FEATURES_FILE, features);
  }
}

function assertPayloadAlignment(payload) {
  const robotTitle = "\u673a\u5668\u4eba\u6570\u636e";
  const genericVisionSignals = [
    "\u89c6\u89c9 encoder",
    "Q-Former",
    "Linear projector",
    "cross-attention",
    "VLM \u6570\u636e\u6d41",
  ];
  const genericDataSignals = [
    "\u56fe\u6587/\u89c6\u9891\u6307\u4ee4",
    "caption",
    "OCR \u6cc4\u6f0f",
  ];

  for (const card of payload.imageCards || []) {
    const title = String(card.title || "");
    const body = String(card.body || "");
    assertNoGenericAnswer(title, `card title ${card.kind || ""}`);
    assertNoGenericAnswer(body, `card body ${title || card.kind || ""}`);
    if (title.includes("action token") && title.includes("diffusion policy")) {
      const hit = genericVisionSignals.find((signal) => body.includes(signal));
      if (hit) throw new Error(`Answer alignment check failed: VLA action card contains ${hit}`);
    }
    if (title.includes(robotTitle)) {
      const hit = genericDataSignals.find((signal) => body.includes(signal));
      if (hit) throw new Error(`Answer alignment check failed: robot data card contains ${hit}`);
    }
  }
  assertSourceUrl(payload.sourcePlatform, payload.sourceUrl);
  if (!String(payload.body || "").includes(String(payload.sourceUrl))) {
    throw new Error("Source alignment check failed: body must include the source URL");
  }
  if (!String(payload.body || "").includes(String(payload.sourcePlatform))) {
    throw new Error("Source alignment check failed: body must include the source platform");
  }
  assertNoGenericAnswer(payload.body, "publish body");
}

function commitAndPush() {
  if (!SHOULD_PUSH) return;
  execFileSync("git", ["-c", "safe.directory=E:/workshop/interview-hub", "add", "data/daily-features.json", "data/publish-queue.json", "content/xiaohongshu-assets"], { cwd: ROOT, stdio: "inherit" });
  try {
    execFileSync("git", ["-c", "safe.directory=E:/workshop/interview-hub", "commit", "-m", "Update Xiaohongshu publish status"], { cwd: ROOT, stdio: "inherit" });
  } catch {
    return;
  }
  execFileSync("git", [
    "-c", "safe.directory=E:/workshop/interview-hub",
    "-c", "http.proxy=http://127.0.0.1:10809",
    "-c", "https.proxy=http://127.0.0.1:10809",
    "push",
  ], { cwd: ROOT, stdio: "inherit" });
}

async function main() {
  const features = await readJson(FEATURES_FILE, []);
  const posts = await readJson(POSTS_FILE, []);
  const featureId = process.argv.find((arg) => arg.startsWith("--id="))?.slice(5);
  const feature = featureId ? features.find((item) => item.id === featureId) : features[0];
  if (!feature) throw new Error("没有可发布的每日精选");
  const post = posts.find((item) => item.id === feature.postId);
  const articlePath = path.join(ROOT, feature.articlePath || "");
  const markdown = await fs.readFile(articlePath, "utf8");
  const payload = buildXhsPayload(feature, post, markdown);
  assertPayloadAlignment(payload);
  const duplicate = SHOULD_RENDER_COVER_ONLY ? null : await findDuplicatePublished(payload);
  if (duplicate) {
    const reason = `疑似重复：已存在 ${duplicate.title || duplicate.id}`;
    await updateQueue(payload, "skipped_duplicate", reason, duplicate.publishUrl || "");
    await updateFeature(feature.id, {
      publishStatus: "skipped_duplicate",
      autoPublish: true,
      publishFailureReason: reason,
      publishUrl: duplicate.publishUrl || "",
    });
    console.log(JSON.stringify({ featureId: feature.id, ok: false, skipped: true, reason, duplicateId: duplicate.id }, null, 2));
    return;
  }
  const imagePaths = await ensureXhsImages(payload);
  payload.coverImage = relativeAsset(imagePaths[0]);
  payload.imageCardFiles = imagePaths.map(relativeAsset);
  if (SHOULD_RENDER_COVER_ONLY) {
    console.log(JSON.stringify({ featureId: feature.id, imagePaths }, null, 2));
    return;
  }

  let result;
  try {
    result = await tryPublish(payload, imagePaths);
  } catch (error) {
    result = { ok: false, reason: error.message || "自动发布失败" };
  }

  if (result.ok) {
    await updateQueue(payload, "published", result.reason, result.url);
    await updateFeature(feature.id, {
      publishStatus: "published",
      autoPublish: true,
      publishedAt: new Date().toISOString(),
      publishUrl: result.url || "",
    });
  } else {
    await updateQueue(payload, "manual_required", result.reason, result.url);
    await updateFeature(feature.id, {
      publishStatus: "manual_required",
      autoPublish: true,
      publishFailureReason: result.reason,
      publishUrl: result.url || "",
    });
  }

  console.log(JSON.stringify({ featureId: feature.id, ok: result.ok, reason: result.reason, url: result.url || "", imagePaths }, null, 2));
  commitAndPush();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
