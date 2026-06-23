import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const CDP = process.env.CHROME_CDP || "http://127.0.0.1:9222";
const POST_ID = process.argv.find((arg) => arg.startsWith("--post-id="))?.slice("--post-id=".length);
if (!POST_ID) throw new Error("Usage: node scripts/publish-xhs-queue-post-real-input.mjs --post-id=<postId>");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(method, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${CDP}${pathname}`, { method }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => resolve(body));
    });
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error(`timeout ${method} ${pathname}`)));
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

  send(method, params = {}, timeout = 30000) {
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

async function setText(page, selectorExpression, text, label) {
  const focus = await page.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const visible = (el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };
      const el = (${selectorExpression});
      if (!el) return { ok: false, reason: ${JSON.stringify(`${label} not found`)}, body: document.body.innerText.slice(0, 1000) };
      el.scrollIntoView({ block: "center" });
      el.focus();
      el.click?.();
      return { ok: true, before: el.value || el.innerText || "" };
    })()`,
  });
  if (!focus.result.value.ok) throw new Error(JSON.stringify(focus.result.value));
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Control", code: "ControlLeft", windowsVirtualKeyCode: 17, nativeVirtualKeyCode: 17, modifiers: 2 });
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65, modifiers: 2 });
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65, modifiers: 2 });
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Control", code: "ControlLeft", windowsVirtualKeyCode: 17, nativeVirtualKeyCode: 17 });
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8 });
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8 });
  await sleep(300);
  await page.send("Input.insertText", { text });
  await sleep(1000);
  const after = await page.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const el = (${selectorExpression});
      return { value: el?.value || el?.innerText || "", body: (document.body.innerText || "").slice(0, 1600) };
    })()`,
  });
  return { before: focus.result.value.before, after: after.result.value.value };
}

const queue = JSON.parse(await fs.readFile(path.join(ROOT, "data", "publish-queue.json"), "utf8"));
const post = queue.find((item) => item.postId === POST_ID);
if (!post) throw new Error(`Post not found: ${POST_ID}`);
const imagePaths = post.imageCardFiles.map((file) => path.join(ROOT, file));
for (const file of imagePaths) await fs.access(file);

const pageInfo = JSON.parse(await request("PUT", `/json/new?${encodeURIComponent("https://creator.xiaohongshu.com/publish/publish?from=automation&target=image")}`));
const page = await new CdpSession(pageInfo.webSocketDebuggerUrl).open();

try {
  await page.send("Runtime.enable");
  await page.send("Page.enable");
  await page.send("DOM.enable");
  await page.send("Input.setIgnoreInputEvents", { ignore: false }).catch(() => {});
  await page.send("Page.bringToFront");
  await sleep(8000);

  const root = await page.send("DOM.getDocument", { depth: -1, pierce: true });
  const input = await page.send("DOM.querySelector", { nodeId: root.root.nodeId, selector: "input[type=file]" });
  if (!input.nodeId) throw new Error("file input not found");
  await page.send("DOM.setFileInputFiles", { nodeId: input.nodeId, files: imagePaths });
  await sleep(15000);

  const titleResult = await setText(
    page,
    `[...document.querySelectorAll("input")].find((item) => item.placeholder === "填写标题会有更多赞哦") || [...document.querySelectorAll("input[type=text]")].find((item) => item.getBoundingClientRect().width > 0)`,
    post.title,
    "title",
  );
  const bodyResult = await setText(
    page,
    `[...document.querySelectorAll("[contenteditable='true']")].find((item) => item.getBoundingClientRect().width > 0 && item.getBoundingClientRect().height > 0)`,
    post.body,
    "body",
  );

  const rectResult = await page.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      document.activeElement?.blur?.();
      document.querySelector(".publish-page")?.scrollTo(0, document.querySelector(".publish-page").scrollHeight);
      window.scrollTo(0, document.body.scrollHeight);
      const target = document.querySelector("xhs-publish-btn");
      if (!target) return { ok: false, reason: "xhs-publish-btn not found", body: document.body.innerText.slice(-1000) };
      target.scrollIntoView({ block: "center" });
      const buttons = [...(target._app?._container?.querySelectorAll?.("button") || [])];
      const publishButton = buttons.find((button) => (button.innerText || button.textContent || "").trim() === "发布")
        || buttons.find((button) => /发布/.test(button.innerText || button.textContent || "") && !/暂存|草稿/.test(button.innerText || button.textContent || ""));
      const clickTarget = publishButton || target;
      const rect = clickTarget.getBoundingClientRect();
      return {
        ok: true,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        w: rect.width,
        h: rect.height,
        text: clickTarget.innerText || clickTarget.textContent || "",
        disabled: clickTarget.disabled || target.getAttribute("submit-disabled")
      };
    })()`,
  });
  const rect = rectResult.result.value;
  if (!rect.ok) throw new Error(JSON.stringify(rect));
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x, y: rect.y, button: "none", buttons: 0, pointerType: "mouse" });
  await sleep(100);
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: rect.x, y: rect.y, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" });
  await sleep(100);
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rect.x, y: rect.y, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" });
  await sleep(6000);
  const fallback = await page.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      if (!location.href.includes("/publish/publish")) return { ok: true, method: "already-left", url: location.href };
      const target = document.querySelector("xhs-publish-btn");
      const buttons = [...(target?._app?._container?.querySelectorAll?.("button") || [])];
      const inner = buttons.find((button) => (button.innerText || button.textContent || "").trim() === "发布")
        || buttons.find((button) => /发布/.test(button.innerText || button.textContent || "") && !/暂存|草稿/.test(button.innerText || button.textContent || ""));
      if (inner) {
        inner.click();
        return { ok: true, method: "inner-button", text: inner.innerText || inner.textContent || "" };
      }
      if (target && typeof target._onPublish === "function") {
        target._onPublish();
        return { ok: true, method: "_onPublish" };
      }
      if (target) {
        target.click();
        target.dispatchEvent(new CustomEvent("publish", { bubbles: true, composed: true }));
        return { ok: true, method: "custom-element" };
      }
      return { ok: false, reason: "publish component not found", text: document.body.innerText.slice(-1200) };
    })()`,
  });
  await sleep(50000);

  const state = await page.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => ({ url: location.href, text: (document.body.innerText || "").slice(0, 1800) }))()`,
  });
  console.log(JSON.stringify({
    postId: POST_ID,
    title: post.title,
    titleResult,
    bodyResult,
    clickRect: rect,
    fallback: fallback.result.value,
    ok: /published=true|note-manager|审核中|已发布|发布成功/.test(`${state.result.value.url}\n${state.result.value.text}`),
    state: state.result.value,
  }, null, 2));
} finally {
  page.close();
}
