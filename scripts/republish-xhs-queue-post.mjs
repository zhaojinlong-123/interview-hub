import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const CDP = process.env.CHROME_CDP || "http://127.0.0.1:9222";
const POST_ID = process.argv.find((arg) => arg.startsWith("--post-id="))?.slice("--post-id=".length);
if (!POST_ID) throw new Error("Usage: node scripts/republish-xhs-queue-post.mjs --post-id=<postId>");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(method, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${CDP}${pathname}`, { method }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve(body));
    });
    req.on("error", reject);
    req.setTimeout(12000, () => req.destroy(new Error(`timeout ${method} ${pathname}`)));
    req.end();
  });
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
      const pending = this.pending.get(data.id);
      if (!pending) return;
      this.pending.delete(data.id);
      data.error ? pending.reject(new Error(data.error.message)) : pending.resolve(data.result);
    };
    return this;
  }
  send(method, params = {}, timeout = 25000) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return Promise.race([
      new Promise((resolve, reject) => this.pending.set(id, { resolve, reject })),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout ${method}`)), timeout)),
    ]);
  }
  close() {
    this.ws?.close();
  }
}

function setInputExpression(title, body) {
  return `(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const setInput = (input, value) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      input.focus();
      setter.call(input, value);
      input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: value }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.blur();
    };
    const titleInput = [...document.querySelectorAll("input[type='text'], input")]
      .filter(visible)
      .find((item) => /标题|title|填写/.test(item.placeholder || "") || item.maxLength >= 20);
    if (!titleInput) return { ok: false, reason: "title input not found" };
    setInput(titleInput, ${JSON.stringify(title)});
    const editor = [...document.querySelectorAll("[contenteditable='true']")].filter(visible)[0];
    if (!editor) return { ok: false, reason: "body editor not found" };
    editor.focus();
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, ${JSON.stringify(body)});
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: ${JSON.stringify(body)} }));
    editor.blur();
    return { ok: true, title: titleInput.value, body: editor.innerText };
  })()`;
}

const queue = JSON.parse(await fs.readFile(path.join(ROOT, "data", "publish-queue.json"), "utf8"));
const post = queue.find((item) => item.postId === POST_ID);
if (!post) throw new Error(`Post not found in queue: ${POST_ID}`);
const imagePaths = post.imageCardFiles.map((file) => path.join(ROOT, file));
for (const file of imagePaths) await fs.access(file);

const pageInfo = JSON.parse(await request("PUT", `/json/new?${encodeURIComponent("https://creator.xiaohongshu.com/publish/publish?from=automation&target=image")}`));
const page = await new CdpSession(pageInfo.webSocketDebuggerUrl).open();
try {
  await page.send("Runtime.enable");
  await page.send("DOM.enable");
  await sleep(8000);
  const root = await page.send("DOM.getDocument", { depth: -1, pierce: true });
  const input = await page.send("DOM.querySelector", { nodeId: root.root.nodeId, selector: "input[type=file]" });
  if (!input.nodeId) throw new Error("file input not found");
  await page.send("DOM.setFileInputFiles", { nodeId: input.nodeId, files: imagePaths });
  await sleep(15000);
  const filled = await page.send("Runtime.evaluate", {
    expression: setInputExpression(post.title, post.body),
    returnByValue: true,
  });
  if (!filled.result?.value?.ok) throw new Error(JSON.stringify(filled.result?.value));
  await sleep(3000);
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
  });
  if (!clicked.result?.value?.ok) throw new Error(JSON.stringify(clicked.result?.value));
  await sleep(45000);
  const state = await page.send("Runtime.evaluate", {
    expression: `(() => ({ url: location.href, text: document.body.innerText.slice(0, 1600) }))()`,
    returnByValue: true,
  });
  console.log(JSON.stringify({
    postId: POST_ID,
    title: post.title,
    ok: /published=true|审核中|已发布|发布成功|note-manager/.test(`${state.result.value.url}\n${state.result.value.text}`),
    state: state.result.value,
  }, null, 2));
} finally {
  page.close();
}
