import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POSTS_FILE = path.join(ROOT, "data", "posts.json");
const FEATURES_FILE = path.join(ROOT, "data", "daily-features.json");
const DRAFT_DIR = path.join(ROOT, "content", "xiaohongshu-drafts");

const items = [
  {
    date: "2026-07-18",
    slot: "afternoon",
    publishTime: "15:30",
    featureId: "daily-2026-07-18-a5ceaf08b87f",
    postId: "embodied-20260719-a5ceaf08b87f",
  },
  {
    date: "2026-07-19",
    slot: "morning",
    publishTime: "09:30",
    featureId: "daily-2026-07-19-d0c23227adf2",
    postId: "embodied-20260719-d0c23227adf2",
  },
  {
    date: "2026-07-19",
    slot: "afternoon",
    publishTime: "15:30",
    featureId: "daily-2026-07-19-7a37255bc43f",
    postId: "embodied-20260719-7a37255bc43f",
  },
];

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

function sourceSummary(post) {
  return `${post.sourcePlatform}${post.sourceDate ? `，${post.sourceDate}` : ""}`;
}

function makeArticle(post) {
  const question = post.questions?.[0] || "";
  const answer = post.questionAnswers?.find((item) => item.question === question)?.answer || post.questionAnswers?.[0]?.answer || "";
  if (!question || !answer) throw new Error(`Post has no question/answer: ${post.id}`);

  const shortAnswer = answer.length > 230 ? `${answer.slice(0, 230)}…` : answer;
  return [
    `# 每日精选面试题精讲：${post.company || "综合"}｜${post.direction}`,
    "",
    "> 今日重点：先看面试题目，再看详细解答与分析，最后补充可能追问。",
    "",
    "## 面试题目",
    `1. ${question}`,
    "",
    "## 详细解答与分析",
    `这道题重点考察候选人是否真正理解 ${post.direction} 的工程闭环，而不是只背模型名称。回答时建议按「任务目标 -> 模型或系统结构 -> 数据/训练 -> 推理控制 -> 评估指标 -> 失败处理」展开。`,
    "",
    "**回答结构：**",
    "- 核心机制：先说明问题要解决什么，以及输入、状态表示和输出动作/预测分别是什么。",
    "- 工程取舍：说明为什么这样设计，和替代方案相比牺牲了什么、换来了什么。",
    "- 风险边界：主动说明延迟、误检、分布外场景、碰撞风险、仿真到真实差异等问题。",
    "- 验证指标：用可量化指标证明方案有效，而不是只说“效果更好”。",
    "",
    "## 逐题解答",
    `### 题目 1：${question}`,
    "",
    "**详细回答：**",
    answer,
    "",
    "**面试展开：**",
    "面试里不要停在概念层。更好的回答方式是把这道题和真实机器人系统挂钩：数据从哪里来，模型在链路里输出什么，低层控制如何兜底，失败样本如何回流，最终用什么指标判断是否真的可落地。",
    "",
    "## 可能追问方向",
    "- 如果真实机器人上效果不稳定，如何判断是感知、规划、控制还是数据分布问题？",
    "- 如果离线指标很好但真机成功率低，下一轮数据应该怎么采、怎么标、怎么回流？",
    "- 这个方案在实时性、安全性和泛化性之间有什么取舍？",
    "- 如果换一个机器人平台或任务场景，哪些模块可以复用，哪些必须重新适配？",
    "",
    "## 面经信息",
    `- 公司：${post.company || "综合"}`,
    `- 岗位：${post.role || "具身智能相关岗位"}`,
    `- 方向：${post.direction}`,
    `- 领域：${post.domain || post.category || ""}`,
    `- 难度：${post.difficulty || "困难"}`,
    `- 来源：${sourceSummary(post)}`,
    `- 原始链接：${post.sourceUrl}`,
    "",
    "## 价值打分依据",
    "- 聚焦具身智能/VLA/机器人系统，符合当前重点方向。",
    "- 题目能从模型结构延伸到数据、控制、安全和评估，适合面试深挖。",
    "- 带来源链接，并已补充模型深度回答。",
    "",
    "## 核心考点速记",
    `- ${question}`,
    "",
    "## 今日复习动作",
    "用 20 分钟把这道题改写成三层答案：30 秒概括、2 分钟展开、5 分钟项目追问。能讲清楚机制、取舍和指标，面试时就不容易发散。",
    "",
    "## 小红书发布文案",
    `每日精选：${post.company || "综合"}｜${post.direction} 题目精讲`,
    "",
    "面试题目",
    `1. ${question}`,
    "",
    "一句话答案",
    shortAnswer,
    "",
    "引用来源：",
    sourceSummary(post),
    post.sourceUrl,
    "",
    "#具身智能 #VLA #机器人 #世界模型 #大模型面试 #AI学习",
  ].join("\n");
}

const posts = await readJson(POSTS_FILE, []);
const features = await readJson(FEATURES_FILE, []);
const byId = new Map(posts.map((post) => [post.id, post]));

const created = [];
for (const item of items) {
  const post = byId.get(item.postId);
  if (!post) throw new Error(`Post not found: ${item.postId}`);
  const articlePath = `content/xiaohongshu-drafts/${item.featureId.replace(/^daily-/, "")}.md`;
  const draftFile = path.join(ROOT, articlePath);

  const existing = features.find((feature) => feature.id === item.featureId);
  const record = {
    id: item.featureId,
    date: item.date,
    slot: item.slot,
    publishTime: item.publishTime,
    postId: item.postId,
    title: post.title,
    company: post.company,
    direction: post.direction,
    score: post.company && post.company !== "综合" ? 88 : 72,
    reasons: [
      "具身智能重点方向",
      "题目未与已发布题目文本重复",
      "已有模型详细回答",
      "带来源链接",
      post.company && post.company !== "综合" ? `明确公司来源 ${post.company}` : "综合来源",
    ],
    sourceUrl: post.sourceUrl,
    sourcePlatform: post.sourcePlatform,
    sourceDate: post.sourceDate,
    articlePath,
    target: "xiaohongshu",
    publishStatus: "draft_ready",
    autoPublish: true,
  };

  if (existing) Object.assign(existing, record);
  else features.unshift(record);

  await fs.mkdir(DRAFT_DIR, { recursive: true });
  await fs.writeFile(draftFile, `${makeArticle(post)}\n`, "utf8");
  created.push({ featureId: item.featureId, postId: item.postId, articlePath });
}

await writeJson(FEATURES_FILE, features);
console.log(JSON.stringify({ created }, null, 2));
