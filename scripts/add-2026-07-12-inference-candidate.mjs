import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POSTS_FILE = path.join(ROOT, "data", "posts.json");
const question = "线上推理出现 P99 延迟升高但平均延迟正常时，应该如何从队列、prefill、decode 和 KV cache 四个层面排查？";

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
const id = `supplement-20260712-${hash(question)}`;

posts.unshift({
  id,
  title: "推理部署面经：P99 延迟排查",
  company: "综合",
  role: "大模型推理部署工程师",
  direction: "推理部署",
  domain: "P99 延迟 / prefill / decode / KV cache",
  category: "推理优化 / 模型压缩",
  sourcePlatform: "CSDN",
  sourceDate: "2026-07-12",
  sourceUrl: "https://blog.csdn.net/zhangzhentiyes/article/details/146966952?ops_request_misc=elastic_search_misc&request_id=39fc56fafca06eb78803620f58d7bbcf&biz_id=",
  tags: ["推理部署", "P99", "prefill", "decode", "KV cache"],
  questions: [question],
  type: "interview",
  difficulty: "困难",
  content: `2026-07-12 补发候选来源：CSDN《大模型最新面试题系列：模型部署（二）》。面试题目：${question}`,
  prepTips: "",
  createdAt: now,
  updatedAt: now,
  reviewStatus: "question_ready",
  questionAnswers: [
    {
      question,
      answer: "P99 升高但平均延迟正常，通常说明少量请求被长尾拖慢，而不是整体算力完全不足。第一层先看队列：是否有长上下文或高优先级请求占用 batch，是否存在 head-of-line blocking，队列等待时间是否在 P99 上放大。第二层看 prefill：长输入、prefix cache 未命中、chunked prefill 设置不合理，都会让首 token 延迟抬高；要按输入长度分桶看 TTFT。第三层看 decode：输出很长、continuous batching 调度不公平、单步 batch token 过大，会导致部分请求 TPOT 变差。第四层看 KV cache：显存水位高、碎片多、PagedAttention block 回收慢或 KV 量化/eviction 策略异常，都可能让少数请求等待资源。排查时不要只看平均 tokens/s，要同时记录队列等待、TTFT、TPOT、active sequence 数、batch token、KV cache 使用率、OOM/重试和不同长度分桶的 P95/P99。解决上可以做请求分级、长短请求隔离、限制最大上下文、开启 prefix cache、优化 chunked prefill、调整 batch token 上限和显存水位保护。",
      answerStatus: "model_answered",
      answeredAt: new Date().toISOString(),
      source: "manual-supplement-2026-07-12",
    },
  ],
});

await fs.writeFile(POSTS_FILE, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ added: 1, id }, null, 2));
