import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POSTS_FILE = path.join(ROOT, "data", "posts.json");
const POST_ID = "auto-20260623-50d0c03d01a9";

const questions = [
  {
    question: "MoE 中专家路由如何做负载均衡和专家容量控制，为什么会出现专家塌缩？",
    answer:
      "MoE 的核心是用 router/gate 为每个 token 选择少量专家计算，从而用较低计算量扩展参数规模。负载均衡要解决的是“所有 token 都挤到少数专家”的问题，常见做法包括 top-k 路由、router auxiliary loss、专家容量因子 capacity factor、token dropping 或 rerouting、router z-loss、噪声路由和分组路由。容量控制本质是在吞吐、显存和质量之间取舍：容量太小会丢 token 或把 token 分给次优专家，质量下降；容量太大会增加 padding、通信和显存浪费。专家塌缩通常来自三类原因：第一，router 初期偏置导致马太效应，热门专家越训练越强；第二，训练数据分布不均，让某些专家长期收到更容易优化的样本；第三，辅助损失权重、学习率或 top-k 设置不合理，使路由器只追求主损失而忽略均衡。面试回答时要强调 MoE 不只是模型结构问题，也是分布式系统问题，因为跨卡专家并行会引入 all-to-all 通信，负载不均会直接拖慢训练吞吐。",
  },
  {
    question: "GRPO 相比 PPO 为什么可以省去价值模型，适合哪些大模型推理训练场景？",
    answer:
      "PPO 通常需要 policy model、reference model、reward model 和 value model。value model 用来估计状态价值，帮助计算 advantage，但这会带来额外显存、训练不稳定和价值估计误差。GRPO 的思路是对同一个 prompt 采样一组回答，用组内 reward 的相对均值或标准差来构造 advantage，因此不再单独训练 value model。它的优势是工程更轻、显存压力更小，尤其适合数学推理、代码生成、复杂问答这类“同一问题可以采样多条候选并做相对比较”的场景。局限也要说清楚：GRPO 依赖 reward 质量和组采样多样性，如果 reward 稀疏、候选高度相似或规则奖励有漏洞，模型仍可能 reward hacking；同时它更适合可验证或可比较的推理任务，不一定适合开放式创作和主观偏好很强的场景。回答这题最好把 PPO 的 value baseline 和 GRPO 的 group-relative baseline 对比清楚，再落到显存、稳定性、采样成本和适用任务上。",
  },
];

const posts = JSON.parse(await fs.readFile(POSTS_FILE, "utf8"));
const post = posts.find((item) => item.id === POST_ID);
if (!post) throw new Error(`post not found: ${POST_ID}`);

post.title = "小红书：美团春招大模型算法岗面经·MoE+GRPO";
post.company = "美团";
post.sourcePlatform = "小红书";
post.sourceDate = "2026-06-23";
post.sourceUrl = "https://www.xiaohongshu.com/explore/6a0033fc000000003601d12a";
post.role = "大模型算法岗";
post.category = "大模型训练 / 强化学习";
post.direction = "MoE / GRPO / 大模型训练";
post.domain = "专家混合模型 / 强化学习优化";
post.difficulty = "困难";
post.tags = [...new Set([...(post.tags || []), "美团", "MoE", "GRPO", "大模型训练", "强化学习", "面经"])];
post.questions = questions.map((item) => item.question);
post.questionAnswers = questions.map((item) => ({
  question: item.question,
  answer: item.answer,
  answerStatus: "model_answered",
  answeredAt: new Date().toISOString(),
  source: "repair-2026-06-23-afternoon-candidate",
}));
post.content = [
  post.content || "",
  "来源题目证据：美团春招大模型算法岗面经·MoE+GRPO。",
  ...questions.map((item) => `面试题目：${item.question}`),
].join(" ").trim();
post.updatedAt = Math.floor(Date.now() / 1000);

await fs.writeFile(POSTS_FILE, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  repaired: POST_ID,
  title: post.title,
  sourceUrl: post.sourceUrl,
  questions: post.questions,
}, null, 2));
