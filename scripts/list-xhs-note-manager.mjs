import http from "node:http";

const CDP = "http://127.0.0.1:9222";
const TARGETS = [
  "对齐训练RLHF题目精讲",
  "KVCache推理部署题目精讲",
  "视频时序理解题目精讲",
  "字节多模态大模型题目精讲",
];

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
      new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout ${method}`)), 20000)),
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
      const scrollers = [document.scrollingElement, ...document.querySelectorAll("*")]
        .filter((el) => el && el.scrollHeight > el.clientHeight + 80);
      for (const el of scrollers) el.scrollTop = el.scrollHeight;
      window.scrollTo(0, document.body.scrollHeight);
      return scrollers.length;
    })()`,
  });
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const result = await cdp.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const targets = ${JSON.stringify(TARGETS)};
      const allText = document.body.innerText || "";
      const visible = (el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };
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
      const rows = targets.map((title) => ({ title, card: cards.find((card) => card.title === title) || null }));
      const links = [...document.querySelectorAll("a[href]")]
        .map((a) => ({ text: (a.innerText || a.textContent || "").trim().slice(0, 120), href: a.href }))
        .filter((item) => /publish|note|explore|update|creator/.test(item.href) || targets.some((title) => item.text.includes(title)));
      return { url: location.href, allText: allText.slice(0, 3000), cards, rows, links };
    })()`,
  });
  console.log(JSON.stringify(result.result.result.value, null, 2));
} finally {
  cdp.close();
}
