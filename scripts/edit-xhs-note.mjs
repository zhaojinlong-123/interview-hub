import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const CDP = process.env.CHROME_CDP || "http://127.0.0.1:9222";
const ASSET_ID = process.argv.find((arg) => arg.startsWith("--asset="))?.slice(8);
const SHOULD_SUBMIT = process.argv.includes("--submit");

if (!ASSET_ID) {
  throw new Error("Usage: node scripts/edit-xhs-note.mjs --asset=<asset-id> [--submit]");
}

const ASSET_DIR = path.join(ROOT, "content", "xiaohongshu-edit-assets", ASSET_ID);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    }).on("error", reject);
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
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    };
    return this;
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  close() {
    this.ws?.close();
  }
}

async function getUpdatePage() {
  const pages = await getJson(`${CDP}/json`);
  const page = pages.find((item) => item.url.includes("creator.xiaohongshu.com/publish/update"));
  if (!page) throw new Error("No Xiaohongshu update page found");
  return page;
}

async function evaluate(send, expression, awaitPromise = false) {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result?.value;
}

async function deleteExistingImages(send) {
  let removed = 0;
  for (let index = 0; index < 20; index += 1) {
    const count = await evaluate(send, `document.querySelectorAll(".close-btn").length`);
    if (!count) break;
    await evaluate(send, `(() => {
      const el = document.querySelector(".close-btn");
      if (!el) return false;
      el.click();
      return true;
    })()`);
    removed += 1;
    await sleep(1000);
  }
  return removed;
}

async function deleteRemoteImages(send) {
  let removed = 0;
  for (let index = 0; index < 20; index += 1) {
    const result = await evaluate(send, `(() => {
      const buttons = Array.from(document.querySelectorAll(".close-btn"));
      for (const btn of buttons) {
        let node = btn.parentElement;
        let src = "";
        for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
          const img = node.querySelector?.("img");
          if (img?.src) {
            src = img.src;
            break;
          }
        }
        if (/^https?:\\/\\//.test(src)) {
          btn.click();
          return { removed: true, remaining: document.querySelectorAll(".close-btn").length, src };
        }
      }
      return { removed: false, remaining: buttons.length };
    })()`);
    if (!result.removed) break;
    removed += 1;
    await sleep(1000);
  }
  return removed;
}

async function uploadImages(send, imageFiles) {
  await send("DOM.enable");
  const root = await send("DOM.getDocument", { depth: -1, pierce: true });
  const inputs = await send("DOM.querySelectorAll", {
    nodeId: root.root.nodeId,
    selector: "input[type=file]",
  });
  if (!inputs.nodeIds?.length) throw new Error("No file input found");
  await send("DOM.setFileInputFiles", {
    nodeId: inputs.nodeIds[0],
    files: imageFiles,
  });
  await sleep(12000);
}

function jsString(value) {
  return JSON.stringify(String(value || ""));
}

async function fillText(send, post) {
  const title = jsString(post.title);
  const body = jsString(post.body);
  return evaluate(send, `(() => {
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const setValue = (el, value) => {
      el.focus();
      if (el.isContentEditable) {
        el.innerText = value;
      } else {
        el.value = value;
      }
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const inputs = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true']")).filter(visible);
    const titleInput = inputs.find((el) => el.tagName === "INPUT" && el.type === "text" && /标题|title/i.test(el.placeholder || ""));
    const contentInput = inputs.find((el) => el.isContentEditable);
    if (!titleInput || !contentInput) return { ok: false, reason: "title/content input not found", inputs: inputs.map((el) => ({ tag: el.tagName, type: el.type || "", placeholder: el.placeholder || "", text: (el.value || el.innerText || "").slice(0, 40) })) };
    setValue(titleInput, ${title});
    setValue(contentInput, ${body});
    document.querySelector(".publish-page")?.scrollTo(0, document.querySelector(".publish-page").scrollHeight);
    window.scrollTo(0, document.body.scrollHeight);
    return { ok: true };
  })()`);
}

async function submit(send) {
  await evaluate(send, `(() => {
    document.querySelector(".publish-page")?.scrollTo(0, document.querySelector(".publish-page").scrollHeight);
    window.scrollTo(0, document.body.scrollHeight);
    return true;
  })()`);
  await sleep(1000);
  const direct = await evaluate(send, `(() => {
    const target = document.querySelector("xhs-publish-btn");
    if (!target) return { ok: false, reason: "submit element not found" };
    const innerButton = target._app?._container?.querySelector?.("button.ce-btn");
    if (innerButton) {
      innerButton.click();
      return { ok: true, method: "inner-button" };
    }
    if (typeof target._onPublish === "function") {
      target._onPublish();
      return { ok: true, method: "_onPublish" };
    }
    target.dispatchEvent(new CustomEvent("publish", { bubbles: true, composed: true }));
    return { ok: true, method: "publish-event" };
  })()`);
  await sleep(45000);
  const directState = await evaluate(send, `(() => ({ url: location.href, text: (document.body.innerText || "").slice(0, 1200) }))()`);
  if (/成功|审核中|已发布|published=true/.test(`${directState.url}\n${directState.text}`)) {
    return { ok: true, direct, state: directState };
  }
  const rect = await evaluate(send, `(() => {
    const target = document.querySelector("xhs-publish-btn");
    if (!target) return null;
    const r = target.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, text: target.getAttribute("submit-text") || "" };
  })()`);
  if (!rect) return { ok: false, reason: "submit button not found" };
  const x = rect.x + rect.w * 0.5;
  const y = rect.y + rect.h * 0.5;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", buttons: 0, pointerType: "mouse" });
    await sleep(150);
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" });
    await sleep(180);
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" });
    await sleep(3000);
  }
  await sleep(45000);
  const state = await evaluate(send, `(() => ({ url: location.href, text: (document.body.innerText || "").slice(0, 1200) }))()`);
  return { ok: /成功|审核中|已发布|published=true/.test(`${state.url}\n${state.text}`), state, rect };
}

async function main() {
  const post = JSON.parse(await fs.readFile(path.join(ASSET_DIR, "post.json"), "utf8"));
  const imageFiles = post.imageFiles.map((file) => path.join(ROOT, file));
  const page = await getUpdatePage();
  const cdp = await new CdpSession(page.webSocketDebuggerUrl).open();
  const send = cdp.send.bind(cdp);
  try {
    await send("Runtime.enable");
    await send("Page.enable");
    const before = await evaluate(send, `(() => ({ url: location.href, closeCount: document.querySelectorAll(".close-btn").length, text: (document.body.innerText || "").slice(0, 400) }))()`);
    await uploadImages(send, imageFiles);
    const removed = await deleteRemoteImages(send);
    const filled = await fillText(send, post);
    if (!filled.ok) throw new Error(JSON.stringify(filled));
    const afterFill = await evaluate(send, `(() => ({ closeCount: document.querySelectorAll(".close-btn").length, text: (document.body.innerText || "").slice(0, 900) }))()`);
    let submitted = { ok: false, skipped: true };
    if (SHOULD_SUBMIT) submitted = await submit(send);
    console.log(JSON.stringify({ asset: ASSET_ID, before, removed, afterFill, submitted }, null, 2));
  } finally {
    cdp.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
