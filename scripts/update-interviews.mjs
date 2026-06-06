import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const DATA_FILE = path.join(ROOT, "data", "posts.json");
const PLATFORMS_FILE = path.join(ROOT, "data", "platforms.json");
const SETTINGS_FILE = path.join(ROOT, "data", "daily-settings.json");
const LOG_DIR = path.join(ROOT, "logs");
const TODAY = new Date().toISOString().slice(0, 10);
const CDP = process.env.CHROME_CDP || "http://127.0.0.1:9222";
const SHOULD_PUSH = process.argv.includes("--push");

const KEYWORDS = [
  "大模型", "LLM", "Agent", "RAG", "VLA", "多模态", "面经", "面试",
  "具身", "机器人", "世界模型", "自动驾驶", "训练框架", "DeepSpeed", "Megatron",
  "字节", "腾讯", "百度", "阿里", "蚂蚁", "快手", "小红书", "智元", "淘天",
];

const COMPANY_KEYWORDS = ["字节", "腾讯", "百度", "阿里", "蚂蚁", "快手", "小红书", "智元", "淘天", "华为", "美团", "蔚来", "小鹏", "Momenta", "NVIDIA", "Google", "DeepSeek", "Qwen", "Seed"];

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function hash(text) {
  return crypto.createHash("sha1").update(text).digest("hex").slice(0, 12);
}

function normalizeUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (/token|xsec|utm|spm|source|from|fr|share/i.test(key)) parsed.searchParams.delete(key);
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

function includesKeyword(text) {
  const lower = text.toLowerCase();
  return KEYWORDS.some((keyword) => lower.includes(keyword.toLowerCase()));
}

function classify(text) {
  if (/VLA|具身|机器人|智元|遥操|动作/.test(text)) return ["VLA / 具身智能", "VLA / 具身智能", "机器人数据 / 动作模型"];
  if (/自动驾驶|世界模型|BEV|仿真|小鹏|蔚来|Momenta/.test(text)) return ["自动驾驶 / 数据闭环", "自动驾驶 / 世界模型", "数据闭环 / 仿真"];
  if (/RAG|Agent|工具调用|应用开发|电商/.test(text)) return ["Agent / RAG / 大模型应用", "Agent / RAG", "工程落地 / 工具调用"];
  if (/DeepSpeed|Megatron|训练框架|显存|分布式|推理|量化/.test(text)) return ["推理优化 / 模型压缩", "训练框架 / 推理优化", "分布式训练 / 部署"];
  if (/RLHF|PPO|DPO|GRPO|强化学习|对齐/.test(text)) return ["强化学习 / 对齐训练", "强化学习 / 对齐训练", "偏好优化"];
  if (/视频|视觉|多模态|CLIP|VLM|图文/.test(text)) return ["多模态大模型", "多模态大模型", "视觉语言理解"];
  return ["多模态大模型", "大模型面经", "综合"];
}

function guessCompany(text) {
  return COMPANY_KEYWORDS.find((company) => text.includes(company)) || "综合";
}

function guessType(text) {
  if (/题库|合集|攻略|总结|LeetCode|八股/.test(text)) return "collection";
  if (/题|问|50问/.test(text)) return "question";
  return "experience";
}

function makeQuestions(text) {
  const questions = [];
  if (/RAG|Agent/.test(text)) questions.push("RAG / Agent 的核心链路、失败兜底和评估指标是什么？");
  if (/VLA|具身|机器人/.test(text)) questions.push("VLA 如何表示动作，机器人数据如何采集、清洗和评估？");
  if (/DeepSpeed|Megatron|训练框架|显存/.test(text)) questions.push("训练框架中的并行策略、显存瓶颈和通信开销如何定位？");
  if (/多模态|视觉|视频|VLM|CLIP/.test(text)) questions.push("多模态模型如何做视觉语言对齐和长上下文理解？");
  if (/RLHF|PPO|DPO|GRPO/.test(text)) questions.push("RLHF、PPO、DPO、GRPO 的训练目标和适用场景有什么区别？");
  if (!questions.length) questions.push("项目经历、模型原理、工程落地和评估指标分别如何回答？");
  return questions.slice(0, 4);
}

function makePost(candidate) {
  const title = clean(candidate.title).slice(0, 120);
  const text = `${title} ${candidate.snippet || ""}`;
  const [category, direction, domain] = classify(text);
  const company = guessCompany(text);
  const sourceUrl = normalizeUrl(candidate.url);
  const sourcePlatform = candidate.platform;
  const tags = [...new Set([sourcePlatform, company, ...KEYWORDS.filter((keyword) => text.includes(keyword)).slice(0, 5)])]
    .filter((tag) => tag && tag !== "综合")
    .slice(0, 8);

  return {
    id: `auto-${TODAY.replaceAll("-", "")}-${hash(`${sourcePlatform}|${title}|${sourceUrl}`)}`,
    title: `${sourcePlatform}：${title}`.slice(0, 120),
    company,
    role: /算法|训练|推理|Agent|VLA|多模态/.test(text) ? "大模型相关岗位" : "AI / 算法候选人",
    direction,
    domain,
    category,
    type: guessType(text),
    difficulty: /三面|二面|困难|训练框架|VLA|RLHF|DeepSpeed|Megatron/.test(text) ? "困难" : "中等",
    sourcePlatform,
    sourceDate: TODAY,
    sourceUrl,
    tags,
    questions: makeQuestions(text),
    content: `自动更新脚本从 ${sourcePlatform} 搜索到的近期面经候选。摘要：${clean(candidate.snippet || title).slice(0, 260)}`,
    prepTips: "先确认原帖细节，再按基础原理、项目追问、工程落地、评估指标四块整理复习。",
    createdAt: Math.floor(Date.now() / 1000),
    updatedAt: Math.floor(Date.now() / 1000),
  };
}

async function readPosts() {
  return JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
}

async function readPlatforms() {
  try {
    const platforms = JSON.parse(await fs.readFile(PLATFORMS_FILE, "utf8"));
    return platforms.filter((platform) => platform.enabled !== false);
  } catch {
    return [];
  }
}

async function readDailySettings() {
  try {
    return JSON.parse(await fs.readFile(SETTINGS_FILE, "utf8"));
  } catch {
    return { focusDirections: [] };
  }
}

async function writePosts(posts) {
  await fs.writeFile(DATA_FILE, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  return response.json();
}

function wsRequest(wsUrl, messages, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let nextId = 1;
    const pending = new Map();
    const results = [];
    const timer = setTimeout(() => reject(new Error("CDP timeout")), timeout);
    ws.onopen = () => {
      for (const msg of messages) {
        const id = nextId++;
        pending.set(id, msg.method);
        ws.send(JSON.stringify({ id, ...msg }));
      }
    };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (!data.id) return;
      results.push({ method: pending.get(data.id), data });
      pending.delete(data.id);
      if (!pending.size) {
        clearTimeout(timer);
        ws.close();
        resolve(results);
      }
    };
    ws.onerror = reject;
  });
}

async function getBrowserWs() {
  const version = await getJson(`${CDP}/json/version`);
  return version.webSocketDebuggerUrl;
}

async function listTabs() {
  return getJson(`${CDP}/json/list`);
}

async function createTab(browserWs, url) {
  const created = await wsRequest(browserWs, [{ method: "Target.createTarget", params: { url: "about:blank" } }]);
  const targetId = created[0].data.result.targetId;
  let tabs = await listTabs();
  let tab = tabs.find((item) => item.id === targetId);
  await wsRequest(tab.webSocketDebuggerUrl, [{ method: "Page.navigate", params: { url } }]);
  await new Promise((resolve) => setTimeout(resolve, 5500));
  tabs = await listTabs();
  tab = tabs.find((item) => item.id === targetId) || tab;
  return { targetId, tab };
}

async function closeTab(browserWs, targetId) {
  await wsRequest(browserWs, [{ method: "Target.closeTarget", params: { targetId } }], 10000).catch(() => {});
}

async function extractFromTab(tab, platform) {
  const expression = `(() => {
    const clean = s => (s || "").replace(/\\s+/g, " ").trim();
    const links = Array.from(document.querySelectorAll("a"))
      .map(a => ({ title: clean(a.innerText || a.textContent), url: a.href, snippet: clean(a.closest("article, section, li, div")?.innerText || a.innerText || "") }))
      .filter(x => x.title || x.url)
      .slice(0, 180);
    const cards = Array.from(document.querySelectorAll("article, section, li, .ContentItem, .note-item, .feed-card, .card"))
      .map(el => clean(el.innerText || el.textContent))
      .filter(Boolean)
      .slice(0, 120)
      .map(text => ({ title: text.slice(0, 80), url: location.href, snippet: text.slice(0, 500) }));
    return { title: document.title, url: location.href, links, cards };
  })()`;
  const result = await wsRequest(tab.webSocketDebuggerUrl, [
    { method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } },
  ]);
  const page = result[0].data.result?.result?.value || { links: [], cards: [] };
  return [...page.links, ...page.cards]
    .map((item) => ({ ...item, platform }))
    .filter((item) => includesKeyword(`${item.title} ${item.snippet}`))
    .filter((item) => clean(item.title).length >= 6);
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  const out = [];
  for (const item of candidates) {
    const snippet = clean(item.snippet);
    let title = clean(item.title).replace(/[|_-]\s*.*$/, "").slice(0, 120);
    if (!includesKeyword(title) && includesKeyword(snippet)) {
      const sentence = snippet.split(/[。！？\n]/).find((part) => includesKeyword(part));
      title = clean(sentence || snippet).slice(0, 120);
    }
    const combined = `${title} ${snippet}`;
    if (!title || /登录|注册|首页|消息|发布|广告|隐私|协议|稍后再看/.test(title)) continue;
    if (/^[\d\s:.万+-]+$/.test(title)) continue;
    if (!/大模型|LLM|Agent|RAG|VLA|多模态|具身|机器人|世界模型|自动驾驶|训练框架|DeepSpeed|Megatron|Qwen|DeepSeek/i.test(combined)) continue;
    if (!/面经|面试|一面|二面|三面|题|八股|岗位|实习|社招|校招|offer|项目|训练|推理/i.test(combined)) continue;
    if (/前端社招|JavaScript|金三银四|安卓开发|婚恋|加班情况/.test(combined) && !/大模型|LLM|Agent|RAG|VLA|多模态|具身/i.test(title)) continue;
    const key = normalizeUrl(item.url) || `${item.platform}|${title}`;
    const titleKey = `${item.platform}|${title}`;
    if (seen.has(key) || seen.has(titleKey)) continue;
    seen.add(key);
    seen.add(titleKey);
    out.push({ ...item, title });
  }
  return out;
}

function filterNew(posts, candidates) {
  const existingUrls = new Set(posts.map((post) => normalizeUrl(post.sourceUrl)).filter(Boolean));
  const existingTitles = new Set(posts.map((post) => clean(post.title).replace(/^[^：]+：/, "")));
  return candidates.filter((candidate) => {
    const title = clean(candidate.title).replace(/^[^：]+：/, "");
    const url = normalizeUrl(candidate.url);
    if (url && existingUrls.has(url)) return false;
    if (existingTitles.has(title)) return false;
    return true;
  });
}

function rankCandidate(candidate, settings = {}) {
  const text = `${candidate.title} ${candidate.snippet}`;
  let score = 0;
  if (/面经|面试|一面|二面|三面|题|八股/.test(text)) score += 8;
  if (/大模型|LLM|Agent|RAG|VLA|多模态|具身|训练框架|DeepSpeed|Megatron/.test(text)) score += 6;
  if (COMPANY_KEYWORDS.some((company) => text.includes(company))) score += 3;
  if (/今天|昨天|小时前|分钟前|06-|05-|2026/.test(text)) score += 3;
  const focusDirections = settings.focusDirections || [];
  const focusHits = focusDirections.filter((keyword) => text.toLowerCase().includes(String(keyword).toLowerCase()));
  score += Math.min(12, focusHits.length * 4);
  if (/登录|注册|首页|隐私|协议|广告/.test(text)) score -= 8;
  return score;
}

function commitAndPush(addedCount) {
  if (!SHOULD_PUSH || addedCount === 0) return;
  execFileSync("git", ["-c", "safe.directory=E:/workshop/interview-hub", "add", "data/posts.json", "data/platforms.json", "logs"], { cwd: ROOT, stdio: "inherit" });
  execFileSync("git", ["-c", "safe.directory=E:/workshop/interview-hub", "commit", "-m", `Auto update interview posts (${TODAY})`], { cwd: ROOT, stdio: "inherit" });
  execFileSync("git", [
    "-c", "safe.directory=E:/workshop/interview-hub",
    "-c", "http.proxy=http://127.0.0.1:10809",
    "-c", "https.proxy=http://127.0.0.1:10809",
    "push",
  ], { cwd: ROOT, stdio: "inherit" });
}

async function main() {
  await fs.mkdir(LOG_DIR, { recursive: true });
  const posts = await readPosts();
  const platforms = await readPlatforms();
  const settings = await readDailySettings();
  const allCandidates = [];
  const browserWs = await getBrowserWs();

  const existingTabs = (await listTabs()).filter((tab) => tab.type === "page");
  for (const tab of existingTabs) {
    const platform = platforms.find((item) =>
      (item.matchDomains || []).some((domain) => tab.url.includes(domain))
    );
    if (platform) allCandidates.push(...await extractFromTab(tab, platform.name).catch(() => []));
  }

  for (const platform of platforms.filter((item) => item.searchUrl)) {
    const { targetId, tab } = await createTab(browserWs, platform.searchUrl);
    allCandidates.push(...await extractFromTab(tab, platform.name).catch(() => []));
    await closeTab(browserWs, targetId);
  }

  const candidates = dedupeCandidates(allCandidates)
    .filter((candidate) => rankCandidate(candidate, settings) > 5)
    .sort((a, b) => rankCandidate(b, settings) - rankCandidate(a, settings));
  const fresh = filterNew(posts, candidates).slice(0, 40);
  const newPosts = fresh.map(makePost);
  const updatedPosts = [...newPosts, ...posts].sort((a, b) => (b.sourceDate || "").localeCompare(a.sourceDate || ""));
  await writePosts(updatedPosts);

  const log = {
    date: new Date().toISOString(),
    platforms: platforms.map((platform) => platform.name),
    focusDirections: settings.focusDirections || [],
    scannedCandidates: allCandidates.length,
    rankedCandidates: candidates.length,
    added: newPosts.length,
    addedTitles: newPosts.map((post) => post.title),
  };
  await fs.writeFile(path.join(LOG_DIR, `update-${TODAY}.json`), `${JSON.stringify(log, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(log, null, 2));
  commitAndPush(newPosts.length);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
