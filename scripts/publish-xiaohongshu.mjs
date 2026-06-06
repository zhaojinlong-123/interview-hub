import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POSTS_FILE = path.join(ROOT, "data", "posts.json");
const FEATURES_FILE = path.join(ROOT, "data", "daily-features.json");
const QUEUE_FILE = path.join(ROOT, "data", "publish-queue.json");
const CDP = process.env.CHROME_CDP || "http://127.0.0.1:9222";
const SHOULD_PUSH = process.argv.includes("--push");
const SHOULD_OPEN_ONLY = process.argv.includes("--open-only");
const CREATOR_URL = process.env.XHS_CREATOR_URL || "https://creator.xiaohongshu.com/publish/publish";

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
    `今天复盘一条${feature.company || post?.company || ""}的${feature.direction || post?.direction || "大模型"}面经。`,
    "",
    "01 为什么值得看",
    conclusion,
    "",
    "02 面试高频考点",
    ...questions.map((item, index) => `${index + 1}. ${item}`),
    "",
    "03 复习方法",
    "不要只背答案。建议每个问题都按「核心机制 -> 工程取舍 -> 常见坑 -> 评估指标」四层准备。",
    "",
    "04 今天要记住",
    "面试官真正想看的是：你能不能把模型结构、数据、训练、推理和业务落地讲成一条完整链路。",
    "",
    "引用 / 来源",
    `来源平台：${sourcePlatform}`,
    `原帖日期：${sourceDate || "未标注"}`,
    `原始链接：${sourceUrl || "未提供"}`,
    "说明：本文为基于公开面经整理的学习笔记，用于个人复习与知识归纳。",
    "",
    tags.map((tag) => `#${String(tag).replace(/\s+/g, "")}`).join(" "),
  ].filter((line) => line !== undefined).join("\n");

  return {
    id: `xhs-${feature.id || hash(feature.articlePath || feature.title)}`,
    title: titleForXhs(feature, post),
    coverTitle: `${feature.company || post?.company || "大模型"}面经复盘`,
    coverSubtitle: `${feature.direction || post?.direction || "AI 面试"}｜高频考点`,
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

function wsRequest(wsUrl, messages, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let nextId = 1;
    const pending = new Map();
    const results = [];
    const timer = setTimeout(() => reject(new Error("CDP timeout")), timeout);
    ws.onopen = () => {
      for (const msg of messages) {
        const id = nextId++;
        pending.set(id, msg.method);
        ws.send(JSON.stringify({ id, ...msg }));
      }
    };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (!data.id) return;
      results.push({ method: pending.get(data.id), data });
      pending.delete(data.id);
      if (!pending.size) {
        clearTimeout(timer);
        ws.close();
        resolve(results);
      }
    };
    ws.onerror = reject;
  });
}

async function createPublishTab() {
  const version = await getJson(`${CDP}/json/version`);
  const browserWs = version.webSocketDebuggerUrl;
  const created = await wsRequest(browserWs, [{ method: "Target.createTarget", params: { url: CREATOR_URL } }]);
  const targetId = created[0].data.result.targetId;
  await new Promise((resolve) => setTimeout(resolve, 8000));
  const tabs = await getJson(`${CDP}/json/list`);
  const tab = tabs.find((item) => item.id === targetId) || tabs.find((item) => item.url.includes("xiaohongshu.com"));
  if (!tab) throw new Error("未找到小红书发布页标签");
  return tab;
}

async function tryPublish(payload) {
  const tab = await createPublishTab();
  const expression = `(async () => {
    const payload = ${JSON.stringify(payload)};
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const textOf = el => (el?.innerText || el?.textContent || el?.value || "").trim();
    const visible = el => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
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
    await sleep(3000);
    const bodyText = document.body.innerText || "";
    if (/登录|验证码|安全验证|扫码|手机号/.test(bodyText) && !/发布|笔记|正文/.test(bodyText)) {
      return { ok: false, reason: "小红书需要登录或安全验证", url: location.href };
    }
    const inputs = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']")).filter(visible);
    const titleInput = inputs.find(el => /标题|title/i.test(el.placeholder || el.getAttribute("aria-label") || "")) || inputs[0];
    const contentInput = inputs.find(el => /正文|内容|描述|caption|content/i.test(el.placeholder || el.getAttribute("aria-label") || "")) || inputs.find(el => el !== titleInput && (el.isContentEditable || el.tagName === "TEXTAREA")) || inputs[1];
    if (!titleInput || !contentInput) {
      return { ok: false, reason: "没有找到标题或正文输入框，可能需要上传图片/视频后才能编辑", url: location.href };
    }
    setValue(titleInput, payload.title);
    await sleep(800);
    setValue(contentInput, payload.body);
    await sleep(1200);
    if (${SHOULD_OPEN_ONLY ? "true" : "false"}) {
      return { ok: false, reason: "已填入发布页，按 open-only 参数保留为人工发布", url: location.href };
    }
    const buttons = Array.from(document.querySelectorAll("button, [role='button']")).filter(visible);
    const publishButton = buttons.find(el => /发布|提交|立即发布/.test(textOf(el)) && !/定时|设置/.test(textOf(el)));
    if (!publishButton) {
      return { ok: false, reason: "已填入内容，但没有找到发布按钮，可能需要上传封面或通过安全验证", url: location.href };
    }
    publishButton.click();
    await sleep(6000);
    const afterText = document.body.innerText || "";
    if (/发布成功|发布完成|审核中|已发布/.test(afterText)) {
      return { ok: true, reason: "发布成功或进入审核", url: location.href };
    }
    if (/验证码|安全验证|上传|图片|视频|失败|错误/.test(afterText)) {
      return { ok: false, reason: "已尝试点击发布，但页面要求额外验证或素材", url: location.href };
    }
    return { ok: false, reason: "已尝试发布，未检测到成功提示，请人工确认", url: location.href };
  })()`;
  const result = await wsRequest(tab.webSocketDebuggerUrl, [
    { method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } },
  ], 45000);
  return result[0].data.result?.result?.value || { ok: false, reason: "发布脚本没有返回结果" };
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
    await writeJson(FEATURES_FILE, features);
  }
}

function commitAndPush() {
  if (!SHOULD_PUSH) return;
  execFileSync("git", ["-c", "safe.directory=E:/workshop/interview-hub", "add", "data/daily-features.json", "data/publish-queue.json"], { cwd: ROOT, stdio: "inherit" });
  execFileSync("git", ["-c", "safe.directory=E:/workshop/interview-hub", "commit", "-m", "Update Xiaohongshu publish status"], { cwd: ROOT, stdio: "inherit" });
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

  let result;
  try {
    result = await tryPublish(payload);
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

  console.log(JSON.stringify({ featureId: feature.id, ok: result.ok, reason: result.reason, url: result.url || "" }, null, 2));
  commitAndPush();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
