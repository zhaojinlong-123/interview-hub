import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POSTS_FILE = path.join(ROOT, "data", "posts.json");
const QUEUE_FILE = path.join(ROOT, "data", "publish-queue.json");
const REGISTRY_FILE = path.join(ROOT, "data", "published-question-registry.json");
const REPORT_FILE = path.join(ROOT, "logs", "xhs-publish-audit.json");

const SHOULD_FIX = process.argv.includes("--fix");
const SHOULD_FAIL_ON_RISK = process.argv.includes("--fail-on-risk");
const SHOULD_REPAIR_QUEUE = process.argv.includes("--repair-queue");

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
  return crypto.createHash("sha1").update(String(text || "")).digest("hex").slice(0, 12);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[，。！？、；：“”‘’（）()[\]{}<>《》/\\\-_:?.!;|\s]/g, "")
    .replace(/visionlanguageaction/g, "vla")
    .replace(/kvcache/g, "kvcache")
    .replace(/diffusionpolicy/g, "diffusion")
    .trim();
}

function questionKey(question) {
  const raw = String(question || "");
  const normalized = normalizeText(raw);
  if (!normalized) return "";
  const family = classifyQuestion(raw);
  if (family !== "general") return `${family}:${hash(normalized)}`;
  return `general:${normalized.slice(0, 96)}`;
}

function extractQuestionsFromCard(record) {
  const card = record.imageCards?.find((item) => item.kind === "questions");
  const lines = String(card?.body || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+[.、]\s*/, "").trim())
    .filter(Boolean);
  return lines.length ? lines : [record.primaryQuestion].filter(Boolean);
}

function classifyQuestion(text) {
  const q = String(text || "");
  if (/episode|成功.*失败.*中断|人为接管|接管.*标注|终止原因/i.test(q)) return "embodied_episode";
  if (/imitation learning|online.*强化学习|在线强化学习|安全风险|受限在线探索/i.test(q)) return "embodied_online_rl";
  if (/sim-to-real|视觉随机化|动力学随机化|真实少样本|域随机化/i.test(q)) return "embodied_sim2real";
  if (/长程具身|子目标分解|动作不可逆|重规划|环境变化/i.test(q)) return "embodied_long_horizon";
  if (/具身智能评估|不能只看成功率|碰撞率|接管率|泛化指标/i.test(q)) return "embodied_eval";
  if (/action\s*token|diffusion\s*policy|连续动作|动作回归|动作表示/i.test(q)) return "vla_action";
  if (/遥操作|时间同步|轨迹切分|失败样本|机器人数据|具身数据/i.test(q)) return "robot_data";
  if (/世界模型|BEV|occupancy|轨迹预测|仿真闭环|数据闭环|自动驾驶/i.test(q)) return "world_model";
  if (/DeepSpeed|ZeRO|Megatron|张量并行|流水并行|数据并行|分布式训练/i.test(q)) return "distributed_training";
  if (/PagedAttention|continuous batching|speculative decoding|推理加速|吞吐|延迟/i.test(q)) return "inference";
  if (/显存|参数|梯度|优化器状态|activation|checkpoint|KV\s*cache/i.test(q)) return "memory";
  if (/INT8|INT4|量化|AWQ|GPTQ|LoRA|蒸馏|剪枝/i.test(q)) return "compression";
  if (/vision encoder|Q-Former|projector|cross-attention|视觉.*LLM|多模态.*对齐/i.test(q)) return "vlm_connector";
  if (/数据构造|指令微调|caption|负样本|数据清洗|标注/i.test(q)) return "data";
  if (/grounding|OCR|空间关系|幻觉|多轮|视觉理解/i.test(q)) return "vlm_eval";
  if (/强化学习|RLHF|DPO|PPO|GRPO|偏好优化|奖励模型/i.test(q)) return "rl";
  return "general";
}

function answerForQuestion(question) {
  const family = classifyQuestion(question);
  switch (family) {
    case "vla_action":
      return "这题要先区分动作表示层级。action token 是把动作离散成 token，让 VLA 像生成语言一样生成技能或离散动作，适合高层规划、技能选择、可离散化控制和跨任务统一动作词表；连续动作回归直接输出关节角、末端位姿、速度或夹爪开合，适合低层实时控制、抓取对齐、插孔等精细操作；diffusion policy 生成一段连续动作轨迹，适合多解、轨迹平滑、模仿学习数据分布复杂的操作任务。工程取舍是：token 更利于统一建模和长程推理，回归更直接更实时，diffusion 更能表达多峰动作但推理成本更高。";
    case "robot_data":
      return "机器人遥操作数据要按采集、同步、切分、标注、质检来组织。采集侧保存多视角 RGB/RGB-D、腕部相机、本体状态、末端位姿、夹爪状态、控制输入和语言指令；同步侧用统一时钟或高精度 timestamp，把相机、关节状态和动作指令对齐到同一时间轴；轨迹切分按任务开始结束、抓取/放置等关键事件、人工标记或状态机阶段切成 episode；失败样本要标注失败类型、发生时间、是否接管、是否可恢复和失败原因。失败样本不能简单丢掉，它能训练恢复策略、失败检测、reward/critic 和 hard negative。";
    case "embodied_episode":
      return "episode 切分要围绕任务语义和控制连续性，而不是机械按固定时长切。一次 episode 通常从任务指令下发、机器人进入初始状态或人工开始遥操作时开始，到任务完成、失败、超时、中断或人为接管时结束。标注时至少记录起止时间、任务目标、关键阶段、动作轨迹、观察流、成功状态和终止原因。成功样本要标注是否完全达成目标；失败样本要标注失败发生点、失败类型、是否可恢复和失败原因；中断样本要区分系统异常、传感器丢失、用户暂停和安全策略触发；人为接管要记录接管时刻、接管前模型输出、人工修正动作和接管原因。";
    case "embodied_online_rl":
      return "VLA 从 imitation learning 过渡到在线强化学习，通常先用高质量遥操作或人类演示训练 BC/SFT 策略，再用离线 RL、偏好数据或仿真环境做策略改进，最后在真实环境中做受限在线探索。安全侧需要动作限幅、速度/力矩/碰撞约束、安全区域、规则过滤器、不确定性估计、异常检测和可回退策略；评估侧要先过仿真、离线 replay、影子模式和小流量灰度。在线 RL 的收益是优化长期目标和恢复能力，代价是安全、样本效率和分布漂移。";
    case "embodied_sim2real":
      return "视觉随机化、动力学随机化和真实少样本微调解决的是 sim-to-real gap 的不同来源。视觉随机化改变纹理、光照、背景、相机位姿、噪声和遮挡，主要提升感知鲁棒性；动力学随机化改变质量、摩擦、关节阻尼、延迟、执行器噪声和接触参数，主要提升控制稳定性；真实少样本微调用少量真实机器人数据校准仿真学到的策略或表征。随机化太弱会过拟合仿真，太强会让训练不稳定，评估要看成功率、碰撞率、恢复率和跨场景泛化。";
    case "embodied_long_horizon":
      return "长程具身任务要把高层规划和低层控制分开处理。高层用语言或视觉语言模型做任务分解，维护环境状态、已完成步骤、物体位置和历史失败；低层用 VLA policy、diffusion policy 或控制器执行短程技能。环境变化需要持续重感知和状态更新，动作不可逆错误要提前做风险评估，并设置确认、回退或人工接管。评估不能只看最终成功，还要看子目标成功率、重规划次数、无效动作比例、错误恢复率、任务时长和安全事件。";
    case "embodied_eval":
      return "具身智能不能只看成功率，因为同样成功可能对应完全不同的安全性、效率和泛化能力。除了成功率，还要看碰撞率、接管率、near miss、力/速度越界、任务完成时间、轨迹平滑度、能耗、恢复成功率、失败类型分布和长尾场景覆盖。泛化指标要覆盖新物体、新背景、新光照、新相机位姿、新任务组合和不同机器人平台。成功率回答能不能做成，安全和泛化指标回答能不能稳定、低风险、可规模化地做成。";
    case "world_model":
      return "自动驾驶或机器人世界模型的重点是学习环境状态随动作和时间的变化。BEV/occupancy 提供空间占用和可行驶区域，轨迹预测刻画其他交通参与者或物体的未来行为，仿真闭环用模型生成的未来状态反过来评估规划策略。回答时要区分 open-loop 预测分数和 closed-loop 交互效果：前者看重重建、预测、碰撞和位姿误差，后者更看重安全、舒适、任务成功率和长尾场景恢复能力。";
    case "distributed_training":
      return "分布式训练要先说清楚切分对象。数据并行切 batch，简单但每步要同步梯度；张量并行切单层矩阵计算，适合单层很宽的大模型；流水并行切层，适合层数很深但会产生 pipeline bubble；ZeRO 切优化器状态、梯度和参数，主要解决显存放不下。真实系统通常是混合并行，回答时要同时讲显存节省、通信开销、吞吐和调度复杂度。";
    case "memory":
      return "训练显存通常由参数、梯度、优化器状态、激活值和临时 buffer 组成。Adam 的优化器状态常常比参数本身更占空间，长序列训练时激活值会随 batch、序列长度和层数增长；推理时重点从梯度和优化器状态转向 KV cache。常用优化包括混合精度、gradient checkpointing、ZeRO/offload、FlashAttention、序列并行、KV cache 量化和分页管理。";
    case "inference":
      return "推理优化要把 prefill 和 decode 分开。prefill 更像大矩阵并行计算，decode 更容易受 KV cache、batch 调度和单 token 延迟影响。PagedAttention 像分页内存一样管理 KV cache，减少碎片；continuous batching 让不同请求动态进入 batch，提高吞吐；speculative decoding 用小模型草拟、大模型验证，降低平均解码成本。最终要用吞吐、首 token 延迟、总延迟、显存和稳定性一起评估。";
    case "compression":
      return "量化、LoRA 和蒸馏解决的问题不同。INT8/INT4 量化降低权重或激活精度，减少显存和带宽压力；GPTQ 偏离线权重量化，AWQ 通过保护重要通道提高质量；LoRA 用低秩增量适配任务，适合低成本微调；蒸馏把大模型能力迁移到小模型。面试要强调代价：量化可能伤害长尾能力，蒸馏依赖 teacher 和数据质量，LoRA 合并后没有多 adapter 切换灵活。";
    case "vlm_connector":
      return "多模态连接层的作用是把视觉 encoder 输出映射到 LLM 可理解的 token 空间。Linear projector 简单高效但表达能力有限；Q-Former 用可学习 query 压缩视觉信息，适合减少 token；cross-attention 交互更充分但计算更贵。回答时要补训练目标和评估方式：图文对齐、指令微调、grounding、OCR、空间关系和幻觉率，不能只背模块名字。";
    case "vlm_eval":
      return "视觉理解评估要按能力拆开：OCR 看文字识别和文本理解，grounding 看回答是否落到正确区域，空间关系看相对位置、计数和属性绑定，幻觉看图中没有的内容是否被编造，多轮对话看上下文一致性。工程上要结合公开 benchmark、人工评测、线上 badcase 和任务通过率，而不是只看单一总分。";
    case "data":
      return "数据构造要先覆盖任务类型，再控制质量。图文/视频指令数据常来自 caption、VQA、OCR、检测框、人工标注和合成指令，但必须去重、过滤模板化答案、隔离评测集，并加入困难负样本。常见坑是 OCR 泄漏、caption 套话、图文不匹配、低质量合成数据和评测集污染，这些会让模型看似会答题，实际泛化很差。";
    case "rl":
      return "RLHF、DPO、PPO、GRPO 的核心差异在优化目标和训练稳定性。PPO 属于在线策略优化，需要 reward model 和采样，灵活但成本高；DPO 直接用偏好对优化策略，工程简单稳定，但强依赖偏好数据质量；GRPO 常用于降低 value model 依赖，通过组内相对奖励优化。面试时要讲清楚数据来源、奖励设计、稳定性、过优化和评估指标。";
    default:
      return "回答这类题要避免只背概念。建议按四层组织：先解释核心机制，再讲工程取舍，然后补常见失败模式，最后落到评估指标和项目经验。如果题目来自真实面经，还要把公司、方向、题目和来源链接对应起来，避免题目与来源或答案错位。";
  }
}

function answerRisk(question, answer) {
  const qFamily = classifyQuestion(question);
  const aFamily = classifyQuestion(answer);
  const genericHit = GENERIC_ANSWER_PATTERNS.find((pattern) => String(answer || "").includes(pattern));
  if (genericHit) return `Generic fallback answer is not allowed: ${genericHit}`;
  if (qFamily === "vla_action" && /Q-Former|Linear projector|视觉 encoder|VLM 数据流|图文/.test(answer)) {
    return "VLA action question appears to use VLM connector answer";
  }
  if (qFamily === "robot_data" && /caption|OCR 泄漏|图文\/视频指令|VQA/.test(answer)) {
    return "Robot data question appears to use generic multimodal data answer";
  }
  if (!answer || answer.length < 40) return "Answer is too short to be useful";
  return "";
}

function collectPublishedRegistry(queue) {
  const entries = [];
  const publishedStatuses = new Set(["published", "source_invalid_after_publish"]);
  for (const record of queue) {
    if (!publishedStatuses.has(record.status)) continue;
    for (const question of extractQuestionsFromCard(record)) {
      const key = questionKey(question);
      if (!key) continue;
      entries.push({
        key,
        question,
        queueId: record.id,
        featureId: record.featureId,
        postId: record.postId,
        title: record.title,
        company: record.company,
        direction: record.direction,
        sourcePlatform: record.sourcePlatform,
        sourceUrl: record.sourceUrl,
        publishUrl: record.publishUrl,
        status: record.status,
        updatedAt: record.updatedAt || record.createdAt || "",
      });
    }
  }
  const best = new Map();
  for (const entry of entries) {
    if (!best.has(entry.key)) best.set(entry.key, entry);
  }
  return [...best.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function auditQueue(queue) {
  const issues = [];
  const byQuestion = new Map();
  for (const record of queue) {
    const questions = extractQuestionsFromCard(record);
    const answerCards = (record.imageCards || []).filter((item) => item.kind === "answer");
    questions.forEach((question) => {
      const key = questionKey(question);
      if (!key) return;
      const list = byQuestion.get(key) || [];
      list.push({ id: record.id, title: record.title, status: record.status, question, sourceUrl: record.sourceUrl });
      byQuestion.set(key, list);
    });

    const answerBodiesByQuestion = new Map();
    for (const [index, card] of answerCards.entries()) {
      const title = String(card.title || "");
      const body = String(card.body || "");
      const indexMatch = String(card.kicker || "").match(/(\d+)/);
      const indexedQuestion = indexMatch ? questions[Number(indexMatch[1]) - 1] : "";
      const matchedQuestion = indexedQuestion
        || questions.find((q) => title.includes(q.slice(0, Math.min(20, q.length))) || q.includes(title.slice(0, 20)))
        || questions[Math.min(index, questions.length - 1)]
        || title;
      const key = questionKey(matchedQuestion) || matchedQuestion;
      const current = answerBodiesByQuestion.get(key);
      answerBodiesByQuestion.set(key, {
        question: matchedQuestion,
        body: [current?.body, body].filter(Boolean).join("\n"),
      });
    }
    for (const { question, body } of answerBodiesByQuestion.values()) {
      const risk = answerRisk(question, body);
      if (risk) issues.push({ type: "answer_mismatch", id: record.id, title: record.title, question, risk });
    }

    if (record.sourcePlatform && record.sourceUrl) {
      let host = "";
      try {
        host = new URL(record.sourceUrl).hostname;
      } catch {}
      const sourceUrl = String(record.sourceUrl || "");
      if (SELF_SOURCE_URL_PATTERNS.some((pattern) => sourceUrl.includes(pattern))) {
        issues.push({ type: "self_or_internal_source", id: record.id, title: record.title, sourceUrl: record.sourceUrl });
      }
      if (/xiaohongshu\.com\/search_result/.test(sourceUrl)) {
        issues.push({ type: "xhs_source_is_search_page", id: record.id, title: record.title, sourceUrl: record.sourceUrl, note: "Xiaohongshu source must be the concrete original note URL and must not be a search result page." });
      }
      const platform = String(record.sourcePlatform);
      if (platform.includes("小红书") && !host.includes("xiaohongshu.com")) {
        issues.push({ type: "source_platform_mismatch", id: record.id, title: record.title, sourcePlatform: record.sourcePlatform, sourceUrl: record.sourceUrl });
      }
      if (platform.includes("知乎") && !host.includes("zhihu.com")) {
        issues.push({ type: "source_platform_mismatch", id: record.id, title: record.title, sourcePlatform: record.sourcePlatform, sourceUrl: record.sourceUrl });
      }
    }

    if (/search_result/.test(record.sourceUrl || "") && record.sourcePlatform === "小红书") {
      issues.push({ type: "xhs_source_needs_note_check", id: record.id, title: record.title, sourceUrl: record.sourceUrl, note: "Xiaohongshu search_result links may require login and should be verified against the visible post title/company." });
    }
  }

  for (const [key, list] of byQuestion) {
    const published = list.filter((item) => ["published", "source_invalid_after_publish"].includes(item.status));
    if (published.length > 1) {
      issues.push({ type: "duplicate_published_question", key, records: published });
    }
  }
  return issues;
}

function fitText(text, maxLength) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function splitTextForCards(text, maxLength = 260) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value) return [];
  const chunks = [];
  let rest = value;
  while (rest.length > maxLength) {
    let cut = Math.max(
      rest.lastIndexOf("。", maxLength),
      rest.lastIndexOf("；", maxLength),
      rest.lastIndexOf("，", maxLength),
      rest.lastIndexOf(" ", maxLength),
    );
    if (cut < Math.floor(maxLength * 0.55)) cut = maxLength;
    chunks.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function repairQueueAnswers(queue) {
  let repaired = 0;
  const nextQueue = queue.map((record) => {
    const questions = extractQuestionsFromCard(record).slice(0, 4);
    if (!questions.length || !Array.isArray(record.imageCards)) return record;
    const preserved = record.imageCards.filter((card) => card.kind !== "answer");
    const answerCards = [];
    questions.forEach((question, questionIndex) => {
      const chunks = splitTextForCards(answerForQuestion(question), 260);
      chunks.forEach((chunk, chunkIndex) => {
        answerCards.push({
          kind: "answer",
          kicker: chunks.length > 1 ? `详细解答 ${questionIndex + 1}-${chunkIndex + 1}` : `详细解答 ${questionIndex + 1}`,
          title: fitText(question, 54),
          body: chunk,
          footer: "机制 -> 取舍 -> 坑 -> 指标",
        });
      });
    });
    const imageCards = [...preserved, ...answerCards].slice(0, 18);
    repaired += 1;
    return {
      ...record,
      imageCards,
      updatedAt: new Date().toISOString(),
    };
  });
  return { queue: nextQueue, repaired };
}

function ensureQuestionAnswers(posts) {
  let added = 0;
  const nextPosts = posts.map((post) => {
    const questions = Array.isArray(post.questions) ? post.questions.filter(Boolean) : [];
    if (!questions.length) return post;
    const existing = Array.isArray(post.questionAnswers) ? post.questionAnswers : [];
    const byKey = new Map(existing.map((item) => [questionKey(item.question), item]));
    const questionAnswers = questions.map((question) => {
      const key = questionKey(question);
      const current = byKey.get(key);
      if (current?.answer) return current;
      added += 1;
      return {
        key,
        question,
        answer: answerForQuestion(question),
        answerStatus: "generated",
        updatedAt: new Date().toISOString(),
      };
    });
    return { ...post, questionAnswers };
  });
  return { posts: nextPosts, added };
}

async function main() {
  const posts = await readJson(POSTS_FILE, []);
  let queue = await readJson(QUEUE_FILE, []);
  const { posts: answeredPosts, added } = ensureQuestionAnswers(posts);
  let repairedQueueCount = 0;
  if (SHOULD_REPAIR_QUEUE) {
    const repaired = repairQueueAnswers(queue);
    queue = repaired.queue;
    repairedQueueCount = repaired.repaired;
  }
  const registry = collectPublishedRegistry(queue);
  const issues = auditQueue(queue);
  const missingAnswerCount = answeredPosts.reduce((sum, post) => {
    const answers = new Map((Array.isArray(post.questionAnswers) ? post.questionAnswers : [])
      .map((item) => [questionKey(item.question), item.answer]));
    const missing = (Array.isArray(post.questions) ? post.questions : [])
      .filter((question) => !answers.get(questionKey(question))).length;
    return sum + missing;
  }, 0);
  const answerMismatchCount = issues.filter((item) => item.type === "answer_mismatch").length;
  const duplicatePublishedQuestionCount = issues.filter((item) => item.type === "duplicate_published_question").length;
  const sourceCheckCount = issues.filter((item) => item.type === "xhs_source_needs_note_check").length;
  const report = {
    generatedAt: new Date().toISOString(),
    postCount: posts.length,
    questionCount: posts.reduce((sum, post) => sum + (Array.isArray(post.questions) ? post.questions.length : 0), 0),
    missingAnswerCount,
    answerMismatchCount,
    duplicatePublishedQuestionCount,
    sourceCheckCount,
    generatedAnswerCount: added,
    repairedQueueCount,
    publishedQuestionCount: registry.length,
    issueCount: issues.length,
    issues,
  };

  if (SHOULD_FIX) {
    await writeJson(POSTS_FILE, answeredPosts);
    if (SHOULD_REPAIR_QUEUE) await writeJson(QUEUE_FILE, queue);
    await writeJson(REGISTRY_FILE, registry);
  }
  await writeJson(REPORT_FILE, report);
  console.log(JSON.stringify(report, null, 2));
  if (SHOULD_FAIL_ON_RISK && issues.some((item) => item.type === "answer_mismatch")) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
