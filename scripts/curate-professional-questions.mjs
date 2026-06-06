import fs from "node:fs";

const POSTS_FILE = new URL("../data/posts.json", import.meta.url);

const QUESTION_BANKS = {
  multimodal: [
    "Vision encoder 输出如何与 LLM token 空间对齐？Linear projector、Q-Former、cross-attention adapter 的差异是什么？",
    "图文/视频指令微调数据如何构造，如何控制噪声、偏见和 OCR 泄漏？",
    "多模态模型如何评估 grounding、OCR、空间关系、幻觉和多轮视觉对话能力？",
  ],
  vla: [
    "VLA 模型中 action token、连续动作回归和 diffusion policy 各自适合什么控制场景？",
    "机器人数据如何做遥操作采集、时间同步、轨迹切分、失败样本标注和 sim-to-real 迁移？",
    "具身智能评估如何设计成功率、泛化任务、长程规划、碰撞安全和实时控制指标？",
  ],
  video: [
    "视频理解中帧采样、temporal token 压缩和 long-context attention 如何取舍？",
    "视频模型如何建模动作、因果关系、事件边界和跨镜头一致性？",
    "视频问答/视频生成如何评估时序一致性、物理合理性、身份保持和指令遵循？",
  ],
  training: [
    "DeepSpeed ZeRO、Megatron 张量并行、流水并行和数据并行分别解决什么瓶颈？",
    "大模型训练中显存占用如何拆解到参数、梯度、优化器状态、激活值和 KV cache？",
    "混合精度、gradient checkpointing、FlashAttention 和通信重叠如何影响吞吐与稳定性？",
  ],
  inference: [
    "KV cache、PagedAttention、continuous batching 和 speculative decoding 如何提升推理吞吐？",
    "INT8/INT4 量化、AWQ/GPTQ、LoRA 合并和蒸馏分别适合哪些部署场景？",
    "线上推理如何权衡首 token 延迟、吞吐、显存、上下文长度和服务稳定性？",
  ],
  autonomous: [
    "自动驾驶世界模型如何从 BEV、occupancy、轨迹预测和仿真闭环中学习环境动态？",
    "驾驶数据闭环如何做场景挖掘、长尾样本回流、自动标注和仿真评测？",
    "座舱多模态大模型如何融合语音、视觉、车控状态和用户上下文，并保证安全边界？",
  ],
  alignment: [
    "RLHF、DPO、GRPO、PPO 的优化目标、训练数据和稳定性问题分别是什么？",
    "Reward model 如何构造偏好数据，如何处理 reward hacking、长度偏置和分布外回答？",
    "对齐训练如何评估 helpfulness、harmlessness、truthfulness 和复杂任务通过率？",
  ],
};

const PREP_TIPS = {
  multimodal: "重点准备视觉编码器、projector/Q-Former、图文/视频指令数据、多模态评估和幻觉控制。",
  vla: "重点准备动作表示、机器人数据采集、轨迹评估、仿真到真实迁移和实时控制安全。",
  video: "重点准备帧采样、时序建模、视频 token 压缩、事件理解和时序一致性评估。",
  training: "重点准备 ZeRO、张量并行、流水并行、显存拆解、通信瓶颈和训练稳定性排查。",
  inference: "重点准备 KV cache、PagedAttention、continuous batching、量化压缩和线上延迟吞吐权衡。",
  autonomous: "重点准备 BEV/occupancy、数据闭环、长尾场景挖掘、仿真评测和座舱多模态安全。",
  alignment: "重点准备 RLHF/DPO/GRPO/PPO、reward model、偏好数据构造和对齐评估指标。",
};

function textOf(post) {
  return [
    post.title,
    post.company,
    post.role,
    post.direction,
    post.domain,
    post.category,
    post.content,
    post.prepTips,
    ...(post.tags || []),
  ].filter(Boolean).join(" ");
}

function pickBank(post) {
  const text = textOf(post);
  if (/VLA|具身|机器人|智元|动作|遥操作|轨迹/.test(text)) return "vla";
  if (/视频|音视频|Video|时序|帧|视觉理解|事件/.test(text)) return "video";
  if (/DeepSpeed|Megatron|训练框架|分布式|显存|ZeRO|并行|checkpoint|FlashAttention/.test(text)) return "training";
  if (/推理|部署|量化|压缩|KV Cache|KV cache|PagedAttention|吞吐|延迟|LoRA/.test(text)) return "inference";
  if (/自动驾驶|世界模型|BEV|occupancy|座舱|蔚来|赛力斯|Momenta|数据闭环|仿真/.test(text)) return "autonomous";
  if (/RLHF|PPO|DPO|GRPO|强化学习|对齐|Reward/.test(text)) return "alignment";
  return "multimodal";
}

function normalizeDirection(post, bank) {
  const mapping = {
    multimodal: ["多模态大模型", "视觉语言对齐"],
    vla: ["VLA / 具身智能", "机器人数据 / 动作模型"],
    video: ["视频 / 视觉理解", "时序建模 / 视频问答"],
    training: ["训练框架", "Megatron / DeepSpeed / 分布式训练"],
    inference: ["推理优化 / 模型压缩", "部署 / 量化 / KV Cache"],
    autonomous: ["自动驾驶 / 世界模型", "数据闭环 / 仿真"],
    alignment: ["强化学习 / 对齐训练", "偏好优化"],
  };
  const [direction, domain] = mapping[bank];
  if (!post.direction || post.direction === "大模型面经" || post.direction === "大模型算法") {
    post.direction = direction;
  }
  if (!post.domain || post.domain === "综合" || post.domain === "项目 / 论文 / 模型基础") {
    post.domain = domain;
  }
  if (bank === "vla") post.category = "VLA / 具身智能";
  if (bank === "video") post.category = "视频 / 视觉理解";
  if (bank === "training" || bank === "inference") post.category = "推理优化 / 模型压缩";
  if (bank === "autonomous") post.category = "自动驾驶 / 数据闭环";
  if (bank === "alignment") post.category = "强化学习 / 对齐训练";
}

const posts = JSON.parse(fs.readFileSync(POSTS_FILE, "utf8"));
let changed = 0;

for (const post of posts) {
  const bank = pickBank(post);
  const previous = JSON.stringify({ questions: post.questions, direction: post.direction, domain: post.domain, category: post.category, prepTips: post.prepTips });
  post.questions = QUESTION_BANKS[bank];
  post.prepTips = PREP_TIPS[bank];
  normalizeDirection(post, bank);
  post.updatedAt = Math.floor(Date.now() / 1000);
  const current = JSON.stringify({ questions: post.questions, direction: post.direction, domain: post.domain, category: post.category, prepTips: post.prepTips });
  if (previous !== current) changed += 1;
}

fs.writeFileSync(POSTS_FILE, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ total: posts.length, changed }, null, 2));
