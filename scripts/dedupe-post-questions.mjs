import fs from "node:fs/promises";

const POSTS_FILE = new URL("../data/posts.json", import.meta.url);
const SHOULD_WRITE = process.argv.includes("--write");
const SHOULD_USE_SEMANTIC_KEYS = process.argv.includes("--semantic");

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[，。！？、；：“”‘’（）()[\]{}<>《》|/\\\-—_:：,.!?;\s]/g, "")
    .replace(/visionlanguageaction/g, "vla")
    .replace(/keyvaluecache/g, "kvcache")
    .replace(/机器人/g, "具身")
    .trim();
}

const QUESTION_PATTERNS = [
  [/action\s*token|diffusion\s*policy|连续动作|动作回归|动作表示/i, "vla_action_representation"],
  [/遥操作|时间同步|轨迹切分|失败样本|机器人数据|具身数据/i, "robot_data_pipeline"],
  [/世界模型|occupancy|bev|轨迹预测|仿真闭环|数据闭环/i, "world_model_autodrive"],
  [/deepspeed|zero|megatron|张量并行|流水并行|数据并行/i, "distributed_training"],
  [/显存|优化器状态|激活值|gradient\s*checkpoint|checkpointing/i, "training_memory"],
  [/kv\s*cache|pagedattention|continuous\s*batching|speculative\s*decoding/i, "llm_inference"],
  [/int4|int8|量化|awq|gptq|lora|蒸馏/i, "compression_finetune"],
  [/rlhf|dpo|grpo|ppo|reward\s*model|偏好|对齐训练/i, "preference_alignment"],
  [/vision\s*encoder|q-former|projector|cross-attention|视觉.*llm|token.*对齐/i, "vlm_connector"],
  [/grounding|ocr|空间关系|幻觉|多轮/i, "vlm_evaluation"],
  [/指令微调|数据构造|caption|vqa|负样本|评测集/i, "multimodal_data"],
];

function questionKey(question) {
  const raw = String(question || "");
  const normalized = normalizeText(raw);
  if (!normalized) return "";
  if (!SHOULD_USE_SEMANTIC_KEYS) return normalized;
  const matched = QUESTION_PATTERNS.find(([pattern]) => pattern.test(raw) || pattern.test(normalized));
  if (matched) return matched[1];
  return normalized.slice(0, 80);
}

function postPriority(post) {
  const sourceTime = Date.parse(post.sourceDate || "") || 0;
  const questionCount = Array.isArray(post.questions) ? post.questions.length : 0;
  const sourceBonus = post.sourceUrl ? 1 : 0;
  const contentBonus = String(post.content || "").length > 120 ? 1 : 0;
  return sourceTime + questionCount * 1000 + sourceBonus * 100 + contentBonus * 10;
}

const posts = JSON.parse(await fs.readFile(POSTS_FILE, "utf8"));
const order = posts
  .map((post, index) => ({ post, index, priority: postPriority(post) }))
  .sort((a, b) => b.priority - a.priority || a.index - b.index);

const seen = new Map();
const removals = [];
let before = 0;
let after = 0;

for (const { post, index } of order) {
  const questions = Array.isArray(post.questions) ? post.questions.filter(Boolean) : [];
  before += questions.length;
  const kept = [];
  const localSeen = new Set();
  for (const question of questions) {
    const key = questionKey(question);
    if (!key) continue;
    if (seen.has(key) || localSeen.has(key)) {
      removals.push({
        key,
        removedFromPostId: post.id,
        removedFromTitle: post.title,
        removedQuestion: question,
        keptByPostId: seen.get(key)?.postId || post.id,
        keptQuestion: seen.get(key)?.question || kept.find((item) => questionKey(item) === key) || "",
      });
      continue;
    }
    localSeen.add(key);
    kept.push(question);
    seen.set(key, { postId: post.id, question, index });
  }
  posts[index].questions = kept;
  after += kept.length;
}

const emptyQuestionPosts = posts.filter((post) => !Array.isArray(post.questions) || post.questions.length === 0).length;
const summary = {
  mode: SHOULD_WRITE ? "write" : "dry-run",
  posts: posts.length,
  before,
  after,
  removed: before - after,
  uniqueKeys: seen.size,
  emptyQuestionPosts,
  sampleRemovals: removals.slice(0, 20),
};

if (SHOULD_WRITE) {
  await fs.writeFile(POSTS_FILE, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify(summary, null, 2));
