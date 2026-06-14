import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const QUEUE_FILE = path.join(ROOT, "data", "publish-queue.json");
const REPORT_FILE = path.join(ROOT, "data", "xhs-source-verification.json");
const CDP = process.env.CHROME_CDP || "http://127.0.0.1:9222";

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    }).on("error", reject);
  });
}

function request(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => resolve(body));
    }).on("error", reject);
  });
}

function putJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: "PUT" }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connect(webSocketDebuggerUrl) {
  const ws = new WebSocket(webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  };
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  return {
    ws,
    send(method, params = {}) {
      const current = ++id;
      ws.send(JSON.stringify({ id: current, method, params }));
      return new Promise((resolve) => pending.set(current, resolve));
    },
  };
}

async function createTab(url) {
  const endpoint = `${CDP.replace(/\/$/, "")}/json/new?${encodeURIComponent(url)}`;
  const target = await putJson(endpoint);
  return connect(target.webSocketDebuggerUrl);
}

async function verify(record) {
  const page = await createTab(record.sourceUrl);
  const { ws, send } = page;
  try {
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Page.navigate", { url: record.sourceUrl });
    await sleep(5000);
    await send("Page.stopLoading");
    let value = {};
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const state = await send("Runtime.evaluate", {
        expression: `(() => ({
          url: location.href,
          title: document.title,
          readyState: document.readyState,
          text: (document.body?.innerText || "").slice(0, 1600)
        }))()`,
        returnByValue: true,
      });
      value = state.result?.value || {};
      if (value.url || value.title || value.text) break;
      await sleep(1500);
    }
    const result = await send("Runtime.evaluate", {
      expression: `(() => ({
        url: location.href,
        title: document.title,
        readyState: document.readyState,
        text: (document.body?.innerText || "").slice(0, 1600)
      }))()`,
      returnByValue: true,
    });
    value = result.result?.value || value;
    const text = String(value.text || "");
    let status = "unknown";
    if (/安全限制|访问链接异常|error_code|登录|扫码/.test(text) || /website-login\/error/.test(value.url || "")) {
      status = "blocked_or_login_required";
    } else if (/小红书/.test(value.title || "") || /赞|收藏|评论|发布/.test(text)) {
      status = "opened";
    }
    return {
      queueId: record.id,
      title: record.title,
      sourceUrl: record.sourceUrl,
      finalUrl: value.url || "",
      pageTitle: value.title || "",
      readyState: value.readyState || "",
      status,
      textSample: text.replace(/\s+/g, " ").slice(0, 260),
      verifiedAt: new Date().toISOString(),
    };
  } finally {
    try {
      await send("Page.close");
    } catch {}
    ws.close();
  }
}

async function main() {
  await request(`${CDP.replace(/\/$/, "")}/json/version`);
  const queue = await readJson(QUEUE_FILE, []);
  const candidates = queue.filter((record) =>
    ["published", "manual_required"].includes(record.status)
    && /xiaohongshu\.com\/search_result/.test(record.sourceUrl || "")
  );
  const report = [];
  for (const record of candidates) {
    report.push(await verify(record));
  }
  await writeJson(REPORT_FILE, {
    generatedAt: new Date().toISOString(),
    count: report.length,
    report,
  });
  console.log(JSON.stringify({ count: report.length, report }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
