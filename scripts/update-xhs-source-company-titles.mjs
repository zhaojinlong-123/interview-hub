import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const CDP = process.env.CHROME_CDP || "http://127.0.0.1:9222";

const jobs = [
  {
    asset: "compliance-embodied-data-20260615",
    noteId: "6a2f55a50000000017028b54",
    title: "字节具身数据题精讲",
  },
  {
    asset: "compliance-training-memory-20260615",
    noteId: "6a2e89ff0000000017029a89",
    title: "字节显存优化题精讲",
  },
  {
    asset: "compliance-video-understanding-20260615",
    noteId: "6a2e1323000000001702dacc",
    title: "CSDN视频时序题精讲",
  },
  {
    asset: "compliance-multi-image-vlm-20260615",
    noteId: "6a2cd92c000000001c0241b3",
    title: "知乎多图VQA题精讲",
  },
  {
    asset: "compliance-world-model-planning-20260615",
    noteId: "6a2cd824000000001502481d",
    title: "51CTO世界模型题精讲",
  },
  {
    asset: "compliance-ali-multimodal-20260615",
    noteId: "6a2cd79b000000001c0278b0",
    title: "阿里连接层题精讲",
  },
  {
    asset: "compliance-openvla-action-20260615",
    noteId: "6a2cd7840000000015024480",
    title: "字节VLA动作题精讲",
  },
  {
    asset: "compliance-autodrive-data-20260615",
    noteId: "6a2cd72a000000001c027637",
    title: "51CTO数据闭环题精讲",
  },
  {
    asset: "compliance-inference-kvcache-20260615",
    noteId: "6a2cd39c000000001503c862",
    title: "字节KVCache题精讲",
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRaw(pathname) {
  return new Promise((resolve, reject) => {
    http.get(`${CDP}${pathname}`, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => resolve(body));
    }).on("error", reject);
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
  const page = pages.find((item) => item.url.includes("creator.xiaohongshu.com"))
    || pages.find((item) => item.type === "page");
  if (!page) throw new Error("No controllable Xiaohongshu creator page found");
  return page;
}

async function closeUpdatePages() {
  const pages = await getJson("/json");
  for (const page of pages) {
    if (!page.url.includes("creator.xiaohongshu.com/publish/update")) continue;
    await getRaw(`/json/close/${page.id}`);
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
    await sleep(7000);
  } finally {
    page.close();
  }
}

async function updateTitle(job) {
  const pages = await getJson("/json");
  const tab = pages.find((item) => item.url.includes(`id=${job.noteId}`));
  if (!tab) throw new Error(`Edit page not found for ${job.noteId}`);
  const page = await new CdpSession(tab.webSocketDebuggerUrl).open();
  const send = page.send.bind(page);
  try {
    await send("Runtime.enable");
    const filled = await send("Runtime.evaluate", {
      expression: `(() => {
        const visible = (el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        };
        const inputs = Array.from(document.querySelectorAll("input")).filter(visible);
        const titleInput = inputs.find((el) => el.type === "text" && ((el.placeholder || "").includes("标题") || (el.value || "").length <= 30))
          || inputs.find((el) => el.type === "text");
        if (!titleInput) return { ok: false, reason: "title input not found" };
        titleInput.focus();
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        setter.call(titleInput, ${JSON.stringify(job.title)});
        titleInput.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: ${JSON.stringify(job.title)} }));
        titleInput.dispatchEvent(new Event("change", { bubbles: true }));
        titleInput.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, composed: true, key: "Enter" }));
        titleInput.blur();
        return { ok: true, title: titleInput.value };
      })()`,
      returnByValue: true,
    });
    if (!filled.result?.value?.ok) throw new Error(JSON.stringify(filled.result?.value));

    const submitted = await send("Runtime.evaluate", {
      expression: `(() => {
        document.activeElement?.blur?.();
        const btn = document.querySelector("xhs-publish-btn")?._app?._container?.querySelector?.("button.ce-btn");
        if (!btn) return { ok: false, reason: "publish button not found" };
        btn.click();
        return { ok: true, text: btn.innerText };
      })()`,
      returnByValue: true,
    });
    if (!submitted.result?.value?.ok) throw new Error(JSON.stringify(submitted.result?.value));
    await sleep(45000);
    const state = await send("Runtime.evaluate", {
      expression: `(() => ({ url: location.href, text: (document.body.innerText || "").slice(0, 1200) }))()`,
      returnByValue: true,
    });
    return state.result.value;
  } finally {
    page.close();
  }
}

async function updateLocalPostJson(job) {
  const file = path.join(ROOT, "content", "xiaohongshu-edit-assets", job.asset, "post.json");
  const post = JSON.parse(await fs.readFile(file, "utf8"));
  post.title = job.title;
  post.onlineTitle = job.title;
  await fs.writeFile(file, `${JSON.stringify(post, null, 2)}\n`, "utf8");
}

const results = [];
for (const [index, job] of jobs.entries()) {
  console.log(`[${index + 1}/${jobs.length}] ${job.title}`);
  await updateLocalPostJson(job);
  await openEdit(job);
  const state = await updateTitle(job);
  results.push({
    title: job.title,
    noteId: job.noteId,
    ok: /审核中|已发布|published=true|note-manager/.test(`${state.url}\n${state.text}`),
    url: state.url,
  });
}

console.log(JSON.stringify(results, null, 2));
