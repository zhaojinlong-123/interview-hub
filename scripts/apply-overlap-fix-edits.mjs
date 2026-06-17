import { execFileSync } from "node:child_process";
import http from "node:http";

const CDP = process.env.CHROME_CDP || "http://127.0.0.1:9222";

const jobs = [
  { asset: "fix-overlap-20260615-morning-rl", noteId: "6a3165f6000000001603d7f9" },
  { asset: "fix-overlap-20260616-afternoon-inference", noteId: "6a31616b0000000015024a0f" },
  { asset: "fix-overlap-20260615-afternoon-video", noteId: "6a3160b0000000001603fbc4" },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get(`${CDP}${path}`, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
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
      data.error ? pending.reject(new Error(data.error.message)) : pending.resolve(data.result);
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

async function creatorPage() {
  const pages = await getJson("/json");
  const page = pages.find((item) => item.type === "page" && item.url.includes("creator.xiaohongshu.com/new/note-manager"))
    || pages.find((item) => item.type === "page" && item.url.includes("creator.xiaohongshu.com"))
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
    await sleep(9000);
  } finally {
    page.close();
  }
  const updatedPages = await getJson("/json");
  const update = updatedPages.find((item) => item.url.includes("creator.xiaohongshu.com/publish/update") && item.url.includes(job.noteId));
  if (!update) throw new Error(`Edit page did not open for ${job.asset}`);
  return update.url;
}

const results = [];
for (const [index, job] of jobs.entries()) {
  console.log(`[${index + 1}/${jobs.length}] editing ${job.asset}`);
  const editUrl = await openEdit(job);
  execFileSync("node", ["scripts/edit-xhs-note.mjs", `--asset=${job.asset}`, "--submit"], { stdio: "inherit" });
  results.push({ ...job, editUrl, status: "submitted" });
}

console.log(JSON.stringify(results, null, 2));
