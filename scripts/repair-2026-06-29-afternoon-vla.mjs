import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POSTS_FILE = path.join(ROOT, "data", "posts.json");
const FEATURES_FILE = path.join(ROOT, "data", "daily-features.json");
const QUEUE_FILE = path.join(ROOT, "data", "publish-queue.json");
const BAD_FEATURE_ID = "daily-2026-06-29-8c8defee0e13";
const BAD_QUEUE_ID = "xhs-daily-2026-06-29-8c8defee0e13";
const TARGET_POST_ID = "auto-20260629-14f67ad3334b";

const questions = [
  "VLA 框架为什么需要把任务理解、场景 grounding 和低层控制解耦？端到端方案和分层方案如何取舍？",
  "具身智能基础认知中，VLA 与传统感知-规划-控制管线相比，优势、风险和可解释性问题是什么？",
];

const answers = [
  "VLA 系统面对的是“看懂环境、理解指令、落到物理执行”三个不同难度的问题。如果完全端到端，模型可以减少人工模块边界，理论上能从数据中学到更统一的表示，适合数据规模足够大、任务分布相对稳定、允许离线充分验证的场景。但端到端的问题是调试困难：失败时很难判断是视觉 grounding 错了、语言目标理解错了，还是低层执行不稳。分层方案会把任务理解、场景 grounding、技能选择和低层控制拆开，优点是可解释、可替换、可插入安全约束，适合真实机器人落地；缺点是模块误差会逐层传递，接口设计不好会限制上限。面试回答可以这样收束：实验探索可以偏端到端，产品落地通常更偏分层闭环；高层负责语义和目标，低层负责稳定控制，中间用状态估计、约束检查和失败恢复把两者连接起来。",
  "传统感知-规划-控制管线通常先做检测、分割、定位和状态估计，再由规划器生成轨迹，最后控制器执行。它的优点是模块清晰、可解释、工程边界明确，适合安全要求高的工业场景；缺点是依赖人工建模和规则，遇到开放词汇物体、复杂语言指令和长尾场景时扩展成本高。VLA 的优势是把视觉、语言和行为放进统一模型里，可以直接利用大规模图文、视频和机器人数据获得更强的语义泛化能力，能处理“把桌上红色杯子放到电脑左边”这类开放指令。风险在于：模型可能产生视觉幻觉，动作决策缺乏可解释性，训练分布外场景不稳定，且错误可能直接进入物理世界。工程上不能把 VLA 当成黑盒控制器裸奔，通常要加安全边界、动作可行性检查、低层控制兜底、异常停止、日志回放和离线仿真评估。好的回答要同时承认 VLA 的泛化潜力和落地风险。",
];

function readJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const posts = readJson(POSTS_FILE, []);
const post = posts.find((item) => item.id === TARGET_POST_ID);
if (!post) throw new Error(`Target post not found: ${TARGET_POST_ID}`);

post.questions = questions;
post.questionAnswers = questions.map((question, index) => ({
  question,
  answer: answers[index],
  answerStatus: "model_answered",
  answeredAt: new Date().toISOString(),
  source: "repair-2026-06-29-afternoon-vla",
}));
post.company = "综合";
post.direction = "VLA / 具身智能";
post.domain = "具身智能基础模型 / VLA 框架";
post.category = "VLA / 具身智能";
post.type = "面经";
post.difficulty = "困难";
post.reviewStatus = "question_ready";
post.content = [
  "自动更新脚本从 CSDN 搜索到的近期面经候选。摘要：具身智能TL常用算法面经：基础认知与 VLA 框架(一)。",
  "来源题目线索：具身智能TL常用算法面经，基础认知与 VLA 框架。",
  `面试题目包括：${questions.join("；")}。`,
].join(" ").trim();
post.updatedAt = Math.floor(Date.now() / 1000);
writeJson(POSTS_FILE, posts);

writeJson(FEATURES_FILE, readJson(FEATURES_FILE, []).filter((item) => item.id !== BAD_FEATURE_ID));
writeJson(QUEUE_FILE, readJson(QUEUE_FILE, []).filter((item) => item.id !== BAD_QUEUE_ID));

for (const relative of [
  "content/xiaohongshu-drafts/2026-06-29-8c8defee0e13.md",
  "content/xiaohongshu-assets/xhs-daily-2026-06-29-8c8defee0e13",
]) {
  const target = path.join(ROOT, relative);
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
}

console.log(JSON.stringify({
  updated: TARGET_POST_ID,
  title: post.title,
  questions: post.questions,
}, null, 2));
