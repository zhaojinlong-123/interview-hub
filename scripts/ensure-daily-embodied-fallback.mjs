import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POSTS_FILE = path.join(ROOT, "data", "posts.json");
const FEATURES_FILE = path.join(ROOT, "data", "daily-features.json");
const REGISTRY_FILE = path.join(ROOT, "data", "published-question-registry.json");
const DRAFT_DIR = path.join(ROOT, "content", "xiaohongshu-drafts");

const SLOT = argValue("--slot") || "morning";
const PUBLISH_TIME = argValue("--publish-time") || "";
const TARGET_DATE = argValue("--date") || chinaDate();

const SOURCE_URL = "https://github.com/WinstonJQ/embodied-interview-qa";
const SOURCE_PLATFORM = "本地兜底题库";

const TOPIC_POOL = [
  {
    title: "具身智能面经：开放词汇抓取与3D定位",
    company: "综合",
    role: "具身智能算法工程师",
    direction: "VLA / 机器人感知",
    domain: "开放词汇检测 / 3D grounding / 抓取点生成",
    tags: ["具身智能", "VLA", "3D Grounding", "抓取", "机器人感知"],
    question: "开放词汇抓取任务中，如何把语言目标从2D检测结果转换成可执行的3D抓取位姿？",
    answer: "这题要把语义定位和机器人可执行性分开讲。语言目标先经过开放词汇检测或 VLM grounding 找到候选 2D 区域，但 2D 框不能直接抓取，因为缺少深度、姿态、遮挡和可达性信息。下一步需要结合深度图、点云、相机内外参和机器人基座坐标，把候选区域投影到 3D，并分割出目标点云。然后估计物体姿态、可抓取区域和表面法向，生成多个候选抓取位姿。候选位姿要经过逆运动学、碰撞检测、夹爪开口宽度、接近方向和工作空间约束过滤。VLA 可以负责理解语言和选择目标，也可以输出抓取意图或候选接触点，但低层仍要用规划器和控制器保证物理可行。评估时不能只看检测准确率，要看 3D 定位误差、抓取成功率、遮挡场景成功率、误抓率和失败恢复能力。",
  },
  {
    title: "机器人数据面经：多相机外参与时间同步",
    company: "综合",
    role: "机器人数据算法工程师",
    direction: "机器人数据 / 具身智能",
    domain: "多相机标定 / 时间同步 / 数据质检",
    tags: ["机器人数据", "多相机", "时间同步", "标定", "具身智能"],
    question: "机器人多相机遥操作数据中，如何发现外参漂移和时间不同步，并避免污染VLA训练集？",
    answer: "外参漂移和时间不同步都会让同一个动作对应到错误视觉证据，是 VLA 数据里很隐蔽但伤害很大的问题。外参漂移可以通过标定板重投影误差、跨相机点云对齐误差、固定物体边缘一致性和抓取点投影偏差发现；如果机器人执行同一轨迹时目标在不同相机中的空间位置不一致，就要怀疑外参。时间不同步可以看图像帧、本体状态、末端位姿和动作命令的时间戳差，也可以用快速运动片段检查视觉变化是否滞后于关节状态。清洗时要把异常 episode 标出，轻微偏差可做时间插值和外参重标定，严重漂移要剔除或单独作为异常数据。训练集构造还要保留质检字段，例如同步误差、重投影误差和有效相机数。评估指标包括标定误差、时间偏差分布、训练后真机成功率和跨视角泛化。",
  },
  {
    title: "VLA面经：action token粒度怎么选",
    company: "综合",
    role: "VLA算法工程师",
    direction: "VLA / 动作表征",
    domain: "action token / 离散化 / 连续控制",
    tags: ["VLA", "action token", "动作离散化", "连续控制", "具身智能"],
    question: "VLA中把连续动作离散成action token时，粒度过粗或过细分别会带来什么问题？",
    answer: "动作离散化是在语言模型接口和连续控制之间做折中。粒度过粗时，token 数少、学习容易、推理稳定，但动作精度不足，容易出现抓取点偏差、末端姿态不准和插入类任务失败。粒度过细时，动作表达更精细，但 token 序列更长，类别更多，数据需求变大，模型更容易预测抖动或落到低频动作上。离散化还会影响泛化：按关节角离散，换机器人平台很难复用；按末端位姿增量离散，跨平台更容易，但需要可靠的低层控制器。工程上可以用分层动作表示，高层离散技能 token 表达意图，低层连续控制或 diffusion policy 负责精细轨迹。也可以对位置、姿态、夹爪状态采用不同粒度，并结合动作平滑和安全过滤。评估要看任务成功率、动作误差、序列长度、延迟、抖动和跨平台迁移能力。",
  },
  {
    title: "具身世界模型面经：接触动力学怎么建模",
    company: "综合",
    role: "机器人世界模型算法工程师",
    direction: "世界模型 / 具身智能",
    domain: "接触动力学 / 物体状态预测 / 闭环规划",
    tags: ["世界模型", "接触动力学", "闭环规划", "机器人操作", "具身智能"],
    question: "机器人世界模型在抓取、推拉、插入等接触任务中，为什么难建模，应该补哪些状态和评估？",
    answer: "接触任务难在动力学非线性强，而且小误差会改变后续状态。抓取时接触点、摩擦、夹持力和物体形变都会影响是否滑落；推拉时物体和桌面的摩擦、碰撞边界会让轨迹发生突变；插入任务还涉及狭窄间隙、力反馈和姿态误差。普通视频预测只看外观变化，往往学不到力和接触因果。更可靠的世界模型需要补充物体 6D 位姿、接触状态、末端力/扭矩、夹爪开合、本体状态和动作条件。训练时要加入成功和失败轨迹，特别是滑移、卡住、碰撞和空抓样本。评估不能只看图像重建误差，要看接触状态预测、物体位姿误差、动作条件下的未来状态、闭环任务成功率和失败预警能力。回答重点是：接触世界模型要服务动作选择，必须显式关注状态、力和失败边界。",
  },
  {
    title: "VLA部署面经：边缘端延迟和模型切分",
    company: "综合",
    role: "机器人系统算法工程师",
    direction: "VLA / 推理部署",
    domain: "边缘部署 / 模型切分 / 实时控制",
    tags: ["VLA部署", "边缘计算", "延迟", "模型切分", "机器人系统"],
    question: "VLA部署到机器人端时，哪些模块适合上云，哪些必须在本地，如何控制端到端延迟？",
    answer: "机器人系统里不能把所有能力都放到云端，因为网络抖动会直接影响安全。低层控制、急停、碰撞检测、力控、状态估计和局部避障必须在本地运行，保证毫秒级响应。高层语言理解、复杂任务规划、检索记忆和大模型推理可以部分上云，但要设计降级策略：云端超时后本地进入安全暂停、继续执行已验证的短 action chunk，或请求人工接管。模型切分上，视觉编码和轻量策略头可以部署在边缘端，重型 VLM/VLA 用云端或边缘 GPU 批处理。延迟控制要拆成感知延迟、编码延迟、大模型推理、动作解码、通信和控制执行，分别监控 P50/P95/P99。工程优化包括模型量化、缓存指令上下文、减少视觉 token、action chunk、异步推理和本地安全过滤。评估要看端到端延迟、超时率、任务成功率、急停次数和网络异常场景下的安全性。",
  },
  {
    title: "具身数据闭环面经：失败样本如何变成训练收益",
    company: "综合",
    role: "具身智能数据算法工程师",
    direction: "机器人数据闭环 / 具身智能",
    domain: "失败样本 / 数据回流 / 主动学习",
    tags: ["数据闭环", "失败样本", "主动学习", "VLA", "具身智能"],
    question: "机器人失败样本回流时，如何判断哪些失败值得标注和重训，而不是简单堆数据？",
    answer: "失败样本不是越多越好，关键是能否覆盖模型盲区并带来可学习信号。优先级最高的是高风险失败，例如碰撞、跌倒、夹伤、越界和频繁人工接管；其次是高频失败和长尾场景失败，例如透明物体、软物体、遮挡、反光和动态干扰。筛选时要看失败原因是否可标注：感知错误、语言理解错误、抓取点错误、路径不可达、控制延迟、外参漂移或数据分布外。没有明确原因的日志可以先进入待诊断池，不一定直接训练。标注时要保存失败前后的观察、动作、本体状态、人工修正和最终结果。重训方式也要区分：感知失败补检测/grounding 数据，控制失败补轨迹或力控数据，策略失败补偏好或恢复策略样本。评估要做回归测试，确认新数据提升目标场景成功率，同时不破坏原有任务。核心是：数据闭环要按价值采样，而不是按数量堆积。",
  },
  {
    title: "机器人评估面经：真机评测集怎么设计",
    company: "综合",
    role: "具身智能评测算法工程师",
    direction: "具身智能 / 评估体系",
    domain: "真机评测 / 长尾场景 / 安全指标",
    tags: ["真机评测", "安全指标", "长尾场景", "VLA", "具身智能"],
    question: "具身智能真机评测集应该如何设计，为什么不能只报任务成功率？",
    answer: "任务成功率是必要指标，但远远不够，因为同样成功的任务可能成本、风险和稳定性完全不同。真机评测集要覆盖任务、物体、场景和扰动四个维度。任务包括抓取、放置、开关门、导航、避障和多步组合；物体包括透明、软体、反光、小物体、易碎物；场景包括光照变化、遮挡、杂乱桌面、动态人群和不同地面；扰动包括目标移动、传感器噪声、执行延迟和轻微碰撞。指标上除成功率，还要看完成时间、碰撞率、急停次数、重试次数、人工接管率、能耗、动作平滑度、失败恢复率和跨场景泛化。评测还要有固定版本和回归机制，避免模型只针对当前测试集调参。安全指标优先级很高：一个成功率高但碰撞多的模型不能上线。",
  },
  {
    title: "VLA安全面经：置信度和动作风险",
    company: "综合",
    role: "VLA安全算法工程师",
    direction: "VLA / 机器人安全",
    domain: "置信度校准 / 风险预测 / 安全过滤",
    tags: ["VLA安全", "置信度校准", "风险预测", "安全过滤", "具身智能"],
    question: "VLA动作置信度为什么不能直接等同于任务成功率，如何做风险校准和安全过滤？",
    answer: "模型置信度通常反映的是模型对输出分布的确定性，不等于动作在真实世界中的成功概率。VLA 可能在分布外场景中非常自信，例如没见过的工具、遮挡目标、反光物体或错误外参；也可能对语义目标很确定，但低层动作不可达。风险校准需要把模型置信度和环境状态、本体约束、碰撞检测、历史失败统计一起看。可以训练独立风险预测器，输入视觉状态、语言目标、候选动作、距离障碍物、IK 可行性和不确定性，输出失败概率或是否需要人工接管。安全过滤层应独立于主模型，包括工作空间限制、速度/力阈值、碰撞检测、急停和动作幅度裁剪。评估要看置信度校准误差、风险召回率、误拦截率、碰撞率和人工接管率。重点是：VLA 的置信度只能作为一个信号，不能替代物理安全检查。",
  },
  {
    title: "机器人多任务学习面经：灾难遗忘和技能组合",
    company: "综合",
    role: "机器人基础模型算法工程师",
    direction: "VLA / 多任务学习",
    domain: "技能组合 / 灾难遗忘 / 数据混合",
    tags: ["多任务学习", "技能组合", "灾难遗忘", "VLA", "机器人基础模型"],
    question: "机器人VLA做多任务学习时，如何避免新技能微调导致旧技能灾难遗忘？",
    answer: "灾难遗忘来自新任务数据分布覆盖旧任务表示，导致模型参数向新技能偏移。机器人 VLA 更明显，因为不同任务的动作空间、物体、场景和控制频率都可能不同。缓解方法第一是数据混合，微调新技能时保留旧技能 replay buffer，并按任务价值和难度采样。第二是参数高效微调，例如 adapter、LoRA 或任务专家头，减少对通用表示的破坏。第三是正则约束，如 EWC 或 KL 约束，让关键参数不要大幅偏移。第四是技能路由，用任务 embedding 或 gating 选择不同专家，避免所有技能挤在同一个输出头里。第五是持续评估，每次新技能上线都跑旧任务回归测试。数据上还要保证指令模板、动作尺度和成功标记一致。指标包括新任务成功率、旧任务保持率、跨任务组合成功率、负迁移程度和模型延迟。回答要强调：多任务不是简单拼数据，必须有采样、参数隔离和回归评估。",
  },
  {
    title: "具身记忆面经：长程任务如何维护环境状态",
    company: "综合",
    role: "具身智能算法工程师",
    direction: "VLA / 长程任务",
    domain: "场景记忆 / 状态更新 / 长程规划",
    tags: ["长程任务", "场景记忆", "状态更新", "VLA", "具身智能"],
    question: "长程具身任务中，机器人如何维护环境记忆，避免物体移动后仍按旧状态执行？",
    answer: "长程任务需要持续维护世界状态，而不是只看当前一帧或初始地图。环境记忆可以包括对象位置、可达性、任务进度、已经尝试过的动作、失败原因和用户偏好。关键是记忆必须可更新：每执行一个子目标后重新感知，检查目标物体是否移动、遮挡是否变化、门/抽屉是否开关、手中物体是否仍被抓住。如果当前观察和记忆冲突，要以高置信新观察覆盖旧记忆，或进入重新定位流程。实现上可以用场景图、对象级 memory、BEV/3D map 或轻量数据库保存状态，并给每条记忆加时间戳和置信度。VLA 在规划时查询记忆，但动作执行前仍要用实时感知校验。评估要看长程任务成功率、状态更新准确率、错误记忆导致的失败率、重定位成功率和多轮交互一致性。核心是：记忆不是静态上下文，而是可验证、可过期、可纠错的状态系统。",
  },
  {
    title: "机器人视觉面经：遮挡场景下的可操作性估计",
    company: "综合",
    role: "机器人视觉算法工程师",
    direction: "机器人视觉 / 具身智能",
    domain: "遮挡 / affordance / grasp planning",
    tags: ["机器人视觉", "遮挡", "Affordance", "抓取规划", "具身智能"],
    question: "桌面杂乱和遮挡场景中，如何估计目标物体的可操作性，并决定先移开哪个物体？",
    answer: "遮挡场景里，检测到目标不代表可以直接操作。可操作性估计要判断目标是否可见、可达、可抓，是否被其他物体压住，以及移动它会不会造成碰撞或掉落。视觉侧可以用实例分割、深度图、点云补全和关系图建模物体之间的遮挡/支撑关系。规划侧要生成候选动作：直接抓目标、拨开遮挡物、移动上层物体或换视角。选择先移开哪个物体时，可以按遮挡贡献、抓取可行性、风险和动作成本排序。VLA 可以理解语言目标和高层策略，但要结合 affordance map、碰撞检测和抓取评分。训练数据需要包含杂乱桌面、遮挡层级、失败抓取和人工整理轨迹。评估指标包括目标取出成功率、额外移动次数、误抓率、碰撞/掉落率和规划步数。回答要体现“先改变场景再完成目标”的长程操作思维。",
  },
];

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : "";
}

function chinaDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((item) => item.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function hash(text) {
  return crypto.createHash("sha1").update(text).digest("hex").slice(0, 12);
}

function normalizeQuestion(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[，。！？、；：“”‘’（）()[\]{}<>《》/\\\-_:,.!?;\s]/g, "")
    .replace(/visionlanguageaction/g, "vla")
    .trim();
}

function hasModelAnswer(post, question) {
  return (post.questionAnswers || []).some((item) => (
    normalizeQuestion(item.question) === normalizeQuestion(question) &&
    item.answerStatus === "model_answered" &&
    String(item.answer || "").trim().length > 120
  ));
}

function validSource(post) {
  const url = String(post.sourceUrl || "");
  if (!/^https?:\/\//.test(url)) return false;
  const selfPatterns = [
    "creator.xiaohongshu.com",
    "zhaojinlong-123.github.io/interview-hub",
    "xiaohongshu.com/explore/6a2cd7840000000015024480",
    "xiaohongshu.com/explore/6a2f55a50000000017028b54",
  ];
  if (selfPatterns.some((pattern) => url.includes(pattern))) return false;
  if (String(post.sourcePlatform || "").includes("小红书")) {
    return /xiaohongshu\.com\/explore\/[A-Za-z0-9]+/.test(url);
  }
  return true;
}

function postPriority(post) {
  const text = [
    post.title,
    post.company,
    post.direction,
    post.domain,
    ...(post.tags || []),
    ...(post.questions || []),
  ].join(" ");
  let score = 0;
  for (const keyword of ["具身", "VLA", "机器人", "世界模型", "自动驾驶", "视觉理解", "多模态", "推理部署", "训练框架"]) {
    if (text.includes(keyword)) score += 8;
  }
  if (post.company && !["综合", "未知", "未明确", "其他"].includes(String(post.company))) score += 10;
  const time = Date.parse(post.sourceDate || "");
  if (!Number.isNaN(time)) score -= Math.max(0, Math.round((Date.now() - time) / 86400000)) * 0.05;
  return score;
}

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

function makeArticle(post) {
  const question = post.questions[0];
  const answer = post.questionAnswers[0].answer;
  const shortAnswer = answer.length > 230 ? `${answer.slice(0, 230)}...` : answer;
  return [
    `# 每日精选面试题精讲：${post.company || "综合"}｜${post.direction}`,
    "",
    "> 今日重点：第一页先给公司、方向、题目，后续图片按题目展开完整答案与分析。",
    "",
    "## 面试题目",
    `1. ${question}`,
    "",
    "## 详细解答与分析",
    `这道题聚焦 ${post.direction}。回答时要把目标、数据、模型结构、控制链路、安全边界和评估指标讲完整。`,
    "",
    "## 逐题解答",
    `### 题目 1：${question}`,
    "",
    "**详细回答：**",
    answer,
    "",
    "**面试展开：**",
    "如果面试官继续追问，可以把答案落到真实项目：数据从哪里来、如何标注、模型输出什么、低层控制怎么兜底、失败样本如何回流、最终指标如何证明有效。",
    "",
    "## 可能追问方向",
    "- 如果真实机器人效果不稳定，如何定位是感知、数据、模型还是控制问题？",
    "- 如果离线指标提升但真机成功率不升，下一步怎么排查？",
    "- 这个方案在实时性、安全性、泛化性之间有什么取舍？",
    "- 如何把失败样本转成下一轮训练数据？",
    "",
    "## 面经信息",
    `- 公司：${post.company || "综合"}`,
    `- 岗位：${post.role}`,
    `- 方向：${post.direction}`,
    `- 领域：${post.domain}`,
    `- 难度：${post.difficulty}`,
    `- 来源：${post.sourcePlatform} ${post.sourceDate}`,
    `- 原始链接：${post.sourceUrl}`,
    "",
    "## 核心考点速记",
    `- ${question}`,
    "",
    "## 小红书发布文案",
    `每日精选：${post.company || "综合"}｜${post.direction} 题目精讲`,
    "",
    "面试题目",
    `1. ${question}`,
    "",
    "一句话答案",
    shortAnswer,
    "",
    `引用来源：${post.sourcePlatform} ${post.sourceDate}`,
    `原文链接：${post.sourceUrl}`,
    "",
    "#具身智能 #VLA #机器人 #世界模型 #大模型面试 #AI学习",
  ].join("\n");
}

const posts = await readJson(POSTS_FILE, []);
const features = await readJson(FEATURES_FILE, []);
const registry = await readJson(REGISTRY_FILE, []);

const existingForSlot = features.find((item) => item.date === TARGET_DATE && item.slot === SLOT);
if (existingForSlot?.publishStatus === "published") {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: "already_published", featureId: existingForSlot.id }, null, 2));
  process.exit(0);
}
if (existingForSlot && existingForSlot.publishStatus !== "published") {
  existingForSlot.publishStatus = "draft_ready";
  existingForSlot.autoPublish = true;
  delete existingForSlot.publishFailureReason;
  await writeJson(FEATURES_FILE, features);
  console.log(JSON.stringify({ ok: true, reused: true, featureId: existingForSlot.id }, null, 2));
  process.exit(0);
}

const publishedQuestions = new Set();
for (const item of registry) {
  if (item.status === "published") publishedQuestions.add(normalizeQuestion(item.question));
}
for (const item of features) {
  if (item.publishStatus !== "failed" && item.publishStatus !== "skipped_duplicate") {
    const post = posts.find((candidate) => candidate.id === item.postId);
    for (const question of post?.questions || []) publishedQuestions.add(normalizeQuestion(question));
  }
}

const eligible = [];
const usedDirectionsToday = new Set(
  features
    .filter((item) => item.date === TARGET_DATE && item.publishStatus !== "failed" && item.publishStatus !== "skipped_duplicate")
    .map((item) => normalizeQuestion(item.direction || ""))
    .filter(Boolean)
);
for (const post of posts) {
  if (!validSource(post)) continue;
  for (const question of post.questions || []) {
    if (publishedQuestions.has(normalizeQuestion(question))) continue;
    if (!hasModelAnswer(post, question)) continue;
    const directionKey = normalizeQuestion(post.direction || post.category || "");
    const directionPenalty = usedDirectionsToday.has(directionKey) ? 50 : 0;
    eligible.push({ post, question, score: postPriority(post) - directionPenalty });
  }
}

eligible.sort((a, b) => b.score - a.score);
const existingCandidate = eligible[0];
if (existingCandidate) {
  const { post, question, score } = existingCandidate;
  const digest = hash(`${TARGET_DATE}:${SLOT}:${post.id}:${question}`);
  const featureId = `daily-${TARGET_DATE}-${digest}`;
  const articlePath = `content/xiaohongshu-drafts/${TARGET_DATE}-${digest}.md`;
  const feature = {
    id: featureId,
    date: TARGET_DATE,
    slot: SLOT,
    publishTime: PUBLISH_TIME,
    postId: post.id,
    title: post.title,
    company: post.company || "综合",
    direction: post.direction || post.category || "具身智能",
    score,
    reasons: ["现有题库候选", "未发布题目", "已有模型详细回答", "来源链接通过基础校验"],
    sourceUrl: post.sourceUrl,
    sourcePlatform: post.sourcePlatform,
    sourceDate: post.sourceDate,
    articlePath,
    target: "xiaohongshu",
    publishStatus: "draft_ready",
    autoPublish: true,
  };
  features.unshift(feature);
  await writeJson(FEATURES_FILE, features);
  await fs.mkdir(DRAFT_DIR, { recursive: true });
  await fs.writeFile(path.join(ROOT, articlePath), `${makeArticle(post)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, featureId, postId: post.id, reusedPost: true, title: post.title, question }, null, 2));
  process.exit(0);
}

const usedQuestions = new Set(publishedQuestions);
for (const post of posts) {
  for (const question of post.questions || []) usedQuestions.add(normalizeQuestion(question));
}

const candidate = TOPIC_POOL.find((item) => !usedQuestions.has(normalizeQuestion(item.question)));
if (!candidate) throw new Error("fallback candidate pool exhausted");

const digest = hash(`${TARGET_DATE}:${SLOT}:${candidate.question}`);
const postId = `embodied-fallback-${TARGET_DATE.replaceAll("-", "")}-${digest}`;
const featureId = `daily-${TARGET_DATE}-${digest}`;
const articlePath = `content/xiaohongshu-drafts/${TARGET_DATE}-${digest}.md`;
const now = Math.floor(Date.now() / 1000);

const post = {
  id: postId,
  title: candidate.title,
  company: candidate.company,
  role: candidate.role,
  direction: candidate.direction,
  domain: candidate.domain,
  category: candidate.direction,
  sourcePlatform: SOURCE_PLATFORM,
  sourceDate: TARGET_DATE,
  sourceUrl: SOURCE_URL,
  tags: candidate.tags,
  questions: [candidate.question],
  type: "interview",
  difficulty: "困难",
  content: `${TARGET_DATE} 自动兜底候选。来源：${SOURCE_PLATFORM}。题目：${candidate.question}`,
  prepTips: "",
  createdAt: now,
  updatedAt: now,
  reviewStatus: "question_ready",
  questionAnswers: [{
    question: candidate.question,
    answer: candidate.answer,
    answerStatus: "model_answered",
    answeredAt: new Date().toISOString(),
    source: "daily-embodied-fallback",
  }],
};

const feature = {
  id: featureId,
  date: TARGET_DATE,
  slot: SLOT,
  publishTime: PUBLISH_TIME,
  postId,
  title: candidate.title,
  company: candidate.company,
  direction: candidate.direction,
  score: candidate.company && candidate.company !== "综合" ? 88 : 76,
  reasons: ["本地兜底草稿", "具身智能重点方向", "题目文本未发布", "已有模型详细回答", "需要人工确认来源"],
  sourceUrl: SOURCE_URL,
  sourcePlatform: SOURCE_PLATFORM,
  sourceDate: TARGET_DATE,
  articlePath,
  target: "xiaohongshu",
  publishStatus: "manual_required",
  autoPublish: false,
};

posts.unshift(post);
features.unshift(feature);
await writeJson(POSTS_FILE, posts);
await writeJson(FEATURES_FILE, features);
await fs.mkdir(DRAFT_DIR, { recursive: true });
await fs.writeFile(path.join(ROOT, articlePath), `${makeArticle(post)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, featureId, postId, title: candidate.title, question: candidate.question }, null, 2));
