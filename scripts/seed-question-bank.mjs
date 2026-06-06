import fs from "node:fs";

const POSTS_FILE = new URL("../data/posts.json", import.meta.url);
const now = Math.floor(Date.now() / 1000);
const sourceDate = new Date().toISOString().slice(0, 10);

const SPECIALIZED_BANKS = [
  {
    id: "bank-multimodal-vlm-alignment-202606",
    title: "题库：多模态大模型视觉语言对齐专项",
    company: "综合",
    role: "多模态算法 / VLM 工程",
    direction: "多模态大模型",
    domain: "视觉语言对齐 / Grounding / OCR",
    category: "多模态大模型",
    difficulty: "困难",
    tags: ["题库", "多模态", "VLM", "视觉语言对齐", "Grounding", "OCR", "CLIP", "Q-Former"],
    questions: [
      "CLIP 预训练中的对比学习目标如何影响后续 VLM 的视觉语义对齐能力？",
      "Linear projector、MLP projector、Q-Former 和 cross-attention adapter 在信息保留、训练成本、推理延迟上如何取舍？",
      "多模态指令微调数据如何避免 OCR 泄漏、答案模板化、负样本不足和评测集污染？",
      "视觉 grounding 能力应该如何评估，bbox、指代表达、区域问答和 hallucination rate 分别看什么？",
      "多图理解任务中图间关系、时间顺序和跨图实体一致性如何建模？",
      "为什么 VLM 容易出现视觉幻觉，如何从数据、模型结构、解码和评测四个层面缓解？",
      "高分辨率图像输入时，patch 数量、token 压缩、局部裁剪和动态分辨率策略如何选择？",
      "VLM 线上服务中如何平衡图像预处理延迟、视觉 encoder 复用、batching 和首 token 延迟？"
    ],
    content: "围绕视觉语言对齐、图文指令微调、grounding、OCR、幻觉评估和线上推理的专项题库，适合多模态算法岗位系统复习。",
    prepTips: "先掌握 CLIP/Q-Former/projector 基础，再按数据构造、模型结构、评估指标、线上部署四条线串起来回答。"
  },
  {
    id: "bank-vla-embodied-control-202606",
    title: "题库：VLA 与具身智能控制专项",
    company: "综合",
    role: "具身智能 / 机器人算法",
    direction: "VLA / 具身智能",
    domain: "动作表示 / 机器人数据 / Sim-to-real",
    category: "VLA / 具身智能",
    difficulty: "困难",
    tags: ["题库", "VLA", "具身智能", "机器人", "Action Token", "Diffusion Policy", "遥操作", "Sim-to-real"],
    questions: [
      "VLA 模型中 action token、连续动作回归和 diffusion policy 分别适合哪些控制粒度和任务场景？",
      "机器人遥操作数据采集时，如何处理多相机、机械臂状态、力控信号和语言指令的时间同步？",
      "轨迹数据如何切分 episode，如何标注成功、失败、中断、重试和人为接管？",
      "从 imitation learning 到 online RL，VLA 系统如何设计安全探索和失败样本回流？",
      "语言规划和低层控制之间如何分层，什么时候需要 skill library 或 hierarchical policy？",
      "Sim-to-real 迁移中，视觉域随机化、动力学随机化和真实数据少样本微调各自解决什么问题？",
      "具身任务评估为什么不能只看成功率，还需要哪些鲁棒性、安全性和泛化指标？",
      "长程任务中，VLA 如何处理记忆、子目标分解、环境变化和动作不可逆错误？"
    ],
    content: "围绕 VLA 动作表示、机器人数据采集、策略学习、长程任务和 sim-to-real 的专项题库，面向具身智能岗位。",
    prepTips: "回答时尽量把语言理解、视觉状态、动作空间、数据闭环和真实机器人约束连接起来，避免只讲大模型。"
  },
  {
    id: "bank-video-understanding-202606",
    title: "题库：视频理解与时序建模专项",
    company: "综合",
    role: "视频理解 / 多模态算法",
    direction: "视频 / 视觉理解",
    domain: "长视频理解 / Temporal Modeling / 视频问答",
    category: "视频 / 视觉理解",
    difficulty: "困难",
    tags: ["题库", "视频理解", "长视频", "Temporal Token", "Video QA", "事件边界", "时序一致性"],
    questions: [
      "视频理解中均匀采样、关键帧采样、运动感知采样和自适应采样分别适合哪些场景？",
      "temporal token 压缩如何保留动作变化和事件顺序，和直接长上下文 attention 相比有什么取舍？",
      "视频问答如何评估动作理解、事件边界、因果关系、跨镜头一致性和细粒度属性识别？",
      "长视频理解中如何处理记忆压缩、片段检索、滑窗推理和跨片段信息融合？",
      "视频生成模型的时序一致性、身份保持、物理合理性和指令遵循分别如何设计评估？",
      "多模态视频数据清洗时，字幕、ASR、画面内容和问题答案之间如何做一致性校验？",
      "视频 grounding 和图像 grounding 的主要差异是什么，时空定位指标应该怎么看？",
      "在线视频理解服务如何控制帧抽取成本、encoder 复用、缓存和响应延迟？"
    ],
    content: "围绕长视频理解、时序压缩、视频问答、视频 grounding 和视频生成评估的专项题库。",
    prepTips: "把视频问题拆成采样、时序建模、任务评估、数据清洗和部署成本五块，回答会更扎实。"
  },
  {
    id: "bank-training-framework-202606",
    title: "题库：大模型训练框架与显存优化专项",
    company: "综合",
    role: "大模型训练工程 / 系统优化",
    direction: "训练框架",
    domain: "DeepSpeed / Megatron / 并行训练",
    category: "推理优化 / 模型压缩",
    difficulty: "困难",
    tags: ["题库", "训练框架", "DeepSpeed", "Megatron", "ZeRO", "FlashAttention", "显存优化", "分布式训练"],
    questions: [
      "数据并行、张量并行、流水并行、序列并行和专家并行分别解决什么瓶颈？",
      "DeepSpeed ZeRO-1/2/3 分别切分哪些状态，通信量、显存节省和实现复杂度如何变化？",
      "Megatron 中 tensor parallel 的列切分和行切分为什么要配合 collective 通信？",
      "训练显存如何拆解为参数、梯度、优化器状态、激活值、临时 buffer 和通信 buffer？",
      "gradient checkpointing、FlashAttention、activation offload 分别如何影响显存、吞吐和稳定性？",
      "大规模训练中 loss spike、梯度溢出、数据异常和通信 hang 应该如何定位？",
      "混合精度训练中 FP16、BF16、FP8 的数值稳定性和硬件收益如何比较？",
      "训练吞吐优化时，global batch、micro batch、pipeline bubble 和通信重叠如何联动调参？"
    ],
    content: "围绕分布式并行、ZeRO、Megatron、显存拆解、混合精度和训练稳定性的专项题库。",
    prepTips: "系统题要用资源瓶颈来组织答案：显存、通信、计算、数据加载、稳定性，逐层解释。"
  },
  {
    id: "bank-inference-deployment-202606",
    title: "题库：大模型推理部署与模型压缩专项",
    company: "综合",
    role: "推理部署 / 模型压缩工程",
    direction: "推理优化 / 模型压缩",
    domain: "KV Cache / vLLM / 量化 / Speculative Decoding",
    category: "推理优化 / 模型压缩",
    difficulty: "困难",
    tags: ["题库", "推理部署", "KV Cache", "PagedAttention", "vLLM", "量化", "Speculative Decoding", "模型压缩"],
    questions: [
      "KV cache 的显存占用如何随 batch size、序列长度、层数、head 数和 hidden size 增长？",
      "PagedAttention 为什么能提高显存利用率，它和传统连续 KV cache 分配有什么区别？",
      "continuous batching 如何提高吞吐，为什么会影响单请求延迟和调度公平性？",
      "speculative decoding 的收益取决于哪些因素，draft model 接受率和额外计算如何权衡？",
      "INT8、INT4、AWQ、GPTQ、SmoothQuant 分别适合权重量化、激活量化还是离线压缩？",
      "长上下文推理中，RoPE scaling、KV eviction、prefix cache 和检索增强分别解决什么问题？",
      "线上推理如何同时监控 TTFT、TPOT、吞吐、显存水位、失败率和队列等待时间？",
      "LoRA 多租户服务中，adapter 热切换、权重合并、缓存复用和隔离性如何设计？"
    ],
    content: "围绕 KV cache、vLLM、连续 batching、投机解码、量化压缩和线上指标的专项题库。",
    prepTips: "推理部署题最好用公式和指标回答：显存怎么涨、吞吐怎么来、延迟怎么拆、压缩损失怎么评估。"
  },
  {
    id: "bank-autonomous-data-world-model-202606",
    title: "题库：自动驾驶数据闭环与世界模型专项",
    company: "综合",
    role: "自动驾驶算法 / 世界模型",
    direction: "自动驾驶 / 世界模型",
    domain: "数据闭环 / BEV / Occupancy / 仿真",
    category: "自动驾驶 / 数据闭环",
    difficulty: "困难",
    tags: ["题库", "自动驾驶", "数据闭环", "世界模型", "BEV", "Occupancy", "仿真", "长尾场景"],
    questions: [
      "自动驾驶数据闭环中，长尾场景挖掘、自动标注、训练回流和仿真评测如何形成闭环？",
      "BEV、occupancy、轨迹预测和端到端规划分别在世界模型中承担什么表示角色？",
      "世界模型如何学习环境动态，和传统感知预测规划模块相比优势和风险是什么？",
      "多传感器数据中，相机、激光雷达、毫米波雷达、定位和车控状态如何做时间空间对齐？",
      "仿真评测如何保证场景真实性、交互合理性、覆盖率和指标可解释性？",
      "自动驾驶数据筛选时，如何识别 corner case、near miss、接管片段和标注不确定样本？",
      "端到端自动驾驶模型如何处理可解释性、安全边界、法规约束和分布外场景？",
      "座舱多模态大模型如何融合语音、视觉、车辆状态和用户上下文，同时保证安全策略？"
    ],
    content: "围绕自动驾驶数据闭环、世界模型、BEV/occupancy、仿真评测和座舱多模态的专项题库。",
    prepTips: "自动驾驶题要同时讲模型和工程闭环：数据怎么来、场景怎么挖、模型怎么学、仿真怎么评。"
  }
];

const posts = JSON.parse(fs.readFileSync(POSTS_FILE, "utf8"));
const existingIds = new Set(posts.map((post) => post.id));

for (const post of posts) {
  if (post.id === "browser-zhihu-bytedance-vlm-20260605") {
    post.category = "多模态大模型";
    post.direction = "多模态大模型";
    post.domain = "视觉语言对齐";
    post.updatedAt = now;
  }
}

let added = 0;
let updated = 0;

for (const bank of SPECIALIZED_BANKS) {
  const record = {
    ...bank,
    type: "collection",
    sourcePlatform: "内部题库",
    sourceDate,
    sourceUrl: "",
    createdAt: now,
    updatedAt: now,
  };
  const index = posts.findIndex((post) => post.id === record.id);
  if (index >= 0) {
    posts[index] = { ...posts[index], ...record, createdAt: posts[index].createdAt || now };
    updated += 1;
  } else if (!existingIds.has(record.id)) {
    posts.unshift(record);
    existingIds.add(record.id);
    added += 1;
  }
}

posts.sort((a, b) => {
  const dateCmp = (b.sourceDate || "").localeCompare(a.sourceDate || "");
  if (dateCmp) return dateCmp;
  return (b.updatedAt || 0) - (a.updatedAt || 0);
});

fs.writeFileSync(POSTS_FILE, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ added, updated, total: posts.length }, null, 2));
