import http from "node:http";

const CDP = process.env.CHROME_CDP || "http://127.0.0.1:9222";

const jobs = [
  { noteId: "6a380e3e0000000016024eca", title: "火山引擎VLA具身智能题目精讲" },
  { noteId: "6a33ce550000000016024539", title: "Qwen2.5大模型题目精讲" },
  { noteId: "6a2cd7840000000015024480", title: "普渡VLA具身智能题目精讲" },
  { noteId: "6a2cd92c000000001c0241b3", title: "字节多图VQA题目精讲" },
];

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

async function closeUpdatePages() {
  const pages = await getJson("/json");
  for (const page of pages) {
    if (page.url.includes("creator.xiaohongshu.com/publish/update")) {
      await request("GET", `/json/close/${page.id}`).catch(() => {});
      await sleep(300);
    }
  }
}

async function openEditPage(noteId) {
  await closeUpdatePages();
  const pageInfo = JSON.parse(await request("PUT", `/json/new?${encodeURIComponent(`https://creator.xiaohongshu.com/publish/update?source=&id=${noteId}&noteType=normal`)}`));
  return new CdpSession(pageInfo.webSocketDebuggerUrl).open();
}

async function readPage(page) {
  const result = await page.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const input = [...document.querySelectorAll("input")].find((item) => item.placeholder === "填写标题会有更多赞哦") || document.querySelector("input[type=text]");
      return {
        url: location.href,
        value: input?.value || "",
        body: (document.body.innerText || "").slice(0, 1800),
      };
    })()`,
  });
  return result.result.value;
}

async function updateTitle(job) {
  const page = await openEditPage(job.noteId);
  try {
    await page.send("Runtime.enable");
    await page.send("Page.enable");
    await page.send("Input.setIgnoreInputEvents", { ignore: false }).catch(() => {});
    await page.send("Page.bringToFront");
    await sleep(12000);

    const focus = await page.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => {
        const input = [...document.querySelectorAll("input")].find((item) => item.placeholder === "填写标题会有更多赞哦") || document.querySelector("input[type=text]");
        if (!input) return { ok: false, reason: "title input not found", body: document.body.innerText.slice(0, 1000) };
        input.scrollIntoView({ block: "center" });
        input.focus();
        input.click();
        return { ok: true, before: input.value };
      })()`,
    });
    if (!focus.result.value.ok) throw new Error(JSON.stringify(focus.result.value));

    await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Control", code: "ControlLeft", windowsVirtualKeyCode: 17, nativeVirtualKeyCode: 17, modifiers: 2 });
    await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65, modifiers: 2 });
    await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65, modifiers: 2 });
    await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Control", code: "ControlLeft", windowsVirtualKeyCode: 17, nativeVirtualKeyCode: 17 });
    await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8 });
    await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8 });
    await sleep(300);
    await page.send("Input.insertText", { text: job.title });
    await sleep(1500);

    const afterInput = await readPage(page);
    if (afterInput.value !== job.title) {
      throw new Error(`Input failed: expected ${job.title}, got ${afterInput.value}`);
    }

    const rectResult = await page.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => {
        document.activeElement?.blur?.();
        document.querySelector(".publish-page")?.scrollTo(0, document.querySelector(".publish-page").scrollHeight);
        window.scrollTo(0, document.body.scrollHeight);
        const target = document.querySelector("xhs-publish-btn");
        if (!target) return { ok: false, reason: "xhs-publish-btn not found", body: document.body.innerText.slice(-1000) };
        target.scrollIntoView({ block: "center" });
        const rect = target.getBoundingClientRect();
        return { ok: true, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, w: rect.width, h: rect.height, disabled: target.getAttribute("submit-disabled") };
      })()`,
    });
    const rect = rectResult.result.value;
    if (!rect.ok) throw new Error(JSON.stringify(rect));

    await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x, y: rect.y, button: "none", buttons: 0, pointerType: "mouse" });
    await sleep(100);
    await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: rect.x, y: rect.y, button: "left", buttons: 1, clickCount: 1, pointerType: "mouse" });
    await sleep(100);
    await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rect.x, y: rect.y, button: "left", buttons: 0, clickCount: 1, pointerType: "mouse" });
    await sleep(9000);

    const state = await readPage(page);
    return {
      ...job,
      ok: !state.url.includes("/publish/update") || state.body.includes(job.title),
      before: focus.result.value.before,
      state,
    };
  } finally {
    page.close();
  }
}

const results = [];
for (const [index, job] of jobs.entries()) {
  console.log(`[${index + 1}/${jobs.length}] ${job.title}`);
  try {
    results.push(await updateTitle(job));
  } catch (error) {
    results.push({ ...job, ok: false, error: error.message });
  }
}

console.log(JSON.stringify(results, null, 2));
