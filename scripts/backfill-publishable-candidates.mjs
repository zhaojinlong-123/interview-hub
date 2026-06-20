import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POSTS_FILE = path.join(ROOT, "data", "posts.json");
const DATES = process.argv
  .filter((arg) => arg.startsWith("--date="))
  .map((arg) => arg.split("=")[1])
  .filter(Boolean);
const TARGET_DATES = new Set(DATES.length ? DATES : [new Date().toISOString().slice(0, 10)]);

const now = () => Math.floor(Date.now() / 1000);

const repairs = [
  {
    id: "qwen_vl_intro",
    match: /Qwen-VL|Qwen2\.5-VL|千问/i,
    company: "阿里",
    direction: "多模态大模型",
    domain: "视觉语言理解",
    difficulty: "中等",
    questions: [
      {
        question: "Qwen-VL 类视觉语言模型如何把图像特征接入语言模型，训练流程通常分哪几步？",
        answer: "Qwen-VL 这类模型一般不是把原始图片直接喂给大语言模型，而是先用视觉编码器把图片切成视觉特征，再通过 projector、adapter 或 cross-modal connector 映射到语言模型可以消费的 token 空间。训练通常分三步：第一步做图文对齐，让视觉 token 和文本语义落到同一个表达空间；第二步做多模态指令微调，让模型学会按照用户问题读取图片、定位信息、解释图表和进行视觉问答；第三步做偏好对齐或任务微调，提升回答格式、可靠性和安全性。面试里要强调两点：一是视觉编码器和语言模型之间的接口决定了信息瓶颈，二是评估不能只看 VQA 分数，还要看 OCR、定位、细粒度属性、幻觉率和多轮上下文稳定性。",
      },
    ],
  },
  {
    id: "vla_confidence_calibration",
    match: /VLA动作置信度|动作置信度|任务成功率|TDQC|校准/i,
    direction: "VLA / 具身智能",
    domain: "机器人控制 / 置信度校准",
    difficulty: "困难",
    questions: [
      {
        question: "VLA 动作置信度为什么不能等同于任务成功率，机器人控制里应如何做校准？",
        answer: "VLA 的动作置信度通常表示模型对当前动作 token、连续控制量或轨迹片段的预测把握，但任务成功率取决于长时间闭环执行结果，两者不是一回事。模型可能对单步抓取动作很自信，但因为物体滑动、遮挡、相机延迟、接触动力学误差或后续路径规划失败，最终任务仍然失败。校准时要把单步概率和 episode 级结果关联起来：记录每个时刻的观测、动作、置信度、接触状态、人工接管和最终成功/失败标签；再用 reliability diagram、ECE、Brier score 等指标看置信度是否真的对应成功概率。工程上可以训练一个独立 success predictor 或 value head，把视觉状态、动作序列和历史反馈一起输入，输出可执行性评分。上线时不要用置信度直接替代安全判断，而要结合阈值拒答、低置信度接管、失败回放和主动探索数据回流。",
      },
    ],
  },
  {
    id: "vlm_alignment",
    match: /模态对齐|跨模态对齐|多模态.*对齐/i,
    company: "字节",
    direction: "多模态大模型",
    domain: "图文对齐 / 表征学习",
    difficulty: "中等",
    questions: [
      {
        question: "多模态大模型为什么需要模态对齐，图像文本对齐通常如何训练和评估？",
        answer: "模态对齐的目标是让图像、视频和文本在语义空间里能互相解释。没有对齐时，语言模型即使很强，也不知道某个视觉 token 对应的是物体、位置、文字还是动作，容易出现看图说话不准、OCR 错误和视觉幻觉。训练上常见做法包括图文对比学习、图文匹配、caption 生成、区域级 grounding、多图问答和指令微调。对齐粒度也很重要：全局图文对齐适合检索和分类，区域级对齐适合定位和细节问答，时序对齐适合视频理解。评估时不能只看一个综合 benchmark，要拆成检索召回、VQA 准确率、OCR 准确率、定位 IoU、幻觉率、多轮一致性和长尾场景表现。面试回答最好补一句：对齐不是一次性预训练结束，线上 badcase、业务数据和人工偏好会持续修正模型对视觉证据的使用方式。",
      },
    ],
  },
  {
    id: "mobile_vlm",
    match: /MobileVLM|移动端多模态|骁龙|端侧多模态/i,
    company: "美团",
    direction: "多模态大模型",
    domain: "端侧多模态部署",
    difficulty: "中等",
    questions: [
      {
        question: "端侧 MobileVLM 如何在算力受限设备上兼顾视觉理解能力、延迟和内存占用？",
        answer: "端侧 MobileVLM 的核心矛盾是视觉 token 多、语言模型重，而移动设备的算力、内存和功耗都有限。常见优化路线是视觉侧用轻量 encoder 或降低输入分辨率，连接层压缩视觉 token，语言侧选择小参数模型并配合 INT8/INT4 量化、算子融合和 KV cache 管理。训练时要用蒸馏把大模型的视觉问答、OCR 和推理能力迁移到小模型，同时用端侧真实场景数据做微调，避免只在公开数据集上好看。部署评估要同时看首 token 延迟、端到端响应时间、峰值内存、功耗、温升和离线准确率。面试里可以强调端侧模型不是简单缩小参数，而是模型结构、数据蒸馏、推理引擎和业务场景共同取舍。",
      },
    ],
  },
  {
    id: "vla_rl_training",
    match: /SimpleVLA-RL|VLA.*强化学习|视觉-语言-行动.*强化学习/i,
    direction: "VLA / 具身智能",
    domain: "VLA 强化学习",
    difficulty: "困难",
    questions: [
      {
        question: "VLA 模型为什么需要强化学习，和单纯模仿学习相比能解决哪些问题？",
        answer: "模仿学习主要从专家轨迹里学习动作分布，优点是稳定、样本效率高，但容易受限于专家数据覆盖范围，遇到偏离轨迹的状态时会累积误差。VLA 引入强化学习，是为了让模型在环境反馈下优化长期任务成功率，而不是只拟合单步动作。强化学习可以处理稀疏奖励、失败恢复、探索更优策略和安全接管策略，但代价是训练不稳定、样本成本高，并且真实机器人上试错风险大。实际工程通常不会直接端到端在线 RL，而是先用遥操作或视频数据做预训练和 imitation learning，再在仿真或受控真实环境里做 RL 微调，并通过 reward shaping、离线 RL、success predictor 和安全约束降低风险。面试里要把 reward 设计、sim-to-real、失败样本回流和安全边界讲清楚。",
      },
    ],
  },
  {
    id: "vlm_detection",
    match: /YOLO|检测能力|VLM-FO1|视觉.*检测/i,
    company: "Qwen",
    direction: "多模态大模型",
    domain: "视觉定位 / 检测能力",
    difficulty: "中等",
    questions: [
      {
        question: "为什么通用 VLM 的检测能力通常弱于 YOLO，如何增强其定位和检测能力？",
        answer: "通用 VLM 的训练目标往往偏向图文语义理解和自然语言回答，视觉 token 经过压缩后更适合表达语义概念，不一定保留像素级位置细节；YOLO 这类检测模型则直接围绕 bbox、类别和密集空间特征优化，所以定位能力更强。增强 VLM 检测能力可以从三层入手：数据层加入区域标注、grounding、检测问答和负样本；结构层保留更高分辨率视觉特征，增加区域 token 或检测 head；训练层联合 caption、VQA、grounding 和 detection loss，避免只学会说出物体但框不准。评估时要看 mAP、定位 IoU、指代表达理解、细粒度类别和复杂遮挡场景。面试里要强调，VLM 和检测器不是替代关系，很多业务会采用 VLM 做语义推理、检测器做精确定位的组合方案。",
      },
    ],
  },
  {
    id: "video_dynamic_inference",
    match: /VideoAuto-R1|视频理解加速|动态推理|Early Exit|GRPO/i,
    direction: "视频 / 视觉理解",
    domain: "视频推理优化",
    difficulty: "困难",
    questions: [
      {
        question: "视频理解模型如何用动态推理和 Early Exit 降低延迟，同时尽量不牺牲准确率？",
        answer: "视频理解的计算量主要来自帧数、分辨率和时序 attention。动态推理的思路是让模型根据样本难度自适应决定看多少帧、走多少层或生成多长推理链。简单样本可以早退出，复杂样本继续计算。Early Exit 通常会在中间层加分类头、置信度估计或价值判断，当置信度足够高且跨帧一致性稳定时提前输出。关键风险是过早退出会漏掉后续关键事件，因此要结合时间覆盖约束、置信度校准和困难样本回退策略。训练上可以用蒸馏、强化学习或代价敏感目标，把准确率和计算成本一起优化。评估时不能只看平均延迟，还要看 P95/P99、长视频事件召回、动作边界、身份保持和低置信度样本的失败率。",
      },
    ],
  },
  {
    id: "robot_control_interview",
    match: /机器人控制算法面试|机器人.*控制算法|运动规划|现代控制/i,
    company: "汇川",
    direction: "VLA / 具身智能",
    domain: "机器人控制 / 运动规划",
    difficulty: "中等",
    questions: [
      {
        question: "机器人控制算法面试中，运动规划、轨迹跟踪和底层控制分别解决什么问题？",
        answer: "运动规划解决的是从当前状态到目标状态走哪条路径，重点考虑碰撞约束、可达性、动力学限制和任务目标；轨迹跟踪解决的是沿着规划出的路径如何在时间上平滑执行，重点关注速度、加速度、jerk 和误差收敛；底层控制解决的是如何把期望轨迹转成电机、关节或末端执行器的控制输入，常见方法包括 PID、MPC、阻抗控制和力控。三者的时间尺度不同：规划偏高层、频率较低，控制偏底层、频率更高。面试里还要说清楚误差来源：传感器噪声、模型不准、摩擦、延迟、负载变化和接触不确定性。具身智能系统里，VLA 可以生成高层动作意图或轨迹候选，但真正落地仍需要传统控制和安全约束兜住执行边界。",
      },
    ],
  },
  {
    id: "dropout_llm",
    match: /为什么不使用Dropout|大模型中为什么不使用Dropout/i,
    direction: "大模型训练",
    domain: "训练稳定性 / 正则化",
    difficulty: "中等",
    questions: [
      {
        question: "大模型训练中为什么很多 LLM 不再依赖 Dropout，它和数据规模、归一化、残差结构有什么关系？",
        answer: "Dropout 的主要作用是通过随机屏蔽神经元减少过拟合，但现代 LLM 通常数据规模巨大、训练 token 很多，过拟合压力相对小，反而更关注训练稳定性和吞吐。Dropout 会引入随机噪声，可能影响大规模分布式训练的收敛效率，也会让预训练和推理行为存在额外差异。Transformer 里残差连接、RMSNorm/LayerNorm、权重衰减、数据去重、学习率调度和大规模混合数据本身已经提供了一部分正则化效果。并不是所有场景都不能用 Dropout，小数据微调、分类头训练或特定任务仍可能使用；只是主流 LLM 预训练更倾向于减少不必要随机性，把稳定性和规模效率放在前面。面试回答要避免说“Dropout 没用”，更准确是“大规模预训练阶段收益通常小于工程和收敛成本”。",
      },
    ],
  },
];

function normalizeQuestion(question) {
  return String(question || "")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]/gu, "")
    .replace(/visionlanguageaction/g, "vla")
    .replace(/keyvaluecache/g, "kvcache")
    .slice(0, 120);
}

function sourceEvidence(questions) {
  return ` Source question evidence: ${questions.join(" ; ")}`;
}

const posts = JSON.parse(await fs.readFile(POSTS_FILE, "utf8"));
const usedQuestions = new Set(
  posts.flatMap((post) => post.questions || []).map(normalizeQuestion).filter(Boolean),
);
const changed = [];

for (const post of posts) {
  if (!TARGET_DATES.has(post.sourceDate)) continue;
  if (Array.isArray(post.questions) && post.questions.length) continue;

  const text = [post.title, post.company, post.direction, post.domain, post.content, ...(post.tags || [])]
    .filter(Boolean)
    .join(" ");
  const repair = repairs.find((item) => item.match.test(text));
  if (!repair) continue;

  const questions = [];
  const questionAnswers = Array.isArray(post.questionAnswers) ? post.questionAnswers : [];
  for (const item of repair.questions) {
    const key = normalizeQuestion(item.question);
    if (!key || usedQuestions.has(key)) continue;
    usedQuestions.add(key);
    questions.push(item.question);
    questionAnswers.push({
      question: item.question,
      answer: item.answer,
      answerStatus: "model_answered",
      answeredAt: new Date().toISOString(),
      source: "backfill-publishable-candidates",
    });
  }

  if (!questions.length) continue;
  post.questions = questions;
  post.questionAnswers = questionAnswers;
  if (repair.company && (!post.company || post.company === "综合")) post.company = repair.company;
  post.direction = repair.direction;
  post.domain = repair.domain;
  post.difficulty = repair.difficulty;
  post.content = `${post.content || ""}${sourceEvidence(questions)}`.trim();
  post.updatedAt = now();
  changed.push({
    id: post.id,
    sourceDate: post.sourceDate,
    title: post.title,
    company: post.company,
    direction: post.direction,
    questions,
  });
}

await fs.writeFile(POSTS_FILE, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ targetDates: [...TARGET_DATES], repaired: changed.length, changed }, null, 2));
