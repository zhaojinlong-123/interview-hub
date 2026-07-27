import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POSTS_FILE = path.join(ROOT, "data", "posts.json");
const FEATURES_FILE = path.join(ROOT, "data", "daily-features.json");
const DRAFT_FILE = path.join(ROOT, "content", "xiaohongshu-drafts", "2026-07-12-991bf07d9a12.md");
const FEATURE_ID = "daily-2026-07-12-991bf07d9a12";
const POST_ID = "supplement-20260712-c8f3579ad4e9";

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

const posts = await readJson(POSTS_FILE, []);
const post = posts.find((item) => item.id === POST_ID);
if (!post) throw new Error(`Post not found: ${POST_ID}`);
const question = post.questions[0];
const answer = post.questionAnswers[0].answer;

const features = await readJson(FEATURES_FILE, []);
if (!features.some((item) => item.id === FEATURE_ID)) {
  features.unshift({
    id: FEATURE_ID,
    date: "2026-07-12",
    slot: "afternoon",
    publishTime: "15:30",
    postId: POST_ID,
    title: post.title,
    company: post.company,
    direction: post.direction,
    score: 49,
    reasons: [
      "近期性 +22",
      "重点方向 推理部署 +6",
      "稀缺方向 推理优化 +4",
      "高频问题 1 个 +5",
      "有来源链接 +6",
      "标签信息完整 +4",
      "同日方向避开上午多模态 +2",
    ],
    sourceUrl: post.sourceUrl,
    sourcePlatform: post.sourcePlatform,
    sourceDate: post.sourceDate,
    articlePath: "content/xiaohongshu-drafts/2026-07-12-991bf07d9a12.md",
    target: "xiaohongshu",
    publishStatus: "draft_ready",
    autoPublish: true,
  });
  await writeJson(FEATURES_FILE, features);
}

const article = [
  `# 每日精选面试题精讲：${post.company}｜${post.direction}`,
  "",
  "## 面试题目",
  `1. ${question}`,
  "",
  "## 详细解答与分析",
  answer,
  "",
  "## 逐题解答",
  `### 题目 1：${question}`,
  "",
  "**详细回答：**",
  answer,
  "",
  "**面试展开：**",
  "回答这类线上推理问题时，先把链路拆成排队、prefill、decode、KV cache 和调度策略，再用 TTFT、TPOT、P95/P99、batch token、active sequence、显存水位这些指标定位瓶颈。不要只说“加机器”或“调 batch”，要说明为什么长尾请求会影响 P99，以及怎样通过长短请求隔离、限流、prefix cache、chunked prefill 和 KV 管理降低长尾。",
  "",
  "## 可能追问方向",
  "- 如果 TTFT 正常但 TPOT 异常，优先看哪些指标？",
  "- 长上下文请求和短请求混跑时，如何设计调度策略？",
  "- PagedAttention 和 continuous batching 分别解决什么问题？",
  "- 线上推理出现 OOM 前，如何做 admission control 和降级？",
  "",
  "## 面经信息",
  `- 公司：${post.company}`,
  `- 岗位：${post.role}`,
  `- 方向：${post.direction}`,
  `- 领域：${post.domain}`,
  `- 难度：${post.difficulty}`,
  `- 来源：${post.sourcePlatform} ${post.sourceDate}`,
  `- 原始链接：${post.sourceUrl}`,
  "",
  "## 小红书发布文案",
  `每日精选：${post.company}｜${post.direction} 题目精讲`,
  "",
  "面试题目",
  `1. ${question}`,
  "",
  "一句话答案",
  answer.slice(0, 180),
  "",
  "引用来源：",
  `${post.sourcePlatform} ${post.sourceDate}`,
  post.sourceUrl,
  "",
  "#大模型面试 #推理部署 #KVCache #vLLM #AI学习",
].join("\n");

await fs.mkdir(path.dirname(DRAFT_FILE), { recursive: true });
await fs.writeFile(DRAFT_FILE, `${article}\n`, "utf8");
console.log(JSON.stringify({ featureId: FEATURE_ID, postId: POST_ID, articlePath: DRAFT_FILE }, null, 2));
