import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POSTS_FILE = path.join(ROOT, "data", "posts.json");
const question = "世界模型训练中如何把真实驾驶数据、仿真数据和闭环评测连接起来，避免只学到离线预测指标？";

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[，。！？、；：“”‘’（）()[\]{}<>《》/\\\-_:,.!?;\s]/g, "")
    .trim();
}

function hash(text) {
  return crypto.createHash("sha1").update(text).digest("hex").slice(0, 12);
}

const posts = JSON.parse(await fs.readFile(POSTS_FILE, "utf8"));
const exists = posts.some((post) => (post.questions || []).some((item) => normalize(item) === normalize(question)));

if (exists) {
  console.log(JSON.stringify({ added: 0, reason: "duplicate" }, null, 2));
  process.exit(0);
}

const now = Math.floor(Date.now() / 1000);
const id = `supplement-20260711-${hash(question)}`;

posts.unshift({
  id,
  title: "世界模型面经：真实数据、仿真与闭环评测",
  company: "综合",
  role: "自动驾驶 / 世界模型算法工程师",
  direction: "自动驾驶数据 / 世界模型",
  domain: "世界模型 / 仿真数据 / 闭环评测",
  category: "自动驾驶 / 数据闭环",
  sourcePlatform: "CSDN",
  sourceDate: "2026-07-11",
  sourceUrl: "https://blog.csdn.net/kaka0722ww/article/details/160022527?ops_request_misc=&request_id=&biz_id=102",
  tags: ["世界模型", "自动驾驶", "仿真", "闭环评测", "数据闭环"],
  questions: [question],
  type: "interview",
  difficulty: "困难",
  content: `2026-07-11 补发候选来源：CSDN《春招必看！自动驾驶多模态大模型算法岗面经 + 薪资全解析》。面试题目：${question}`,
  prepTips: "",
  createdAt: now,
  updatedAt: now,
  reviewStatus: "question_ready",
  questionAnswers: [
    {
      question,
      answer: "这题的核心是区分“离线预测准确”和“闭环驾驶可用”。真实驾驶数据提供长尾场景、传感器噪声、交通参与者真实反应和人类接管片段，是世界模型学习环境动态的基础；仿真数据提供可控扰动、危险场景扩增和反事实评测能力，但容易有 sim-to-real gap；闭环评测负责把模型预测放回规划控制链路，看自车动作改变后环境是否合理演化。训练时可以用真实日志学习 BEV、occupancy、轨迹和交通规则，再用仿真生成稀有交互与碰撞边界样本，最后用闭环指标筛选失败场景回流训练。不能只优化 ADE、FDE 或未来 occupancy IoU，因为这些离线指标不一定对应安全规划。更可靠的指标包括碰撞率、接管率、规则违反、舒适性、near miss、长尾场景通过率和不确定性校准。工程上还要保留可解释中间量，例如风险热力图、候选动作代价和参与者反应假设，便于排查世界模型是否学错了因果关系。",
      answerStatus: "model_answered",
      answeredAt: new Date().toISOString(),
      source: "manual-supplement-2026-07-11",
    },
  ],
});

await fs.writeFile(POSTS_FILE, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ added: 1, id }, null, 2));
