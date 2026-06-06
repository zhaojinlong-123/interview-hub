import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POSTS_FILE = path.join(ROOT, "data", "posts.json");
const FEATURES_FILE = path.join(ROOT, "data", "daily-features.json");
const QUEUE_FILE = path.join(ROOT, "data", "publish-queue.json");
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

function listFromSection(markdown, title, limit = 4) {
  const raw = markdown.match(new RegExp(`^##\\s+${title}\\s*$([\\s\\S]*?)(?=^##\\s+|\\Z)`, "m"))?.[1] || "";
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function titleForXhs(feature, post) {
  const direction = post?.direction || feature.direction || "大模型";
  const company = post?.company || feature.company || "今日";
  return `${company}${direction}面经复盘`.replace(/\s+/g, "").slice(0, 20);
}

function buildXhsPayload(feature, post, markdown) {
  const questions = Array.isArray(post?.questions) && post.questions.length
    ? post.questions.slice(0, 4)
    : listFromSection(markdown, "核心考点", 4);
  const detailedAnalysis = section(markdown, "详细解答与分析")
    || section(markdown, "今日结论")
    || section(markdown, "一句话总结");
  const conclusion = section(markdown, "今日结论") || `${feature.title}，适合作为今天的大模型面试复习材料。`;
  const sourcePlatform = feature.sourcePlatform || post?.sourcePlatform || "公开来源";
  const sourceDate = feature.sourceDate || post?.sourceDate || feature.date || "";
  const sourceUrl = feature.sourceUrl || post?.sourceUrl || "";
  const tags = [...new Set([
    ...(post?.tags || []),
    feature.company,
    feature.direction,
    "大模型面试",
    "AI学习",
  ])].filter(Boolean).slice(0, 10);

  const body = [
    `【每日精选】${feature.company || post?.company || ""} ${feature.direction || post?.direction || "大模型"}面经。`,
    "",
    "【面试题目】",
    ...questions.slice(0, 3).map((item, index) => `${index + 1}. ${item}`),
    "",
    "【详细解答与分析】",
    detailedAnalysis || conclusion,
    "",
    "【回答框架】",
    "按「核心机制 -> 工程取舍 -> 常见坑 -> 评估指标」组织，不要只背名词。",
    "",
    "【今天要记住】",
    "面试官想看的是：你能不能把模型结构、数据、训练、推理和业务落地讲成一条完整链路。",
    "",
    "引用 / 来源",
    `来源平台：${sourcePlatform}`,
    `原帖日期：${sourceDate || "未标注"}`,
    `原始链接：${sourceUrl || "未提供"}`,
    "说明：本文为基于公开面经整理的学习笔记，用于个人复习与知识归纳。",
    "",
    tags.map((tag) => `#${String(tag).replace(/\s+/g, "")}`).join(" "),
  ].filter((line) => line !== undefined).join("\n").slice(0, 980);

  return {
    id: `xhs-${feature.id || hash(feature.articlePath || feature.title)}`,
    title: titleForXhs(feature, post),
    coverTitle: `${feature.company || post?.company || "大模型"}面试题精讲`,
    coverSubtitle: `${feature.direction || post?.direction || "AI 面试"} 高频题`,
    body,
    sourcePlatform,
    sourceDate,
    sourceUrl,
    articlePath: feature.articlePath,
    featureId: feature.id,
    postId: feature.postId,
    createdAt: new Date().toISOString(),
  };
}

async function getJson(url) {
  const response = await fetch(url);
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

async function uploadCover(send, coverPath) {
  await send("DOM.enable");
  const root = await send("DOM.getDocument", { depth: -1, pierce: true });
  const input = await send("DOM.querySelector", { nodeId: root.root.nodeId, selector: "input[type=file]" });
  if (!input.nodeId) throw new Error("未找到小红书图片上传控件");
  await send("DOM.setFileInputFiles", { nodeId: input.nodeId, files: [coverPath] });
}

async function tryPublish(payload, coverPath) {
  const tab = await createPublishTab();
  const page = await new CdpSession(tab.webSocketDebuggerUrl).open();
  const send = page.send.bind(page);
  try {
    await send("Runtime.evaluate", { expression: "document.body.innerText", returnByValue: true });
    await uploadCover(send, coverPath);

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
  await writeJson(QUEUE_FILE, queue);
  return record;
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
  const coverPath = await ensureCoverImage(payload);
  if (SHOULD_RENDER_COVER_ONLY) {
    console.log(JSON.stringify({ featureId: feature.id, coverPath }, null, 2));
    return;
  }

  let result;
  try {
    result = await tryPublish(payload, coverPath);
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

  console.log(JSON.stringify({ featureId: feature.id, ok: result.ok, reason: result.reason, url: result.url || "", coverPath }, null, 2));
  commitAndPush();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
