import fs from "node:fs";

const POSTS_FILE = "data/posts.json";
const REPORT_FILE = "logs/question-bank-update-2026-07-01.json";

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[，。！？、；：“”‘’（）()[\]{}<>《》「」『』\s,.:;!?/_\\-]/g, "")
    .replace(/visionlanguageaction/g, "vla")
    .replace(/keyvaluecache/g, "kvcache")
    .trim();
}

function normalizeUrl(url) {
  const value = String(url || "");
  const xhs = value.match(/^https:\/\/www\.xiaohongshu\.com\/search_result\/([A-Za-z0-9]+)(\?.*)?$/);
  if (xhs) return `https://www.xiaohongshu.com/explore/${xhs[1]}${xhs[2] || ""}`;
  return value;
}

function existingQuestionKeys(posts) {
  const keys = new Set();
  for (const post of posts) {
    for (const question of post.questions || []) {
      const key = normalize(question);
      if (key) keys.add(key);
    }
  }
  return keys;
}

const updates = [
  {
    id: "auto-20260701-0dff93d2c054",
    questions: [
      {
        q: "字节多模态训练中，DeepSpeed ZeRO-3、张量并行和 LoRA 微调应该如何组合，分别解决什么瓶颈？",
        a: "可以先把问题拆成参数放置、单层计算和训练成本三层。ZeRO-3/FSDP 负责把参数、梯度和优化器状态分片，解决单卡显存装不下完整模型的问题；张量并行切分 attention 或 FFN 的矩阵计算，解决单层太宽、单卡算不动的问题；LoRA 则只训练低秩增量，减少可训练参数、优化器状态和通信量。多模态场景里，常见做法是冻结或半冻结视觉编码器，语言模型主体用 ZeRO/FSDP 管理，projector、adapter 或部分 LLM 层用 LoRA 训练。如果模型很大且单层矩阵也放不下，再叠加张量并行。面试里要强调组合顺序：先估算权重、梯度、优化器状态和激活值，再决定是否需要 ZeRO-3；再看单层矩阵和 batch token 是否需要张量并行；最后用 LoRA 控制微调成本和灾难性遗忘。风险是并行策略叠太多会让通信、checkpoint、恢复和性能调优复杂化。"
      },
      {
        q: "多模态 LoRA 微调时，视觉编码器、projector 和 LLM 哪些层更适合训练，如何避免语言能力退化？",
        a: "多模态 LoRA 的核心是让视觉特征进入语言空间，同时尽量少破坏原有语言能力。视觉编码器如果已经很强，通常先冻结，只训练 projector 或 cross-modal adapter；如果目标领域视觉分布差异很大，比如医学、遥感、车载或机器人视角，再考虑解冻高层视觉 block 或加视觉侧 LoRA。LLM 侧可以在 attention 的 q/v/o 或 FFN 上加 LoRA，但 rank 不宜过大，且要混入通用指令数据维持语言能力。避免退化的关键包括：保留一定比例纯文本/通用多模态数据；控制学习率和 LoRA rank；对 projector 先 warmup；监控语言 benchmark、OCR、grounding 和幻觉率；必要时用 KL 或 reference loss 约束输出分布。回答时不要只说“冻结视觉、训练 LoRA”，要说明训练哪些层取决于领域差异、数据规模和目标任务。"
      }
    ]
  },
  {
    id: "auto-20260701-c6d314c9cad9",
    questions: [
      {
        q: "多模态大模型的模态对齐为什么不能只靠图文对比学习，指令微调阶段还需要对齐什么？",
        a: "图文对比学习主要把整图和整句拉到同一语义空间，适合检索和粗粒度语义对齐，但它不能保证模型会按指令回答、能定位局部区域、能处理多轮上下文，也不能解决视觉幻觉。指令微调阶段要进一步对齐三类东西：第一是任务格式对齐，让模型知道问答、OCR、grounding、图表理解、视频问答等任务分别怎么输出；第二是粒度对齐，让局部对象、属性、数量、空间关系和文字区域能对应到语言描述；第三是行为对齐，让模型在看不清、证据不足或输入冲突时能表达不确定性，而不是编造。工程上通常混合 caption、VQA、OCR、region-level grounding、多图比较和拒答样本，并用负样本降低幻觉。面试里可以总结为：对比学习解决“看见什么大概像什么”，指令微调解决“按任务要求可靠地说什么”。"
      },
      {
        q: "VLM 出现视觉幻觉时，应该从数据、模型结构和解码三个层面分别怎么排查？",
        a: "数据层先查图文是否错配、caption 是否过度泛化、OCR/框标注是否错误、训练集中是否存在强语言先验。例如大量“厨房里有微波炉”的样本会让模型在没有微波炉时也猜出来。模型结构层检查视觉 token 是否被过度压缩，projector 是否丢了局部细节，LLM 是否过度依赖文本 prompt；对于高分辨率、计数和空间关系任务，可能需要 tile、region token 或 grounding 分支。解码层检查 temperature、top_p、重复惩罚和系统提示，过高随机性会放大幻觉；同时可以加入 evidence-first prompt，让模型先列视觉证据再回答。评估时不能只看总准确率，要拆 OCR、计数、属性、空间关系、拒答和反事实样本。一个好的回答应说明幻觉不是单点问题，而是数据先验、视觉瓶颈和语言生成倾向共同造成的。"
      }
    ]
  },
  {
    id: "auto-20260701-e98d6a62d6a7",
    questions: [
      {
        q: "小鹏 VLM/VLA 场景中，自动驾驶感知输出如何转成可被语言模型使用的场景 token？",
        a: "自动驾驶里的原始图像、点云和 BEV 特征不能直接丢给语言模型，需要先转成结构化或半结构化场景 token。常见做法是先用感知模型得到车道线、交通灯、动态目标、occupancy、可行驶区域、轨迹候选和自车状态，再通过 projector、query token 或序列化模板把这些信息编码成 LLM 可消费的 token。关键是保留时空关系：目标相对自车的位置、速度、意图，车道拓扑和交通规则约束，不能只给静态类别标签。对于 VLA，还要把候选动作或规划轨迹作为条件，让模型理解“如果我这样开，未来会发生什么”。面试里可以强调两条路线：端到端视觉 token 路线表达力强但解释性弱；结构化场景 token 路线更可控、更适合安全审计，实际系统往往混合使用。"
      },
      {
        q: "自动驾驶 VLA 如何评估闭环能力，为什么离线感知准确率不足以说明模型可用？",
        a: "离线感知准确率只说明单帧或短片段识别得准，不代表模型在自己的动作影响下仍然安全。闭环评估要让模型输出规划或控制，再把动作反馈到仿真或真实系统中，观察后续状态是否变好。关键指标包括碰撞率、接管率、交通规则违规率、舒适性、最小 TTC、路线完成率、长尾场景恢复能力和 near miss。还要做反事实评估：同一场景下不同自车动作会导致不同未来，世界模型或 VLA 必须能预测这种动作条件下的变化。离线模型可能在专家轨迹附近表现好，但一旦偏离训练分布就会误差累积。面试回答应指出：自动驾驶模型最终优化的是安全、合法、舒适和可恢复的闭环行为，而不是单独的检测 mAP 或轨迹 ADE。"
      }
    ]
  },
  {
    id: "auto-20260701-e5fd56c26393",
    questions: [
      {
        q: "快手短视频多模态理解中，如何把封面、视频帧、字幕、ASR 和互动行为构造成训练样本？",
        a: "短视频样本要同时包含内容侧和用户反馈侧。内容侧先抽封面、关键帧或 clip，提取 OCR 字幕、ASR 文本、背景音乐、标题、话题和作者信息；用户侧记录曝光、点击、完播、停留、点赞、收藏、评论、转发和负反馈。构造时用统一 video id 和时间戳对齐多模态信息，并区分强弱监督：完播、长停留和收藏通常比点击更强，负反馈和快速划走可作为负样本。难点是曝光偏置和热门偏置，所以要做位置校正、负采样、时间切分和去重，避免模型只学到流量分布。训练上可以把内容理解任务和推荐排序任务结合，既做 caption/OCR/VQA 辅助目标，也做 CTR、完播率或互动率预测。评估要看离线 AUC/NDCG、线上 A/B、冷启动、长尾覆盖和内容安全。"
      },
      {
        q: "短视频 VLM 为什么需要时序建模，单帧图文模型在推荐和审核场景会漏掉哪些信息？",
        a: "单帧图文模型只能看到局部静态证据，容易漏掉动作过程、情绪变化、剧情反转、危险行为和违规上下文。短视频推荐关心的是用户为什么停留：可能是前几秒铺垫、中间动作、结尾反转或音乐节奏；审核场景也常常需要连续帧才能判断打斗、危险操作、擦边或误导。时序建模可以通过 clip-level encoder、temporal attention、事件边界检测、关键片段检索和长视频记忆来实现。工程上通常先低成本均匀采样，再对高运动或高语义变化片段加密采样。面试里可以指出：单帧模型适合封面理解和粗分类；时序模型适合动作、因果、事件边界和跨镜头一致性。真正上线时两者会分层组合，以控制成本和延迟。"
      }
    ]
  },
  {
    id: "auto-20260701-d2452f75c025",
    questions: [
      {
        q: "小红书内容理解场景中，如何同时优化图文相关性、审美质量和安全风险识别？",
        a: "这类场景不能只做一个多分类模型，而应拆成多任务内容理解。图文相关性关注标题、正文、图片和视频是否一致，可用图文匹配、OCR/ASR 对齐和语义检索；审美质量关注清晰度、构图、主体突出、滤镜和风格，可以训练质量评分或偏好模型；安全风险识别关注违规、广告、诱导、隐私和敏感内容，需要规则、分类器和人工审核闭环。多任务训练时共享视觉/文本编码器，但不同任务用独立 head 或 adapter，避免安全任务被推荐目标稀释。数据上要注意负样本构造：图文错配、标题党、低质图、擦边和误导内容都要覆盖。上线后用召回率、误杀率、申诉率、人工复核一致性和推荐效果综合权衡。"
      }
    ]
  },
  {
    id: "auto-20260701-c48382f27e86",
    questions: [
      {
        q: "VLA 框架中，视觉、语言和动作三部分的接口应该如何设计，才能支持跨机器人泛化？",
        a: "跨机器人泛化的关键是把任务语义、环境观测和具体控制接口解耦。视觉侧输出对象、空间关系、状态变化或视觉 token；语言侧提供目标、约束和阶段性指令；动作侧不能只绑定某个机械臂的关节维度，而应尽量使用末端位姿、技能 token、归一化动作或机器人无关的 action chunk。不同机器人再通过低层控制器或 embodiment adapter 映射到具体关节。训练数据中要显式记录相机外参、机器人本体状态、控制频率和动作坐标系，否则模型会把平台差异误当成任务规律。回答时可以强调分层：高层 VLA 学任务和语义动作，低层控制器处理动力学和安全约束。这样既利于跨平台迁移，也方便在真实机器人上做限幅、碰撞检查和急停。"
      }
    ]
  },
  {
    id: "auto-20260701-5282521e72b6",
    questions: [
      {
        q: "经典 VLA 模型里，RT-1/RT-2、OpenVLA 和 Diffusion Policy 的动作生成范式有什么差异？",
        a: "RT-1 更偏机器人多任务策略学习，把视觉和语言条件映射到离散化动作 token，适合统一多个任务但受动作量化影响。RT-2 把互联网视觉语言知识迁移到机器人动作，把动作也表示成语言模型可生成的 token，优势是语义泛化更强。OpenVLA 延续视觉语言动作统一建模思路，强调开源数据和跨任务泛化。Diffusion Policy 则不是自回归 token 生成，而是对一段连续动作轨迹做去噪生成，能表达多峰、平滑的 action chunk，适合抓取、装配等连续控制任务，但推理步数和延迟更高。面试里要把“离散 token 便于复用 LLM”和“连续扩散轨迹更适合精细控制”讲清楚，并说明实际系统常用高层 token 规划加低层连续控制。"
      }
    ]
  },
  {
    id: "auto-20260701-abcc070cf71c",
    questions: [
      {
        q: "VLA 预训练数据应该包含哪些字段，为什么只保存图像和动作不够？",
        a: "VLA 预训练样本至少要包含多视角图像或视频、语言指令、机器人本体状态、末端位姿、动作命令、时间戳、相机外参、任务阶段、成功/失败标签和必要的力觉或触觉信息。只保存图像和动作会丢掉意图、坐标系和状态上下文，模型不知道这个动作是为了完成什么目标，也难以区分同一视觉状态下的不同任务。时间戳用于同步多相机和控制信号，外参用于空间对齐，本体状态用于判断可达性，成功失败标签用于学习恢复和风险。对于真实机器人数据，还要记录人工接管、异常、碰撞、超时和重试。一个成熟的数据 schema 能支持 imitation learning、失败样本挖掘、离线 RL 和仿真回放，而不是只能做简单行为克隆。"
      },
      {
        q: "VLA 模型如何处理语言指令中的歧义，比如“把它放到旁边”这种缺少明确目标的命令？",
        a: "这类指令的难点在于代词、参照物和空间关系都不完整。系统应先做语义解析和上下文补全：结合历史对话、当前视觉场景、用户注视或最近操作，推断“它”指哪个对象，“旁边”相对哪个参照物。若存在多个高概率解释，不能强行动作，应触发澄清问题或给出候选确认。模型侧可以输出不确定性、候选目标和理由，再由安全策略决定是否执行。训练数据中要加入歧义指令、澄清对话和错误执行负例，让模型学会“看不确定时先问”。面试回答可以总结为：语言理解不是直接映射动作，而是先把指令落到可验证的场景符号和目标状态，再规划动作。"
      }
    ]
  },
  {
    id: "auto-20260701-d9a26fddfea4",
    questions: [
      {
        q: "文档多模态大模型中，版面结构、OCR 文本和视觉区域如何联合建模？",
        a: "文档理解不能把 OCR 文本当普通纯文本，因为表格、标题、段落、脚注和图像区域的空间位置很关键。常见做法是同时输入 OCR token、bbox 坐标、页面图像特征和版面结构标签，用 Layout-aware Transformer、视觉 token 加文本 token 或区域级 cross-attention 建模。bbox 提供阅读顺序和二维空间关系，视觉特征补充字体、表格线、图标和扫描噪声，文本特征负责语义。对于多页文档，还需要页面级索引和跨页检索。训练任务可以包括字段抽取、表格解析、文档 VQA、阅读顺序恢复和版面分类。面试中要强调：文档多模态的核心不是 OCR 后喂给 LLM，而是保留“文字在哪里”和“版面如何组织”。"
      }
    ]
  },
  {
    id: "auto-20260701-31d4047ea35e",
    questions: [
      {
        q: "InternVL 这类 VLM 为什么常用高分辨率切图和动态 tile，代价是什么？",
        a: "高分辨率切图是为了保留小目标、文字、图表和局部属性。若直接把整图缩到固定分辨率，OCR、计数和细粒度识别会损失严重；动态 tile 会根据图像长宽比和分辨率把图片切成多个局部块，再加全局缩略图，让模型同时看到整体和细节。代价是视觉 token 数量增加，导致 encoder 计算、LLM 上下文、显存和首 token 延迟上升。工程上需要限制最大 tile 数、做 token 压缩、缓存视觉特征，并按任务动态选择分辨率：普通问答低 tile，OCR/图表/小目标高 tile。面试里可以把它归纳为“用计算换细节”，关键是按任务自适应，而不是所有图片都开最高分辨率。"
      }
    ]
  },
  {
    id: "auto-20260701-3da793573222",
    questions: [
      {
        q: "多模态预训练数据集从原始网页和视频到可训练样本，一般要经过哪些清洗和过滤步骤？",
        a: "流程通常包括采集、解析、去重、质量过滤、对齐过滤、安全过滤和格式化。图文网页先抽取图片、alt、标题、正文和上下文，再去掉低清、二维码、水印、广告和重复图；视频数据要切片、抽帧、ASR、OCR 和字幕对齐。对齐过滤会用 CLIP/SigLIP 相似度、OCR 一致性或人工规则判断文本是否真正描述图像/片段。安全过滤用于去除隐私、违规、版权风险和低质内容。之后按任务生成 caption、VQA、grounding、OCR、图表理解、多图比较等样本，并记录来源、时间、许可证和质量分。最后要做训练/验证/测试时间切分和近重复检测，防止评测泄漏。好的回答要体现数据工程比模型结构同样重要。"
      }
    ]
  },
  {
    id: "auto-20260701-bf5621b9d675",
    questions: [
      {
        q: "模型部署时，vLLM 的 PagedAttention、prefix cache 和 continuous batching 分别解决什么问题？",
        a: "PagedAttention 解决 KV cache 显存碎片和预留浪费，把不同请求的 KV 切成块管理，逻辑连续但物理可离散分配；prefix cache 解决重复前缀的重复计算问题，比如系统提示词、长文档前缀或多轮对话公共上下文可以复用已算好的 KV；continuous batching 解决静态 batch 等待和 GPU 利用率低的问题，让新请求在生成过程中动态加入批次，完成的请求及时释放资源。三者都提升吞吐，但影响点不同：PagedAttention偏显存管理，prefix cache偏复用计算，continuous batching偏调度效率。上线评估要同时看 TTFT、TPOT、吞吐、显存水位、P99 延迟和公平性，不能只看平均 tokens/s。"
      }
    ]
  },
  {
    id: "auto-20260701-79bb859b5eef",
    questions: [
      {
        q: "分布式训练中，如何判断瓶颈是在计算、显存、通信还是数据加载？",
        a: "判断瓶颈要看 profiler 和系统指标，而不是凭感觉。计算瓶颈表现为 GPU SM 利用率高但 step time 长，算子占比集中在 matmul/attention；显存瓶颈表现为 OOM、频繁重算或 batch 上不去；通信瓶颈表现为 all-reduce/all-gather/all-to-all 时间占比高，GPU 等通信，跨节点扩展效率差；数据加载瓶颈表现为 GPU 利用率周期性掉到低位，CPU、磁盘或网络读取成为等待点。排查顺序通常是先固定 batch 和序列长度，记录 step time 分解，再分别开启/关闭 checkpointing、调整并行度、换数据缓存、看通信 trace。优化手段包括 FlashAttention、算子融合、ZeRO/FSDP、张量并行、通信重叠、数据预取和样本 packing。面试里最好能给出“指标-现象-手段”的闭环。"
      }
    ]
  },
  {
    id: "auto-20260701-cc8e6566face",
    questions: [
      {
        q: "SFT 微调中，packing、多轮对话 mask 和 loss 只算 assistant token 分别有什么作用？",
        a: "Packing 是把多条短样本拼到同一固定长度序列里，提高 token 利用率，减少 padding；但必须用 attention mask 或 sample boundary 防止不同样本互相看见。多轮对话 mask 用来保留 system、user、assistant 的角色结构，让模型理解上下文轮次。loss 只算 assistant token 是因为训练目标是让模型学会回答，而不是预测用户问题或系统提示词；如果把 user token 也计入 loss，模型可能学习复述输入，降低指令跟随质量。实践中还要处理 EOS、模板一致性、超长截断和多样本拼接后的 position id。面试里可以强调：SFT 数据格式错误会直接表现为模型啰嗦、角色混乱、重复用户问题或无法正确停止。"
      }
    ]
  },
  {
    id: "auto-20260701-1b8c4b115791",
    questions: [
      {
        q: "大模型训练出现 loss spike 时，应该如何区分是数据异常、数值不稳定还是通信/并行问题？",
        a: "先看 spike 是否可复现。如果固定随机种子和同一 batch 可复现，优先检查数据：异常长样本、乱码、错误标签、重复模板或损坏图片。如果不可复现且伴随 NaN/Inf，重点查数值稳定性：学习率过高、梯度裁剪缺失、FP16 溢出、归一化异常或 attention mask 错误。如果 spike 只在多机多卡出现，单卡或少卡正常，就要查通信和并行：梯度同步、参数分片恢复、pipeline micro-batch 边界、MoE 路由负载和 checkpoint 恢复。排查手段包括记录样本 id、梯度范数、激活统计、loss scale、每层参数范数和通信 trace。处理上可以数据隔离、降低学习率、启用 BF16、梯度裁剪、跳过坏 batch 或修复并行配置。"
      }
    ]
  },
  {
    id: "auto-20260701-a5256313dfd8",
    questions: [
      {
        q: "训练稳定性里，学习率 warmup、梯度裁剪、weight decay 和 EMA 分别解决什么问题？",
        a: "Warmup 让训练初期从较小学习率逐步升高，避免随机初始化或新任务微调阶段梯度剧烈震荡；梯度裁剪限制梯度范数，防止偶发异常 batch 或长序列导致参数一步更新过大；weight decay 抑制权重过大，提高泛化，AdamW 中通常与梯度更新解耦；EMA 对参数做滑动平均，能降低训练噪声，常用于视觉或扩散模型，LLM 中使用要看成本和收益。它们解决的问题不同：warmup 管启动，裁剪管极端梯度，weight decay 管复杂度，EMA 管评估稳定。面试里要补一句：这些手段不能替代数据清洗和数值监控，如果 mask、标签或混合精度配置错了，再多稳定技巧也只是掩盖问题。"
      }
    ]
  },
  {
    id: "auto-20260701-5c345833fbcf",
    questions: [
      {
        q: "多模态大模型通常由视觉编码器、连接层和语言模型组成，各部分训练目标如何分阶段设计？",
        a: "第一阶段通常做视觉-语言对齐，冻结或半冻结视觉编码器和 LLM，训练 projector/Q-Former，让视觉 token 映射到语言模型可理解的空间，目标可以是 caption 或图文匹配。第二阶段做多模态指令微调，混合 VQA、OCR、grounding、图表、多图和视频任务，让模型学会按指令使用视觉证据。第三阶段可做偏好对齐或安全对齐，降低幻觉、格式错误和不当回答。若领域差异大，可以在视觉侧或 LLM 高层加入 LoRA 继续适配。面试里要说明分阶段的原因：直接端到端全量训练成本高且不稳定，先对齐再指令微调能降低训练难度，同时保留语言模型原有能力。"
      }
    ]
  },
  {
    id: "manual-20260701-kuaishou-video-vlm",
    questions: [
      {
        q: "视频理解模型如何区分“动作发生过”和“动作正在发生”，数据标注和模型结构上分别要注意什么？",
        a: "这需要显式建模时间边界和状态。数据标注上不能只给视频级标签，而要标出动作开始、持续、结束以及动作后的状态，例如“拿起杯子”发生过后杯子位置会变化，“正在拿起”则处于运动过程。模型结构上要保留帧序和局部运动特征，可以用 clip-level encoder、temporal attention、光流或轨迹特征，并在输出中区分事件检测、动作分类和状态判断。训练时可以加入正负时间片段：动作前、动作中、动作后都要有样本，避免模型只靠物体共现判断。评估上看 temporal IoU、边界误差和状态问答准确率。面试中要强调，视频理解的关键不是“看见物体”，而是理解状态随时间如何变化。"
      }
    ]
  }
];

const posts = JSON.parse(fs.readFileSync(POSTS_FILE, "utf8"));
const used = existingQuestionKeys(posts);
const nowIso = new Date().toISOString();
const nowSeconds = Math.floor(Date.now() / 1000);
const added = [];
const missing = [];
const skipped = [];

for (const update of updates) {
  const post = posts.find((item) => item.id === update.id);
  if (!post) {
    missing.push(update.id);
    continue;
  }
  post.sourceUrl = normalizeUrl(post.sourceUrl);
  post.questions = Array.isArray(post.questions) ? post.questions : [];
  post.questionAnswers = Array.isArray(post.questionAnswers) ? post.questionAnswers : [];
  for (const item of update.questions) {
    const key = normalize(item.q);
    if (!key || used.has(key)) {
      skipped.push({ id: update.id, question: item.q, reason: "duplicate" });
      continue;
    }
    post.questions.push(item.q);
    post.questionAnswers.push({
      question: item.q,
      answer: item.a,
      answerStatus: "model_answered",
      answeredAt: nowIso,
      source: "question-bank-update-2026-07-01"
    });
    used.add(key);
    added.push({
      id: update.id,
      title: post.title,
      company: post.company || "",
      direction: post.direction || "",
      sourcePlatform: post.sourcePlatform || "",
      sourceUrl: post.sourceUrl || "",
      question: item.q
    });
  }
  post.reviewStatus = "question_ready";
  post.updatedAt = nowSeconds;
}

fs.writeFileSync(POSTS_FILE, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
fs.mkdirSync("logs", { recursive: true });
fs.writeFileSync(REPORT_FILE, `${JSON.stringify({
  generatedAt: nowIso,
  addedQuestions: added.length,
  missingPosts: missing,
  skippedQuestions: skipped.length,
  added
}, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  addedQuestions: added.length,
  missingPosts: missing.length,
  skippedQuestions: skipped.length,
  report: REPORT_FILE
}, null, 2));
