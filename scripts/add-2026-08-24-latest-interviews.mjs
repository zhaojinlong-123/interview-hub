import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POSTS_FILE = path.join(ROOT, "data", "posts.json");
const LOG_FILE = path.join(ROOT, "logs", "latest-search-2026-08-24.json");
const SOURCE_DATE = "2026-08-24";

function hash(text) {
  return crypto.createHash("sha1").update(text).digest("hex").slice(0, 12);
}

function normalizeQuestion(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[，。！？、；：“”‘’（）()[\]{}<>《》|/\\\-—_:：,.!?;\s]/g, "")
    .replace(/visionlanguageaction/g, "vla")
    .replace(/keyvaluecache/g, "kvcache")
    .trim();
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function qa(question, answer) {
  return {
    question,
    answer,
    answerStatus: "model_answered",
    answeredAt: SOURCE_DATE,
    source: "add-2026-08-24-latest-interviews",
  };
}

const curated = [
  {
    title: "具身智能 VLA 动作生成范式面经：RT-2、OpenVLA、ACT 与 Diffusion Policy",
    company: "综合",
    role: "具身智能 / VLA 算法岗位",
    direction: "VLA / 具身智能",
    domain: "动作表示 / 机器人控制",
    category: "VLA / 具身智能",
    difficulty: "困难",
    sourcePlatform: "CSDN",
    sourceUrl: "https://xingyun3d.csdn.net/69fb0c350a2f6a37c5a812f8.html",
    tags: ["VLA", "具身智能", "action token", "Diffusion Policy", "OpenVLA", "ACT"],
    content: "公开检索补充：该来源系统比较 RT-2、OpenVLA、ACT、Diffusion Policy、π0、GR00T 等 VLA/机器人策略路线，适合作为动作表示与控制范式类面试题源。",
    questions: [
      "RT-2、OpenVLA、ACT 和 Diffusion Policy 在动作表示、推理延迟和适用任务上有什么核心差异？",
      "如果机器人任务存在多峰动作分布，为什么 diffusion policy 往往比单步连续回归更稳？",
    ],
    answers: [
      "RT-2 和 OpenVLA 更接近把动作离散化成 token，优势是能复用 VLM/LLM 的语言-视觉知识和自回归建模框架，适合语言条件、多任务和开放词汇泛化，但离散化会带来量化误差，且大模型自回归推理延迟较高。ACT 通常用 CVAE 和 action chunk，一次预测一段连续动作，工程闭环快、小数据友好，适合固定任务或少量任务的模仿学习，但语言泛化弱。Diffusion Policy 把动作序列看成从噪声逐步去噪的生成过程，能表达多峰轨迹和复杂接触操作，代价是采样步数、部署延迟和稳定性调参更重。面试回答要落到任务：语言泛化选 VLA 路线，低延迟固定操作可先用 ACT，复杂多峰操作可考虑 Diffusion Policy。",
      "多峰动作分布意味着同一个观察下可能存在多种合理动作，例如绕左/绕右抓取、先推再抓或直接抓。单步连续回归通常用均值回归，会把多个模式平均成一个不可执行动作，表现为轨迹发软、接触点漂移或中间姿态不合理。Diffusion Policy 通过条件生成整个动作序列，可以在采样过程中保留多个模式，再由条件观测和训练分布收敛到其中一个一致轨迹，因此对接触丰富、遮挡、工具使用和灵巧操作更友好。工程上仍要控制采样步数、动作平滑、安全边界和控制频率，否则优势会被延迟和闭环误差抵消。",
    ],
  },
  {
    title: "具身智能 VLA 框架面经：基准评测、闭环执行与部署指标",
    company: "综合",
    role: "机器人基础模型 / VLA 算法岗位",
    direction: "VLA / 具身智能",
    domain: "评测体系 / 部署指标",
    category: "VLA / 具身智能",
    difficulty: "困难",
    sourcePlatform: "CSDN",
    sourceUrl: "https://xingyun3d.csdn.net/69fb0cbf54b52172bc720972.html",
    tags: ["VLA", "Benchmark", "LIBERO", "Open X-Embodiment", "真机评测"],
    content: "公开检索补充：该来源强调 VLA 面试要从仿真 benchmark、真实机器人数据、闭环成功率、延迟、控制频率和安全触发率等维度回答。",
    questions: [
      "评估 VLA/机器人策略时，为什么不能只看离线 loss 或单一成功率？应该设计哪些指标？",
      "如果一个 VLA 方法声称提升了泛化能力，面试中应如何设计公平 baseline 和消融实验？",
    ],
    answers: [
      "离线 loss 只能说明模型拟合了数据分布，不代表闭环执行稳定；单一成功率也会掩盖安全风险、长尾失败和任务难度差异。更完整的指标应分四层：离线指标看动作误差、语言条件匹配和轨迹相似度；仿真指标看 LIBERO、Meta-World、ManiSkill 等任务成功率和泛化；真机指标看闭环成功率、恢复次数、碰撞/安全触发、接触稳定性；部署指标看 E2E latency、控制频率、显存、GPU 占用和失败恢复耗时。面试里要强调指标必须和任务目标绑定，例如装配任务要看接触时刻和插入成功，家居长程任务要看子目标完成与错误恢复。",
      "公平 baseline 首先要固定数据量、任务划分、视觉 backbone、控制频率和评测环境，否则改进来源不清楚。基础 baseline 至少包含行为克隆、ACT/Diffusion Policy 这类强模仿学习方法，以及同等数据上的开源 VLA 或任务内 finetune 版本。消融实验要围绕你的创新点拆：如果创新是动作表示，就固定数据和视觉特征，对比 action token、连续回归、action chunk、diffusion；如果创新是数据策略，就固定模型结构，对比数据清洗、失败样本、跨 embodiment 混合和语言标注。最后用仿真与真机双评测验证，避免只在离线 replay 上得出泛化结论。",
    ],
  },
  {
    title: "机器人训练数据面经：遥操作采集、时间同步与轨迹质量控制",
    company: "综合",
    role: "机器人数据 / 具身智能算法岗位",
    direction: "VLA / 具身智能",
    domain: "机器人数据 / 标注质量",
    category: "VLA / 具身智能",
    difficulty: "困难",
    sourcePlatform: "Robotics Center",
    sourceUrl: "https://www.roboticscenter.ai/zh/blog/robot-data-annotation-challenges",
    tags: ["机器人数据", "遥操作", "时间同步", "轨迹标注", "失败样本"],
    content: "公开检索补充：该来源讨论机器人示范数据中的相机、关节状态、力/扭矩传感器时间对齐，以及轨迹质量和接触事件标注问题。",
    questions: [
      "机器人遥操作数据采集时，多相机、关节状态、力控信号和夹爪状态如何做时间同步？",
      "机器人轨迹数据进入训练前，如何切分 episode 并标注成功、失败、中断和人为接管？",
    ],
    answers: [
      "最理想方案是硬件同步：用主时钟或触发脉冲同时驱动相机帧、关节状态采样和力/扭矩传感器记录，所有数据写入统一时间基准。若只能软件同步，要记录每路数据的原始时间戳、采样频率和系统时钟漂移，训练前按控制周期重采样，并对相机帧、关节状态、夹爪开合、F/T 信号做插值或最近邻对齐。接触敏感任务不能容忍几十毫秒偏差，因为视觉接触点和力峰值错位会让模型学到错误因果。工程上还应保留同步质量指标，例如最大时间偏移、丢帧率、时钟漂移和接触事件对齐误差，用于过滤低质量 episode。",
      "Episode 切分不能只按固定时间窗，应该以任务语义和机器人状态共同决定：开始点通常是语言指令下发、机器人进入可控状态或夹爪接近目标；结束点可以是成功完成、超时、人工接管、碰撞、安全停机或目标状态变化。标注至少包含 success、failure、abort、intervention、reset 等状态，并记录失败原因，例如感知错误、抓取失败、路径碰撞、目标滑落、控制饱和。失败样本不要简单删除，应该区分可学习失败和脏数据：可学习失败可用于恢复策略、安全判别或负样本训练；传感器错位、严重丢帧和错误标注才应剔除。这样才能让数据闭环真正提升鲁棒性。",
    ],
  },
  {
    title: "机器人数据采集路线面经：本体遥操作、VR、视频学习与仿真数据",
    company: "综合",
    role: "具身智能数据 / 机器人算法岗位",
    direction: "VLA / 具身智能",
    domain: "数据采集 / 数据飞轮",
    category: "VLA / 具身智能",
    difficulty: "中等",
    sourcePlatform: "公开资料",
    sourceUrl: "https://www.aibangbots.com/a/11605",
    tags: ["机器人数据", "本体遥操作", "VR遥操作", "仿真数据", "数据飞轮"],
    content: "公开检索补充：该来源围绕人形机器人数据采集路线，适合抽取机器人数据质量、成本和泛化能力相关题目。",
    questions: [
      "本体遥操作、VR 遥操作、互联网视频学习和仿真数据各自适合补充机器人数据的哪一部分？",
      "具身智能数据飞轮中，如何把线上失败样本变成下一轮训练收益？",
    ],
    answers: [
      "本体遥操作数据质量最高，动作、传感器和真实动力学一致，适合精细操作和接触任务，但成本高、规模有限。VR 遥操作能降低采集门槛、提升速度，适合大规模示范，但存在控制映射和人体动作到机器人 embodiment 的差异。互联网视频覆盖物体和场景丰富，适合学习视觉先验、任务语义和 affordance，但缺少精确动作和机器人状态。仿真数据便宜、可控、可生成长尾场景，适合预训练、失败恢复和安全测试，但有 sim-to-real gap。面试回答要强调组合：真实遥操作做高质量锚点，视频和仿真扩覆盖，最终用真机闭环评估校正。",
      "数据飞轮链路是：线上执行记录全量日志，触发器挖掘失败或不确定片段，人工/自动标注失败原因和目标状态，筛掉传感器异常，加入训练或评测集，再用离线与真机指标验证收益。关键是不要把所有失败样本都混进训练，而是分成感知失败、规划失败、控制失败、安全接管、标注错误等类别。对可学习失败，可以生成恢复动作、负样本或偏好数据；对不可学习的硬件/同步问题，应进入数据质量治理。每轮回流都要记录版本、样本来源、覆盖场景和指标变化，否则数据量变大但模型不一定变强。",
    ],
  },
  {
    title: "大模型推理加速面经：KV Cache、PagedAttention 与 Continuous Batching",
    company: "综合",
    role: "大模型推理部署 / 系统优化岗位",
    direction: "推理优化 / 模型压缩",
    domain: "KV Cache / 调度系统",
    category: "推理优化 / 模型压缩",
    difficulty: "困难",
    sourcePlatform: "知乎",
    sourceUrl: "https://zhuanlan.zhihu.com/p/2057144249490077467",
    tags: ["KV Cache", "PagedAttention", "Continuous Batching", "Speculative Decoding", "vLLM"],
    content: "公开检索补充：2026 大模型面试 118 题中推理加速部分覆盖 PagedAttention、Continuous Batching、投机解码等高频部署考点。",
    questions: [
      "KV Cache、PagedAttention、Continuous Batching 和 Speculative Decoding 分别解决推理链路的什么瓶颈？",
      "为什么 Continuous Batching 会提升吞吐，但仍可能让部分请求的尾延迟变差？",
    ],
    answers: [
      "KV Cache 解决自回归解码重复计算历史 token 的问题，用显存换计算；PagedAttention 解决 KV Cache 变长请求造成的显存碎片和连续分配浪费，把 KV 切成页块管理；Continuous Batching 解决 GPU 空转问题，让已完成/新进入的请求动态加入 batch，提高吞吐；Speculative Decoding 解决单步解码串行瓶颈，用小 draft model 先生成候选 token，再由大模型并行验证。四者分别对应计算复用、内存管理、调度利用率和解码并行化，工程上通常组合使用，但要同时监控 TTFT、TPOT、吞吐、显存水位和失败率。",
      "Continuous Batching 的核心是动态合批，GPU 不再等一个固定 batch 全部结束，而是不断插入新请求，整体利用率更高。但调度器为了吞吐可能让长请求、低优先级请求或 prefill 较重的请求等待更久；如果 prefill/decode 混排不合理，还会让 decode 请求被大 prompt 阻塞，导致 TPOT 或尾延迟变差。解决方法包括 prefill/decode 分离、chunked prefill、优先级队列、最大等待时间约束、按租户限流、长短请求分池，以及同时用 P50/P95/P99 而不是平均延迟评估。",
    ],
  },
  {
    title: "KV Cache 与投机解码面经：MQA/GQA/MLA、KV 量化与显存拆解",
    company: "综合",
    role: "LLM 推理优化 / 模型部署岗位",
    direction: "推理优化 / 模型压缩",
    domain: "KV Cache / 显存优化",
    category: "推理优化 / 模型压缩",
    difficulty: "困难",
    sourcePlatform: "GitHub Pages",
    sourceUrl: "https://wanshuiyin.github.io/ARIS-in-AI-Offer/tutorials/kv_cache_speculative_decoding_tutorial.html",
    tags: ["KV Cache", "MQA", "GQA", "MLA", "KV 量化", "投机解码"],
    content: "公开检索补充：该 Cheat Sheet 覆盖 KV Cache、MQA/GQA/MLA、PagedAttention、KV 量化和投机解码，适合推理部署类面试题。",
    questions: [
      "MQA、GQA 和 MLA 为什么能降低 KV Cache 压力？它们的代价分别是什么？",
      "KV Cache 量化和权重量化的目标有什么不同，线上部署时应该如何评估风险？",
    ],
    answers: [
      "标准 MHA 每个 attention head 都有独立 K/V，KV Cache 随层数、batch、序列长度和 head 数线性增长。MQA 让多个 query head 共享一组 K/V，显著降低 KV 显存和带宽，但可能牺牲表达能力；GQA 把 head 分组共享 K/V，在性能和显存之间折中；MLA 进一步把 K/V 表示压到低秩 latent，再恢复注意力所需信息，适合长上下文和大模型推理，但实现复杂，尤其要处理位置编码和 attention 计算兼容性。面试要讲清楚：它们本质是在减少解码阶段最昂贵的 KV 读写，而不是减少所有计算。",
      "权重量化主要降低模型参数显存和矩阵乘带宽，影响所有阶段；KV Cache 量化主要降低长上下文和大 batch 解码阶段的缓存显存与访存压力，随请求长度越长收益越明显。KV 量化风险在于注意力分布对 K/V 精度敏感，可能造成长上下文遗忘、事实错误或多轮一致性下降。线上评估不能只看 perplexity，要看长文 QA、多轮对话、代码/数学、检索片段引用、首 token/每 token 延迟、显存水位和异常率。高风险业务可采用分层策略：短上下文不量化，长上下文低比特，关键层保留高精度。",
    ],
  },
  {
    title: "多模态架构面经：CLIP、Flamingo、LLaVA 与 Qwen-VL 对比",
    company: "综合",
    role: "多模态大模型算法岗位",
    direction: "多模态大模型",
    domain: "视觉语言架构 / 模态对齐",
    category: "多模态大模型",
    difficulty: "困难",
    sourcePlatform: "知乎",
    sourceUrl: "https://zhuanlan.zhihu.com/p/2057198402748862813",
    tags: ["多模态大模型", "CLIP", "Flamingo", "LLaVA", "Qwen-VL", "Q-Former"],
    content: "公开检索补充：2026 大模型面试 118 题中的多模态架构部分覆盖 CLIP-style、Flamingo、LLaVA、Qwen-VL 及连接层对比。",
    questions: [
      "CLIP-style、Flamingo、LLaVA 和 Qwen-VL 这几类多模态架构的连接方式和能力边界有什么差异？",
      "Vision Encoder 输出接入 LLM 时，MLP Projector、Q-Former 和 Cross-Attention Adapter 如何取舍？",
    ],
    answers: [
      "CLIP-style 通常是图文双编码器，对比学习得到统一语义空间，检索和粗粒度匹配强，但生成、多轮推理和细粒度 grounding 弱。Flamingo 类方法通过 cross-attention 把视觉信息插入语言模型层间，视觉-语言交互强，适合少样本多模态任务，但结构复杂、训练成本高。LLaVA 路线更工程化，用 vision encoder + projector 把视觉 token 接入 LLM，再用图文指令数据微调，成本低、对话能力好，但依赖数据质量和视觉 token 预算。Qwen-VL 等新模型更重视高分辨率、OCR、定位和多图/视频能力，通常在视觉编码、动态分辨率、数据配比和评测上做系统优化。回答时要把架构、训练数据和评估能力一起讲。",
      "MLP Projector 简单、快、参数少，适合 LLaVA 类快速对齐，但可能损失细粒度视觉信息；Q-Former 用可学习 query 从视觉特征中抽取固定数量语义 token，压缩效率高，适合冻结视觉 encoder 和 LLM 的阶段化训练，但 query 数和训练目标会限制信息容量；Cross-Attention Adapter 让语言 token 在生成过程中动态读取视觉特征，交互更强、保留信息更多，但计算和工程复杂度更高。取舍取决于任务：通用聊天和低成本部署可用 projector，细粒度图文理解和压缩可用 Q-Former，需要强视觉-语言交互或多帧多图推理时考虑 cross-attention。",
    ],
  },
  {
    title: "多模态 LLM 面经：Vision Encoder、Q-Former 与视觉指令微调",
    company: "综合",
    role: "VLM / 多模态算法岗位",
    direction: "多模态大模型",
    domain: "视觉编码器 / 指令微调",
    category: "多模态大模型",
    difficulty: "中等",
    sourcePlatform: "GitHub",
    sourceUrl: "https://github.com/datawhalechina/hello-agents/blob/main/Extra-Chapter/Extra01-%E9%9D%A2%E8%AF%95%E9%97%AE%E9%A2%98%E6%80%BB%E7%BB%93.md",
    tags: ["VLM", "Vision Encoder", "Q-Former", "视觉指令微调", "Grounding"],
    content: "公开检索补充：该 GitHub 面试问题总结包含 VLM 核心挑战、CLIP、视觉编码器接入 LLM、视觉指令微调和 grounding 评估等题目。",
    questions: [
      "视觉指令微调为什么是 VLM 从图文对齐走向可对话、可遵循指令的关键阶段？",
      "Grounding 能力和普通 VQA 能力有什么差别？评估时应该关注哪些指标？",
    ],
    answers: [
      "图文对齐阶段主要让模型知道图像和文本在语义上如何匹配，但不一定会按人类指令回答，也不一定能进行多轮解释、拒答或结构化输出。视觉指令微调用图像-问题-答案、多轮对话、定位描述、OCR 问答和复杂推理数据，把视觉表示接入 LLM 的指令遵循能力中。它解决的是任务格式和交互方式问题：用户问什么、模型如何组织答案、何时引用视觉证据、何时承认不确定。面试要强调数据质量比数量更关键，尤其要过滤 OCR 泄漏、模板化问答、错误 caption 和训练/评测集重叠。",
      "普通 VQA 只要求回答问题，模型可能凭语言先验猜对；Grounding 要求把文本、答案或指令准确对应到图像区域、物体、坐标或时空片段，更关注视觉证据绑定。评估指标包括框/掩码 IoU、pointing accuracy、referring expression comprehension、文本答案正确率与定位一致性、负样本拒答率，以及多目标关系的准确性。对于视频 grounding 还要加时间边界 tIoU 和跨帧一致性。面试里可以指出：没有 grounding 约束的 VLM 容易产生视觉幻觉，实际业务中应把答案正确性和证据定位一起评估。",
    ],
  },
  {
    title: "多模态大模型面经：2025-2026 Any-to-Any 架构与原生多模态",
    company: "综合",
    role: "多模态大模型 / Omni 模型岗位",
    direction: "多模态大模型",
    domain: "Omni 架构 / 原生多模态",
    category: "多模态大模型",
    difficulty: "困难",
    sourcePlatform: "GitHub",
    sourceUrl: "https://github.com/laoshan-song/Awesome-LLM-Interview/blob/main/notes/05_%E5%89%8D%E6%B2%BF%E4%B8%93%E9%A2%98/19_%E5%A4%9A%E6%A8%A1%E6%80%81%E5%A4%A7%E6%A8%A1%E5%9E%8B.md",
    tags: ["多模态大模型", "Any-to-Any", "原生多模态", "Omni", "视觉 Tokenizer"],
    content: "公开检索补充：该面试题库总结多模态 LLM 从连接器路线到原生 Any-to-Any 架构的演进，适合问架构趋势和训练数据。",
    questions: [
      "Connector 桥接式多模态和原生 Any-to-Any 多模态模型的核心差异是什么？",
      "原生多模态模型训练时，文本、图像、音频、视频 token 混合会带来哪些数据和优化难点？",
    ],
    answers: [
      "Connector 路线通常保留预训练 vision encoder 和 LLM，通过 MLP、Q-Former 或 adapter 把视觉特征投到语言 token 空间，优点是复用成熟模型、训练成本低、工程落地快；缺点是模态交互多发生在后接层，生成图像/音频/视频等能力往往需要额外模块。原生 Any-to-Any 模型则尝试把文本、图像、音频、视频统一成可建模 token 或 latent，在同一生成框架中处理多模态输入输出，能力边界更宽，但训练数据、tokenizer、损失权重、上下文长度和推理成本都更复杂。面试回答要避免只说“更强”，要讲清成本和数据门槛。",
      "难点首先是 token 预算：视频和音频 token 远多于文本，如果不压缩会挤占上下文并抬高训练成本。其次是数据配比：文本数据多、质量高，多模态数据噪声大，比例不当会造成语言能力退化或视觉能力不足。第三是目标函数冲突：理解任务、生成任务、对齐任务和重建任务的损失尺度不同，需要课程学习和权重调度。第四是时间同步与语义对齐，尤其视频-音频-文本字幕常常错位。最后是评估困难，必须同时看文本能力、多模态理解、跨模态生成、幻觉、安全和延迟成本。",
    ],
  },
  {
    title: "World Model 类 VLA 面经：视频预测、环境动态与机器人控制",
    company: "综合",
    role: "世界模型 / 具身智能算法岗位",
    direction: "世界模型",
    domain: "视频预测 / 机器人控制",
    category: "世界模型",
    difficulty: "困难",
    sourcePlatform: "知乎",
    sourceUrl: "https://zhuanlan.zhihu.com/p/2049207405238563542",
    tags: ["世界模型", "VLA", "视频预测", "机器人控制", "Planning"],
    content: "公开检索补充：该来源调研 world model 类 VLA，关注用视频生成/视频预测能力辅助机器人控制动作输出。",
    questions: [
      "World Model 类 VLA 相比直接策略 VLA，多了哪些建模目标和系统收益？",
      "如果用视频预测作为机器人控制的中间表征，如何避免预测好看但控制不可用？",
    ],
    answers: [
      "直接策略 VLA 主要从观察和语言直接输出动作，优化目标更接近 imitation 或 policy learning。World Model 类 VLA 额外建模环境状态和未来演化，例如预测下一帧、未来 latent、对象运动、接触变化或可达状态，再把这种预测用于规划或动作生成。收益是可解释性更强，能在执行前评估候选动作后果，也更容易做仿真、反事实和失败恢复；风险是世界模型预测误差会累积，且视觉上合理的未来不一定对应物理可执行动作。面试要讲清它适合长程任务、交互规划和数据增强，但需要闭环控制校验。",
      "首先预测目标不能只追求像素好看，应加入与控制相关的状态，例如物体位姿、接触状态、可抓取区域、轨迹可达性和安全约束。其次要把预测模型放进闭环评估：给定候选动作，预测未来，再由 cost 或 value 判断是否可执行，而不是只看 FVD/PSNR。第三，训练数据要包含动作条件和失败样本，否则模型只能学被动视频外观。第四，控制接口要验证 sim-to-real 和延迟，避免预测频率低于控制需求。评估上应同时看视觉预测指标、任务成功率、碰撞率、恢复次数和真实机器人执行效果。",
    ],
  },
  {
    title: "自动驾驶世界模型面经：BEV、Occupancy、轨迹预测与闭环仿真",
    company: "综合",
    role: "自动驾驶 / 世界模型算法岗位",
    direction: "自动驾驶数据 / 世界模型",
    domain: "闭环仿真 / 规划评测",
    category: "自动驾驶 / 数据闭环",
    difficulty: "困难",
    sourcePlatform: "博客园",
    sourceUrl: "https://www.cnblogs.com/clnchanpin/p/19502504",
    tags: ["世界模型", "自动驾驶", "BEV", "Occupancy", "闭环仿真"],
    content: "公开检索补充：该来源讨论端到端自动驾驶、扩散式决策和世界模型/VLA 结合趋势，适合作为世界模型与闭环评测题源。",
    questions: [
      "自动驾驶世界模型如何把 BEV、occupancy、轨迹预测和闭环仿真统一到规划可用的环境动态建模中？",
      "闭环仿真评估自动驾驶策略时，为什么需要关注交互真实性而不只是轨迹误差？",
    ],
    answers: [
      "BEV 提供统一鸟瞰空间坐标，方便融合多相机、激光雷达和地图；occupancy 表示空间占用和可通行区域，能描述静态/动态障碍；轨迹预测建模其他交通参与者未来行为；闭环仿真则把自车动作对环境反馈的影响纳入评估。世界模型的目标是学习状态转移：当前感知、历史动作、交通上下文输入后，预测未来场景和风险，让规划器能比较候选动作的后果。面试要强调规划可用性：预测不只是生成好看的 BEV，而是要服务碰撞风险、舒适性、法规约束、可解释性和长尾场景覆盖。",
      "轨迹误差是开环指标，只比较模型预测和记录轨迹是否接近，但真实驾驶是交互系统：自车换道、减速或避让会改变其他车辆反应。一个开环误差小的模型，闭环中可能产生不合理让行、碰撞或僵持。交互真实性要求仿真中的车辆、行人、信号和道路约束对自车动作有合理反馈，并覆盖 cut-in、急刹、遮挡、无保护左转等长尾场景。评估时应看碰撞率、违规率、舒适性、到达率、接管率、场景覆盖和反事实一致性，而不是只看 ADE/FDE。",
    ],
  },
  {
    title: "LLM 算法岗多模态面经：Qwen2.5-VL、ViT、SAM 与视觉文本对齐",
    company: "综合",
    role: "LLM / 多模态算法岗位",
    direction: "多模态大模型",
    domain: "模型架构 / 视觉基础模型",
    category: "多模态大模型",
    difficulty: "中等",
    sourcePlatform: "博客园",
    sourceUrl: "https://www.cnblogs.com/moonout/p/19733786",
    tags: ["Qwen2.5-VL", "ViT", "SAM", "CLIP", "视觉文本对齐"],
    content: "公开检索补充：该 2026 LLM 算法岗八股问答总结多模态和主流模型架构，包含 Qwen2.5-VL、ViT、SAM、视觉文本对齐等题目。",
    questions: [
      "Qwen2.5-VL 这类 VLM 面试中，回答模型结构时应该拆成哪些模块？",
      "ViT、CLIP 和 SAM 在多模态大模型体系里分别提供什么能力，不能混为一谈的点是什么？",
    ],
    answers: [
      "回答 VLM 结构可以按五块拆：视觉输入处理，包括动态分辨率、patch/tile 和位置编码；vision encoder，把图像或视频转成视觉特征；连接层，如 projector、Q-Former 或 cross-attention，把视觉特征映射到 LLM token 空间；LLM 主干，负责语言理解、推理和生成；训练与评估，包括图文预训练、指令微调、OCR/grounding/多图评测。这样回答比只背模型名字更稳，也方便继续追问高分辨率、长视频、多图和推理成本。",
      "ViT 是视觉编码器骨架，把图像切成 patch 并用 Transformer 提取视觉特征；CLIP 是图文对比学习框架，学习图像和文本的语义对齐，擅长检索和开放类别识别；SAM 是分割基础模型，擅长 promptable segmentation，提供区域级掩码能力。它们在 VLM 中角色不同：ViT 提供特征，CLIP 提供语义对齐预训练，SAM 可用于精细区域或标注辅助。不能把 CLIP 当成完整对话式 VLM，也不能认为 SAM 直接具备语言推理能力；真正的 VLM 还需要连接层、LLM 和指令微调。",
    ],
  },
  {
    title: "具身智能学习路线面经：VLA、世界模型、Sim2Real 与数据飞轮",
    company: "综合",
    role: "具身智能算法 / 机器人基础模型岗位",
    direction: "VLA / 具身智能",
    domain: "学习路线 / 系统设计",
    category: "VLA / 具身智能",
    difficulty: "中等",
    sourcePlatform: "GitHub",
    sourceUrl: "https://github.com/Mbot-lab/Mbot-llm-wiki-EAI",
    tags: ["具身智能", "VLA", "世界模型", "Sim2Real", "数据飞轮"],
    content: "公开检索补充：该具身智能学习路线强调 3D 视觉、机器人理论、VLA、世界模型、Sim2Real 和数据飞轮，适合作为岗位系统设计类题源。",
    questions: [
      "从零搭建一个具身智能项目，为什么要同时考虑感知、策略、控制、仿真和数据飞轮？",
      "Sim2Real 在具身智能项目中主要解决什么问题，哪些问题不能只靠域随机化解决？",
    ],
    answers: [
      "具身智能不是单一模型问题。感知负责识别物体、空间、状态和 affordance；策略负责把语言目标转成子目标和动作意图；控制负责把高层动作变成稳定、安全、实时的机器人执行；仿真用于低成本覆盖长尾、验证安全和预训练；数据飞轮负责从真实失败中持续改进。只做大模型会卡在真实控制和安全边界，只做控制又缺少开放任务泛化。面试里可以用闭环链路回答：数据采集、标注、训练、仿真评估、真机部署、失败回流，每一环都有指标和质量门槛。",
      "Sim2Real 主要缓解真实机器人数据昂贵、危险场景难采、长尾覆盖不足的问题。域随机化可以让模型适应纹理、光照、相机姿态和部分动力学变化，但不能完全解决接触物理不准、传感器延迟、执行器背隙、软物体形变、人类环境不可控和任务语义差异。更可靠的方案是仿真预训练 + 真实少样本微调 + 在线校正 + 真机评测闭环。面试时要强调：仿真是加速器，不是真实评估替代品，最终指标仍然要落到真机成功率、安全触发和失败恢复。",
    ],
  },
];

const posts = JSON.parse(await fs.readFile(POSTS_FILE, "utf8"));
const existingQuestionKeys = new Set(posts.flatMap((post) => post.questions || []).map(normalizeQuestion).filter(Boolean));
const existingUrls = new Set(posts.map((post) => post.sourceUrl).filter(Boolean));
const added = [];
const skipped = [];

for (const item of curated) {
  const kept = [];
  const answers = [];
  item.questions.forEach((question, index) => {
    const key = normalizeQuestion(question);
    if (!key || existingQuestionKeys.has(key)) {
      skipped.push({ title: item.title, question, reason: "duplicate-question" });
      return;
    }
    existingQuestionKeys.add(key);
    kept.push(question);
    answers.push(qa(question, item.answers[index]));
  });
  if (!kept.length) continue;

  const id = `curated-20260824-${hash(`${item.sourcePlatform}|${item.title}|${item.sourceUrl}`)}`;
  if (posts.some((post) => post.id === id) || existingUrls.has(item.sourceUrl)) {
    skipped.push({ title: item.title, sourceUrl: item.sourceUrl, reason: "duplicate-source" });
    continue;
  }

  const post = {
    id,
    title: item.title,
    company: item.company,
    role: item.role,
    direction: item.direction,
    domain: item.domain,
    category: item.category,
    type: "question",
    difficulty: item.difficulty,
    sourcePlatform: item.sourcePlatform,
    sourceDate: SOURCE_DATE,
    sourceUrl: item.sourceUrl,
    tags: item.tags,
    questions: kept,
    questionAnswers: answers,
    reviewStatus: "question_ready",
    content: item.content,
    prepTips: "",
    createdAt: nowSeconds(),
    updatedAt: nowSeconds(),
  };
  posts.unshift(post);
  added.push({ id, title: item.title, questions: kept.length, sourceUrl: item.sourceUrl });
}

posts.sort((a, b) => (b.sourceDate || "").localeCompare(a.sourceDate || "") || (b.updatedAt || 0) - (a.updatedAt || 0));
await fs.writeFile(POSTS_FILE, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
await fs.writeFile(LOG_FILE, `${JSON.stringify({
  date: new Date().toISOString(),
  mode: "public-web-curation",
  added: added.length,
  addedQuestions: added.reduce((sum, item) => sum + item.questions, 0),
  skipped,
  addedItems: added,
}, null, 2)}\n`, "utf8");

console.log(JSON.stringify({ added: added.length, addedQuestions: added.reduce((sum, item) => sum + item.questions, 0), skipped: skipped.length, added }, null, 2));
