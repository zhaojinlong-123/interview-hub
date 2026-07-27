import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POSTS_FILE = path.join(ROOT, "data", "posts.json");
const LOG_FILE = path.join(ROOT, "logs", "question-bank-supplement-2026-07-08.json");
const NOW = Math.floor(Date.now() / 1000);
const ANSWERED_AT = new Date().toISOString();

function hash(text) {
  return crypto.createHash("sha1").update(text).digest("hex").slice(0, 12);
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[，。！？、；：“”‘’（）()[\]{}<>《》/\\\-_:,.!?;\s]/g, "")
    .replace(/visionlanguageaction/g, "vla")
    .replace(/keyvaluecache/g, "kvcache")
    .trim();
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

function makePost(item) {
  const question = item.question.trim();
  const id = `supplement-20260708-${hash(`${item.sourcePlatform}|${item.sourceUrl}|${question}`)}`;
  return {
    id,
    title: item.title,
    company: item.company,
    role: item.role || "大模型相关岗位",
    direction: item.direction,
    domain: item.domain,
    category: item.category,
    sourcePlatform: item.sourcePlatform,
    sourceDate: "2026-07-08",
    sourceUrl: item.sourceUrl,
    tags: item.tags,
    questions: [question],
    type: "interview",
    difficulty: item.difficulty || "中等",
    content: `2026-07-08 检索补充来源：${item.sourcePlatform}《${item.sourceTitle}》。面试题目：${question}`,
    prepTips: "",
    createdAt: NOW,
    updatedAt: NOW,
    reviewStatus: "question_ready",
    questionAnswers: [
      {
        question,
        answer: item.answer.trim(),
        answerStatus: "model_answered",
        answeredAt: ANSWERED_AT,
        source: "question-bank-supplement-2026-07-08",
      },
    ],
  };
}

const supplements = [
  {
    title: "百度多模态算法面经：图文对齐失败排查",
    sourceTitle: "百度｜多模态算法实习生｜未知",
    company: "百度",
    direction: "多模态大模型",
    domain: "图文对齐 / 负样本 / 评估",
    category: "多模态大模型",
    sourcePlatform: "牛客",
    sourceUrl: "https://www.nowcoder.com/discuss/878600528970735616",
    tags: ["百度", "多模态", "图文对齐", "负样本", "评估"],
    question: "图文对齐训练后检索效果提升但视觉问答仍出错，应该如何从数据、连接层和评估集定位问题？",
    answer: "这类问题要先区分“全局语义对齐好”和“局部视觉证据可用”不是一回事。图文对比学习通常让整图和整句靠近，能提升检索，但未必学会计数、空间关系、OCR 和局部属性。数据侧先检查图文是否弱相关、caption 是否只描述主体而忽略细节、负样本是否太简单；可以加入 hard negative，例如同类物体、相似颜色、相似布局但答案不同的样本。连接层侧看视觉 token 是否被过度压缩，projector 或 Q-Former 是否丢掉小目标和文本区域，必要时保留高分辨率 tile 或区域 token。评估侧要拆成检索、VQA、OCR、grounding、计数、空间关系几套集，避免只用检索指标掩盖问答短板。工程上还应抽样可视化 attention 或证据区域，确认模型回答时真的看到了相关区域，而不是靠语言先验猜答案。",
  },
  {
    title: "字节多模态一面：动态分辨率与 tile 取舍",
    sourceTitle: "【清华代码熊】字节面试官：多模态大模型动态分辨率原理？",
    company: "字节",
    direction: "多模态大模型",
    domain: "动态分辨率 / 高分辨率图像 / token 预算",
    category: "多模态大模型",
    sourcePlatform: "知乎",
    sourceUrl: "https://zhuanlan.zhihu.com/p/2014314780802967473",
    tags: ["字节", "动态分辨率", "tile", "VLM", "OCR"],
    question: "动态分辨率 VLM 如何在 OCR、细粒度识别和推理成本之间分配视觉 token？",
    answer: "动态分辨率的核心是按任务和图像内容决定视觉 token 预算，而不是所有图片统一 resize 到固定尺寸。对普通场景理解，低分辨率全图 token 足够保留主体和布局；对 OCR、表格、小目标、遥感或界面截图，需要局部高分辨率 tile 保留细节。常见做法是全局低分辨率图提供上下文，再对高信息密度区域切 tile，并给 tile 加位置编码，避免模型不知道局部来自哪里。成本上，tile 数越多，LLM prefill 越长，显存和首 token 延迟都会上升，所以要限制最大 tile 数、合并低价值 patch，或用 resampler 压缩。训练时要混合不同分辨率和任务，防止模型只适应某种 token 布局。评估时不能只看通用 VQA，要单独看 OCR 准确率、局部属性、空间关系和延迟曲线。",
  },
  {
    title: "字节抖音电商多模态面经：商品图文理解",
    sourceTitle: "字节跳动抖音电商多模态大模型面经",
    company: "字节",
    direction: "多模态大模型",
    domain: "电商图文理解 / 商品属性 / 召回排序",
    category: "多模态大模型",
    sourcePlatform: "牛客",
    sourceUrl: "https://www.nowcoder.com/feed/main/detail/824e9694564848f7a56bc9131ff2ceec",
    tags: ["字节", "电商", "多模态", "商品理解", "检索"],
    question: "电商多模态模型如何同时建模商品图片、标题、属性和用户行为，避免只学到热门偏置？",
    answer: "电商多模态建模通常分两层：先用图片、标题、类目、属性、OCR 和详情文本学习商品表征，再把点击、收藏、加购、成交、停留时长等用户行为作为监督信号用于召回或排序。为了避免热门偏置，训练时不能只把点击当正样本，因为曝光越多的商品天然点击多；需要加入曝光日志做反事实校正，按位置、流量入口、价格段和类目分桶采样。图片侧要保留款式、颜色、材质、logo、场景等细粒度属性，文本侧要清洗营销噪声和属性缺失。负样本应包含同类相似商品、相同标题不同图片、相同图片不同属性等 hard negative。评估要分整体指标和长尾指标，看 NDCG、Recall、属性一致性、跨模态检索准确率，以及新品和低曝光商品的泛化效果。",
  },
  {
    title: "阿里淘天多模态面经：商品理解数据构造",
    sourceTitle: "阿里淘天多模态大模型面经分享",
    company: "阿里",
    direction: "多模态大模型",
    domain: "电商数据 / 指令微调 / 质量分层",
    category: "多模态大模型",
    sourcePlatform: "CSDN",
    sourceUrl: "https://blog.csdn.net/2201_75499313/article/details/146128971?ops_request_misc=&request_id=&biz_id=102",
    tags: ["阿里", "淘天", "电商", "多模态数据", "SFT"],
    question: "电商场景的多模态指令数据如何构造，才能覆盖商品属性、图文一致性和用户意图？",
    answer: "电商多模态指令数据要围绕真实业务任务构造，而不是只做通用看图说话。样本可以分为商品属性抽取、图文一致性判断、卖点生成、相似商品比较、搭配推荐、违规内容识别和用户问题回答。每条数据最好绑定图片区域、标题、类目、属性表、OCR、评论或问答上下文，避免答案只来自文本泄漏。质量分层很关键：高质量人工标注和专家规则样本用于核心能力，弱标注和合成样本用于覆盖长尾，但要经过图文匹配、属性一致性和敏感内容过滤。用户意图侧要覆盖搜索、购买决策、售后咨询和风格偏好。评估时按类目、价格段、图像质量和长尾属性分桶，检查模型是否能在图像证据不足时表达不确定，而不是编造属性。",
  },
  {
    title: "阿里云多模态三面：VLM 训练阶段拆解",
    sourceTitle: "阿里云智能多模态大模型岗三面面经",
    company: "阿里",
    direction: "多模态大模型",
    domain: "预训练 / 指令微调 / 偏好对齐",
    category: "多模态大模型",
    sourcePlatform: "CSDN",
    sourceUrl: "https://blog.csdn.net/2401_85592132/article/details/151260542?ops_request_misc=&request_id=&biz_id=102",
    tags: ["阿里云", "VLM", "预训练", "指令微调", "偏好对齐"],
    question: "VLM 从图文预训练到指令微调再到偏好对齐，各阶段分别解决什么问题？",
    answer: "图文预训练主要解决视觉表征和语言语义的基础对齐，让模型知道图像内容如何映射到文本空间，常用 caption、图文对比、图文匹配或生成式目标。指令微调让模型学会按用户问题完成任务，例如 OCR、VQA、grounding、多图比较、视频问答和拒答；它强调任务格式、证据使用和多轮交互。偏好对齐进一步优化回答风格、安全边界、幻觉控制和人类偏好，例如回答更简洁、引用证据、不确定时不乱猜。三个阶段的数据质量侧重点不同：预训练看规模和覆盖，指令微调看任务多样性和答案可靠性，偏好对齐看偏好对是否能真实反映好坏。不能跳过前两阶段直接做偏好，否则模型可能只是语言风格更像答案，但视觉证据利用不足。",
  },
  {
    title: "Qwen-VL 面经：视觉 token 接入 LLM",
    sourceTitle: "【AIGC面试面经第七期】多模态大模型Qwen",
    company: "Qwen",
    direction: "多模态大模型",
    domain: "Qwen-VL / projector / 视觉语言对齐",
    category: "多模态大模型",
    sourcePlatform: "CSDN",
    sourceUrl: "https://blog.csdn.net/weixin_31588979/article/details/160087360?ops_request_misc=elastic_search_misc&request_id=ff52808e4efd88c878d62081f2bac53b&biz_id=0",
    tags: ["Qwen", "Qwen-VL", "视觉token", "projector", "VLM"],
    question: "Qwen-VL 类模型把图像接入 LLM 时，为什么需要控制视觉 token 数量和位置编码？",
    answer: "图像经过视觉 encoder 后会产生大量 patch token，如果直接全部送入 LLM，prefill 成本、显存和注意力计算都会快速上升。因此 Qwen-VL 类模型需要通过 resize、动态分辨率、tile、pooling、resampler 或 projector 控制视觉 token 数量。位置编码同样重要，因为模型不仅要知道“有什么”，还要知道“在哪里”；高分辨率切图后更要保留 tile 的全局位置，否则局部 token 会失去空间参照。token 太少会损失 OCR、小目标和空间关系，token 太多会拖慢推理并挤占文本上下文。工程上通常使用全局图加局部 tile、多尺度位置编码和任务相关压缩。训练时要让模型见过不同分辨率、不同 tile 数和不同图文排列，否则部署时动态输入会造成分布偏移。",
  },
  {
    title: "美团 MobileVLM 面经：端侧多模态压缩",
    sourceTitle: "骁龙888实时运行，美团、浙大等打造全流程移动端多模态大模型MobileVLM",
    company: "美团",
    direction: "多模态大模型",
    domain: "端侧部署 / MobileVLM / 视觉压缩",
    category: "推理部署",
    sourcePlatform: "掘金",
    sourceUrl: "https://juejin.cn/post/7319663384097275942?searchId=202607082139168DD081ACD59893DC5ABE",
    tags: ["美团", "MobileVLM", "端侧部署", "量化", "视觉压缩"],
    question: "端侧 MobileVLM 如何在低算力设备上兼顾视觉理解效果、内存占用和响应延迟？",
    answer: "端侧 MobileVLM 的关键是把视觉和语言两部分都做轻量化。视觉侧可以使用更小的 encoder、低分辨率输入、局部重要区域裁剪和 token 压缩，避免把大量 patch token 送进 LLM。语言侧需要选择小参数模型，并配合 INT8/INT4 量化、KV cache 管理、算子融合和推理引擎优化。为了不明显损失效果，训练时通常用大模型蒸馏小模型，把大 VLM 的答案、推理过程或中间视觉语义迁移到端侧模型；同时保留 OCR、小目标等 hard case 的高质量样本。部署时要分阶段测量图像预处理、vision encoder、prefill、decode 的延迟，不能只看总耗时。实际产品还会设置任务分级：简单识别本地完成，复杂推理转云端或降级处理。",
  },
  {
    title: "高德地图多模态面经：地图场景理解",
    sourceTitle: "高德地图 多模态大模型算法工程师面试题精选",
    company: "高德",
    direction: "多模态大模型",
    domain: "地图场景 / POI / 空间语义",
    category: "多模态大模型",
    sourcePlatform: "CSDN",
    sourceUrl: "https://blog.csdn.net/zhhhhh15/article/details/159165484?ops_request_misc=elastic_search_misc&request_id=39fc56fafca06eb78803620f58d7bbcf&biz_id=0",
    tags: ["高德", "地图", "多模态", "空间关系", "POI"],
    question: "地图类多模态模型如何融合道路图像、POI 文本、轨迹和地理空间关系？",
    answer: "地图场景的多模态建模不能只看单张图片，还要把地理位置和拓扑关系纳入表示。道路图像提供车道线、路牌、建筑和环境线索；POI 文本提供名称、品类和营业信息；轨迹反映真实通行模式；路网拓扑提供连接关系、转向限制和距离。模型可以把视觉特征、文本特征和地理网格或道路节点 embedding 对齐到统一空间，再通过图神经网络或 cross-attention 融合邻近区域信息。训练任务包括 POI 匹配、路牌识别、地点问答、轨迹目的地预测和异常道路发现。评估时要按城市、道路等级、昼夜天气和新开道路分桶，重点检查空间关系和时效性。隐私上要避免暴露个人轨迹，通常使用聚合特征和脱敏采样。",
  },
  {
    title: "快手多模态面经：短视频样本构造",
    sourceTitle: "快手实习 多模态算法一面分享",
    company: "快手",
    direction: "视频理解",
    domain: "短视频理解 / ASR / OCR / 用户反馈",
    category: "视频 / 视觉理解",
    sourcePlatform: "牛客",
    sourceUrl: "https://www.nowcoder.com/feed/main/detail/b8573c3fe8e14f63aab2ff63c5359924",
    tags: ["快手", "短视频", "视频理解", "ASR", "OCR"],
    question: "短视频理解模型如何把封面、视频帧、OCR、ASR 和用户反馈构造成训练样本？",
    answer: "短视频样本要同时保留内容证据和行为反馈。封面提供静态主题，视频帧提供动作和场景变化，OCR 捕捉画面文字，ASR/字幕提供语音语义，用户点击、完播、点赞、评论和负反馈提供偏好监督。构造时先按镜头或时间窗口抽帧，并把 OCR/ASR 对齐到时间段；再生成视频级摘要、事件标签、实体标签和风险标签。用户行为不能直接当内容标签，因为受曝光位置和人群偏好影响，需要做去偏采样或作为排序目标而非纯语义目标。训练上可以先做内容理解预训练，再做多任务学习：分类、检索、问答、审核和推荐预估。评估要分内容准确性、时序理解、冷启动视频、长尾类目和线上指标，避免模型只学热门模板。",
  },
  {
    title: "字节大模型面经：DeepSpeed、LoRA、RLHF 取舍",
    sourceTitle: "【26届校招】字节多模态大模型面经：一文掌握DeepSpeed、LoRA、RLHF等核心技术！",
    company: "字节",
    direction: "训练框架",
    domain: "DeepSpeed / LoRA / RLHF",
    category: "训练框架",
    sourcePlatform: "CSDN",
    sourceUrl: "https://blog.csdn.net/libaiup/article/details/152087779?ops_request_misc=elastic_search_misc&request_id=ff52808e4efd88c878d62081f2bac53b&biz_id=0",
    tags: ["字节", "DeepSpeed", "LoRA", "RLHF", "训练框架"],
    question: "DeepSpeed、LoRA 和 RLHF 分别解决训练流程中的什么问题，为什么不能放在同一层面比较？",
    answer: "DeepSpeed 是训练系统层工具，主要解决大模型训练的显存、并行和吞吐问题，例如 ZeRO 切分优化器状态、梯度和参数，配合数据并行、流水并行和 offload。LoRA 是参数高效微调方法，解决下游适配成本高的问题，通过训练低秩增量矩阵减少显存和存储，同时便于多任务维护 adapter。RLHF 是对齐训练流程，解决模型输出是否符合人类偏好、安全和任务目标的问题，通常包含偏好数据、奖励模型和策略优化。三者不在同一层面：DeepSpeed 管“怎么训得动”，LoRA 管“用多少参数适配”，RLHF 管“优化什么行为”。实际项目可以组合使用，例如用 DeepSpeed/FSDP 训练基座，用 LoRA 做业务微调，再用 DPO/GRPO/RLHF 做偏好对齐。",
  },
  {
    title: "模型部署面经：Prefill 与 Decode 拆解",
    sourceTitle: "大模型最新面试题系列：模型部署（一）",
    company: "综合",
    direction: "推理部署",
    domain: "prefill / decode / TTFT / TPOT",
    category: "推理优化 / 模型压缩",
    sourcePlatform: "CSDN",
    sourceUrl: "https://blog.csdn.net/zhangzhentiyes/article/details/146966643?ops_request_misc=elastic_search_misc&request_id=39fc56fafca06eb78803620f58d7bbcf&biz_id=",
    tags: ["部署", "prefill", "decode", "TTFT", "TPOT"],
    question: "大模型线上推理为什么要把 prefill 和 decode 分开优化，二者瓶颈分别是什么？",
    answer: "Prefill 阶段处理整段输入上下文，主要瓶颈是大矩阵计算、注意力计算和输入 token 长度，因此影响首 token 延迟 TTFT。Decode 阶段每次生成一个或少量 token，主要瓶颈是 KV cache 读写、batch 调度和小矩阵计算效率，因此影响 TPOT 和吞吐。二者优化策略不同：prefill 适合 chunked prefill、prefix cache、输入长度控制和高效 attention；decode 适合 continuous batching、PagedAttention、KV cache 压缩、speculative decoding 和更好的调度。线上系统还要区分长输入短输出、短输入长输出、多轮对话和批量离线任务。只看总延迟容易误判瓶颈，必须分别监控 TTFT、TPOT、tokens/s、显存水位和队列等待。",
  },
  {
    title: "训练稳定性面经：loss spike 定位",
    sourceTitle: "大模型最新面试题系列：训练篇之训练稳定性",
    company: "综合",
    direction: "训练框架",
    domain: "loss spike / 混合精度 / 数据异常",
    category: "训练框架",
    sourcePlatform: "CSDN",
    sourceUrl: "https://blog.csdn.net/zhangzhentiyes/article/details/145885374?ops_request_misc=elastic_search_misc&request_id=39fc56fafca06eb78803620f58d7bbcf&biz_id=",
    tags: ["训练稳定性", "loss spike", "混合精度", "数据异常", "梯度"],
    question: "大模型训练中出现 loss spike 时，如何区分数据异常、数值不稳定和并行通信问题？",
    answer: "定位 loss spike 要先保留触发 step 的 batch、随机种子、学习率、梯度范数、loss scale、激活统计和通信日志。数据异常通常表现为特定样本或数据源重复触发，可能有乱码、超长文本、错误标签、异常图像或污染样本；复现同一 batch 可以验证。数值不稳定常伴随梯度范数暴涨、NaN/Inf、loss scale 频繁下降，和学习率过高、FP16 溢出、归一化异常或初始化有关；可用 BF16、梯度裁剪、warmup、降低 LR 排查。并行通信问题可能表现为某些 rank loss 不一致、梯度同步异常、hang 或参数漂移，需要检查 all-reduce、ZeRO/FSDP 状态、数据切分和 checkpoint 恢复。稳妥流程是先单卡/小并行复现，再扩大到原并行配置，逐层排除。",
  },
  {
    title: "分布式训练面经：ZeRO 与并行策略选择",
    sourceTitle: "大模型最新面试题系列：训练篇之分布式训练",
    company: "综合",
    direction: "训练框架",
    domain: "ZeRO / TP / PP / DP",
    category: "训练框架",
    sourcePlatform: "CSDN",
    sourceUrl: "https://blog.csdn.net/zhangzhentiyes/article/details/145909490?ops_request_misc=elastic_search_misc&request_id=39fc56fafca06eb78803620f58d7bbcf&biz_id=",
    tags: ["分布式训练", "ZeRO", "张量并行", "流水并行", "数据并行"],
    question: "显存不够训练大模型时，ZeRO、张量并行、流水并行和数据并行应该如何组合？",
    answer: "选择并行策略要看瓶颈来自整模型状态、单层矩阵、模型深度还是 batch 吞吐。数据并行复制完整模型，只切 batch，简单但每卡仍保存完整参数和优化器状态。ZeRO/FSDP 进一步切分优化器状态、梯度和参数，适合解决全局状态显存过大。张量并行切单层大矩阵，适合单层参数或激活太大放不下，但需要高带宽通信。流水并行按层切模型，适合模型很深，代价是 pipeline bubble，需要 micro-batch 填充。实际训练常用数据并行 + ZeRO/FSDP 做基础，再对超大模型叠加张量并行和流水并行。调参时要同时看显存余量、通信占比、GPU 利用率、bubble 比例和全局 batch 是否影响收敛。",
  },
  {
    title: "自动驾驶多模态面经：世界模型闭环",
    sourceTitle: "春招必看！自动驾驶多模态大模型算法岗面经 + 薪资全解析",
    company: "综合",
    direction: "自动驾驶数据 / 世界模型",
    domain: "BEV / occupancy / 闭环仿真",
    category: "自动驾驶 / 数据闭环",
    sourcePlatform: "CSDN",
    sourceUrl: "https://blog.csdn.net/kaka0722ww/article/details/160022527?ops_request_misc=&request_id=&biz_id=102",
    tags: ["自动驾驶", "世界模型", "BEV", "occupancy", "闭环仿真"],
    question: "自动驾驶世界模型如何把 BEV、occupancy、轨迹预测和闭环仿真连接起来？",
    answer: "自动驾驶世界模型的目标不是只做感知，而是学习“当前状态加候选动作会导致什么未来”。BEV 提供统一鸟瞰坐标，把相机、雷达、地图和历史轨迹对齐到可规划空间；occupancy 描述静态和动态空间占用，尤其适合表达可见和不可见区域；轨迹预测建模其他交通参与者未来运动；闭环仿真则把自车规划动作放回环境中，评估交互结果。训练时可以联合未来 occupancy、轨迹、碰撞风险、交通规则和规划代价，让模型理解动态演化。难点在于闭环误差会累积，仿真参与者反应要合理，长尾场景要覆盖。评估不能只看离线 mAP 或 ADE/FDE，还要看闭环碰撞率、接管率、规则违反、舒适性和场景覆盖。",
  },
  {
    title: "自动驾驶数据闭环面经：长尾样本回流",
    sourceTitle: "春招必收藏！自动驾驶多模态大模型算法岗真实面经+薪资全揭秘",
    company: "综合",
    direction: "自动驾驶数据 / 世界模型",
    domain: "长尾场景 / 自动标注 / 数据闭环",
    category: "自动驾驶 / 数据闭环",
    sourcePlatform: "CSDN",
    sourceUrl: "https://blog.csdn.net/weixin_59191169/article/details/159648229?ops_request_misc=elastic_search_misc&request_id=ff52808e4efd88c878d62081f2bac53b&biz_id=0",
    tags: ["自动驾驶", "数据闭环", "长尾场景", "自动标注", "仿真评测"],
    question: "自动驾驶数据闭环中，如何识别并回流 corner case、near miss 和接管片段？",
    answer: "数据闭环先要定义触发信号：接管、急刹、碰撞风险、规划不连续、感知低置信、规则冲突、预测误差大、用户投诉和仿真失败都可以作为候选。corner case 强调罕见或分布外，near miss 强调差点出事故但未发生，接管片段则有人类安全员介入。回流流程通常是自动挖掘候选、去重聚类、自动预标注、人工复核、质量验收、训练重采样和仿真回归。关键是避免只回流“看起来吓人”的片段，而忽略模型真正失败的原因；需要把失败归因到感知、预测、规划、控制或地图。评估时要看新数据是否提升目标场景通过率，同时不降低普通场景表现。隐私和合规上要做车牌、人脸和位置脱敏。",
  },
  {
    title: "腾讯大模型面经：推理服务稳定性",
    sourceTitle: "腾讯大模型算法日常实习面经",
    company: "腾讯",
    direction: "推理部署",
    domain: "服务稳定性 / 队列调度 / 降级",
    category: "推理优化 / 模型压缩",
    sourcePlatform: "知乎",
    sourceUrl: "https://zhuanlan.zhihu.com/p/1997087164006155782",
    tags: ["腾讯", "推理部署", "稳定性", "调度", "降级"],
    question: "大模型推理服务如何在高并发下同时保证吞吐、延迟和稳定性？",
    answer: "高并发推理服务要把请求准入、队列调度、显存管理和降级策略一起设计。吞吐依赖 batching、continuous batching、PagedAttention 和高 GPU 利用率；延迟依赖输入长度控制、prefill/decode 分离、优先级队列和超时机制；稳定性依赖显存水位保护、OOM 前拒绝新请求、异常重试、模型副本隔离和灰度发布。调度时要避免长上下文请求拖垮短请求，可以按输入长度、业务优先级和输出预算分队列。KV cache 是显存核心变量，需要监控每个请求的 token 数和剩余生成长度。线上还要有降级路径，例如切小模型、缩短上下文、关闭复杂工具、限制最大输出。指标上同时看 TTFT、TPOT、P95/P99、tokens/s、失败率和队列等待。",
  },
  {
    title: "美团大模型面经：评测指标与业务指标",
    sourceTitle: "算法面经：美团大模型日常实习",
    company: "美团",
    direction: "多模态大模型",
    domain: "离线评测 / 业务指标 / 误差分析",
    category: "多模态大模型",
    sourcePlatform: "知乎",
    sourceUrl: "https://zhuanlan.zhihu.com/p/2000170723654779295",
    tags: ["美团", "评测", "业务指标", "误差分析", "多模态"],
    question: "多模态模型上线前，如何把离线能力评测和业务指标关联起来？",
    answer: "离线评测要先按业务任务拆能力，例如图文检索、OCR、商品属性、视频分类、风险识别、问答正确率和幻觉率。每个能力都要有代表性测试集，并按场景、类目、长尾、低质图片和高风险样本分桶。业务指标则可能是点击率、转化率、审核召回、误杀率、客服解决率或用户停留。关联二者的方式是建立任务链路：模型能力提升应该影响哪个中间指标，再影响哪个业务结果。例如 OCR 提升可能先提升商品属性覆盖率，再提升搜索相关性。上线前做 shadow test、人工抽检和 A/B 实验，记录失败样本回流。不能只用一个综合分，因为综合分可能掩盖某个关键业务场景下降；也不能只看线上指标，否则难以定位模型具体能力短板。",
  },
  {
    title: "快手大模型面经：LoRA 与全参微调",
    sourceTitle: "【26届校招】快手大模型算法岗面经：从多模态模型到LoRA技术，面试官常问问题详解！",
    company: "快手",
    direction: "训练框架",
    domain: "LoRA / 全参微调 / 多模态适配",
    category: "训练框架",
    sourcePlatform: "CSDN",
    sourceUrl: "https://blog.csdn.net/trb701012/article/details/152117850?ops_request_misc=elastic_search_misc&request_id=ff52808e4efd88c878d62081f2bac53b&biz_id=0",
    tags: ["快手", "LoRA", "全参微调", "多模态", "训练成本"],
    question: "多模态业务微调时，LoRA、视觉侧微调和全参微调应该如何选择？",
    answer: "选择微调方式要看业务数据规模、领域差异和需要改变的能力位置。LoRA 适合数据中等、目标是语言风格或任务格式适配的场景，成本低、可维护多个 adapter，但容量有限。视觉侧微调适合图像分布和预训练差异较大，例如短视频、电商图、工业缺陷、医学或遥感；只调 LLM 可能无法修正视觉特征不足。全参微调容量最大，适合领域差异很大、数据足够且要重塑模型能力的场景，但显存、训练稳定性和通用能力退化风险最高。多模态项目常见做法是先冻结视觉 encoder 训练 projector/LoRA，确认收益后再小学习率解冻部分视觉层或 LLM 高层。评估必须包含通用能力回归和目标业务 hard case。",
  },
  {
    title: "百度多模态高频题：CLIP、BLIP 与 Qwen-VL",
    sourceTitle: "百度面经——多模态模型高频面试题",
    company: "百度",
    direction: "多模态大模型",
    domain: "CLIP / BLIP / Qwen-VL",
    category: "多模态大模型",
    sourcePlatform: "知乎",
    sourceUrl: "https://zhuanlan.zhihu.com/p/713494385",
    tags: ["百度", "CLIP", "BLIP", "Qwen-VL", "VLM"],
    question: "CLIP、BLIP 和 Qwen-VL 的训练目标与能力边界分别有什么不同？",
    answer: "CLIP 是双塔对比学习模型，核心目标是让匹配的图文向量接近、不匹配的远离，擅长检索和零样本分类，但生成和细粒度推理弱。BLIP 在图文理解和生成之间做了更多桥接，既能做 caption/VQA，也关注数据过滤和生成式目标；BLIP-2 用 Q-Former 把视觉特征压缩成少量 query token 接入 LLM，参数效率更高。Qwen-VL 类模型直接围绕强 LLM 构建视觉语言能力，重点是图像/视频输入、OCR、grounding、多轮对话和工具式任务。能力边界上，CLIP 更像通用视觉语义表征，BLIP 更像视觉语言桥接方案，Qwen-VL 更像可交互的多模态助手。面试回答要把训练目标、模型结构、数据类型和适用任务一起讲清楚。",
  },
  {
    title: "B站大模型面试题：FlashAttention 工程价值",
    sourceTitle: "LLM面试题解：flashattention与Transformers",
    company: "综合",
    direction: "训练框架",
    domain: "FlashAttention / attention IO / 长上下文",
    category: "训练框架",
    sourcePlatform: "B站",
    sourceUrl: "https://www.bilibili.com/video/BV11AbhzXE9h/",
    tags: ["FlashAttention", "Transformer", "训练优化", "长上下文", "显存"],
    question: "FlashAttention 的主要收益为什么来自减少显存读写，而不是改变 attention 的数学结果？",
    answer: "标准 attention 会显式构造 n×n 注意力矩阵，虽然数学上简单，但会产生大量 HBM 读写和峰值显存。FlashAttention 的核心是 IO-aware：把 Q、K、V 分块放入 SRAM，边计算边做在线 softmax，不把完整注意力矩阵写回显存，因此减少显存访问和中间激活。它计算的仍然是精确 attention，不是稀疏近似，也不是改变 softmax 公式。收益在长序列和大 batch 下尤其明显，因为注意力矩阵规模随序列长度平方增长。FlashAttention v2/v3 进一步优化了并行划分、warp 级调度和硬件利用率。面试里要强调它降低显存和提升吞吐，但不能无限解决长上下文，因为 KV cache、prefill 成本和位置外推仍然存在。",
  },
  {
    title: "华为大模型面试题：结构化复习路线",
    sourceTitle: "2026面试题精选：华为大佬带你一周刷完AI大模型高频面试题",
    company: "华为",
    direction: "训练框架",
    domain: "训练 / 推理 / 评测",
    category: "训练框架",
    sourcePlatform: "B站",
    sourceUrl: "https://www.bilibili.com/video/BV1kaDsBNEkJ/",
    tags: ["华为", "训练", "推理", "评测", "大模型面试"],
    question: "大模型面试复习时，为什么要把训练、推理、数据和评测拆成四条线，而不是只背模型结构？",
    answer: "真实大模型岗位不只考 Transformer 结构，而是考能否把模型做出来、训稳定、部署稳、评估准。训练线关注数据配比、优化器、学习率、混合精度、并行和稳定性；推理线关注 KV cache、batch 调度、量化、吞吐、延迟和服务降级；数据线关注清洗、去重、质量分层、指令构造和安全过滤；评测线关注离线 benchmark、业务指标、误差分析和回归测试。只背模型结构容易答成概念罗列，遇到“线上延迟高怎么办”“loss spike 怎么查”“数据污染怎么防”就会断。结构化复习可以把每个问题落到瓶颈、指标、排查路径和工程取舍上，更接近面试官真实关注点。",
  },
  {
    title: "世界模型面经：可解释性与安全边界",
    sourceTitle: "春招必看！自动驾驶多模态大模型算法岗面经+薪资全解析",
    company: "综合",
    direction: "自动驾驶数据 / 世界模型",
    domain: "可解释性 / 安全边界 / OOD",
    category: "自动驾驶 / 数据闭环",
    sourcePlatform: "CSDN",
    sourceUrl: "https://blog.csdn.net/youmaob/article/details/159420071?ops_request_misc=elastic_search_misc&request_id=ff52808e4efd88c878d62081f2bac53b&biz_id=0",
    tags: ["世界模型", "自动驾驶", "安全边界", "OOD", "可解释性"],
    question: "世界模型用于自动驾驶规划时，如何处理可解释性、安全边界和分布外场景？",
    answer: "世界模型能把感知、预测和规划放到统一动态建模中，但这也会降低模块边界的可解释性。工程上需要让模型输出中间状态，例如 BEV、occupancy、轨迹分布、风险热力图和候选动作代价，而不是只输出最终控制。安全边界不能完全交给神经网络，需要规则约束、碰撞检查、可达集、速度/加速度限制和冗余安全控制器兜底。分布外场景要通过不确定性估计、低置信触发降级、长尾场景挖掘和仿真回归处理。评估时要看模型在罕见天气、施工、异形障碍、交通参与者异常行为下是否会给出高置信错误。上线策略通常是影子模式、限定场景、逐步放量，并保留可审计日志用于失败归因。",
  },
];

const posts = JSON.parse(await fs.readFile(POSTS_FILE, "utf8"));
const used = existingQuestionKeys(posts);
const added = [];
const skipped = [];

for (const item of supplements) {
  const key = normalize(item.question);
  if (!key || used.has(key)) {
    skipped.push({ title: item.title, question: item.question, reason: "duplicate-question" });
    continue;
  }
  used.add(key);
  const post = makePost(item);
  posts.unshift(post);
  added.push({ id: post.id, title: post.title, question: item.question, sourceUrl: item.sourceUrl });
}

await fs.writeFile(POSTS_FILE, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
await fs.writeFile(LOG_FILE, `${JSON.stringify({ date: ANSWERED_AT, added: added.length, skipped }, null, 2)}\n`, "utf8");

console.log(JSON.stringify({ added: added.length, skipped: skipped.length, added }, null, 2));
