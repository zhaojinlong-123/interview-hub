import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POSTS_FILE = path.join(ROOT, "data", "posts.json");
const TARGET_DATE = "2026-06-24";
const SHOULD_WRITE = process.argv.includes("--write");

const interviewSignals = /面经|面试|八股|一面|二面|三面|四面|offer|高频题|面试题|面试实录|校招|实习/i;
const rejectSignals = /课程|教程|就业指南|论文|综述|项目源码|项目代码|资源下载|下载|网工|VLAN|OSPF|生成树|端口隔离/i;
const excludedDirections = /RAG|Agent/i;

function normalizeXhsUrl(url) {
  const value = String(url || "");
  const match = value.match(/^https:\/\/www\.xiaohongshu\.com\/search_result\/([A-Za-z0-9]+)(\?.*)?$/);
  if (!match) return value;
  return `https://www.xiaohongshu.com/explore/${match[1]}${match[2] || ""}`;
}

function normalizeSourceUrl(url) {
  const xhs = normalizeXhsUrl(url);
  try {
    const parsed = new URL(xhs);
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|request_id|ops_request_misc|biz_id|searchId|spm|from|source)/i.test(key)) {
        parsed.searchParams.delete(key);
      }
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return xhs;
  }
}

const posts = JSON.parse(await fs.readFile(POSTS_FILE, "utf8"));
const kept = [];
const removed = [];
const next = [];
const seenSourceUrls = new Set();

for (const post of posts) {
  if (post.sourceDate !== TARGET_DATE) {
    next.push(post);
    continue;
  }

  const text = [post.title, post.direction, post.content].filter(Boolean).join(" ");
  const reason = !interviewSignals.test(post.title || "")
    ? "no explicit interview signal"
    : rejectSignals.test(post.title || "")
      ? "course/tutorial/paper/download content"
      : excludedDirections.test(text)
        ? "excluded RAG/Agent direction"
        : "";

  if (reason) {
    removed.push({ id: post.id, title: post.title, reason });
    continue;
  }

  post.sourceUrl = normalizeSourceUrl(post.sourceUrl);
  if (seenSourceUrls.has(post.sourceUrl)) {
    removed.push({ id: post.id, title: post.title, reason: "duplicate canonical source URL" });
    continue;
  }
  seenSourceUrls.add(post.sourceUrl);
  post.reviewStatus = (post.questions || []).length ? "question_ready" : "source_candidate";
  post.updatedAt = Math.floor(Date.now() / 1000);
  kept.push(post);
  next.push(post);
}

if (SHOULD_WRITE) {
  await fs.writeFile(POSTS_FILE, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

function group(items, field) {
  return Object.entries(items.reduce((counts, item) => {
    const value = item[field] || "未标注";
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {})).sort((a, b) => b[1] - a[1]);
}

console.log(JSON.stringify({
  mode: SHOULD_WRITE ? "write" : "dry-run",
  date: TARGET_DATE,
  before: kept.length + removed.length,
  kept: kept.length,
  removed: removed.length,
  directXhsLinks: kept.filter((post) => post.sourcePlatform === "小红书" && /\/explore\/[A-Za-z0-9]+/.test(post.sourceUrl || "")).length,
  companies: group(kept, "company"),
  platforms: group(kept, "sourcePlatform"),
  directions: group(kept, "direction"),
  keptItems: kept.map((post) => ({
    id: post.id,
    title: post.title,
    company: post.company,
    direction: post.direction,
    sourcePlatform: post.sourcePlatform,
    sourceUrl: post.sourceUrl,
    questionCount: (post.questions || []).length,
  })),
  removalSamples: removed.slice(0, 30),
}, null, 2));
