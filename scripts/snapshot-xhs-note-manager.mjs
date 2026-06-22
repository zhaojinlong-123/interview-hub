import fs from "node:fs";
import http from "node:http";

const CDP = process.env.CHROME_CDP || "http://127.0.0.1:9222";

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
    req.setTimeout(12000, () => req.destroy(new Error(`timeout ${method} ${pathname}`)));
    req.end();
  });
}

async function getJson(pathname) {
  return JSON.parse(await request("GET", pathname));
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

async function managerPage() {
  const pages = await getJson("/json");
  const existing = pages.find((page) => page.type === "page" && page.url.includes("creator.xiaohongshu.com/new/note-manager"));
  if (existing) return existing;
  return JSON.parse(await request("PUT", `/json/new?${encodeURIComponent("https://creator.xiaohongshu.com/new/note-manager")}`));
}

const tab = await managerPage();
const page = await new CdpSession(tab.webSocketDebuggerUrl).open();

try {
  await page.send("Runtime.enable");
  await page.send("Page.bringToFront");
  await page.send("Page.reload", { ignoreCache: true });
  await sleep(15000);
  for (let index = 0; index < 5; index += 1) {
    await page.send("Runtime.evaluate", {
      expression: `(() => {
        window.scrollTo(0, document.body.scrollHeight);
        for (const el of document.querySelectorAll("*")) {
          if (el.scrollHeight > el.clientHeight + 100) el.scrollTop = el.scrollHeight;
        }
      })()`,
    });
    await sleep(2000);
  }
  const result = await page.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const cards = [...document.querySelectorAll(".note-card,[data-impression]")].map((card) => {
        let noteId = "";
        try {
          const impression = JSON.parse(card.getAttribute("data-impression") || "{}");
          noteId = impression.noteTarget?.value?.noteId || impression.noteId || "";
        } catch {}
        const title = (card.querySelector(".note-card__title,[class*=title]")?.innerText || "").trim()
          || (card.innerText || "").split("\\n")[0].trim();
        return { title, noteId, text: (card.innerText || "").trim().slice(0, 220) };
      }).filter((card) => card.title || card.noteId);
      return {
        url: location.href,
        title: document.title,
        body: (document.body.innerText || "").slice(0, 5000),
        cards,
      };
    })()`,
  });
  fs.writeFileSync("logs/xhs-note-manager-cards.json", JSON.stringify(result.result.value, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({
    count: result.result.value.cards.length,
    targets: result.result.value.cards.filter((card) => /Qwen|NVIDIA|VLA具身智能|自动驾驶|多图|普渡|腾讯/.test(`${card.title}\n${card.text}`)),
  }, null, 2));
} finally {
  page.close();
}
