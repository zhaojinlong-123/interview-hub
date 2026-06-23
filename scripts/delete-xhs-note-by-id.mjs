import http from "node:http";

const CDP = process.env.CHROME_CDP || "http://127.0.0.1:9222";
const NOTE_ID = process.argv.find((arg) => arg.startsWith("--note-id="))?.slice("--note-id=".length);
if (!NOTE_ID) throw new Error("Usage: node scripts/delete-xhs-note-by-id.mjs --note-id=<noteId>");

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

async function noteManagerPage() {
  const pages = await getJson("/json");
  const existing = pages.find((page) => page.type === "page" && page.url.includes("creator.xiaohongshu.com/new/note-manager"));
  if (existing) return existing;
  return JSON.parse(await request("PUT", `/json/new?${encodeURIComponent("https://creator.xiaohongshu.com/new/note-manager")}`));
}

const tab = await noteManagerPage();
const page = await new CdpSession(tab.webSocketDebuggerUrl).open();

try {
  await page.send("Runtime.enable");
  await page.send("Page.enable");
  await page.send("Page.bringToFront");
  await page.send("Page.reload", { ignoreCache: true });
  await sleep(12000);

  const findResult = await page.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const targetId = ${JSON.stringify(NOTE_ID)};
      const visible = (el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };
      const cards = [...document.querySelectorAll("[data-impression], .note-card")];
      const card = cards.find((item) => (item.getAttribute("data-impression") || "").includes(targetId));
      if (!card) {
        return {
          ok: false,
          reason: "target note card not found",
          cards: cards.slice(0, 30).map((item) => ({
            impression: item.getAttribute("data-impression") || "",
            text: (item.innerText || "").slice(0, 180),
          })),
        };
      }
      card.scrollIntoView({ block: "center", inline: "center" });
      const rect = card.getBoundingClientRect();
      return {
        ok: true,
        title: (card.querySelector(".note-card__title,[class*=title]")?.innerText || "").trim(),
        text: (card.innerText || "").trim().slice(0, 500),
        x: rect.right - 28,
        y: rect.top + 32,
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
      };
    })()`,
  });
  const found = findResult.result.value;
  if (!found.ok) throw new Error(JSON.stringify(found, null, 2));

  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: found.x, y: found.y, button: "none", buttons: 0, pointerType: "mouse" });
  await sleep(1000);

  const deleteButton = await page.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const targetId = ${JSON.stringify(NOTE_ID)};
      const card = [...document.querySelectorAll("[data-impression], .note-card")]
        .find((item) => (item.getAttribute("data-impression") || "").includes(targetId));
      if (!card) return { ok: false, reason: "card disappeared" };
      const buttons = [...card.querySelectorAll(".note-card__action-btn--del, [class*=del], button, [role=button]")]
        .filter((item) => {
          const rect = item.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        })
        .map((item, index) => {
          const rect = item.getBoundingClientRect();
          return {
            index,
            className: item.className?.toString?.() || "",
            text: (item.innerText || item.textContent || item.getAttribute("aria-label") || item.title || "").trim(),
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            w: rect.width,
            h: rect.height,
          };
        });
      const del = buttons.find((item) => /del|delete|删除|删/.test((item.className || "") + " " + (item.text || "")));
      return del ? { ok: true, button: del, buttons } : { ok: false, reason: "delete button not found", buttons };
    })()`,
  });
  const del = deleteButton.result.value;
  if (!del.ok) throw new Error(JSON.stringify({ found, del }, null, 2));

  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: del.button.x, y: del.button.y, button: "none", buttons: 0, pointerType: "mouse" });
  await sleep(100);
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: del.button.x, y: del.button.y, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" });
  await sleep(100);
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: del.button.x, y: del.button.y, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" });
  await sleep(1500);

  const confirmResult = await page.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const visible = (el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };
      const candidates = [...document.querySelectorAll("button, [role=button], .d-button, .el-button")]
        .filter(visible)
        .map((item, index) => {
          const rect = item.getBoundingClientRect();
          return {
            index,
            text: (item.innerText || item.textContent || "").trim(),
            className: item.className?.toString?.() || "",
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            w: rect.width,
            h: rect.height,
          };
        });
      const confirm = candidates.find((item) => /确认删除|删除|确定|确认/.test(item.text) && !/取消/.test(item.text));
      return confirm ? { ok: true, button: confirm, candidates } : { ok: false, candidates, body: document.body.innerText.slice(-1600) };
    })()`,
  });
  const confirm = confirmResult.result.value;
  if (!confirm.ok) throw new Error(JSON.stringify({ found, del, confirm }, null, 2));

  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: confirm.button.x, y: confirm.button.y, button: "none", buttons: 0, pointerType: "mouse" });
  await sleep(100);
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: confirm.button.x, y: confirm.button.y, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" });
  await sleep(100);
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: confirm.button.x, y: confirm.button.y, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" });
  await sleep(5000);

  await page.send("Page.reload", { ignoreCache: true });
  await sleep(10000);
  const verify = await page.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const text = document.body.innerText || "";
      const cards = [...document.querySelectorAll("[data-impression], .note-card")].map((card) => ({
        impression: card.getAttribute("data-impression") || "",
        text: (card.innerText || "").slice(0, 260),
      }));
      return {
        deletedStillPresent: cards.some((card) => card.impression.includes(${JSON.stringify(NOTE_ID)})),
        vlmCards: cards.filter((card) => /VLM检测定位题目精讲|VLM檢測定位題目精講/.test(card.text)),
        bodySnippet: text.slice(0, 2000),
      };
    })()`,
  });

  console.log(JSON.stringify({ noteId: NOTE_ID, target: found, deleted: !verify.result.value.deletedStillPresent, verify: verify.result.value }, null, 2));
} finally {
  page.close();
}
