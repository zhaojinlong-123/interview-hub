import http from "node:http";

const CDP = "http://127.0.0.1:9222";
const QUERY = process.argv.slice(2).join(" ") || "字节多模态大模型题目精讲";

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve(JSON.parse(body)));
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
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message);
    };
    return this;
  }
  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return Promise.race([
      new Promise((resolve, reject) => this.pending.set(id, { resolve, reject })),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout ${method}`)), 25000)),
    ]);
  }
  close() {
    this.ws?.close();
  }
}

const pages = await getJson(`${CDP}/json`);
const page = pages.find((item) => item.type === "page" && item.url.includes("creator.xiaohongshu.com/new/note-manager"));
if (!page) throw new Error("No note manager page found.");

const cdp = await new CdpSession(page.webSocketDebuggerUrl).open();
try {
  await cdp.send("Runtime.enable");
  await cdp.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const input = document.querySelector(".search-input input") || [...document.querySelectorAll("input")].find((el) => el.offsetParent !== null);
      if (!input) return { ok: false, reason: "search input not found" };
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      input.focus();
      setter.call(input, ${JSON.stringify(QUERY)});
      input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: ${JSON.stringify(QUERY)} }));
      input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter", code: "Enter" }));
      input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Enter", code: "Enter" }));
      return { ok: true, value: input.value };
    })()`,
  });
  await new Promise((resolve) => setTimeout(resolve, 8000));
  const result = await cdp.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const cards = [...document.querySelectorAll(".note-card")].map((card) => {
        let noteId = "";
        try {
          const impression = JSON.parse(card.getAttribute("data-impression") || "{}");
          noteId = impression.noteTarget?.value?.noteId || "";
        } catch {}
        return {
          title: card.querySelector(".note-card__title")?.innerText?.trim() || "",
          noteId,
          text: (card.innerText || "").trim().slice(0, 300),
        };
      });
      return { query: ${JSON.stringify(QUERY)}, text: (document.body.innerText || "").slice(0, 2000), cards };
    })()`,
  });
  console.log(JSON.stringify(result.result.result.value, null, 2));
} finally {
  cdp.close();
}
