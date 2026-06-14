import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POSTS_FILE = path.join(ROOT, "data", "posts.json");
const TODAY = new Date().toISOString().slice(0, 10);
const SHOULD_WRITE = process.argv.includes("--write");
const minArg = process.argv.find((arg) => arg.startsWith("--min-new="));
const MIN_NEW = Number(minArg?.split("=")[1] || process.env.MIN_NEW_QUESTIONS || 20);

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[，。！？、；：“”‘’（）()[\]{}<>《》/\\\-_:,.!?;\s]/g, "")
    .replace(/visionlanguageaction/g, "vla")
    .replace(/keyvaluecache/g, "kvcache")
    .trim();
}

function textOf(post) {
  return [
    post.title,
    post.company,
    post.role,
    post.direction,
    post.domain,
    post.category,
    post.content,
    ...(post.tags || []),
  ].filter(Boolean).join(" ");
}

function questionKey(question) {
  return normalizeText(question).slice(0, 120);
}

const QUESTION_BANKS = {
  multimodal: [
    "多模态大模型中，vision encoder 输出如何通过 projector、Q-Former 或 cross-attention 接入 LLM？",
    "VLM 训练中图文对齐、指令微调和偏好对齐分别解决什么问题？",
    "高分辨率图片输入时，动态分辨率、tile 切分和 token 压缩如何取舍？",
    "OCR、grounding、计数、空间关系这四类能力分别应该如何设计评估集？",
    "多图理解任务中，如何保证跨图实体一致性、顺序理解和比较推理能力？",
    "VLM 产生视觉幻觉的常见原因有哪些，数据、模型和解码侧分别怎么缓解？",
    "图像 caption 数据、VQA 数据和合成指令数据在多模态训练中的作用有什么差异？",
    "多模态模型线上服务如何优化图片预处理、vision encoder 复用和首 token 延迟？",
  ],
  vla: [
    "VLA 模型中 action token、连续动作回归和 diffusion policy 分别适合什么控制场景？",
    "机器人遥操作数据采集时，如何同步多相机、机械臂状态、力控信号和语言指令？",
    "具身智能任务中，episode 如何切分，成功、失败、中断和人为接管如何标注？",
    "VLA 系统如何从 imitation learning 过渡到在线强化学习并控制安全风险？",
    "语言规划和低层控制之间如何分层，什么时候需要 skill library 或 hierarchical policy？",
    "sim-to-real 中，视觉随机化、动力学随机化和真实少样本微调分别解决什么问题？",
    "长程具身任务如何处理记忆、子目标分解、环境变化和动作不可逆错误？",
    "具身智能评估为什么不能只看成功率，还需要哪些安全性和泛化指标？",
  ],
  video: [
    "视频理解中，均匀采样、关键帧采样、运动感知采样和自适应采样分别适合什么场景？",
    "temporal token 压缩如何保留动作变化和事件顺序，相比长上下文 attention 有什么取舍？",
    "视频问答如何评估动作理解、事件边界、因果关系和跨镜头一致性？",
    "长视频理解中，记忆压缩、片段检索、滑窗推理和跨片段融合如何组合？",
    "视频生成模型的时序一致性、身份保持、物理合理性和指令遵循如何评估？",
    "视频 grounding 与图像 grounding 的主要差异是什么，时空定位指标怎么设计？",
    "多模态视频数据清洗时，字幕、ASR、画面内容和问答之间如何做一致性校验？",
    "在线视频理解服务如何控制帧抽取成本、encoder 缓存和响应延迟？",
  ],
  training: [
    "数据并行、张量并行、流水线并行、序列并行和专家并行分别解决什么瓶颈？",
    "DeepSpeed ZeRO-1/2/3 分别切分哪些状态，显存节省和通信开销如何变化？",
    "Megatron 的 tensor parallel 为什么需要行切分、列切分和 collective 通信配合？",
    "大模型训练显存如何拆成参数、梯度、优化器状态、激活值和临时 buffer？",
    "gradient checkpointing、FlashAttention 和 activation offload 分别如何影响显存和吞吐？",
    "大规模训练中 loss spike、梯度溢出、数据异常和通信 hang 应该如何定位？",
    "FP16、BF16、FP8 在数值稳定性、硬件收益和训练风险上有什么差异？",
    "global batch、micro batch、pipeline bubble 和通信重叠如何联动调参？",
  ],
  inference: [
    "KV cache 显存如何随 batch、序列长度、层数、head 数和 hidden size 增长？",
    "PagedAttention 为什么能提升显存利用率，和连续 KV cache 分配有什么区别？",
    "continuous batching 如何提升吞吐，为什么可能影响单请求延迟和调度公平性？",
    "speculative decoding 的收益取决于哪些因素，draft model 接受率如何影响加速比？",
    "INT8、INT4、AWQ、GPTQ、SmoothQuant 分别适合哪些量化和部署场景？",
    "长上下文推理中，RoPE scaling、KV eviction、prefix cache 分别解决什么问题？",
    "线上推理如何同时监控 TTFT、TPOT、吞吐、显存水位、失败率和队列等待时间？",
    "LoRA 多租户服务中，adapter 热切换、权重合并、缓存复用和隔离性如何设计？",
  ],
  worldModel: [
    "自动驾驶世界模型如何从 BEV、occupancy、轨迹预测和仿真闭环中学习环境动态？",
    "世界模型和传统感知、预测、规划模块相比，优势、风险和可解释性问题是什么？",
    "驾驶数据闭环中，长尾场景挖掘、自动标注、训练回流和仿真评测如何形成闭环？",
    "多传感器数据中，相机、激光雷达、毫米波雷达、定位和车控状态如何时空对齐？",
    "仿真评测如何保证场景真实性、交互合理性、覆盖率和指标可解释性？",
    "自动驾驶数据筛选时，如何识别 corner case、near miss、接管片段和标注不确定样本？",
    "端到端自动驾驶模型如何处理安全边界、法规约束、分布外场景和可解释性？",
    "座舱多模态大模型如何融合语音、视觉、车辆状态和用户上下文，同时保证安全策略？",
  ],
};

function pickBank(post) {
  const text = textOf(post);
  if (/VLA|具身|机器人|遥操作|动作|轨迹|sim-to-real|diffusion policy/i.test(text)) return "vla";
  if (/视频|Video|时序|帧|长视频|事件|temporal/i.test(text)) return "video";
  if (/DeepSpeed|Megatron|ZeRO|训练框架|分布式|显存|并行|checkpoint|FlashAttention/i.test(text)) return "training";
  if (/推理|部署|量化|压缩|KV Cache|KV cache|PagedAttention|吞吐|延迟|LoRA|vLLM/i.test(text)) return "inference";
  if (/世界模型|自动驾驶|BEV|occupancy|仿真|数据闭环|座舱|Momenta|蔚来|小鹏/i.test(text)) return "worldModel";
  return "multimodal";
}

function postPriority(post) {
  const dateScore = Date.parse(post.sourceDate || "") || 0;
  const hasSource = post.sourceUrl ? 1000 : 0;
  const hasQuestions = Array.isArray(post.questions) && post.questions.length ? 0 : 500;
  return dateScore + hasSource + hasQuestions;
}

const posts = JSON.parse(await fs.readFile(POSTS_FILE, "utf8"));
const used = new Set();
for (const post of posts) {
  for (const question of post.questions || []) {
    const key = questionKey(question);
    if (key) used.add(key);
  }
}

const beforeQuestions = [...used].length;
const additions = [];
const candidates = posts
  .filter((post) => !/RAG|Agent/i.test(textOf(post)))
  .sort((a, b) => postPriority(b) - postPriority(a));

for (const post of candidates) {
  if (additions.length >= MIN_NEW) break;
  const bank = QUESTION_BANKS[pickBank(post)];
  const current = Array.isArray(post.questions) ? post.questions : [];
  for (const question of bank) {
    if (additions.length >= MIN_NEW) break;
    const key = questionKey(question);
    if (!key || used.has(key)) continue;
    current.push(question);
    used.add(key);
    additions.push({ postId: post.id, title: post.title, question });
  }
  post.questions = current;
  if (!post.prepTips) {
    post.prepTips = "按基础原理、工程实现、评估指标和项目追问四块复习，回答时优先讲清楚机制和取舍。";
  }
  post.updatedAt = Math.floor(Date.now() / 1000);
}

const summary = {
  mode: SHOULD_WRITE ? "write" : "dry-run",
  date: TODAY,
  minNewQuestions: MIN_NEW,
  addedQuestions: additions.length,
  beforeUniqueQuestions: beforeQuestions,
  afterUniqueQuestions: used.size,
  samples: additions.slice(0, 20),
};

if (SHOULD_WRITE) {
  await fs.writeFile(POSTS_FILE, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify(summary, null, 2));
