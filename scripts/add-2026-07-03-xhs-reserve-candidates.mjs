import fs from "node:fs";

const POSTS_FILE = "data/posts.json";
const posts = JSON.parse(fs.readFileSync(POSTS_FILE, "utf8"));
const nowSeconds = Math.floor(Date.now() / 1000);
const nowIso = new Date().toISOString();

const reserves = [
  {
    id: "reserve-20260703-aliyun-multimodal-eval",
    title: "阿里云多模态面经：复杂图文评估体系",
    company: "阿里云",
    direction: "多模态大模型",
    sourcePlatform: "知乎",
    sourceUrl: "https://zhuanlan.zhihu.com/p/1947724271746024823",
    question: "复杂图文任务中，如何把文字识别、空间关系、计数和推理能力拆开评估？",
    answer: "复杂图文评估要按能力拆开，而不是只给一个总分。文字识别看字符级准确率、表格字段抽取和长文本阅读；空间关系看左右、包含、遮挡、相对位置和区域指代；计数要覆盖密集小目标、遮挡目标和相似目标；推理能力则要让答案依赖多个视觉证据，而不是只靠常识。数据集设计上应加入反事实样本，例如改动数量、位置或文字，让模型不能靠语言先验猜。上线前还要看错误类型分布，区分是看不清、定位错、读错字，还是推理链断了。"
  },
  {
    id: "reserve-20260703-tencent-video-event",
    title: "腾讯视频理解面经：事件边界与状态变化",
    company: "腾讯",
    direction: "视频理解 / 多模态大模型",
    sourcePlatform: "知乎",
    sourceUrl: "https://zhuanlan.zhihu.com/p/1933187361329611269",
    question: "视频事件理解中，如何判断事件开始、结束和状态变化，而不是只做整段分类？",
    answer: "整段分类只能回答视频大概是什么，无法解释事件在什么时候发生。事件理解需要把视频切成时间片段，预测每个片段的动作、主体、对象和状态，并回归开始结束边界。状态变化尤其重要，比如杯子从桌上到手里、门从关到开，这类变化要求模型比较事件前后帧。训练数据最好包含动作前、动作中、动作后三类片段，并标注边界和状态。评估时用边界误差、时间交并比、状态问答准确率和跨片段一致性共同判断。"
  },
  {
    id: "reserve-20260703-baidu-vlm-data",
    title: "百度多模态面经：高质量图文数据构造",
    company: "百度",
    direction: "多模态大模型",
    sourcePlatform: "知乎",
    sourceUrl: "https://zhuanlan.zhihu.com/p/1996677583337698496",
    question: "图文指令数据如何做质量分层，避免低质描述和错配样本拖累模型？",
    answer: "图文数据质量可以从清晰度、图文一致性、信息密度、任务价值和安全合规五层筛选。低清、广告、水印、重复图和无关描述应先过滤；再用图文相似度、文字区域检查和人工抽检排除错配。高质量样本应描述具体对象、属性、数量、位置和关系，而不是只有“这是一张好看的图片”。指令数据还要覆盖问答、定位、比较、解释和拒答，避免模型只学会生成泛化描述。训练时可以对高质量样本加权，对噪声来源限额采样，并用验证集持续监控幻觉和细粒度能力。"
  },
  {
    id: "reserve-20260703-huawei-edge-vlm",
    title: "华为多模态面经：端侧模型压缩与部署",
    company: "华为",
    direction: "推理部署 / 多模态大模型",
    sourcePlatform: "小红书",
    sourceUrl: "https://www.xiaohongshu.com/explore/69e5b4a70000000020038bbb?xsec_source=pc_search",
    question: "端侧多模态模型部署时，视觉编码、语言推理和缓存复用分别如何降成本？",
    answer: "端侧部署要分别压缩视觉侧、语言侧和系统调度。视觉编码可以降低输入分辨率、按任务选择切图数量、缓存重复图片特征，或使用轻量视觉编码器。语言推理侧可采用低比特量化、结构剪枝、小模型蒸馏和短回答约束，减少显存和延迟。缓存复用适合固定系统提示、重复图片或多轮对话中的相同上下文。还要把预处理、编码和生成流水线化，避免 CPU/GPU/NPU 互相等待。评估时不能只看模型准确率，还要看首字延迟、峰值内存、功耗、发热和离线可用性。"
  },
  {
    id: "reserve-20260703-meituan-mobile-vlm",
    title: "美团移动端多模态面经：轻量视觉语言模型",
    company: "美团",
    direction: "多模态大模型",
    sourcePlatform: "掘金",
    sourceUrl: "https://juejin.cn/post/7319663384097275942",
    question: "移动端多模态模型为什么要做视觉特征压缩，如何避免压缩后丢失关键细节？",
    answer: "移动端算力和内存有限，视觉 token 如果过多，会直接拉高编码耗时、上下文长度和功耗，所以必须压缩。压缩可以用池化、区域筛选、特征聚合、低分辨率全局图加局部高分辨率块等方式。避免丢细节的关键是不要盲目平均所有区域，而是保留文字、小目标、主体区域和用户问题相关区域。可以先用轻量检测或注意力分数找关键区域，再把这些区域送入高精度编码。评估要按任务分开看：普通场景描述可以强压缩，文字识别、商品属性和图表理解则需要保留更多局部信息。"
  },
  {
    id: "reserve-20260703-qwen-long-context",
    title: "Qwen 面经：长上下文推理与位置外推",
    company: "Qwen",
    direction: "推理优化 / 大模型基础",
    sourcePlatform: "CSDN",
    sourceUrl: "https://blog.csdn.net/weixin_45264425/article/details/157210711",
    question: "长上下文推理中，位置外推、注意力稀释和证据检索分别会带来什么问题？",
    answer: "长上下文不是把长度参数调大就结束。位置外推会让模型在训练长度之外的位置关系不稳定，需要缩放策略和长文本继续训练来适配。注意力稀释指关键信息被大量无关 token 淹没，模型可能找不到真正证据。证据检索则决定哪些片段进入上下文，如果召回错了，再强的模型也会答错。工程上通常结合分块索引、重排序、摘要记忆和引用定位，让模型先找到证据再回答。评估时要看 needle-in-a-haystack、跨段推理、引用准确率和长上下文下的延迟成本。"
  },
  {
    id: "reserve-20260703-deepseek-reasoning-distill",
    title: "DeepSeek 推理面经：推理模型蒸馏",
    company: "DeepSeek",
    direction: "训练框架 / 推理优化",
    sourcePlatform: "知乎",
    sourceUrl: "https://zhuanlan.zhihu.com/p/1974870853121508975",
    question: "推理模型蒸馏时，应该蒸馏最终答案、推理过程还是偏好排序，三者有什么差异？",
    answer: "只蒸馏最终答案成本低，但学生模型学不到中间分解方式，遇到新题容易泛化差。蒸馏推理过程能教模型如何拆题、验证和回溯，适合数学、代码和复杂问答，但要过滤错误或冗长推理链。蒸馏偏好排序关注哪个回答更好，可用于训练选择能力或偏好模型，但不直接提供完整解题路径。实践中常把三者组合：用高质量过程样本做监督，用最终答案保证简洁正确，再用偏好数据约束风格和可靠性。评估要分别看正确率、推理长度、鲁棒性和错误自检能力。"
  },
  {
    id: "reserve-20260703-robot-failure-recovery",
    title: "具身智能面经：失败恢复与安全接管",
    company: "综合",
    direction: "VLA / 具身智能",
    sourcePlatform: "CSDN",
    sourceUrl: "https://blog.csdn.net/lovely_yoshino/article/details/160694260",
    question: "机器人执行失败后，系统如何识别失败原因并选择重试、重规划或人工接管？",
    answer: "失败处理要先做状态诊断，而不是盲目重试。系统可以根据视觉状态、力觉异常、目标是否移动、轨迹偏差、碰撞检测和超时信息判断失败类型：感知失败、规划失败、控制失败、环境变化或安全风险。轻微偏差可以低层控制重试；目标位置变化需要重新感知和规划；连续失败或安全风险升高时应人工接管。训练数据中要保留失败前后的完整片段和接管原因，用于学习恢复策略。评估时除了成功率，还要看失败检测准确率、恢复成功率、平均重试次数和危险动作拦截率。"
  }
];

for (const item of reserves) {
  const post = {
    ...item,
    role: item.role || "大模型相关岗位",
    domain: item.domain || item.direction,
    category: item.category || item.direction,
    type: "interview",
    difficulty: "中等",
    sourceDate: "2026-07-03",
    tags: [item.company, item.direction, "面经", "大模型"].filter(Boolean),
    questions: [item.question],
    content: `候选来源：${item.title}。面试题目：${item.question}`,
    prepTips: "围绕机制、工程取舍、评估指标和风险边界回答。",
    createdAt: nowSeconds,
    updatedAt: nowSeconds,
    reviewStatus: "question_ready",
    questionAnswers: [{
      question: item.question,
      answer: item.answer,
      answerStatus: "model_answered",
      answeredAt: nowIso,
      source: "xhs-reserve-candidates-2026-07-03"
    }]
  };
  delete post.question;
  delete post.answer;
  const index = posts.findIndex((candidate) => candidate.id === post.id);
  if (index >= 0) posts[index] = { ...posts[index], ...post };
  else posts.push(post);
}

fs.writeFileSync(POSTS_FILE, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ upserted: reserves.length }, null, 2));
