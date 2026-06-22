import http from "node:http";

const CDP = process.env.CHROME_CDP || "http://127.0.0.1:9222";

const jobs = [
  { noteId: "6a380e3e0000000016024eca", title: "火山引擎VLA具身智能题目精讲" },
  { noteId: "6a380cff000000001702fb2f", title: "Qwen-VL视觉语言题目精讲" },
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

  send(method, params = {}, timeout = 25000) {
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
      await sleep(500);
    }
  }
}

async function openEditPage(noteId) {
  await closeUpdatePages();
  const pageInfo = JSON.parse(await request("PUT", `/json/new?${encodeURIComponent(`https://creator.xiaohongshu.com/publish/update?source=&id=${noteId}&noteType=normal`)}`));
  return pageInfo.webSocketDebuggerUrl;
}

function fillTitleExpression(title) {
  return `(() => {
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const setValue = (input, value) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      input.focus();
      input.select?.();
      setter.call(input, value);
      input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: value }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, composed: true, key: "Enter" }));
      input.blur();
    };
    const inputs = [...document.querySelectorAll("input")].filter(visible);
    const titleInput = inputs.find((input) => input.type === "text" && ((input.placeholder || "").includes("标题") || /title/i.test(input.placeholder || "")))
      || inputs.find((input) => input.type === "text" && (input.value || "").length <= 40)
      || inputs.find((input) => input.type === "text");
    if (!titleInput) return { ok: false, reason: "title input not found", text: document.body.innerText.slice(0, 1000) };
    setValue(titleInput, ${JSON.stringify(title)});
    return { ok: true, value: titleInput.value };
  })()`;
}

async function submit(page) {
  const rectResult = await page.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      document.activeElement?.blur?.();
      window.scrollTo(0, document.body.scrollHeight);
      document.querySelector(".publish-page")?.scrollTo(0, document.querySelector(".publish-page").scrollHeight);
      const publishBtn = document.querySelector("xhs-publish-btn");
      if (!publishBtn) return { ok: false, reason: "xhs-publish-btn not found", text: document.body.innerText.slice(-1200) };
      publishBtn.scrollIntoView({ block: "center", inline: "center" });
      const rect = publishBtn.getBoundingClientRect();
      return { ok: true, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width, height: rect.height, text: publishBtn.innerText || publishBtn.textContent || "" };
    })()`,
  });
  const rect = rectResult.result.value;
  if (!rect.ok) throw new Error(JSON.stringify(rect));
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x, y: rect.y });
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
  await sleep(5000);
  const fallbackResult = await page.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      if (!location.href.includes("/publish/update")) return { ok: true, method: "mouse", url: location.href };
      const publishBtn = document.querySelector("xhs-publish-btn");
      const inner = publishBtn?._app?._container?.querySelector?.("button.ce-btn, button");
      const fallback = [...document.querySelectorAll("button")].find((button) => /发布|更新|提交/.test(button.innerText || button.textContent || "") && !button.disabled);
      if (inner) {
        inner.click();
        return { ok: true, method: "inner", text: inner.innerText || inner.textContent || "" };
      }
      if (fallback) {
        fallback.click();
        return { ok: true, method: "fallback", text: fallback.innerText || fallback.textContent || "" };
      }
      if (publishBtn && typeof publishBtn._onPublish === "function") {
        publishBtn._onPublish();
        return { ok: true, method: "_onPublish" };
      }
      if (publishBtn) {
        publishBtn.click();
        publishBtn.dispatchEvent(new CustomEvent("publish", { bubbles: true, composed: true }));
        return { ok: true, method: "custom-element" };
      }
      return { ok: false, reason: "submit button not found", text: document.body.innerText.slice(-1200) };
    })()`,
  });
  if (!fallbackResult.result.value.ok) throw new Error(JSON.stringify(fallbackResult.result.value));
  await sleep(45000);
  const state = await page.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => ({ url: location.href, text: (document.body.innerText || "").slice(0, 1400) }))()`,
  });
  return state.result.value;
}

const results = [];
for (const [index, job] of jobs.entries()) {
  console.log(`[${index + 1}/${jobs.length}] ${job.noteId} -> ${job.title}`);
  const wsUrl = await openEditPage(job.noteId);
  const page = await new CdpSession(wsUrl).open();
  try {
    await page.send("Runtime.enable");
    await page.send("Page.bringToFront");
    await sleep(10000);
    const filled = await page.send("Runtime.evaluate", {
      returnByValue: true,
      expression: fillTitleExpression(job.title),
    });
    if (!filled.result.value.ok) throw new Error(JSON.stringify(filled.result.value));
    if (filled.result.value.value !== job.title) {
      throw new Error(`title fill mismatch: expected ${job.title}, got ${filled.result.value.value}`);
    }
    const state = await submit(page);
    results.push({
      ...job,
      ok: /published=true|note-manager|审核中|已发布|成功/.test(`${state.url}\n${state.text}`),
      state,
    });
  } catch (error) {
    results.push({ ...job, ok: false, error: error.message });
  } finally {
    page.close();
  }
}

console.log(JSON.stringify(results, null, 2));
