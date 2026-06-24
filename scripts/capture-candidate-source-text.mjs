import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POSTS_FILE = path.join(ROOT, "data", "posts.json");
const OUTPUT_FILE = path.join(ROOT, "logs", "candidate-source-text-2026-06-24.json");
const CDP = process.env.CHROME_CDP || "http://127.0.0.1:9222";
const TARGET_DATE = "2026-06-24";
const WAIT_MS = Number(process.env.SOURCE_CAPTURE_WAIT_MS || 3000);

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

function cleanText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 30000);
}

const posts = JSON.parse(await fs.readFile(POSTS_FILE, "utf8"));
const candidates = posts.filter((post) => post.sourceDate === TARGET_DATE && post.reviewStatus === "source_candidate");
const existing = await fs.readFile(OUTPUT_FILE, "utf8").then(JSON.parse).catch(() => []);
const cache = new Map(existing.map((item) => [item.id, item]));
const version = await getJson("/json/version");
const browser = await new CdpSession(version.webSocketDebuggerUrl).open();
let targetId = "";
let page;

try {
  const created = await browser.send("Target.createTarget", { url: "about:blank" });
  targetId = created.targetId;
  await sleep(500);
  const pages = await getJson("/json/list");
  const tab = pages.find((item) => item.id === targetId);
  if (!tab) throw new Error("temporary capture tab not found");
  page = await new CdpSession(tab.webSocketDebuggerUrl).open();
  await page.send("Page.enable");
  await page.send("Runtime.enable");

  for (const [index, post] of candidates.entries()) {
    if (cache.has(post.id) && cache.get(post.id).text?.length > 200) continue;
    const startedAt = Date.now();
    let record;
    try {
      await page.send("Page.navigate", { url: post.sourceUrl });
      await sleep(WAIT_MS);
      const result = await page.send("Runtime.evaluate", {
        returnByValue: true,
        expression: `(() => {
          const selectors = [
            "article",
            ".note-content",
            ".content",
            ".main-content",
            "#content_views",
            ".Post-RichTextContainer",
            ".RichContent-inner",
            ".video-desc-container",
          ];
          const selected = selectors
            .flatMap((selector) => [...document.querySelectorAll(selector)])
            .map((el) => el.innerText || el.textContent || "")
            .sort((a, b) => b.length - a.length)[0] || "";
          return {
            url: location.href,
            title: document.title,
            text: selected || document.body?.innerText || "",
          };
        })()`,
      });
      record = {
        id: post.id,
        sourceUrl: post.sourceUrl,
        finalUrl: result.result.value.url,
        pageTitle: result.result.value.title,
        text: cleanText(result.result.value.text),
        capturedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      record = {
        id: post.id,
        sourceUrl: post.sourceUrl,
        error: error.message,
        capturedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      };
    }
    cache.set(post.id, record);
    if ((index + 1) % 10 === 0) {
      await fs.writeFile(OUTPUT_FILE, `${JSON.stringify([...cache.values()], null, 2)}\n`, "utf8");
      console.log(`captured ${index + 1}/${candidates.length}`);
    }
  }
} finally {
  page?.close();
  if (targetId) await browser.send("Target.closeTarget", { targetId }).catch(() => {});
  browser.close();
}

const records = [...cache.values()];
await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(records, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  candidates: candidates.length,
  captured: records.filter((item) => item.text?.length > 200).length,
  failed: records.filter((item) => !item.text || item.text.length <= 200).length,
  output: path.relative(ROOT, OUTPUT_FILE).replaceAll("\\", "/"),
}, null, 2));
