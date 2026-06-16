import http from "node:http";

const CDP = process.env.CHROME_CDP || "http://127.0.0.1:9222";

const jobs = [
  {
    noteId: "6a2cd7840000000015024480",
    title: "VLA具身智能题目精讲",
    reason: "source is GitHub/OpenVLA, not a company interview source",
  },
  {
    noteId: "6a2cd79b000000001c0278b0",
    title: "阿里多模态连接层题目精讲",
    reason: "source title explicitly points to Alibaba multimodal interview content",
  },
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
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => resolve(body));
    });
    req.on("error", reject);
    req.setTimeout(8000, () => {
      req.destroy(new Error(`HTTP timeout: ${pathname}`));
    });
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
      if (data.error) pending.reject(new Error(data.error.message));
      else pending.resolve(data.result);
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

async function controllablePage() {
  const pages = await getJson("/json");
  const page = pages.find((item) => item.type === "page" && item.url.includes("creator.xiaohongshu.com"))
    || pages.find((item) => item.type === "page");
  if (!page) throw new Error("No controllable page found");
  return page;
}

async function updateJob(job) {
  const tab = await controllablePage();
  const page = await new CdpSession(tab.webSocketDebuggerUrl).open();
  try {
    const url = `https://creator.xiaohongshu.com/publish/update?source=&id=${job.noteId}&noteType=normal`;
    await page.send("Page.navigate", { url }, 10000);
    await sleep(9000);
    const filled = await page.send("Runtime.evaluate", {
      expression: `(() => {
        const input = document.querySelector('input[placeholder="填写标题会有更多赞哦"]');
        if (!input) return { ok: false, reason: "title input not found", text: document.body.innerText.slice(0, 500) };
        input.focus();
        input.select?.();
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        setter.call(input, ${JSON.stringify(job.title)});
        input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: ${JSON.stringify(job.title)} }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.blur();
        return { ok: true, value: input.value };
      })()`,
      returnByValue: true,
    }, 12000);
    if (!filled.result?.value?.ok) throw new Error(JSON.stringify(filled.result?.value));

    const submitted = await page.send("Runtime.evaluate", {
      expression: `(() => {
        const rootButton = document.querySelector("xhs-publish-btn")?._app?._container?.querySelector?.("button.ce-btn");
        const fallback = [...document.querySelectorAll("button")].find((button) => /发布|提交|更新/.test(button.innerText || button.textContent || "") && !button.disabled);
        const button = rootButton || fallback;
        if (!button) return { ok: false, reason: "publish button not found", text: document.body.innerText.slice(-800) };
        button.scrollIntoView({ block: "center" });
        button.click();
        return { ok: true, text: button.innerText || button.textContent || "" };
      })()`,
      returnByValue: true,
    }, 12000);
    if (!submitted.result?.value?.ok) throw new Error(JSON.stringify(submitted.result?.value));
    await sleep(30000);
    const state = await page.send("Runtime.evaluate", {
      expression: `(() => ({ url: location.href, text: document.body.innerText.slice(0, 1600) }))()`,
      returnByValue: true,
    }, 12000);
    return { ok: true, title: job.title, noteId: job.noteId, state: state.result.value };
  } finally {
    page.close();
  }
}

const results = [];
for (const job of jobs) {
  console.log(`Updating ${job.noteId}: ${job.title}`);
  try {
    results.push(await updateJob(job));
  } catch (error) {
    results.push({ ok: false, title: job.title, noteId: job.noteId, error: error.message });
  }
}

console.log(JSON.stringify(results, null, 2));
