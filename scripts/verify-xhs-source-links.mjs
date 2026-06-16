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

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => resolve(body));
    });
    req.on("error", reject);
    req.end();
  });
}

async function requestJson(url, options = {}) {
  return JSON.parse(await request(url, options));
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
  return requestJson(endpoint, { method: "PUT" });
}

async function getTargets() {
  return requestJson(`${CDP.replace(/\/$/, "")}/json/list`);
}

async function closeTarget(id) {
  try {
    await request(`${CDP.replace(/\/$/, "")}/json/close/${id}`);
  } catch {}
}

function classifyPage(target) {
  const url = String(target.url || "");
  const title = String(target.title || "");
  if (/website-login\/error/.test(url) || /安全限制|访问链接异常|error_code/.test(title)) {
    return "blocked_or_login_required";
  }
  if (/xiaohongshu\.com\/explore\//.test(url) && /小红书/.test(title)) {
    return "opened";
  }
  if (/小红书/.test(title)) {
    return "login_required_but_title_readable";
  }
  return "unknown";
}

async function verify(record) {
  const target = await createTab(record.sourceUrl);
  try {
    let value = target;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await sleep(3000);
      const targets = await getTargets();
      value = targets.find((item) => item.id === target.id) || value;
      if (/xiaohongshu\.com\/explore\//.test(value.url || "") || /website-login\/error/.test(value.url || "")) break;
    }
    return {
      queueId: record.id,
      title: record.title,
      sourceUrl: record.sourceUrl,
      finalUrl: value.url || "",
      pageTitle: value.title || "",
      readyState: "",
      status: classifyPage(value),
      textSample: "",
      verifiedAt: new Date().toISOString(),
    };
  } finally {
    await closeTarget(target.id);
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
