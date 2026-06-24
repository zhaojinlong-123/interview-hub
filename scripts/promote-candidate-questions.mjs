import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POSTS_FILE = path.join(ROOT, "data", "posts.json");
const EXTRACTED_FILE = path.join(ROOT, "logs", "candidate-question-lines-2026-06-24.json");
const REPORT_FILE = path.join(ROOT, "logs", "promoted-candidate-questions-2026-06-24.json");
const SHOULD_WRITE = process.argv.includes("--write");

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[，。！？、；：“”‘’（）()[\]{}<>《》\/\\\-_:,.!?;\s]/g, "")
    .replace(/visionlanguageaction/g, "vla")
    .replace(/keyvaluecache/g, "kvcache")
    .trim();
}

function cleanQuestion(value) {
  return String(value || "")
    .replace(/^八股\s*[:：]\s*/, "")
    .replace(/^项目\s*[:：]\s*/, "")
    .replace(/^题目\s*\d+\s*[:：]\s*/, "")
    .replace(/^【项目深挖】\s*\d*[.、]?\s*/, "")
    .replace(/^\d+\s*[.、)）]\s*/, "")
    .trim();
}

const rejectPatterns = [
  /RAG|Agent/i,
  /日常实习还是暑期实习|怎么这么困|为什么会考接雨水|点赞|评论|收藏/,
  /你负责哪些工作|你们是否|你们如何|你的baseline|为什么没有补充|成功率大概|能到多少/,
  /动物上的临床验证|数学方程|构成三角形的概率|岛屿的数量/,
  /对比维度.*集成效果|TensorRT.*ONNX Runtime|对比项|\t/,
  /登录|验证码|扫码|服务协议|隐私/,
];

const domainSignals = [
  /多模态|VLM|CLIP|SigCLIP|DINO|ViT|BLIP|Flamingo|OCR|视觉编码器|图文|模态对齐/i,
  /VLA|具身|机器人|机械臂|action|动作|RT-1|RT-2|OpenVLA|Diffusion Policy|Sim-to-Real|模仿学习/i,
  /世界模型|自动驾驶|BEV|occupancy|仿真|数据闭环/i,
  /视频理解|视频生成|时序|帧|temporal/i,
  /DeepSpeed|ZeRO|Megatron|显存|并行|FlashAttention|训练数据|SFT|packing|优化器/i,
  /vLLM|PagedAttention|KV Cache|推理|部署|量化|吞吐|延迟/i,
  /RLHF|DPO|PPO|GRPO|奖励模型|强化学习|KL散度|熵|优势值/i,
  /Qwen|DeepSeek|RoPE|Mamba|Transformer|MoE/i,
];

function questionScore(question, post) {
  if (rejectPatterns.some((pattern) => pattern.test(question))) return -100;
  let score = 0;
  for (const pattern of domainSignals) if (pattern.test(question)) score += 5;
  if (/[？?]$/.test(question)) score += 2;
  if (question.length >= 18 && question.length <= 100) score += 2;
  if (post.company && !["综合", "未知", "未明确", "其他"].includes(post.company)) score += 3;
  if (/为什么|如何|区别|原理|怎么|哪些|分别|相比|取舍|优化|设计/.test(question)) score += 2;
  return score;
}

function answerQuestion(question) {
  const q = cleanQuestion(question);

  if (/Action Chunk|组织形变|闭环修正/i.test(q)) {
    return "Action Chunk 不能作为开环轨迹一次执行到底。更稳妥的做法是采用滚动时域控制：策略每次预测一段动作，但控制器只执行前几个动作，随后重新采集视觉、力觉和机器人本体状态，再用最新观测重规划剩余轨迹。对组织形变这类强非刚性场景，还应加入目标跟踪与形变估计、动作置信度或不确定性检测、力/速度安全约束以及异常触发的快速停止。训练时可通过扰动轨迹、失败恢复数据和延迟随机化，让策略学会在状态偏离时回到可恢复区域。核心是“短执行、频重规划、低层安全控制兜底”，而不是追求一次生成很长的动作序列。";
  }
  if (/Transformer.*Mamba|Mamba.*Transformer|平方.*线性|KV Cache.*Mamba/i.test(q)) {
    return "Transformer 的自注意力需要计算序列中 token 两两交互，标准实现的注意力矩阵大小为 n×n，因此时间和显存复杂度通常随序列长度呈 O(n²) 增长；Mamba 使用选择性状态空间模型，把历史压缩进固定维度状态并递推更新，序列计算近似 O(n)。代价是 Mamba 的状态压缩不是无损记忆，长时细节可能被覆盖。机器人长任务中不应只依赖单一隐状态，而应结合分层记忆：短期连续状态交给 Mamba，关键事件、目标和操作结果写入结构化外部记忆，需要时检索回模型；同时用阶段边界监督、记忆一致性损失和长序列回放评估遗忘。";
  }
  if (/DeepSeek-V3.*DeepSeek-R1|DeepSeek-R1.*DeepSeek-V3/i.test(q)) {
    return "DeepSeek-V3 更偏向高效通用基座模型：核心关注 MoE 稀疏激活、负载均衡、低成本训练和通用语言/代码能力。DeepSeek-R1 则是在强基座上重点强化推理能力，通过可验证奖励、强化学习和后续蒸馏，让模型形成更稳定的长链推理。回答时要把“架构”和“训练目标”分开：V3 的亮点主要是如何用稀疏专家扩大容量并控制训练成本；R1 的亮点主要是如何利用 RL 放大数学、代码和逻辑推理能力。两者不是简单的新旧版本关系，而是通用基座与推理后训练侧重点不同。";
  }
  if (/Qwen2\.5-VL.*是什么/i.test(q)) {
    return "Qwen2.5-VL 是面向图像和视频理解的视觉语言模型：视觉侧把图片或视频编码成视觉 token，经过连接/投影模块与文本 token 一起送入语言模型，从而完成问答、OCR、图表理解、目标定位、视频时序理解和工具调用。理解它时要关注三个层面：动态分辨率或视觉 token 压缩如何控制高分辨率成本；视觉 token 如何与语言空间对齐；训练数据如何从图文预训练过渡到多模态指令微调和偏好对齐。它不是单纯“给 Qwen 加图片输入”，而是一套视觉编码、时空建模、对齐训练和评测体系。";
  }
  if (/Qwen.*结构|Attention.*FFN|Qwen2\.5/i.test(q)) {
    return "Qwen2.5 类模型整体仍是 decoder-only Transformer。典型模块包括 RoPE 位置编码、RMSNorm、SwiGLU FFN，以及为降低推理 KV Cache 成本采用的 GQA 类注意力设计。面试中不应只罗列模块，还要说明影响：GQA 在保持多查询表达能力的同时减少 K/V 头数量，降低长上下文推理显存；SwiGLU 提升 FFN 表达能力但增加中间维度计算；RoPE 让注意力自然感知相对位置，并可配合缩放策略扩展上下文。Qwen 系列还应结合中文、多语言、代码、工具调用和多模态生态说明其训练与应用特点。";
  }
  if (/8B.*显存|多少显存|显存不够/i.test(q)) {
    return "仅看权重，8B 参数模型使用 FP16/BF16 约需 16GB；但全参训练远不止权重，还包括梯度、Adam 一阶/二阶状态、主权重、激活值和通信缓冲，通常需要权重体积的数倍甚至十余倍。粗略估算时应分别列出参数、梯度、优化器状态和激活，而不是只报一个数字。显存不足可组合使用 BF16/FP16、ZeRO-2/3 或 FSDP、张量/流水线并行、gradient checkpointing、FlashAttention、CPU/NVMe offload、减小 micro-batch、序列并行，以及 LoRA/QLoRA。推理场景还要单独计算随 batch 和上下文长度增长的 KV Cache。";
  }
  if (/RoPE|旋转位置编码/i.test(q)) {
    return "RoPE 将每个位置对应为不同旋转角度，对 Query 和 Key 的二维子空间做旋转。单个向量携带的是绝对位置角度，但注意力内积中的旋转会化简为两位置角度之差，因此分数自然依赖相对距离。相比直接相加的位置向量，RoPE 不改变向量范数，且能把相对位置信息直接注入 QK 内积。长上下文扩展时，常用 NTK-aware scaling、YaRN 或位置插值调整旋转频率，但必须重新评估远距离注意力、短上下文退化和外推稳定性。";
  }
  if (/max_model_len|n_ctx|硬件限制/i.test(q)) {
    return "配置 `max_model_len` 或 `n_ctx` 时要先按 KV Cache 显存预算倒推，而不是直接设成模型理论上限。可用近似关系估算 KV Cache：层数 × 2(K/V) × KV 头数 × head_dim × 序列长度 × 并发序列数 × 数据类型字节数。预留模型权重、CUDA workspace 和碎片后，再确定最大上下文与 `gpu_memory_utilization`。上下文越长，可同时服务的请求越少；如果频繁 OOM，应降低最大长度、并发序列数或 batch token 上限，采用 GQA/MQA、KV Cache FP8、张量并行或前缀缓存。上线前需压测 TTFT、吞吐、P99 和抢占次数。";
  }
  if (/temperature.*top_p|top_p.*temperature|采样参数.*多样性/i.test(q)) {
    return "`temperature` 通过缩放 logits 控制概率分布尖锐程度：低温让高概率 token 更占优势，输出更稳定；高温增加随机性，但也提高事实错误和格式漂移风险。`top_p` 只保留累计概率达到阈值的最小 token 集，再从中采样，因此会随上下文动态改变候选数量。生产中通常先按任务确定温度，再用 top_p 限制长尾：代码、抽取和结构化输出使用低温；创作和头脑风暴可适当提高。还应配合 top_k、重复惩罚、最大长度和固定随机种子做离线评测。";
  }
  if (/vLLM|PagedAttention/i.test(q)) {
    return "vLLM 的核心优化是围绕 KV Cache 管理和请求调度。PagedAttention 将每条请求的 KV Cache 切成固定大小块，逻辑连续但物理上可离散分配，类似虚拟内存分页，从而减少预留空间和碎片，并支持不同长度请求共享显存池。再配合 continuous batching，新请求可以动态进入批次，已完成请求及时释放块，显著提升并发吞吐。代价是调度与块表管理更复杂；评估时要同时看 TTFT、TPOT、吞吐、P95/P99 延迟、显存利用率和抢占次数。";
  }
  if (/FlashAttention.*v1.*v2|FlashAttention v1|FlashAttention v2/i.test(q)) {
    return "FlashAttention 的关键不是减少理论 FLOPs，而是用分块计算和在线 softmax 避免把完整 n×n 注意力矩阵写回显存，从而减少 HBM 访问。v1 已实现 IO-aware 的精确注意力；v2 进一步优化工作划分，减少非矩阵乘操作，改进线程块与 warp 间并行，并在长序列和不同 head 维度下获得更高 GPU 利用率。回答时要强调它仍计算精确 attention，不是稀疏近似；收益主要来自更少的显存读写、更低峰值显存和更好的并行调度。";
  }
  if (/packing.*多轮对话|多轮对话.*packing/i.test(q)) {
    return "Packing 是把多条短样本拼进同一固定长度序列，配合 attention mask 和 loss mask 避免样本间互相看到，主要目的是减少 padding、提升 token 利用率和训练吞吐。多轮对话格式则是在一条样本中保留 system、user、assistant 的真实轮次结构，并只对需要学习的 assistant token 计算损失，目标是学习上下文跟踪和角色一致性。二者可以同时使用：先构造正确的多轮样本，再把多条样本 packing；关键是处理边界位置编码、跨样本 attention 隔离和 loss mask。";
  }
  if (/SFT.*数据.*配比|不同来源数据.*配比/i.test(q)) {
    return "SFT 数据配比不能只按样本条数决定，应按有效 token、任务价值、质量和难度联合采样。通常先保证通用指令数据维持基础能力，再加入垂域问答提升专业性，CoT 数据重点增强复杂推理，但比例过高可能让模型在简单问题上也输出冗长推理。实践中可采用温度采样或上限截断防止大数据源垄断，并通过分阶段训练、混合验证集和梯度/损失监控动态调整。评估要同时看通用能力回退、垂域通过率、推理正确率、回答长度和安全指标。";
  }
  if (/CLIP\/SigCLIP.*DINO|细粒度.*CLIP|细粒度.*DINO/i.test(q)) {
    return "CLIP/SigLIP 的图文对齐目标偏向全局语义，适合检索和开放词汇识别；DINO 的自监督视觉特征通常保留更强局部结构，但缺少天然语言接口。细粒度任务若只做封闭类别分类，可以直接用 DINO/CLIP 特征加分类头；选择多模态大模型通常是因为还需要文本解释、开放类别、属性组合、局部问答或链式推理。合理方案是保留高分辨率局部特征，用多尺度视觉编码器、区域 token、局部裁剪或 DINO 特征作为辅助，再通过 projector/cross-attention 接入 LLM，而不是期待单一全局 CLS token 完成细粒度识别。";
  }
  if (/DPO.*Reward Model.*GRPO|DPO.*GRPO/i.test(q)) {
    return "DPO 和“奖励模型 + GRPO”没有绝对优劣，取决于数据和目标。DPO 直接用偏好对优化策略，不需要在线采样和单独 reward model，训练稳定、成本低，适合已有高质量 chosen/rejected 数据的场景；奖励模型 + GRPO 可以对同一 prompt 在线采样多条回答，用可验证奖励或学习型奖励持续探索，适合数学、代码和复杂推理，但工程复杂、采样昂贵，并存在 reward hacking。实践中可先用 DPO 获得稳定起点，再用 GRPO 做小步强化；评估要同时看任务通过率、KL 偏移、回答长度、奖励泛化和安全性。";
  }
  if (/GRPO.*PPO|为什么选用GRPO|优势值.*GRPO/i.test(q)) {
    return "PPO 通常依赖 value model 估计状态价值，再用 GAE 构造 advantage；GRPO 对同一 prompt 采样一组回答，用组内奖励的相对均值和方差归一化得到 advantage，因此可省去单独的价值模型。这样能降低显存和工程复杂度，适合数学、代码、可验证问答等同题多采样场景。局限是组内样本过于相似时优势信号很弱，奖励尺度或规则漏洞也会导致 reward hacking。实践中仍需 KL 约束控制策略偏离参考模型，并监控组内奖励方差、响应长度和通过率。";
  }
  if (/KL散度.*熵|熵.*KL散度/i.test(q)) {
    return "KL 散度约束新策略不要过快偏离参考策略，主要用于防止强化学习把语言能力和回答分布推坏；熵衡量策略输出的不确定性或多样性，熵过低容易过早收敛到单一模式，熵过高则动作或 token 分布过于随机。训练时常把任务奖励、KL 惩罚和熵奖励组合：提高 KL 系数会更保守，提高熵系数会鼓励探索。两者都应随训练阶段和 reward 稳定性调节，并结合通过率、长度、重复率和安全性观察是否出现模式坍塌。";
  }
  if (/奖励模型.*如何训练|Reward Model/i.test(q)) {
    return "奖励模型通常从同一 prompt 的多个回答中构造偏好对，标注哪个回答更好，再训练模型输出标量分数，使 preferred response 的得分高于 rejected response。数据应覆盖正确性、帮助性、安全性、格式和长度，并处理标注者分歧。常见风险包括长度偏置、风格偏置、分布外失真和 reward hacking，因此需要去偏采样、对抗样本、校准集和人工复核。对于可验证任务，可将单元测试或规则奖励与学习型奖励组合，降低纯主观偏好的噪声。";
  }
  if (/多模态.*融合方式|早期融合.*晚期融合|中间融合/i.test(q)) {
    return "早期融合在输入或浅层就拼接不同模态，跨模态交互充分，但要求时空对齐好且计算量大；晚期融合先让各模态独立编码，再融合 logits 或 embedding，工程解耦、缺失模态鲁棒，但细粒度交互较弱；中间融合在若干层通过 cross-attention、co-attention 或共享 token 交互，表达力与成本居中。检索推荐常用多塔和晚期融合，细粒度视觉问答、grounding 更适合中间融合，传感器时间严格同步且模态稳定时可使用早期融合。";
  }
  if (/CLIP.*BLIP|BLIP.*Q-Former/i.test(q)) {
    return "CLIP 是双塔对比学习模型，重点把整图和整句映射到共享向量空间，擅长检索和零样本分类；BLIP 同时结合理解与生成目标，并通过数据清洗和字幕生成改善图文训练数据；BLIP-2 使用冻结视觉编码器、冻结 LLM 和轻量 Q-Former。Q-Former 里的可学习 query 通过 cross-attention 从大量视觉 token 中提取与语言任务相关的少量表示，再接入 LLM，因此显著降低连接成本。它的取舍是压缩高效，但 query 数量过少可能损失细粒度局部信息。";
  }
  if (/图文对齐.*实际场景|图文不对齐/i.test(q)) {
    return "图文对齐意味着视觉区域、对象属性和文本语义在共享表示或生成过程中正确对应。例如商品检索中，“红色圆领连衣裙”应匹配颜色、领型和类别都一致的图片；视觉问答中，模型提到的数量和位置应来自图中真实对象。若图文不对齐，训练会把错误属性绑定到对象，造成检索召回下降、OCR/grounding 错位和视觉幻觉。治理方法包括图文相似度过滤、对象或区域级对齐、困难负样本、人工抽检和下游任务一致性评估。";
  }
  if (/CLIP.*原理|图文对齐|InfoNCE/i.test(q)) {
    return "CLIP 使用图像编码器和文本编码器把配对图文映射到同一向量空间，在一个 batch 内把真实图文对作为正样本，其余组合视为负样本，双向计算图到文和文到图的对比损失。InfoNCE 本质上让正样本相似度相对所有候选更高，温度参数控制分布尖锐程度。CLIP 的优势是大规模弱监督和零样本迁移，局限是依赖 batch 内负样本、偏向全局语义，对计数、空间关系和细粒度局部属性不够敏感。";
  }
  if (/ViT.*CNN|CNN.*ViT/i.test(q)) {
    return "CNN 通过局部卷积、权重共享和平移归纳偏置，在中小数据和高分辨率密集预测中样本效率高；ViT 把图像切成 patch token，用自注意力直接建模长距离关系，规模化后表达能力和迁移性更强，但训练数据与计算需求更大。多模态大模型常选 ViT，因为 token 形式容易接入 LLM，不过对小目标和局部细节通常需要高分辨率、动态切图、多尺度特征或卷积 stem 补强。";
  }
  if (/AdamW.*Adam|优化器.*AdamW/i.test(q)) {
    return "Adam 将 L2 正则项加进梯度后再经过自适应缩放，导致不同参数的实际衰减受二阶矩影响；AdamW 将 weight decay 与梯度更新解耦，直接按参数大小衰减，因此正则化含义更稳定，也更适合 Transformer。实践中通常不对 bias、LayerNorm/RMSNorm 参数做权重衰减，并配合 warmup、余弦学习率、梯度裁剪和 BF16 稳定训练。";
  }
  if (/数据并行.*模型并行|流水线并行|ZeRO 是什么/i.test(q)) {
    return "数据并行复制完整模型、切分 batch，并在反向传播后同步梯度；张量并行切分单层矩阵，解决单层参数放不下；流水线并行按层切分模型，通过 micro-batch 填充流水线，但会产生 bubble；ZeRO/FSDP 则切分优化器状态、梯度和参数，降低每卡冗余。真实大模型通常组合这些策略，取舍取决于显存、网络带宽、模型宽度/深度和全局 batch。";
  }
  if (/BLIP.*Flamingo|BLIP-2/i.test(q)) {
    return "BLIP-2 用冻结视觉编码器、轻量 Q-Former 和冻结 LLM 连接视觉与语言，重点是用较少可训练参数完成图文对齐与生成；Flamingo 在语言模型层间插入 gated cross-attention，并使用 Perceiver Resampler 压缩可变数量图像/视频特征，擅长多图和上下文学习。BLIP-2 更像高效连接器方案，Flamingo 更强调交错图文序列和 few-shot 多模态上下文。";
  }
  if (/VLA模型的输入和输出|动作空间离散化.*Token/i.test(q)) {
    return "VLA 的输入通常包括当前或历史视觉观测、语言指令、机器人本体状态，有时还加入力觉和任务记忆；输出可以是离散 action token、连续关节/末端位姿，或一段 action chunk。动作离散化后可复用语言模型的自回归训练、统一不同机器人技能词表，并便于长序列规划；代价是量化误差和高频控制不连续。工程上常采用高层离散 token 规划、低层连续控制器执行的分层方式。";
  }
  if (/Sim-to-Real|仿真到真实/i.test(q)) {
    return "Sim-to-Real 的差距主要来自视觉外观、动力学参数、传感器噪声、控制延迟和接触模型不一致。常用手段包括视觉与动力学域随机化、系统辨识、噪声/延迟注入、仿真图像风格迁移、鲁棒策略训练，以及少量真实数据微调。评估不能只看平均成功率，还要看不同物体、光照、摩擦、载荷和相机位姿下的最差性能与恢复率。";
  }
  if (/模仿学习.*强化学习|IL.*RL/i.test(q)) {
    return "模仿学习直接拟合专家演示，训练稳定、样本利用率高，适合快速获得可用策略，但容易受到分布偏移和复合误差影响；强化学习能基于长期奖励探索超越演示的策略，但真实机器人采样昂贵且有安全风险。常见组合是先用行为克隆/SFT 初始化，再用离线 RL、仿真 RL 或受约束在线 RL 优化成功率和恢复能力，同时保留专家数据做正则，防止策略漂移。";
  }
  if (/RT-1.*RT-2|RT-2.*VLA/i.test(q)) {
    return "RT-1 主要把机器人观测和语言指令映射到离散动作 token，重点是多任务机器人控制；RT-2 将大规模视觉语言模型的语义知识迁移到动作生成，把动作表示成可由语言模型输出的 token，因此能利用互联网图文预训练获得更强的语义泛化和简单推理能力。RT-2 被称为 VLA，是因为视觉、语言和动作在统一序列建模框架中连接起来。";
  }
  if (/推理频率.*3Hz.*50Hz|频率不匹配|机械臂需要50Hz/i.test(q)) {
    return "不能要求大模型直接以 50Hz 每步推理。常见方案是分层控制：VLA 低频输出 action chunk、目标位姿或技能参数，低层 MPC/PID/阻抗控制器以 50Hz 或更高频执行和纠偏；同时采用异步推理、动作重叠执行、模型蒸馏/量化和视觉编码缓存降低延迟。若新观测偏离预测轨迹，应提前中止 chunk 并重规划。关键指标包括端到端延迟、控制抖动、轨迹误差和异常恢复时间。";
  }
  if (/Diffusion Policy.*原理|Diffusion Policy.*优势/i.test(q)) {
    return "Diffusion Policy 把一段动作轨迹视为待去噪变量，从高斯噪声开始，结合视觉和状态条件逐步生成平滑 action chunk。它比单峰回归更能表达抓取、绕行等多解动作分布，也能利用轨迹级相关性减少逐步自回归误差。代价是多步去噪带来推理延迟，因此常用少步采样、蒸馏、缓存视觉特征和滚动执行。";
  }
  if (/奖励函数.*机器人|复杂的操作任务/i.test(q)) {
    return "复杂机器人任务的奖励应分层设计：任务完成给稀疏终局奖励，距离、姿态、接触状态和子目标提供稠密 shaping，碰撞、力矩越界、掉落和超时给安全惩罚。要避免奖励互相冲突和投机行为，可用势函数 shaping 保持最优策略不变，并通过成功判定器、人工偏好或视觉语言奖励补充难以手写的目标。最终应检查 reward hacking、奖励尺度和不同阶段梯度是否平衡。";
  }
  if (/完整的具身智能系统架构|各模块如何协同/i.test(q)) {
    return "完整具身系统通常包含传感器与同步、感知/状态估计、语言与任务理解、世界模型或记忆、高层任务规划、VLA/技能策略、运动规划与低层控制、安全监控、执行反馈和数据闭环。高层模块决定做什么，低层模块保证怎么稳定地做；执行结果持续回写状态与记忆，失败样本进入标注、训练和仿真评测。系统设计重点是接口频率、时间同步、不确定性传递和安全兜底。";
  }
  if (/Pi0.*核心架构|π0.*核心架构/i.test(q)) {
    return "π0 类 VLA 的核心思路是把预训练视觉语言表征与连续动作生成结合：视觉和语言负责理解场景与任务，动作专家使用 flow matching/连续生成方式输出一段高维动作轨迹。相比把动作完全离散成 token，连续流模型更适合高频、平滑、多自由度控制；训练时通常先利用跨机器人数据学习通用表征，再针对具体机器人和任务微调。";
  }
  if (/Pi0.*训练数据|π0.*训练数据/i.test(q)) {
    return "π0 类模型的数据策略强调跨机器人、跨任务和跨场景混合。每条样本应对齐多视角图像、语言指令、本体状态与 action chunk，并统一坐标系、动作尺度和时间频率。训练时既要用大规模异构数据学习通用能力，也要通过机器人类型标识、动作归一化和高质量目标平台数据避免负迁移；失败轨迹与恢复轨迹对提升闭环鲁棒性尤其重要。";
  }
  if (/机器人动作队列|动作队列/i.test(q)) {
    return "高效动作队列需要支持时间戳、优先级、可取消和状态反馈。VLA 低频地产生 action chunk，控制线程按固定周期消费；当新观测触发重规划、碰撞风险或人工接管时，应原子地废弃未执行动作并切换到安全动作。队列还应限制最大前瞻时长，记录每个动作的计划时间与实际执行时间，用于监控延迟、丢帧和控制漂移。";
  }
  if (/模型推理延迟|推理延迟问题/i.test(q)) {
    return "降低模型推理延迟要先拆分视觉编码、prefill、decode/动作生成、通信和控制等待。可采用视觉特征缓存、低分辨率快速路径、模型蒸馏、INT8/FP8、FlashAttention、CUDA Graph、批处理与异步流水线；机器人控制还可让低层控制器在模型计算期间继续执行短 action chunk。必须设置超时和旧结果丢弃机制，避免迟到动作污染闭环。";
  }
  if (/多模态大模型.*建模的方法|多模态.*建模方法/i.test(q)) {
    return "多模态大模型常见建模路线有三类：双塔/多塔编码后在向量空间对齐，适合检索；视觉编码器加 projector 或 Q-Former 接入 LLM，适合问答和生成；在 LLM 多层插入 cross-attention，实现更深跨模态交互。还可按融合时机分为早期、中间和晚期融合。选择取决于任务是否需要细粒度定位、输入模态数量、延迟预算和是否复用冻结基座。";
  }
  if (/LoRA.*全参|为什么常用 LoRA|LoRA.*效果.*成本/i.test(q)) {
    return "LoRA 冻结主模型，只训练低秩增量矩阵，显著降低梯度和优化器状态显存，也便于为不同业务维护独立 adapter；全参微调容量更大，适合大规模领域迁移，但成本高且更容易造成通用能力遗忘。选择时应比较数据规模、领域差异、目标能力是否需要重塑主干表征，以及线上是否需要多租户热切换。LoRA 并非天然无损，rank、注入层、学习率和数据覆盖不足都会限制上限。";
  }

  return "";
}

function existingQuestionKeys(posts) {
  const keys = new Set();
  for (const post of posts) {
    if (post.sourceDate === "2026-06-24" && ["source_candidate", "question_ready"].includes(post.reviewStatus)) continue;
    for (const question of post.questions || []) {
      const key = normalize(question);
      if (key) keys.add(key);
    }
  }
  return keys;
}

const posts = JSON.parse(await fs.readFile(POSTS_FILE, "utf8"));
const extracted = JSON.parse(await fs.readFile(EXTRACTED_FILE, "utf8"));
const extractedById = new Map(extracted.map((item) => [item.id, item]));
const used = existingQuestionKeys(posts);
const promoted = [];
const skipped = [];

for (const post of posts) {
  if (post.sourceDate !== "2026-06-24" || !["source_candidate", "question_ready"].includes(post.reviewStatus)) continue;
  const source = extractedById.get(post.id);
  if (!source) {
    skipped.push({ id: post.id, title: post.title, reason: "no extracted questions" });
    continue;
  }

  const ranked = source.questions
    .map((question) => ({ question: cleanQuestion(question), score: questionScore(question, post) }))
    .filter((item) => item.score >= 7)
    .sort((a, b) => b.score - a.score || a.question.length - b.question.length);

  const selected = [];
  const selectedAnswers = new Set();
  for (const item of ranked) {
    const key = normalize(item.question);
    if (!key || used.has(key)) continue;
    const answer = answerQuestion(item.question);
    if (!answer || answer.length < 80) continue;
    const answerKey = normalize(answer);
    if (selectedAnswers.has(answerKey)) continue;
    selected.push({ question: item.question, answer, score: item.score });
    used.add(key);
    selectedAnswers.add(answerKey);
    if (selected.length >= 2) break;
  }

  if (!selected.length) {
    skipped.push({ id: post.id, title: post.title, reason: "no source-backed question with a specific model answer" });
    continue;
  }

  post.questions = selected.map((item) => item.question);
  post.questionAnswers = selected.map((item) => ({
    question: item.question,
    answer: item.answer,
    answerStatus: "model_answered",
    answeredAt: new Date().toISOString(),
    source: "promote-candidate-questions-2026-06-24",
  }));
  post.content = [
    post.content || "",
    "来源正文抽取题目：",
    ...selected.map((item) => item.question),
  ].join(" ").trim();
  post.reviewStatus = "question_ready";
  post.updatedAt = Math.floor(Date.now() / 1000);
  promoted.push({
    id: post.id,
    title: post.title,
    company: post.company,
    direction: post.direction,
    sourceUrl: post.sourceUrl,
    questions: selected.map((item) => item.question),
  });
}

if (SHOULD_WRITE) {
  await fs.writeFile(POSTS_FILE, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
}
await fs.writeFile(REPORT_FILE, `${JSON.stringify({
  mode: SHOULD_WRITE ? "write" : "dry-run",
  promotedSources: promoted.length,
  promotedQuestions: promoted.reduce((sum, item) => sum + item.questions.length, 0),
  promoted,
  skipped,
}, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  mode: SHOULD_WRITE ? "write" : "dry-run",
  promotedSources: promoted.length,
  promotedQuestions: promoted.reduce((sum, item) => sum + item.questions.length, 0),
  skippedSources: skipped.length,
  report: path.relative(ROOT, REPORT_FILE).replaceAll("\\", "/"),
  samples: promoted.slice(0, 15),
}, null, 2));
