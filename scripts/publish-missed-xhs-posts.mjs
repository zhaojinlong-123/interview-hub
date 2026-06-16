import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const ASSET_ROOT = path.join(ROOT, "content", "xiaohongshu-assets");
const DRAFT_ROOT = path.join(ROOT, "content", "xiaohongshu-drafts");
const FEATURES_FILE = path.join(ROOT, "data", "daily-features.json");
const QUEUE_FILE = path.join(ROOT, "data", "publish-queue.json");
const REGISTRY_FILE = path.join(ROOT, "data", "published-question-registry.json");
const CDP = process.env.CHROME_CDP || "http://127.0.0.1:9222";

const posts = [
  {
    date: "2026-06-15",
    slot: "afternoon",
    publishTime: "15:30",
    postId: "missed-20260615-afternoon-video",
    title: "视频时序理解题目精讲",
    company: "",
    direction: "视频 / 视觉理解",
    sourcePlatform: "CSDN",
    sourceDate: "2026-06-14",
    sourceUrl: "https://blog.csdn.net/qq_45934285/article/details/143261317",
    questions: [
      {
        question: "视频理解中帧采样、temporal token 压缩和 long-context attention 如何取舍？",
        answer: "这题要先说明三者解决的是同一个矛盾：视频信息量很大，但模型上下文、显存和延迟有限。帧采样决定把哪些原始帧送进模型，适合从输入侧降低成本；temporal token 压缩是在特征侧合并冗余时间信息，适合保留长视频全局语义；long-context attention 则尽量保留更多 token，让模型直接建模长程依赖。工程上，短视频动作识别可以用较密采样，长视频问答更依赖关键帧加片段检索；如果任务需要细粒度动作边界，不能压得太狠；如果任务更偏摘要或场景理解，可以更激进压缩。面试里要补评估指标：动作识别准确率、事件边界定位、跨片段一致性、首 token 延迟和单位视频成本。",
      },
      {
        question: "视频问答如何评估动作理解、事件边界、因果关系和跨镜头一致性？",
        answer: "视频问答评估不能只看答案是否语义相近，要按能力拆解。动作理解看模型能否区分拿起、放下、打开、关闭等时间相关动作；事件边界看能否定位动作开始和结束，而不是只识别静态画面；因果关系看是否能回答因为前面发生了什么所以后面结果如何；跨镜头一致性看同一人物、物体或状态在多个片段里是否保持一致。数据集设计上要有时间戳标注、干扰帧、相似动作负例和跨片段问题。线上评估还要看幻觉率和不确定性表达：视频里没有出现的信息，模型应该说无法判断，而不是补剧情。",
      },
    ],
  },
  {
    date: "2026-06-16",
    slot: "morning",
    publishTime: "09:30",
    postId: "missed-20260616-morning-byte-vlm",
    title: "字节多模态动态分辨率题目精讲",
    company: "字节",
    direction: "多模态大模型",
    sourcePlatform: "知乎",
    sourceDate: "2026-06-14",
    sourceUrl: "https://zhuanlan.zhihu.com/p/2014314780802967473",
    questions: [
      {
        question: "高分辨率图片输入时，动态分辨率、tile 切分和 token 压缩如何取舍？",
        answer: "高分辨率输入的核心矛盾是细节信息和 token 成本。动态分辨率会根据图片长宽比和内容复杂度选择输入尺度，优点是避免所有图片都按最大分辨率处理；tile 切分把大图拆成局部块，适合 OCR、图表、遥感和细粒度检测，但会增加跨 tile 融合难度；token 压缩通过 pooling、query 压缩或 token pruning 减少视觉 token，适合降低 LLM 侧上下文压力。取舍上，如果任务依赖局部文字和小目标，应优先保留高分辨率 tile；如果任务偏整体场景理解，可以更强压缩。面试回答要落到指标：准确率、OCR 召回、幻觉率、视觉 token 数、显存和首 token 延迟。",
      },
      {
        question: "Vision encoder 输出如何与 LLM token 空间对齐？Linear projector、Q-Former、cross-attention adapter 的差异是什么？",
        answer: "视觉 encoder 输出通常是连续视觉特征，而 LLM 接收的是语言 token embedding，因此需要连接层把视觉特征映射到 LLM 可用空间。Linear projector 最简单，直接线性映射视觉 patch token，延迟低、训练稳定，但压缩和选择能力弱；Q-Former 使用可学习 query 从视觉特征里抽取固定数量的视觉摘要，能减少 token，但可能丢细节；cross-attention adapter 让语言侧和视觉侧交互更充分，表达能力强，但训练和推理成本更高。工程上常按任务选择：OCR 和细粒度 grounding 更需要保留局部 token，通用问答可以用 query 压缩。评估要看图文对齐、grounding、OCR、空间关系和幻觉率。",
      },
    ],
  },
  {
    date: "2026-06-16",
    slot: "afternoon",
    publishTime: "15:30",
    postId: "missed-20260616-afternoon-inference",
    title: "KVCache推理部署题目精讲",
    company: "",
    direction: "推理部署 / 模型压缩",
    sourcePlatform: "知乎",
    sourceDate: "2026-06-14",
    sourceUrl: "https://zhuanlan.zhihu.com/p/2014643829844770923",
    questions: [
      {
        question: "KV cache 显存如何随 batch、序列长度、层数、head 数和 hidden size 增长？",
        answer: "KV cache 保存每层 attention 的 key/value，用来避免生成新 token 时重复计算历史上下文。它的显存大致随 batch size、序列长度、层数、KV head 数、head dimension 和数据类型线性增长。训练时主要显存压力来自参数、梯度、优化器状态和激活值；推理时没有梯度和优化器状态，长上下文下 KV cache 会成为核心瓶颈。优化手段包括 MQA/GQA 减少 KV head、PagedAttention 降低碎片、KV cache 量化、prefix cache 复用、滑动窗口或 KV eviction。面试里最好能说明 TTFT 受 prefill 影响，TPOT 受 decode 阶段和 KV 读取影响。",
      },
      {
        question: "PagedAttention 为什么能提升显存利用率，和连续 KV cache 分配有什么区别？",
        answer: "传统连续 KV cache 往往为每个请求预留一段连续显存，序列长度不一致时容易产生浪费和碎片。PagedAttention 借鉴操作系统分页思想，把 KV cache 切成固定大小的 block，通过页表把逻辑序列位置映射到物理块。这样短请求不会占用过大的连续空间，长请求可以按需扩展，多个请求调度时也更容易复用和回收。它提升的是显存利用率和 batch 调度灵活性，不是改变 attention 的数学结果。工程风险在 block size、页表管理、内存访问局部性和调度复杂度，需要用吞吐、显存水位、碎片率、TTFT 和 TPOT 一起评估。",
      },
    ],
  },
  {
    date: "2026-06-15",
    slot: "morning-reissue",
    publishTime: "09:30",
    postId: "missed-20260615-morning-rl",
    title: "对齐训练RLHF题目精讲",
    company: "",
    direction: "强化学习 / 对齐训练",
    sourcePlatform: "牛客",
    sourceDate: "2026-06-14",
    sourceUrl: "https://www.nowcoder.com/feed/main/detail/d9b2ff6d748c4827aba3a0227a733d0f",
    questions: [
      {
        question: "RLHF、DPO、GRPO、PPO 的优化目标、训练数据和稳定性问题分别是什么？",
        answer: "RLHF 是一套从人类偏好到策略优化的流程，常见做法是先训练 reward model，再用 PPO 优化策略；PPO 需要采样、reward model 和 KL 约束，灵活但成本高、稳定性敏感。DPO 不显式训练 reward model，而是直接用偏好对优化策略，让偏好样本中的 chosen 比 rejected 更可能，工程更简单稳定，但强依赖偏好数据质量。GRPO 用组内相对奖励降低对 value model 的依赖，常用于数学推理等可批量采样比较的场景。面试回答要讲数据来源、KL 约束、reward hacking、长度偏置、评估指标和线上安全边界。",
      },
      {
        question: "Reward model 如何构造偏好数据，如何处理 reward hacking、长度偏置和分布外回答？",
        answer: "Reward model 的偏好数据通常来自同一 prompt 下多个回答的人工排序、专家标注或模型辅助标注。关键是让 chosen/rejected 覆盖真实质量差异，而不是只覆盖格式差异。长度偏置可以通过长度分桶、显式惩罚、pair 采样平衡和评估时控制回答长度缓解；reward hacking 要用 held-out 人评、规则校验、红队样本和多维 reward 监控；分布外回答则需要加入拒答、安全、事实性和复杂任务样本。好的 reward model 不应只给高分，而要能区分有用性、真实性、安全性和指令遵循，并持续用线上 badcase 回流修正。",
      },
    ],
  },
];

const ONLY_TITLES = new Set(
  process.argv
    .filter((arg) => arg.startsWith("--only="))
    .flatMap((arg) => arg.slice("--only=".length).split("|"))
    .filter(Boolean),
);
const ONLY_POST_IDS = new Set(
  process.argv
    .filter((arg) => arg.startsWith("--only-post-id="))
    .flatMap((arg) => arg.slice("--only-post-id=".length).split(","))
    .filter(Boolean),
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hash(text) {
  return crypto.createHash("sha1").update(text).digest("hex").slice(0, 12);
}

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

function fit(text, max) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function titleForPost(post) {
  if (post.company) return `${post.company}${post.direction.replace(/\s|\/|-/g, "")}题目精讲`.slice(0, 20);
  return post.title.slice(0, 20);
}

function xhsBody(post) {
  const companyLine = post.company ? `公司：${post.company}` : "";
  return [
    `每日精选：${post.company ? `${post.company}｜` : ""}${post.direction}题目精讲`,
    "本篇图卡包含面试题目、完整解答和追问方向。第一页先看方向和题目，后面按顺序复习答案。",
    companyLine,
    `引用来源：${post.sourcePlatform}${post.sourceDate ? `，${post.sourceDate}` : ""}`,
    `原文链接：${post.sourceUrl}`,
    "#大模型面试 #AI学习 #多模态 #VLA #世界模型 #推理部署 #面经",
  ].filter(Boolean).join("\n");
}

function cardsFor(post) {
  const cards = [
    {
      kicker: "本篇速览",
      title: post.company ? `${post.company}｜${post.direction}` : post.direction,
      body: `${post.company ? `公司：${post.company}\n` : ""}方向：${post.direction}\n题目：${post.questions[0].question}`,
      footer: "Interview Hub · 面试题精讲",
    },
    {
      kicker: "面试题目",
      title: "今天重点看这几题",
      body: post.questions.map((item, index) => `${index + 1}. ${item.question}`).join("\n\n"),
      footer: "题目和来源一致，答案逐题展开",
    },
  ];
  post.questions.forEach((item, index) => {
    cards.push({
      kicker: `详细解答 ${index + 1}`,
      title: fit(item.question, 54),
      body: item.answer,
      footer: "机制 -> 工程取舍 -> 风险 -> 指标",
    });
  });
  cards.push({
    kicker: "引用来源",
    title: post.sourcePlatform,
    body: `${post.sourcePlatform}${post.sourceDate ? ` · ${post.sourceDate}` : ""}\n${post.sourceUrl}`,
    footer: "链接也会放在正文里",
  });
  return cards;
}

function escapePs(value) {
  return String(value || "").replace(/`/g, "``").replace(/"/g, '`"');
}

function psString(value) {
  return `[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("${Buffer.from(String(value || ""), "utf8").toString("base64")}"))`;
}

async function renderCards(post, id) {
  const dir = path.join(ASSET_ROOT, id);
  await fs.mkdir(dir, { recursive: true });
  const cards = cardsFor(post);
  const psCards = cards.map((card, index) => ({
    ...card,
    file: path.join(dir, `${String(index + 1).padStart(2, "0")}-card.png`),
    index: index + 1,
    total: cards.length,
  }));
  const ps = `
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
${psCards.map((card) => `  @{ file="${escapePs(card.file)}"; kicker=${psString(card.kicker)}; title=${psString(card.title)}; body=${psString(card.body)}; footer=${psString(`${card.footer}   ${card.index}/${card.total}`)} }`).join(",\n")}
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
`;
  const psFile = path.join(dir, "render.ps1");
  await fs.writeFile(psFile, `\uFEFF${ps}`, "utf8");
  execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", psFile], { cwd: ROOT, stdio: "inherit" });
  return psCards.map((card) => card.file);
}

function getRaw(pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${CDP}${pathname}`, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve(body));
    });
    req.on("error", reject);
    req.setTimeout(10000, () => req.destroy(new Error(`HTTP timeout: ${pathname}`)));
  });
}

function requestRaw(method, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${CDP}${pathname}`, { method }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve(body));
    });
    req.on("error", reject);
    req.setTimeout(10000, () => req.destroy(new Error(`HTTP timeout: ${method} ${pathname}`)));
    req.end();
  });
}

async function getJson(pathname) {
  return JSON.parse(await getRaw(pathname));
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms)),
  ]);
}

class CdpSession {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
  }
  async open() {
    this.ws = new WebSocket(this.wsUrl);
    await withTimeout(new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    }), 12000, "websocket open");
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const pending = this.pending.get(data.id);
      if (!pending) return;
      this.pending.delete(data.id);
      data.error ? pending.reject(new Error(JSON.stringify(data.error))) : pending.resolve(data.result);
    };
    return this;
  }
  send(method, params = {}, timeout = 15000) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return withTimeout(new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    }), timeout, method);
  }
  close() {
    this.ws?.close();
  }
}

async function newPage(url) {
  const encoded = encodeURIComponent(url);
  const page = JSON.parse(await requestRaw("PUT", `/json/new?${encoded}`));
  await sleep(8000);
  return page;
}

async function publish(post, imagePaths) {
  const pageInfo = await newPage("https://creator.xiaohongshu.com/publish/publish?from=automation&target=image");
  const page = await new CdpSession(pageInfo.webSocketDebuggerUrl).open();
  try {
    await page.send("Runtime.enable");
    await page.send("DOM.enable");
    await sleep(6000);
    const root = await page.send("DOM.getDocument", {});
    const input = await page.send("DOM.querySelector", { nodeId: root.root.nodeId, selector: "input[type=file]" });
    if (!input.nodeId) throw new Error("file input not found");
    await page.send("DOM.setFileInputFiles", { nodeId: input.nodeId, files: imagePaths });
    await sleep(12000);
    const title = titleForPost(post);
    const body = xhsBody(post);
    const filled = await page.send("Runtime.evaluate", {
      expression: `(() => {
        const setInput = (input, value) => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          setter.call(input, value);
          input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: value }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        };
        const titleInput = document.querySelector('input[placeholder="填写标题会有更多赞哦"]') || [...document.querySelectorAll('input[type="text"]')].find((item) => item.offsetParent !== null);
        if (!titleInput) return { ok: false, reason: "title input not found" };
        titleInput.focus();
        setInput(titleInput, ${JSON.stringify(title)});
        titleInput.blur();
        const editors = [...document.querySelectorAll('[contenteditable="true"]')];
        const editor = editors.find((item) => item.offsetParent !== null);
        if (!editor) return { ok: false, reason: "body editor not found" };
        editor.focus();
        document.execCommand("selectAll", false, null);
        document.execCommand("insertText", false, ${JSON.stringify(body)});
        editor.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: ${JSON.stringify(body)} }));
        editor.blur();
        return { ok: true, title: titleInput.value, body: editor.innerText };
      })()`,
      returnByValue: true,
    }, 15000);
    if (!filled.result?.value?.ok) throw new Error(JSON.stringify(filled.result?.value));
    await sleep(2500);
    const clicked = await page.send("Runtime.evaluate", {
      expression: `(() => {
        const root = document.querySelector("xhs-publish-btn")?._app?._container;
        const button = root?.querySelector?.("button.bg-red")
          || [...(root?.querySelectorAll?.("button.ce-btn") || [])].find((item) => (item.innerText || item.textContent || "").trim() === "发布")
          || [...document.querySelectorAll("button")].find((item) => /发布|提交/.test(item.innerText || item.textContent || "") && !item.disabled);
        if (!button) return { ok: false, reason: "publish button not found", text: document.body.innerText.slice(-1200) };
        button.click();
        return { ok: true, text: button.innerText || button.textContent || "" };
      })()`,
      returnByValue: true,
    }, 15000);
    if (!clicked.result?.value?.ok) throw new Error(JSON.stringify(clicked.result?.value));
    await sleep(45000);
    const state = await page.send("Runtime.evaluate", {
      expression: `(() => ({ url: location.href, text: document.body.innerText.slice(0, 1800) }))()`,
      returnByValue: true,
    }, 15000);
    const value = state.result.value;
    const ok = String(value.url || "").includes("published=true") || /审核中|已发布|发布成功|note-manager/.test(value.text || "");
    return { ok, url: value.url, reason: ok ? "已提交发布，进入平台处理" : "未检测到发布成功标记" };
  } finally {
    page.close();
  }
}

async function writeDraft(post, id) {
  const file = path.join(DRAFT_ROOT, `${post.date}-${id}.md`);
  const md = [
    `# 每日精选面试题精讲：${post.company ? `${post.company}｜` : ""}${post.direction}`,
    "",
    "## 面试题目",
    ...post.questions.map((item, index) => `${index + 1}. ${item.question}`),
    "",
    "## 逐题解答",
    ...post.questions.flatMap((item, index) => [
      `### 题目 ${index + 1}：${item.question}`,
      item.answer,
      "",
    ]),
    "## 面经信息",
    post.company ? `- 公司：${post.company}` : "- 公司：未明确",
    `- 方向：${post.direction}`,
    `- 来源：${post.sourcePlatform} ${post.sourceDate}`,
    `- 原始链接：${post.sourceUrl}`,
    "",
    "## 小红书发布文案",
    xhsBody(post),
  ].join("\n");
  await fs.mkdir(DRAFT_ROOT, { recursive: true });
  await fs.writeFile(file, `${md}\n`, "utf8");
  return path.relative(ROOT, file).replaceAll("\\", "/");
}

function registryKey(question) {
  return crypto.createHash("sha1").update(String(question).replace(/\s+/g, "").toLowerCase()).digest("hex").slice(0, 12);
}

async function recordPost(post, id, articlePath, imagePaths, result) {
  const features = await readJson(FEATURES_FILE, []);
  const queue = await readJson(QUEUE_FILE, []);
  const registry = await readJson(REGISTRY_FILE, []);
  const featureId = `daily-${post.date}-${id}`;
  const queueId = `xhs-${featureId}`;
  const relImages = imagePaths.map((file) => path.relative(ROOT, file).replaceAll("\\", "/"));
  const record = {
    id: featureId,
    date: post.date,
    slot: post.slot,
    publishTime: post.publishTime,
    postId: post.postId,
    title: post.title,
    company: post.company || "未明确",
    direction: post.direction,
    score: 90,
    reasons: ["补发漏发布内容", "来源链接可直达", "题目未重复", "逐题重新深度回答"],
    sourceUrl: post.sourceUrl,
    sourcePlatform: post.sourcePlatform,
    sourceDate: post.sourceDate,
    articlePath,
    target: "xiaohongshu",
    publishStatus: result.ok ? "published" : "manual_required",
    autoPublish: true,
    publishedAt: result.ok ? new Date().toISOString() : undefined,
    publishUrl: result.url || "",
    publishFailureReason: result.ok ? undefined : result.reason,
  };
  const payload = {
    id: queueId,
    title: titleForPost(post),
    coverTitle: post.company ? `${post.company}面试题精讲` : `${post.direction}题目精讲`,
    coverSubtitle: `${post.direction} 高频题`,
    body: xhsBody(post),
    sourcePlatform: post.sourcePlatform,
    sourceDate: post.sourceDate,
    sourceUrl: post.sourceUrl,
    articlePath,
    featureId,
    postId: post.postId,
    company: post.company || "",
    direction: post.direction,
    primaryQuestion: post.questions[0].question,
    imageCardFiles: relImages,
    coverImage: relImages[0],
    imageCards: cardsFor(post),
    status: result.ok ? "published" : "manual_required",
    reason: result.reason,
    publishUrl: result.url || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const nextFeatures = [record, ...features.filter((item) => item.id !== featureId)];
  const nextQueue = [payload, ...queue.filter((item) => item.id !== queueId)];
  for (const item of post.questions) {
    registry.unshift({
      key: registryKey(item.question),
      question: item.question,
      queueId,
      featureId,
      postId: post.postId,
      title: payload.title,
      company: post.company || "",
      direction: post.direction,
      sourcePlatform: post.sourcePlatform,
      sourceUrl: post.sourceUrl,
      publishUrl: result.url || "",
      status: result.ok ? "published" : "manual_required",
      updatedAt: new Date().toISOString(),
    });
  }
  await writeJson(FEATURES_FILE, nextFeatures);
  await writeJson(QUEUE_FILE, nextQueue);
  await writeJson(REGISTRY_FILE, registry);
}

const results = [];
for (const post of posts.filter((item) =>
  (!ONLY_TITLES.size || ONLY_TITLES.has(item.title))
  && (!ONLY_POST_IDS.size || ONLY_POST_IDS.has(item.postId))
)) {
  const id = hash(`${post.date}-${post.slot}-${post.postId}`);
  console.log(`\n[${post.date} ${post.slot}] ${titleForPost(post)}`);
  const articlePath = await writeDraft(post, id);
  const imagePaths = await renderCards(post, `xhs-daily-${post.date}-${id}`);
  const result = await publish(post, imagePaths);
  await recordPost(post, id, articlePath, imagePaths, result);
  results.push({ post: titleForPost(post), ...result });
}

console.log(JSON.stringify(results, null, 2));
