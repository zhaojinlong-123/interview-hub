import http from "node:http";

const CDP = process.env.CHROME_CDP || "http://127.0.0.1:9222";
const DRAFTS = [
  "视频时序理解题目精讲",
  "字节多模态大模型题目精讲",
  "KVCache推理部署题目精讲",
  "对齐训练RLHF题目精讲",
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms)),
  ]);
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

async function getJson(pathname) {
  return JSON.parse(await getRaw(pathname));
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

async function creatorPage() {
  const pages = await getJson("/json");
  const publishPages = pages.filter((item) => item.type === "page" && item.url.includes("creator.xiaohongshu.com/publish/publish"));
  let page = null;
  let bestDraftCount = -1;
  for (const item of publishPages) {
    const probe = await new CdpSession(item.webSocketDebuggerUrl).open();
    try {
      const result = await probe.send("Runtime.evaluate", {
        expression: `document.querySelectorAll(".draft-item").length`,
        returnByValue: true,
      }, 8000).catch(() => null);
      const count = Number(result?.result?.value || 0);
      if (count > bestDraftCount) {
        bestDraftCount = count;
        page = item;
      }
    } finally {
      probe.close();
    }
  }
  page ||= pages.find((item) => item.type === "page" && item.url.includes("creator.xiaohongshu.com"))
    || pages.find((item) => item.type === "page");
  if (!page) throw new Error("No controllable Chrome page found");
  return page;
}

async function openDraftList(page) {
  const count = await page.send("Runtime.evaluate", {
    expression: `document.querySelectorAll(".draft-item").length`,
    returnByValue: true,
  }, 12000).catch(() => null);
  if (Number(count?.result?.value || 0) > 0) return;
  await page.send("Runtime.evaluate", {
    expression: `location.href = "https://creator.xiaohongshu.com/publish/publish?from=automation&target=image"`,
    returnByValue: true,
  }, 12000).catch(() => {});
  await sleep(7000);
}

async function publishDraft(page, title) {
  await openDraftList(page);
  const clickedDraft = await page.send("Runtime.evaluate", {
    expression: `(() => {
      const title = ${JSON.stringify(title)};
      const item = [...document.querySelectorAll(".draft-item")]
        .find((node) => (node.innerText || "").includes(title));
      if (!item) return { ok: false, reason: "draft not found", text: (document.body.innerText || "").slice(0, 1800) };
      const edit = item.querySelector(".draft-actions .btn") || item.querySelector(".btn");
      if (!edit) return { ok: false, reason: "edit button not found", text: item.innerText };
      edit.click();
      return { ok: true, title, text: item.innerText };
    })()`,
    returnByValue: true,
  }, 15000);
  if (!clickedDraft.result?.value?.ok) return clickedDraft.result?.value || { ok: false, reason: "unknown draft click failure" };
  await sleep(10000);

  const ready = await page.send("Runtime.evaluate", {
    expression: `(() => ({
      text: (document.body.innerText || "").slice(0, 1600),
      title: document.querySelector('input[placeholder="填写标题会有更多赞哦"]')?.value || "",
      hasPublish: Boolean(document.querySelector("xhs-publish-btn")),
      inner: document.querySelector("xhs-publish-btn")?._app?._container?.innerHTML || "",
    }))()`,
    returnByValue: true,
  }, 15000);
  const value = ready.result?.value || {};
  if (!value.hasPublish) return { ok: false, reason: "editor did not open", state: value };

  const clickedPublish = await page.send("Runtime.evaluate", {
    expression: `(() => {
      const root = document.querySelector("xhs-publish-btn")?._app?._container;
      const button = root?.querySelector?.("button.bg-red")
        || [...(root?.querySelectorAll?.("button.ce-btn") || [])].find((item) => (item.innerText || item.textContent || "").trim() === "发布")
        || [...document.querySelectorAll("button")].find((item) => /发布|提交/.test(item.innerText || item.textContent || "") && !item.disabled);
      if (!button) return { ok: false, reason: "publish button not found", text: (document.body.innerText || "").slice(-1200) };
      button.scrollIntoView({ block: "center" });
      button.click();
      return { ok: true, text: button.innerText || button.textContent || "" };
    })()`,
    returnByValue: true,
  }, 15000);
  if (!clickedPublish.result?.value?.ok) return clickedPublish.result?.value || { ok: false, reason: "unknown publish click failure" };
  await sleep(55000);

  const state = await page.send("Runtime.evaluate", {
    expression: `(() => ({ url: location.href, text: (document.body.innerText || "").slice(0, 2200) }))()`,
    returnByValue: true,
  }, 15000);
  const finalState = state.result?.value || {};
  const ok = String(finalState.url || "").includes("published=true") || /审核中|已发布|发布成功|note-manager/.test(finalState.text || "");
  return { ok, reason: ok ? "published or submitted for review" : "no success marker", state: finalState };
}

const tab = await creatorPage();
const page = await new CdpSession(tab.webSocketDebuggerUrl).open();
const results = [];
try {
  for (const title of DRAFTS) {
    console.log(`Publishing draft: ${title}`);
    const result = await publishDraft(page, title);
    results.push({ title, ...result });
    console.log(JSON.stringify(results.at(-1), null, 2));
  }
} finally {
  page.close();
}

console.log(JSON.stringify(results, null, 2));
