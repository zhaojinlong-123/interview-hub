import { execFileSync } from "node:child_process";
import http from "node:http";

const CDP = process.env.CHROME_CDP || "http://127.0.0.1:9222";

const jobs = [
  { asset: "compliance-video-understanding-20260615", noteId: "6a2e1323000000001702dacc" },
  { asset: "compliance-multi-image-vlm-20260615", noteId: "6a2cd92c000000001c0241b3" },
  { asset: "compliance-world-model-planning-20260615", noteId: "6a2cd824000000001502481d" },
  { asset: "compliance-ali-multimodal-20260615", noteId: "6a2cd79b000000001c0278b0" },
  { asset: "compliance-openvla-action-20260615", noteId: "6a2cd7840000000015024480" },
  { asset: "compliance-autodrive-data-20260615", noteId: "6a2cd72a000000001c027637" },
  { asset: "compliance-inference-kvcache-20260615", noteId: "6a2cd39c000000001503c862" },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get(`${CDP}${path}`, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          resolve(JSON.parse(body || "{}"));
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
      const data = JSON.parse(event.data);
      const pending = this.pending.get(data.id);
      if (!pending) return;
      this.pending.delete(data.id);
      if (data.error) pending.reject(new Error(data.error.message));
      else pending.resolve(data.result);
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

async function creatorPage() {
  const pages = await getJson("/json");
  const page = pages.find((item) => item.url.includes("creator.xiaohongshu.com/new/note-manager"))
    || pages.find((item) => item.url.includes("creator.xiaohongshu.com"))
    || pages.find((item) => item.type === "page");
  if (!page) throw new Error("No controllable creator page found");
  return page;
}

async function closeUpdatePages() {
  const pages = await getJson("/json");
  for (const page of pages) {
    if (!page.url.includes("creator.xiaohongshu.com/publish/update")) continue;
    await getJson(`/json/close/${page.id}`);
    await sleep(800);
  }
}

async function navigateManager() {
  const tab = await creatorPage();
  const page = await new CdpSession(tab.webSocketDebuggerUrl).open();
  try {
    await page.send("Runtime.evaluate", {
      expression: `location.href = "https://creator.xiaohongshu.com/new/note-manager?source="`,
      returnByValue: true,
    });
    await sleep(7000);
  } finally {
    page.close();
  }
}

async function openEdit(job) {
  await closeUpdatePages();
  const tab = await creatorPage();
  const page = await new CdpSession(tab.webSocketDebuggerUrl).open();
  try {
    const url = `https://creator.xiaohongshu.com/publish/update?source=&id=${job.noteId}&noteType=normal`;
    await page.send("Runtime.evaluate", {
      expression: `location.href = ${JSON.stringify(url)}`,
      returnByValue: true,
    });
    await sleep(6000);
  } finally {
    page.close();
  }
  const updatedPages = await getJson("/json");
  const update = updatedPages.find((item) => item.url.includes("creator.xiaohongshu.com/publish/update"));
  if (!update) throw new Error(`Edit page did not open for ${job.asset}`);
  return update.url;
}

const results = [];
for (const [index, job] of jobs.entries()) {
  console.log(`[${index + 1}/${jobs.length}] editing ${job.asset}`);
  await navigateManager();
  const editUrl = await openEdit(job);
  execFileSync("node", ["scripts/edit-xhs-note.mjs", `--asset=${job.asset}`, "--submit"], {
    stdio: "inherit",
  });
  results.push({ asset: job.asset, editUrl, status: "submitted" });
}

console.log(JSON.stringify(results, null, 2));
