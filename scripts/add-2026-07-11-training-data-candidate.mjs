import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POSTS_FILE = path.join(ROOT, "data", "posts.json");
const question = "大模型训练数据版本迭代时，如何记录样本来源、过滤规则和评测回归，避免新数据引入能力退化？";

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
  title: "训练数据面经：版本治理与回归评测",
  company: "综合",
  role: "大模型训练工程师",
  direction: "训练框架",
  domain: "数据治理 / 版本追踪 / 回归评测",
  category: "训练框架",
  sourcePlatform: "CSDN",
  sourceDate: "2026-07-11",
  sourceUrl: "https://blog.csdn.net/zhangzhentiyes/article/details/145885529?ops_request_misc=elastic_search_misc&request_id=39fc56fafca06eb78803620f58d7bbcf&biz_id=",
  tags: ["训练数据", "数据治理", "回归评测", "质量过滤", "训练框架"],
  questions: [question],
  type: "interview",
  difficulty: "中等",
  content: `2026-07-11 补发候选来源：CSDN《大模型最新面试题系列：训练篇之数据处理与增强》。面试题目：${question}`,
  prepTips: "",
  createdAt: now,
  updatedAt: now,
  reviewStatus: "question_ready",
  questionAnswers: [
    {
      question,
      answer: "训练数据迭代必须像代码一样做版本治理。首先要给每批样本记录来源、采集时间、授权状态、清洗规则、去重阈值、质量分、领域标签和过滤原因，保证后续能追溯“这条数据为什么进入训练集”。其次，每次数据变更都要生成数据 diff，例如新增了哪些领域、删除了哪些低质样本、重复率和长度分布如何变化，避免只看总量。训练前要跑小规模试训或 replay，观察 loss、梯度、困惑度和关键能力集表现；训练后要做回归评测，覆盖通用能力、目标领域、安全、事实性、代码/数学、多模态或业务 hard case。若新数据带来能力退化，要能回滚到上一个数据版本，并通过分桶评测定位是某个来源、某类模板化样本还是过滤规则出了问题。工程上还应把数据版本、模型 checkpoint、训练配置和评测报告绑定，形成可审计链路。",
      answerStatus: "model_answered",
      answeredAt: new Date().toISOString(),
      source: "manual-supplement-2026-07-11",
    },
  ],
});

await fs.writeFile(POSTS_FILE, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ added: 1, id }, null, 2));
