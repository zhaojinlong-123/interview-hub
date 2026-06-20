import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POSTS_FILE = path.join(ROOT, "data", "posts.json");
const SETTINGS_FILE = path.join(ROOT, "data", "daily-settings.json");
const FEATURES_FILE = path.join(ROOT, "data", "daily-features.json");
const PUBLISHED_QUESTION_REGISTRY_FILE = path.join(ROOT, "data", "published-question-registry.json");
const DRAFT_DIR = path.join(ROOT, "content", "xiaohongshu-drafts");
const TARGET_DATE = process.argv.find((arg) => arg.startsWith("--date="))?.split("=")[1] || new Date().toISOString().slice(0, 10);
const TODAY = TARGET_DATE;
const SHOULD_PUSH = process.argv.includes("--push");
const SHOULD_DRY_RUN = process.argv.includes("--dry-run");
const SLOT = process.argv.find((arg) => arg.startsWith("--slot="))?.split("=")[1] || process.env.DAILY_FEATURE_SLOT || "morning";
const PUBLISH_TIME = process.argv.find((arg) => arg.startsWith("--publish-time="))?.split("=")[1] || process.env.DAILY_FEATURE_PUBLISH_TIME || "";

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

function hasSpecificCompany(post) {
  const company = String(post.company || "").trim();
  if (!company) return false;
  const genericCompanies = new Set(["综合", "未明确", "未知", "其他", "??", "????", "缁煎悎", "鏈槑纭?"]);
  if (genericCompanies.has(company)) return false;
  if (/^[?\s？]+$/.test(company)) return false;
  return true;
}

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
  [/vision\s*encoder|q-former|projector|cross-attention|视觉.*llm|token.*对齐/i, "vlm_connector"],
  [/grounding|ocr|空间关系|幻觉|多轮/i, "vlm_evaluation"],
  [/指令微调|数据构造|caption|vqa|负样本|评测集/i, "multimodal_data"],
];

function questionKey(question) {
  const raw = String(question || "");
  const normalized = normalizeText(raw);
  if (!normalized) return "";
  const matched = QUESTION_PATTERNS.find(([pattern]) => pattern.test(raw) || pattern.test(normalized));
  if (matched) return matched[1];
  return normalized.slice(0, 80);
}

function titleKey(post) {
  return normalizeText([
    post.company,
    post.direction || post.category,
    post.title,
  ].filter(Boolean).join("|")).slice(0, 120);
}

function directionKey(post) {
  return normalizeText(post.direction || post.category || "");
}

function questionKeysForPost(post) {
  return (post.questions || [])
    .map(questionKey)
    .filter(Boolean);
}

const SELF_SOURCE_URL_PATTERNS = [
  "creator.xiaohongshu.com",
  "zhaojinlong-123.github.io/interview-hub",
  "xiaohongshu.com/explore/6a2cd7840000000015024480",
  "xiaohongshu.com/explore/6a2f55a50000000017028b54",
];

const GENERIC_ANSWER_PATTERNS = [
  "回答这类题要避免只背概念",
  "建议按四层组织",
  "如果题目来自真实面经",
  "先解释核心机制，再讲工程取舍",
  "先讲核心机制，再讲工程取舍",
];

function isGenericAnswer(answer) {
  const value = String(answer || "");
  return GENERIC_ANSWER_PATTERNS.some((pattern) => value.includes(pattern));
}

function isPublishableSourceUrl(post) {
  const sourceUrl = String(post.sourceUrl || "");
  if (!post.sourcePlatform || !sourceUrl) return false;
  if (SELF_SOURCE_URL_PATTERNS.some((pattern) => sourceUrl.includes(pattern))) return false;
  if (String(post.sourcePlatform).includes("小红书") && !/xiaohongshu\.com\/explore\/[A-Za-z0-9]+/.test(sourceUrl)) return false;
  return true;
}

function answerMapForPost(post) {
  const map = new Map();
  for (const item of post.questionAnswers || []) {
    const status = String(item.answerStatus || "");
    if (!["verified", "model_answered"].includes(status)) continue;
    if (!item.answer || isGenericAnswer(item.answer)) continue;
    map.set(questionKey(item.question), item.answer);
  }
  return map;
}

function sourceBacksQuestions(post) {
  const sourceText = normalizeText([post.title, post.content, post.prepTips].filter(Boolean).join(" "));
  const questions = Array.isArray(post.questions) ? post.questions : [];
  if (!questions.length) return false;
  return questions.every((question) => {
    const q = normalizeText(question);
    if (!q) return false;
    if (sourceText.includes(q.slice(0, Math.min(24, q.length)))) return true;
    const keyTokens = q.match(/[a-z0-9]{3,}|[\u4e00-\u9fa5]{2,}/g) || [];
    const hits = keyTokens.filter((token) => sourceText.includes(token)).length;
    return hits >= Math.min(4, Math.max(2, Math.ceil(keyTokens.length * 0.45)));
  });
}

function hasVerifiedAnswersForAllQuestions(post) {
  const answerMap = answerMapForPost(post);
  return (post.questions || []).every((question) => answerMap.has(questionKey(question)));
}

function freshenPostQuestions(post, usedQuestionKeys) {
  const questions = Array.isArray(post.questions) ? post.questions : [];
  if (!questions.length) return post;
  const freshQuestions = [];
  const seen = new Set();
  for (const question of questions) {
    const key = questionKey(question);
    if (!key || usedQuestionKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    freshQuestions.push(question);
  }
  if (!freshQuestions.length) return null;
  if (freshQuestions.length === questions.length) return post;
  return {
    ...post,
    questions: freshQuestions,
    content: `${post.content || ""} 已过滤历史重复题目，保留本次未精选过的问题。`.trim(),
  };
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

  if (hasSpecificCompany(post)) {
    const points = Number(settings.companyPriority?.dailyFeatureBonus ?? 18);
    score += points;
    reasons.push(`明确公司来源 ${post.company} +${points}`);
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

function numberedList(items) {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function answerForQuestion(question) {
  const q = String(question || "");
  if (/action\s*token|diffusion\s*policy|连续动作|动作回归|动作表示/i.test(q)) {
    return "这题要先区分动作表示层级。action token 是把动作离散成 token，让 VLA 像生成语言一样生成技能或离散动作，适合高层规划、技能选择、可离散化控制和跨任务统一动作词表；连续动作回归直接输出关节角、末端位姿、速度或夹爪开合，适合低层实时控制、抓取对齐、插孔等精细操作；diffusion policy 生成一段连续动作轨迹，适合多解、轨迹平滑、模仿学习数据分布复杂的操作任务。核心取舍是：token 更利于统一建模和长程推理，回归更直接更实时，diffusion 更能表达多峰动作但推理成本更高。";
  }
  if (/遥操作|时间同步|轨迹切分|失败样本|机器人数据|具身数据/i.test(q)) {
    return "机器人遥操作数据要按采集、同步、切分、标注、质检来组织。采集侧要保存多视角 RGB/RGB-D、腕部相机、本体状态、末端位姿、夹爪状态、控制输入和语言指令；同步侧用统一时钟或高精度 timestamp，把相机、关节状态和动作指令对齐到同一时间轴；轨迹切分通常按任务开始结束、抓取/放置等关键事件、人工标记或状态机阶段切成 episode；失败样本要标注失败类型、发生时间、是否接管、是否可恢复和失败原因。失败样本不能简单丢掉，它能训练恢复策略、失败检测、reward/critic 和 hard negative。";
  }
  if (/DeepSpeed|ZeRO|Megatron|张量并行|流水并行|数据并行/i.test(q)) {
    return "ZeRO 主要切分优化器状态、梯度和参数，解决单卡显存放不下的问题；张量并行把单层矩阵计算拆到多卡，解决单层过宽；流水并行把不同层放到不同卡，解决层数很深；数据并行复制模型、切 batch，提升吞吐但显存冗余高。回答时要补充通信代价：数据并行看 all-reduce，张量并行看层内通信，流水并行看 bubble 和 micro-batch 调度。";
  }
  if (/显存|参数|梯度|优化器|激活值|KV cache/i.test(q)) {
    return "训练显存通常拆成参数、梯度、优化器状态、激活值和临时 buffer。Adam 优化器状态常常比参数本身更占空间；长序列训练时激活值会随 batch、序列长度、层数增长；推理时重点从梯度和优化器状态转到 KV cache。面试里最好能说出优化手段：混合精度、gradient checkpointing、ZeRO/offload、序列并行、FlashAttention、KV cache 量化或分页管理。";
  }
  if (/PagedAttention|continuous batching|speculative decoding|KV cache/i.test(q)) {
    return "KV cache 避免每次生成都重复计算历史 token 的 K/V；PagedAttention 把 KV cache 像分页内存一样管理，减少碎片并提升并发；continuous batching 让不同请求动态进入 batch，减少空等；speculative decoding 用小模型先草拟、大模型验证，降低每个 token 的平均延迟。回答时要说明这些方法主要优化吞吐和延迟，但会带来调度复杂度、显存管理和一致性验证成本。";
  }
  if (/INT8|INT4|量化|AWQ|GPTQ|LoRA|蒸馏/i.test(q)) {
    return "INT8/INT4 量化通过降低权重或激活精度减少显存和带宽压力；GPTQ 偏离线权重量化，适合部署前压缩；AWQ 保护重要通道，通常更关注推理质量；LoRA 合并适合把微调增量融入基座模型，减少在线额外分支；蒸馏适合把大模型能力迁移到小模型。面试要强调取舍：量化可能伤害长尾能力，蒸馏依赖 teacher 数据质量，LoRA 合并后切换任务不如 adapter 灵活。";
  }
  if (/视觉|encoder|LLM|token|Q-Former|cross-attention|projector/i.test(q)) {
    return "视觉 encoder 先把图像或视频转成视觉 token，连接层再把这些 token 映射到 LLM 语义空间。Linear projector 简单高效但表达能力有限；Q-Former 用少量可学习 query 抽取视觉信息，适合压缩 token；cross-attention 交互更充分但成本更高。回答时要补充训练目标和评估方式，比如图文对齐、指令微调、grounding 与幻觉评估。";
  }
  if (/数据|指令微调|OCR|噪声|偏见/i.test(q)) {
    return "数据构造要先覆盖任务类型，再控制质量。图文/视频指令数据通常来自 caption、VQA、OCR、检测框、人工标注和合成指令，但要去重、过滤模板化答案、隔离评测集，并加入困难负样本。OCR 泄漏、标注偏见和低质量 caption 会让模型看似会答题，实际泛化很差。";
  }
  if (/grounding|空间关系|幻觉|多轮/i.test(q)) {
    return "评估要按能力拆开：grounding 看回答是否能落到正确区域，OCR 看文字识别和理解，空间关系看相对位置与计数，幻觉看图中没有但模型编出来的内容，多轮对话看上下文一致性。工程上应结合公开 benchmark、人工评测、线上 badcase 和任务通过率，而不是只看单一总分。";
  }
  return "回答这类题要避免只背概念。建议先给出核心机制，再讲工程取舍，然后补充常见失败模式和评估指标。最好能把答案落到自己的项目：数据怎么来、模型怎么训、线上怎么评估、失败样本如何回流。";
}

function expansionForQuestion(question) {
  const q = String(question || "");
  if (/action\s*token|diffusion\s*policy|连续动作|动作回归|动作表示/i.test(q)) {
    return "面试展开时，建议用“高层规划到低层控制”的链路回答：语言和视觉先决定目标或技能，动作表示再落到具体控制。可以补充一个例子：打开抽屉时，action token 适合表示 grasp / pull 这类技能，连续回归适合输出每一帧末端位姿，diffusion policy 适合生成一段平滑拉抽屉轨迹。最后讲部署约束：控制频率高、延迟敏感时优先回归；任务多解、演示数据多样时 diffusion 更稳；需要和 LLM 统一建模时 action token 更自然。";
  }
  if (/遥操作|时间同步|轨迹切分|失败样本|机器人数据|具身数据/i.test(q)) {
    return "面试展开时，可以按 episode 数据结构讲清楚：每条样本包含初始观察、语言指令、观测序列、动作序列、终止状态和成功/失败标签。相机 30Hz、机械臂状态 200Hz 时，常以图像帧为主时间轴，取最近状态或插值对齐动作。切分时要把失败、重试、人工接管分开标注，不能把失败后重试成功的长轨迹混成一条成功样本。最后强调质检：时间戳错乱、丢帧、相机动作错位、遥操作抖动和重复空操作都要过滤。";
  }
  if (/DeepSpeed|ZeRO|Megatron|张量并行|流水并行|数据并行/i.test(q)) {
    return "面试展开时，可以按“并行对象”组织：数据并行切 batch，张量并行切单层计算，流水并行切层，ZeRO 切训练状态。然后补一句真实系统通常是混合并行，不是单选题。最后给出权衡：显存省了多少、通信增加多少、吞吐是否被 bubble 或 all-reduce 拖慢。";
  }
  if (/显存|参数|梯度|优化器|激活值|KV cache/i.test(q)) {
    return "面试展开时，最好能做数量级估算：参数量、精度、优化器状态倍数、batch size、sequence length 都会影响显存。回答不要停在“用 ZeRO”或“用 checkpointing”，要说明分别减少哪一块显存，以及代价是 CPU/NVMe offload、重复前向计算还是吞吐下降。";
  }
  if (/PagedAttention|continuous batching|speculative decoding|KV cache/i.test(q)) {
    return "面试展开时，把 prefill 和 decode 分开讲会更专业：prefill 更像大矩阵并行计算，decode 更容易受 KV cache、batch 调度和单 token 延迟影响。PagedAttention 解决 cache 管理，continuous batching 解决请求调度，speculative decoding 解决解码步数。";
  }
  if (/INT8|INT4|量化|AWQ|GPTQ|LoRA|蒸馏/i.test(q)) {
    return "面试展开时，可以用部署场景回答：显存紧张先考虑量化，特定任务微调用 LoRA，稳定小模型上线考虑蒸馏。再补质量验证：量化前后要比较困惑度、核心任务准确率、长上下文、代码/数学和安全拒答表现，不能只看平均分。";
  }
  if (/视觉|encoder|LLM|token|Q-Former|cross-attention|projector/i.test(q)) {
    return "面试展开时，可以画出 VLM 数据流：image/video -> vision encoder -> connector -> LLM -> answer/action。再比较 token 数量、训练成本、表达能力和推理延迟。最后落到评估：OCR、grounding、空间关系、幻觉率、多轮一致性。";
  }
  if (/数据|指令微调|OCR|噪声|偏见/i.test(q)) {
    return "面试展开时，重点讲数据闭环：来源、清洗、标注、去重、质量打分、负样本、评测隔离和线上 badcase 回流。多模态数据尤其要防止 OCR 答案泄漏、caption 套话、图文不匹配和训练集污染评测集。";
  }
  if (/grounding|空间关系|幻觉|多轮/i.test(q)) {
    return "面试展开时，建议把评估拆成自动评测和人工评测。自动评测覆盖 OCR、定位、计数、属性识别；人工评测覆盖幻觉、安全、复杂指令和真实业务可用性。线上还要接 badcase 聚类，找出数据缺口和模型系统性弱点。";
  }
  return "面试展开时，把答案和自己的项目挂钩最有说服力：你遇到过什么失败样本，怎么定位，怎么改数据或模型，指标提升了多少，是否带来新的成本或风险。";
}

function answerBlocks(questions, answerMap) {
  return questions.slice(0, 5).flatMap((question, index) => [
    `### 题目 ${index + 1}：${question}`,
    "",
    "**详细回答：**",
    answerMap.get(questionKey(question)),
    "",
    "**面试展开：**",
    expansionForQuestion(question),
    "",
  ]);
}

function buildArticle(post, score, reasons, settings) {
  const answerMap = answerMapForPost(post);
  const questions = post.questions && post.questions.length
    ? post.questions.filter((question) => answerMap.has(questionKey(question)))
    : [
        "Vision encoder 输出如何与 LLM token 空间对齐？",
        "多模态模型如何评估 grounding、OCR、空间关系和幻觉？",
      ];
  if (!questions.length || questions.some((question) => !answerMap.has(questionKey(question)))) {
    throw new Error("Daily feature generation refused: selected post has no verified/model_answered answer for every question");
  }
  const focus = (settings.focusDirections || []).slice(0, 6).join(" / ");
  const tags = [...new Set([...(post.tags || []), post.company, post.direction, "大模型面试", "AI学习"])].filter(Boolean).slice(0, 10);
  const direction = post.direction || post.category;
  const firstQuestion = questions[0] || `${direction} 的核心技术链路如何拆解？`;

  return [
    `# 每日精选面试题精讲：${post.company}｜${direction}`,
    "",
    `> 今日重点：先看面试题目，再看详细解答与分析，最后补充可能追问。`,
    "",
    "## 面试题目",
    numberedList(questions.slice(0, 5)),
    "",
    "## 详细解答与分析",
    `这组题的主线不是背概念，而是判断候选人能否把 ${direction} 拆成可解释、可实现、可评估的工程链路。以「${firstQuestion}」为例，回答时建议先给出整体结构，再说明每个模块的取舍，最后落到项目中的指标和失败案例。`,
    "",
    "**回答结构：**",
    bulletList([
      "核心机制：先解释输入、表示、模型模块、训练目标和输出形式。",
      "工程取舍：说明为什么选这个结构，而不是另一个更重或更简单的方案。",
      "常见问题：主动讲清楚数据噪声、幻觉、延迟、显存、评估偏差或长尾失败。",
      "验证方法：给出离线指标、人工评测、线上反馈和数据回流方式。",
    ]),
    "",
    "**简洁回答模板：**",
    `我会先把 ${direction} 看成一条链路：数据输入 -> 表示学习 -> 模型连接/训练目标 -> 推理部署 -> 评估反馈。面试时不要只说模型名，要把“为什么这样设计、哪里容易失败、怎么验证有效”讲完整。`,
    "",
    "## 逐题解答",
    ...answerBlocks(questions, answerMap),
    "## 可能追问方向",
    bulletList([
      `如果 ${direction} 的效果不稳定，如何定位是数据、结构、训练还是推理问题？`,
      "如果上线后延迟或成本超标，优先压缩哪一部分，代价是什么？",
      "如果 benchmark 分数高但真实业务表现差，你会怎样重新设计评估？",
      "如何把一次失败样本转化为下一轮数据回流和模型改进？",
    ]),
    "",
    "## 面经信息",
    bulletList([
      `公司：${post.company}`,
      `岗位：${post.role}`,
      `方向：${direction}`,
      `领域：${post.domain || "未标注"}`,
      `难度：${post.difficulty}`,
      `来源：${post.sourcePlatform} ${post.sourceDate || ""}`,
      `原始链接：${post.sourceUrl}`,
    ]),
    "",
    "## 价值打分依据",
    bulletList(reasons),
    "",
    "## 复习建议",
    bulletList([
      "先把自己的项目讲成一条闭环：目标、数据、模型、训练/推理、评估、线上效果。",
      `围绕 ${direction} 准备 2-3 个能深入追问的技术细节。`,
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
    "## 核心考点速记",
    bulletList(questions),
    "",
    "## 今日复习动作",
    "拿 20 分钟，把上面每个问题写成 3 层答案：30 秒概括、2 分钟展开、5 分钟项目追问。能写出来，面试时才有稳定输出。",
    "",
    "## 小红书发布文案",
    `每日精选：${post.company}｜${direction} 题目精讲`,
    "",
    `今天这条适合复习：${focus || "大模型基础与应用实现"}。`,
    "",
    "面试题目",
    numberedList(questions.slice(0, 3)),
    "",
    "一句话答案",
    answerMap.get(questionKey(questions[0])).slice(0, 180),
    "",
    "面试展开",
    expansionForQuestion(questions[0]).slice(0, 160),
    "",
    "复习抓手",
    "- 先说核心机制，再说工程取舍。",
    "- 主动补常见坑和评估指标。",
    "- 最后落到自己的项目经验。",
    "",
    `引用来源：${post.sourcePlatform} ${post.sourceDate || ""}`,
    `原文链接：${post.sourceUrl}`,
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
  const publishedQuestionRegistry = await readJson(PUBLISHED_QUESTION_REGISTRY_FILE, []);
  const usedIds = new Set(history.map((item) => item.postId));
  const postsById = new Map(posts.map((post) => [post.id, post]));
  const usedQuestionKeys = new Set();
  const usedTitleKeys = new Set();
  for (const item of history) {
    const historicalPost = postsById.get(item.postId);
    if (historicalPost) {
      questionKeysForPost(historicalPost).forEach((key) => usedQuestionKeys.add(key));
      usedTitleKeys.add(titleKey(historicalPost));
    }
  }
  for (const item of publishedQuestionRegistry) {
    if (item?.key) usedQuestionKeys.add(item.key);
    if (item?.question) usedQuestionKeys.add(questionKey(item.question));
  }
  const todayUsedDirections = new Set(history
    .filter((item) => item.date === TODAY && item.slot !== SLOT)
    .map((item) => normalizeText(item.direction || ""))
    .filter(Boolean));
  const candidates = posts
    .filter((post) =>
      post.sourceUrl
      && (!post.sourceDate || post.sourceDate <= TODAY)
      && isPublishableSourceUrl(post)
      && sourceBacksQuestions(post)
      && hasVerifiedAnswersForAllQuestions(post)
      && Array.isArray(post.questions)
      && post.questions.length > 0
      && !usedIds.has(post.id)
      && !usedTitleKeys.has(titleKey(post))
      && !todayUsedDirections.has(directionKey(post))
      && !/RAG|Agent/i.test(textOf(post))
    )
    .map((post) => freshenPostQuestions(post, usedQuestionKeys))
    .filter(Boolean);

  if (!candidates.length) {
    throw new Error("没有可选面经：所有带来源链接且题目不重复的面经都已经精选过。");
  }

  const ranked = candidates
    .map((post) => ({ post, ...scorePost(post, settings) }))
    .sort((a, b) => b.score - a.score || (b.post.sourceDate || "").localeCompare(a.post.sourceDate || ""));

  const winner = ranked[0];
  const article = buildArticle(winner.post, winner.score, winner.reasons, settings);
  const fileName = `${TODAY}-${hash(winner.post.id)}.md`;
  const articlePath = path.join(DRAFT_DIR, fileName);

  const record = {
    id: `daily-${TODAY}-${hash(winner.post.id)}`,
    date: TODAY,
    slot: SLOT,
    publishTime: PUBLISH_TIME,
    postId: winner.post.id,
    title: winner.post.title,
    company: winner.post.company,
    direction: winner.post.direction || winner.post.category,
    score: winner.score,
    reasons: winner.reasons,
    sourceUrl: winner.post.sourceUrl,
    sourcePlatform: winner.post.sourcePlatform,
    sourceDate: winner.post.sourceDate,
    articlePath: path.relative(ROOT, articlePath).replaceAll("\\", "/"),
    target: settings.publishTarget || "xiaohongshu",
    publishStatus: "draft_ready",
    autoPublish: Boolean(settings.autoPublish),
  };
  if (SHOULD_DRY_RUN) {
    console.log(JSON.stringify({
      ...record,
      dryRun: true,
      selectedQuestions: winner.post.questions || [],
      filteredDuplicateQuestionKeys: [...usedQuestionKeys],
    }, null, 2));
    return;
  }
  await fs.mkdir(DRAFT_DIR, { recursive: true });
  await fs.writeFile(articlePath, `${article}\n`, "utf8");
  const nextHistory = [record, ...history];
  await writeJson(FEATURES_FILE, nextHistory);
  console.log(JSON.stringify(record, null, 2));
  commitAndPush(record);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
