import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POSTS_FILE = path.join(ROOT, "data", "posts.json");
const SOURCE_FILE = path.join(ROOT, "logs", "candidate-source-text-2026-06-24.json");
const TARGET_DATE = "2026-06-24";

const genericPatterns = [
  "回答这类题要避免只背概念",
  "建议按四层组织",
  "如果题目来自真实面经",
  "先解释核心机制，再讲工程取舍",
];

const posts = JSON.parse(await fs.readFile(POSTS_FILE, "utf8"));
const sources = new Map(
  JSON.parse(await fs.readFile(SOURCE_FILE, "utf8")).map((record) => [record.id, record]),
);
const ready = posts.filter((post) => post.sourceDate === TARGET_DATE && post.reviewStatus === "question_ready");
const issues = [];

for (const post of ready) {
  const sourceText = String(sources.get(post.id)?.text || "");
  if (!post.sourceUrl) issues.push({ id: post.id, type: "missing_source_url" });
  if (post.sourcePlatform === "小红书" && !/xiaohongshu\.com\/explore\/[A-Za-z0-9]+/.test(post.sourceUrl || "")) {
    issues.push({ id: post.id, type: "invalid_xhs_source", sourceUrl: post.sourceUrl });
  }
  for (const question of post.questions || []) {
    if (!sourceText.includes(question)) {
      issues.push({ id: post.id, type: "question_not_in_captured_source", question });
    }
    const answer = (post.questionAnswers || []).find((item) => item.question === question);
    if (!answer) {
      issues.push({ id: post.id, type: "missing_answer", question });
      continue;
    }
    if (answer.answerStatus !== "model_answered") {
      issues.push({ id: post.id, type: "invalid_answer_status", question, status: answer.answerStatus });
    }
    if (String(answer.answer || "").length < 80) {
      issues.push({ id: post.id, type: "answer_too_short", question });
    }
    const generic = genericPatterns.find((pattern) => String(answer.answer || "").includes(pattern));
    if (generic) {
      issues.push({ id: post.id, type: "generic_answer", question, pattern: generic });
    }
  }
}

const summary = {
  date: TARGET_DATE,
  readySources: ready.length,
  readyQuestions: ready.reduce((sum, post) => sum + (post.questions || []).length, 0),
  concreteCompanySources: ready.filter((post) => post.company && !["综合", "未知", "未明确", "其他"].includes(post.company)).length,
  issues,
  valid: issues.length === 0,
};

console.log(JSON.stringify(summary, null, 2));
if (issues.length) process.exitCode = 1;
