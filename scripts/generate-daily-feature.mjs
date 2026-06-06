import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POSTS_FILE = path.join(ROOT, "data", "posts.json");
const SETTINGS_FILE = path.join(ROOT, "data", "daily-settings.json");
const FEATURES_FILE = path.join(ROOT, "data", "daily-features.json");
const DRAFT_DIR = path.join(ROOT, "content", "xiaohongshu-drafts");
const TODAY = new Date().toISOString().slice(0, 10);
const SHOULD_PUSH = process.argv.includes("--push");

const STRATEGIC_COMPANIES = [
  "字节", "字节跳动", "阿里", "腾讯", "百度", "快手", "美团", "小红书",
  "智元机器人", "蚂蚁集团", "淘天集团", "蔚来", "NVIDIA", "Google",
  "DeepSeek", "Qwen", "Seed", "通义", "混元", "Momenta",
];

const RARE_DIRECTIONS = ["VLA", "具身智能", "世界模型", "自动驾驶", "训练框架", "推理优化", "强化学习", "多模态"];

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

function hash(text) {
  return crypto.createHash("sha1").update(text).digest("hex").slice(0, 12);
}

function daysSince(date) {
  const time = Date.parse(date || "");
  if (Number.isNaN(time)) return 999;
  return Math.max(0, Math.round((Date.now() - time) / 86400000));
}

function textOf(post) {
  return [
    post.title,
    post.company,
    post.role,
    post.direction,
    post.domain,
    post.category,
    post.difficulty,
    post.sourcePlatform,
    post.content,
    post.prepTips,
    ...(post.tags || []),
    ...(post.questions || []),
  ].filter(Boolean).join(" ");
}

function scorePost(post, settings) {
  const text = textOf(post);
  if (/RAG|Agent/i.test(text)) {
    return { score: -999, reasons: ["已按策略排除 RAG / Agent"] };
  }
  const reasons = [];
  let score = 0;

  const age = daysSince(post.sourceDate);
  const recency = age <= 7 ? 22 : age <= 30 ? 14 : age <= 90 ? 8 : 2;
  score += recency;
  reasons.push(`近期性 +${recency}`);

  const focusHits = (settings.focusDirections || []).filter((keyword) =>
    text.toLowerCase().includes(String(keyword).toLowerCase())
  );
  if (focusHits.length) {
    const points = Math.min(24, focusHits.length * 6);
    score += points;
    reasons.push(`重点方向 ${focusHits.join(" / ")} +${points}`);
  }

  if (STRATEGIC_COMPANIES.some((company) => String(post.company || "").includes(company) || text.includes(company))) {
    score += 14;
    reasons.push("大厂/重点机构 +14");
  }

  const rareHits = RARE_DIRECTIONS.filter((keyword) => text.includes(keyword));
  if (rareHits.length) {
    const points = Math.min(16, rareHits.length * 4);
    score += points;
    reasons.push(`稀缺方向 ${rareHits.join(" / ")} +${points}`);
  }

  const questionCount = (post.questions || []).length;
  if (questionCount) {
    const points = Math.min(15, questionCount * 5);
    score += points;
    reasons.push(`高频问题 ${questionCount} 个 +${points}`);
  }

  if (post.sourceUrl) {
    score += 6;
    reasons.push("有来源链接 +6");
  }
  if (post.difficulty === "困难") {
    score += 8;
    reasons.push("困难题/高压面 +8");
  } else if (post.difficulty === "综合") {
    score += 5;
    reasons.push("综合复习价值 +5");
  }
  if ((post.content || "").length > 120) {
    score += 5;
    reasons.push("摘要信息量充足 +5");
  }
  if ((post.tags || []).length >= 4) {
    score += 4;
    reasons.push("标签信息完整 +4");
  }

  return { score, reasons };
}

function bulletList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function buildArticle(post, score, reasons, settings) {
  const questions = post.questions && post.questions.length
    ? post.questions
    : ["项目经历、模型原理、工程落地和评估指标分别如何回答？"];
  const focus = (settings.focusDirections || []).slice(0, 6).join(" / ");
  const tags = [...new Set([...(post.tags || []), post.company, post.direction, "大模型面试", "AI学习"])].filter(Boolean).slice(0, 10);

  return [
    `# 每日大模型面经精读：${post.company}｜${post.direction || post.category}`,
    "",
    `今天选这条：${post.title}`,
    "",
    `为什么值得看：这条面经价值分是 ${score}。它覆盖了 ${post.direction || post.category}，来源是 ${post.sourcePlatform}，适合用来检查自己是否真的能把项目、原理和工程落地讲清楚。`,
    "",
    "## 面经信息",
    `公司：${post.company}`,
    `岗位：${post.role}`,
    `方向：${post.direction || post.category}`,
    `领域：${post.domain || "未标注"}`,
    `难度：${post.difficulty}`,
    `来源：${post.sourcePlatform} ${post.sourceDate || ""}`,
    `原始链接：${post.sourceUrl}`,
    "",
    "## 价值打分依据",
    bulletList(reasons),
    "",
    "## 一句话总结",
    `${post.company} 的这条内容不只是“背题”，更像是在考察候选人能不能把 ${post.direction || post.category} 放进真实业务和工程链路里解释清楚。`,
    "",
    "## 建议重点拆解",
    bulletList([
      "先把自己的项目讲成一条闭环：目标、数据、模型、训练/推理、评估、线上效果。",
      `围绕 ${post.direction || post.category} 准备 2-3 个能深入追问的技术细节。`,
      "把每个高频问题都准备成：直觉解释、公式/结构、工程取舍、常见坑。",
      "如果涉及应用落地，补充延迟、成本、鲁棒性、安全边界和评估指标。",
    ]),
    "",
    "## 可能衍生知识点",
    bulletList([
      "Transformer / Attention / KV Cache / 长上下文",
      "多模态对齐、视觉 token 压缩、图文/视频理解",
      "VLA 动作表示、机器人数据、仿真到真机迁移",
      "分布式训练、显存优化、量化和推理部署",
      "RLHF、DPO、GRPO 与偏好对齐",
    ]),
    "",
    "## 高频考点",
    bulletList(questions),
    "",
    "## 今日复习动作",
    "拿 20 分钟，把上面每个问题写成 3 层答案：30 秒概括、2 分钟展开、5 分钟项目追问。能写出来，面试时才有稳定输出。",
    "",
    "## 小红书发布文案",
    `今天的面经精读：${post.company}｜${post.direction || post.category}`,
    "",
    `这条我会优先看，因为它命中了最近重点方向：${focus || "大模型基础与工程落地"}。`,
    "",
    "复习时不要只背答案，建议按这 4 步拆：",
    "1. 这个问题到底在考什么",
    "2. 我的项目里哪里能对应上",
    "3. 有哪些工程取舍和失败案例",
    "4. 面试官继续追问时我怎么展开",
    "",
    "今天重点问题：",
    bulletList(questions.slice(0, 4)),
    "",
    `来源链接：${post.sourceUrl}`,
    "",
    tags.map((tag) => `#${String(tag).replace(/\s+/g, "")}`).join(" "),
  ].join("\n");
}

function commitAndPush(record) {
  if (!SHOULD_PUSH) return;
  execFileSync("git", ["-c", "safe.directory=E:/workshop/interview-hub", "add", "data/daily-features.json", "data/daily-settings.json", "content/xiaohongshu-drafts"], { cwd: ROOT, stdio: "inherit" });
  execFileSync("git", ["-c", "safe.directory=E:/workshop/interview-hub", "commit", "-m", `Daily featured interview (${record.date})`], { cwd: ROOT, stdio: "inherit" });
  execFileSync("git", [
    "-c", "safe.directory=E:/workshop/interview-hub",
    "-c", "http.proxy=http://127.0.0.1:10809",
    "-c", "https.proxy=http://127.0.0.1:10809",
    "push",
  ], { cwd: ROOT, stdio: "inherit" });
}

async function main() {
  const posts = await readJson(POSTS_FILE, []);
  const settings = await readJson(SETTINGS_FILE, {});
  const history = await readJson(FEATURES_FILE, []);
  const usedIds = new Set(history.map((item) => item.postId));
  const candidates = posts.filter((post) => post.sourceUrl && !usedIds.has(post.id) && !/RAG|Agent/i.test(textOf(post)));

  if (!candidates.length) {
    throw new Error("没有可选面经：所有带来源链接的面经都已经精选过。");
  }

  const ranked = candidates
    .map((post) => ({ post, ...scorePost(post, settings) }))
    .sort((a, b) => b.score - a.score || (b.post.sourceDate || "").localeCompare(a.post.sourceDate || ""));

  const winner = ranked[0];
  await fs.mkdir(DRAFT_DIR, { recursive: true });
  const article = buildArticle(winner.post, winner.score, winner.reasons, settings);
  const fileName = `${TODAY}-${hash(winner.post.id)}.md`;
  const articlePath = path.join(DRAFT_DIR, fileName);
  await fs.writeFile(articlePath, `${article}\n`, "utf8");

  const record = {
    id: `daily-${TODAY}-${hash(winner.post.id)}`,
    date: TODAY,
    postId: winner.post.id,
    title: winner.post.title,
    company: winner.post.company,
    direction: winner.post.direction || winner.post.category,
    score: winner.score,
    reasons: winner.reasons,
    sourceUrl: winner.post.sourceUrl,
    articlePath: path.relative(ROOT, articlePath).replaceAll("\\", "/"),
    target: settings.publishTarget || "xiaohongshu",
    publishStatus: "draft_ready",
    autoPublish: false,
  };
  const nextHistory = [record, ...history];
  await writeJson(FEATURES_FILE, nextHistory);
  console.log(JSON.stringify(record, null, 2));
  commitAndPush(record);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
