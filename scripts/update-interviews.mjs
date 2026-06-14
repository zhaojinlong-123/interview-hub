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
const SEARCHES_PER_PLATFORM = Number(process.env.SEARCHES_PER_PLATFORM || 6);
const maxNewArg = process.argv.find((arg) => arg.startsWith("--max-new="));
const MAX_NEW_POSTS = Number(maxNewArg?.split("=")[1] || process.env.MAX_NEW_POSTS || 40);

const KEYWORDS = [
  "大模型", "LLM", "VLA", "多模态", "面经", "面试",
  "具身", "机器人", "世界模型", "自动驾驶", "训练框架", "DeepSpeed", "Megatron",
  "字节", "腾讯", "百度", "阿里", "蚂蚁", "快手", "小红书", "智元", "淘天",
];

const COMPANY_KEYWORDS = ["字节", "腾讯", "百度", "阿里", "蚂蚁", "快手", "小红书", "智元", "淘天", "华为", "美团", "蔚来", "小鹏", "Momenta", "NVIDIA", "Google", "DeepSeek", "Qwen", "Seed"];
const DEFAULT_SEARCH_QUERIES = [
  "多模态大模型 面经",
  "VLA 具身智能 面经",
  "视频理解 面试题",
  "训练框架 DeepSpeed Megatron 面经",
  "推理部署 KV cache 量化 面经",
  "自动驾驶 数据闭环 世界模型 面经",
];

const FOCUS_QUERY_TOPICS = [
  {
    direction: "多模态大模型",
    topics: ["VLM", "视觉语言对齐", "CLIP", "Q-Former", "OCR", "grounding", "多图理解"],
  },
  {
    direction: "VLA 具身智能",
    topics: ["VLA", "机器人", "action token", "diffusion policy", "遥操作", "轨迹数据", "sim-to-real"],
  },
  {
    direction: "视频理解",
    topics: ["视频理解", "temporal token", "长视频", "时序建模", "视频问答", "事件边界"],
  },
  {
    direction: "训练框架",
    topics: ["DeepSpeed", "Megatron", "ZeRO", "张量并行", "流水并行", "FlashAttention", "显存优化"],
  },
  {
    direction: "推理部署",
    topics: ["KV cache", "PagedAttention", "vLLM", "量化", "speculative decoding", "continuous batching"],
  },
  {
    direction: "自动驾驶数据",
    topics: ["自动驾驶", "数据闭环", "BEV", "occupancy", "世界模型", "仿真评测", "长尾场景"],
  },
];

const SEARCH_SUFFIXES = ["面经", "面试题", "一面", "实习 面经"];
const SEARCH_COMPANY_GROUPS = [
  "",
  "字节",
  "腾讯",
  "百度",
  "阿里",
  "华为",
  "NVIDIA",
  "Google",
  "Momenta",
  "小鹏",
  "蔚来",
];

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function normalizeQuestionText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[，。！？、；：“”‘’（）()[\]{}<>《》/\\\-_:,.!?;\s]/g, "")
    .replace(/visionlanguageaction/g, "vla")
    .replace(/keyvaluecache/g, "kvcache")
    .trim();
}

function questionKey(question) {
  return normalizeQuestionText(question).slice(0, 120);
}

function existingQuestionKeys(posts) {
  const keys = new Set();
  for (const post of posts) {
    for (const question of post.questions || []) {
      const key = questionKey(question);
      if (key) keys.add(key);
    }
  }
  return keys;
}

function removeRepeatedQuestions(post, usedQuestionKeys) {
  const freshQuestions = [];
  const localSeen = new Set();
  for (const question of post.questions || []) {
    const key = questionKey(question);
    if (!key || usedQuestionKeys.has(key) || localSeen.has(key)) continue;
    localSeen.add(key);
    usedQuestionKeys.add(key);
    freshQuestions.push(question);
  }
  return { ...post, questions: freshQuestions };
}

function hash(text) {
  return crypto.createHash("sha1").update(text).digest("hex").slice(0, 12);
}

function normalizeUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const isXiaohongshu = /xiaohongshu\.com$/i.test(parsed.hostname) || /\.xiaohongshu\.com$/i.test(parsed.hostname);
    for (const key of [...parsed.searchParams.keys()]) {
      if (isXiaohongshu && /^xsec_/i.test(key)) continue;
      if (/token|utm|spm|source|from|fr|share/i.test(key)) parsed.searchParams.delete(key);
    }
    if (isXiaohongshu && parsed.pathname.startsWith("/search_result/") && !parsed.searchParams.get("xsec_source")) {
      parsed.searchParams.set("xsec_source", "pc_search");
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
  const banks = [];
  if (/VLA|具身|机器人|智元|动作|遥操作|轨迹/.test(text)) {
    banks.push(
      "VLA 中 action token、连续动作回归和 diffusion policy 各自适合什么控制场景？",
      "机器人数据如何做遥操作采集、时间同步、轨迹切分和失败样本标注？"
    );
  }
  if (/视频|音视频|Video|时序|帧|视觉理解|事件/.test(text)) {
    banks.push(
      "视频理解中帧采样、temporal token 压缩和 long-context attention 如何取舍？",
      "视频模型如何评估时序一致性、动作理解、事件边界和身份保持？"
    );
  }
  if (/DeepSpeed|Megatron|训练框架|显存|ZeRO|并行|checkpoint|FlashAttention/.test(text)) {
    banks.push(
      "DeepSpeed ZeRO、Megatron 张量并行、流水并行和数据并行分别解决什么瓶颈？",
      "大模型训练中显存如何拆解到参数、梯度、优化器状态、激活值和 KV cache？"
    );
  }
  if (/推理|部署|量化|压缩|KV Cache|KV cache|PagedAttention|吞吐|延迟|LoRA/.test(text)) {
    banks.push(
      "KV cache、PagedAttention、continuous batching 和 speculative decoding 如何提升推理吞吐？",
      "INT8/INT4 量化、AWQ/GPTQ、LoRA 合并和蒸馏分别适合哪些部署场景？"
    );
  }
  if (/自动驾驶|世界模型|BEV|occupancy|座舱|蔚来|赛力斯|Momenta|数据闭环|仿真/.test(text)) {
    banks.push(
      "自动驾驶世界模型如何从 BEV、occupancy、轨迹预测和仿真闭环中学习环境动态？",
      "驾驶数据闭环如何做场景挖掘、长尾样本回流、自动标注和仿真评测？"
    );
  }
  if (/RLHF|PPO|DPO|GRPO|强化学习|对齐|Reward/.test(text)) {
    banks.push(
      "RLHF、DPO、GRPO、PPO 的优化目标、训练数据和稳定性问题分别是什么？",
      "Reward model 如何构造偏好数据，如何处理 reward hacking、长度偏置和分布外回答？"
    );
  }
  if (!banks.length) {
    banks.push(
      "Vision encoder 输出如何与 LLM token 空间对齐？Linear projector、Q-Former、cross-attention adapter 的差异是什么？",
      "多模态模型如何评估 grounding、OCR、空间关系、幻觉和多轮视觉对话能力？",
      "图文/视频指令微调数据如何构造，如何控制噪声、偏见和 OCR 泄漏？"
    );
  }
  return [...new Set(banks)].slice(0, 4);
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
    role: /算法|训练|推理|VLA|多模态/.test(text) ? "大模型相关岗位" : "AI / 算法候选人",
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
    prepTips: "",
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

function uniqueList(items) {
  return [...new Set(items.map((item) => clean(item)).filter(Boolean))];
}

function buildSearchQueries(settings) {
  const configured = Array.isArray(settings.searchQueries) ? settings.searchQueries : [];
  const focusDirections = Array.isArray(settings.focusDirections) ? settings.focusDirections : [];
  const focusQueries = focusDirections.map((item) => `${item} 面经`);
  const topicQueries = FOCUS_QUERY_TOPICS.flatMap((group) =>
    group.topics.flatMap((topic) =>
      SEARCH_SUFFIXES.flatMap((suffix) =>
        SEARCH_COMPANY_GROUPS.map((company) => clean(`${company} ${topic} ${suffix}`))
      )
    )
  );
  return uniqueList([...configured, ...focusQueries, ...DEFAULT_SEARCH_QUERIES, ...topicQueries]);
}

function replaceQueryInUrl(searchUrl, query) {
  const encoded = encodeURIComponent(query);
  const raw = String(searchUrl || "");
  if (!raw) return "";
  if (raw.includes("{query}") || raw.includes("{keyword}")) {
    return raw.replaceAll("{query}", encoded).replaceAll("{keyword}", encoded);
  }
  try {
    const url = new URL(raw);
    const queryKeys = ["q", "query", "keyword", "keywords", "w"];
    const key = queryKeys.find((item) => url.searchParams.has(item));
    if (!key) return raw;
    url.searchParams.set(key, query);
    return url.toString();
  } catch {
    return raw;
  }
}

function buildSearchUrls(platform, queries) {
  if (!platform.searchUrl) return [];
  const urls = queries.map((query) => replaceQueryInUrl(platform.searchUrl, query));
  return uniqueList(urls).slice(0, SEARCHES_PER_PLATFORM);
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
    if (/RAG|Agent/i.test(combined)) continue;
    if (!/大模型|LLM|VLA|多模态|具身|机器人|世界模型|自动驾驶|训练框架|DeepSpeed|Megatron|Qwen|DeepSeek/i.test(combined)) continue;
    if (!/面经|面试|一面|二面|三面|题|八股|岗位|实习|社招|校招|offer|项目|训练|推理/i.test(combined)) continue;
    if (/前端社招|JavaScript|金三银四|安卓开发|婚恋|加班情况/.test(combined) && !/大模型|LLM|VLA|多模态|具身/i.test(title)) continue;
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
  if (/大模型|LLM|VLA|多模态|具身|训练框架|DeepSpeed|Megatron/.test(text)) score += 6;
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
  const searchQueries = buildSearchQueries(settings);
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
    for (const searchUrl of buildSearchUrls(platform, searchQueries)) {
      const { targetId, tab } = await createTab(browserWs, searchUrl);
      allCandidates.push(...await extractFromTab(tab, platform.name).catch(() => []));
      await closeTab(browserWs, targetId);
    }
  }

  const candidates = dedupeCandidates(allCandidates)
    .filter((candidate) => rankCandidate(candidate, settings) > 5)
    .sort((a, b) => rankCandidate(b, settings) - rankCandidate(a, settings));
  const fresh = filterNew(posts, candidates).slice(0, MAX_NEW_POSTS);
  const usedQuestionKeys = existingQuestionKeys(posts);
  const newPosts = fresh.map(makePost).map((post) => removeRepeatedQuestions(post, usedQuestionKeys));
  const updatedPosts = [...newPosts, ...posts].sort((a, b) => (b.sourceDate || "").localeCompare(a.sourceDate || ""));
  await writePosts(updatedPosts);

  const log = {
    date: new Date().toISOString(),
    platforms: platforms.map((platform) => platform.name),
    focusDirections: settings.focusDirections || [],
    searchQueryCount: searchQueries.length,
    searchQuerySamples: searchQueries.slice(0, 30),
    scannedCandidates: allCandidates.length,
    rankedCandidates: candidates.length,
    maxNewPosts: MAX_NEW_POSTS,
    added: newPosts.length,
    addedTitles: newPosts.map((post) => post.title),
    rankedCandidateSamples: candidates.slice(0, 500).map((candidate) => ({
      platform: candidate.platform,
      title: candidate.title,
      url: normalizeUrl(candidate.url),
      score: rankCandidate(candidate, settings),
    })),
  };
  await fs.writeFile(path.join(LOG_DIR, `update-${TODAY}.json`), `${JSON.stringify(log, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(log, null, 2));
  commitAndPush(newPosts.length);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
