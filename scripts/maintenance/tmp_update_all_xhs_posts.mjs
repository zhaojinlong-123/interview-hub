import fs from "node:fs";
import path from "node:path";

const ROOT = "E:/workshop/interview-hub";
const TARGET_MANAGER_URL = "https://creator.xiaohongshu.com/new/note-manager";
const FEATURES = JSON.parse(fs.readFileSync(path.join(ROOT, "data/daily-features.json"), "utf8"));
const POSTS = JSON.parse(fs.readFileSync(path.join(ROOT, "data/posts.json"), "utf8"));

const jobs = [
  { title: "字节训练框架推理优化题目精讲", featureId: "daily-2026-06-13-9d3c283ef28d" },
  { title: "蔚来VLA具身智能题目精讲", featureId: "daily-2026-06-13-08551c35562c" },
  { title: "字节VLA具身智能题目精讲", featureId: "daily-2026-06-13-2d55b23ddce6" },
  { title: "阿里多模态大模型题目精讲", featureId: "daily-2026-06-13-c026b29d4659" },
  { title: "VLA具身智能题目精讲", featureId: "daily-2026-06-13-176a8d789a4e" },
  { title: "字节多模态大模型题目精讲", featureId: "daily-2026-06-12-362a59bc5046" },
];

function cleanLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function tagsFor(feature, post) {
  return [...new Set([
    feature.sourcePlatform,
    feature.company,
    feature.direction,
    ...(post?.tags || []),
    "大模型面试",
    "AI学习",
  ])]
    .filter(Boolean)
    .slice(0, 8)
    .map((tag) => `#${String(tag).replace(/\s+/g, "").replace(/[|/｜]/g, "")}`)
    .join(" ");
}

function bodyFor(feature) {
  const post = POSTS.find((item) => item.id === feature.postId);
  const company = feature.company || post?.company || "综合";
  const direction = feature.direction || post?.direction || "AI 面试";
  const focus = direction.includes("训练") || direction.includes("推理")
    ? "重点看训练框架、显存拆解、推理加速、量化部署和工程取舍。"
    : direction.includes("VLA") || direction.includes("具身") || direction.includes("世界模型")
      ? "重点看动作表示、机器人数据、世界模型、仿真闭环和评估指标。"
      : "重点看 VLM 对齐、视觉理解、数据构造、幻觉评估和工程落地。";
  return [
    `每日精选：${company}｜${direction}题目精讲`,
    `本篇图卡包含：面试题目、完整解答、追问方向。第一页先看公司、方向、题目，后面按顺序复习完整答案。${focus}`,
    "",
    `引用来源：${feature.sourcePlatform || post?.sourcePlatform || "公开来源"}${feature.sourceDate ? `，${feature.sourceDate}` : ""}`,
    feature.sourceUrl ? `原文链接：${feature.sourceUrl}` : "",
    tagsFor(feature, post),
  ].filter((line) => line !== "").join("\n");
}

function imagePathsFor(featureId) {
  const dir = path.join(ROOT, "content/xiaohongshu-assets", `xhs-${featureId}`);
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith(".png") && !file.includes("source"))
    .sort()
    .map((file) => path.join(dir, file));
}

async function getPages() {
  return fetch("http://127.0.0.1:9222/json/list").then((response) => response.json());
}

async function newPage(url) {
  const encoded = encodeURIComponent(url);
  const response = await fetch(`http://127.0.0.1:9222/json/new?${encoded}`, { method: "PUT" });
  return response.json();
}

class Cdp {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
  }

  async open() {
    this.ws = new WebSocket(this.wsUrl);
    this.ws.addEventListener("message", (event) => {
      const text = typeof event.data === "string" ? event.data : Buffer.from(event.data).toString("utf8");
      const message = JSON.parse(text);
      if (this.pending.has(message.id)) {
        this.pending.get(message.id)(message);
        this.pending.delete(message.id);
      }
    });
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    return this;
  }

  send(method, params = {}, timeout = 20000) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return Promise.race([
      new Promise((resolve) => this.pending.set(id, resolve)),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout ${method}`)), timeout)),
    ]);
  }

  async eval(expression, timeout = 20000) {
    const response = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    }, timeout);
    return response.result?.result?.value;
  }

  close() {
    this.ws?.close();
  }
}

async function waitFor(page, expression, timeout = 60000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await page.eval(expression, 12000).catch(() => null);
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 900));
  }
  return null;
}

async function uploadFiles(page, files) {
  await page.send("DOM.enable");
  const root = await page.send("DOM.getDocument", { depth: -1, pierce: true });
  const input = await page.send("DOM.querySelector", {
    nodeId: root.result.root.nodeId,
    selector: "input[type=file]",
  });
  if (!input.result.nodeId) {
    const debug = await page.eval(`JSON.stringify({
      url: location.href,
      title: document.title,
      text: document.body.innerText.slice(0, 1200),
      inputs: [...document.querySelectorAll('input')].map((item) => ({
        type: item.type,
        accept: item.accept,
        visible: item.getBoundingClientRect().width > 0 || item.getBoundingClientRect().height > 0,
      })),
    })`).catch((error) => error.message);
    throw new Error(`file input not found: ${debug}`);
  }
  await page.send("DOM.setFileInputFiles", { nodeId: input.result.nodeId, files }, 30000);
}

async function updatePostByTitle(job) {
  const { title, featureId } = job;
  const feature = FEATURES.find((item) => item.id === featureId);
  if (!feature) throw new Error(`feature not found: ${featureId}`);
  const images = imagePathsFor(featureId);
  const body = bodyFor(feature);

  const managerTarget = await newPage(TARGET_MANAGER_URL);
  const page = await new Cdp(managerTarget.webSocketDebuggerUrl).open();
  try {
    await page.send("Runtime.enable");
    await page.send("Page.bringToFront");
    await waitFor(page, "document.querySelectorAll('.note-card').length >= 6", 45000);

    const opened = await page.eval(`(() => {
      const expectedTitle = ${JSON.stringify(title)};
      const cards = [...document.querySelectorAll('.note-card')];
      const titles = cards.map((item) => item.querySelector('.note-card__title')?.textContent?.trim() || '');
      const card = cards.find((item) => (item.querySelector('.note-card__title')?.textContent?.trim() || '') === expectedTitle);
      if (!card) return { ok: false, reason: 'card title not found', expectedTitle, titles };
      const title = card.querySelector('.note-card__title')?.textContent?.trim() || '';
      const actions = [...card.querySelectorAll('.note-card__action-btn')];
      const edit = actions[2];
      if (!edit) return { ok: false, reason: 'no edit action', title, actions: actions.length };
      edit.click();
      return { ok: true, title };
    })()`);
    if (!opened?.ok) throw new Error(`open edit failed: ${JSON.stringify(opened)}`);
    await waitFor(page, "location.href.includes('/publish/update')", 45000);
    await waitFor(page, "document.querySelector('input[type=file]') || document.querySelectorAll('.img-idx').length > 0", 90000);

    const oldCount = Number(await page.eval("document.querySelectorAll('.img-idx').length")) || 0;
    await uploadFiles(page, images);
    await waitFor(page, `document.querySelectorAll('.img-idx').length >= ${oldCount + images.length}`, 90000);
    await page.eval(`(async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      for (let i = 0; i < ${oldCount}; i += 1) {
        const button = document.querySelector('.close-btn');
        if (!button) return false;
        button.click();
        await sleep(550);
      }
      return true;
    })()`, 45000);
    await waitFor(page, `document.querySelectorAll('.img-idx').length === ${images.length}`, 90000);

    const bodyResult = await page.eval(`(async () => {
      const body = ${JSON.stringify(body)};
      const editor = document.querySelector('.tiptap.ProseMirror') || document.querySelector('[contenteditable=true]');
      if (!editor) return { ok: false, reason: 'no editor' };
      editor.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand('delete', false, null);
      document.execCommand('insertText', false, body);
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: body }));
      editor.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { ok: true, text: editor.innerText, count: document.querySelectorAll('.img-idx').length };
    })()`, 45000);
    if (!bodyResult?.ok) throw new Error(`body update failed: ${JSON.stringify(bodyResult)}`);

    const publishResult = await page.eval(`(async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const main = document.querySelector('.publish-page') || document.body;
      main.scrollTo?.(0, main.scrollHeight);
      window.scrollTo?.(0, document.body.scrollHeight);
      await sleep(800);
      const candidates = [...document.querySelectorAll('xhs-publish-btn, button')]
        .filter((element) => /发布|更新|保存/.test(element.innerText || element.textContent || '') || element.tagName.toLowerCase() === 'xhs-publish-btn')
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return { element, rect, text: (element.innerText || element.textContent || '').trim() };
        })
        .filter((item) => item.rect.width > 20 && item.rect.height > 20 && item.rect.x > 250 && item.rect.y > 300);
      const target = candidates.find((item) => item.element.tagName.toLowerCase() === 'xhs-publish-btn')?.element
        || candidates[candidates.length - 1]?.element
        || document.elementFromPoint(779, 888);
      if (!target) return { clicked: false, reason: 'no publish button' };
      target.scrollIntoView?.({ block: 'center' });
      await sleep(500);
      target.click();
      await sleep(10000);
      return {
        clicked: true,
        url: location.href,
        count: document.querySelectorAll('.img-idx').length,
        hasLink: (document.querySelector('.tiptap.ProseMirror')?.innerText || '').includes('原文链接'),
        tail: document.body.innerText.slice(-300),
      };
    })()`, 45000);

    console.log(JSON.stringify({
      featureId,
      openedTitle: cleanLine(opened.title),
      oldCount,
      newCount: images.length,
      bodyHasLink: bodyResult.text.includes("原文链接"),
      publishResult,
    }, null, 2));
  } finally {
    page.close();
  }
}

for (const job of jobs) {
  await updatePostByTitle(job);
}
