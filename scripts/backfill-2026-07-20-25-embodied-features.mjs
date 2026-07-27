import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POSTS_FILE = path.join(ROOT, "data", "posts.json");
const FEATURES_FILE = path.join(ROOT, "data", "daily-features.json");
const DRAFT_DIR = path.join(ROOT, "content", "xiaohongshu-drafts");

const now = Math.floor(Date.now() / 1000);

function hash(text) {
  return crypto.createHash("sha1").update(text).digest("hex").slice(0, 12);
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[，。！？、；：“”‘’（）()[\]{}<>《》/\\\-_:,.!?;\s]/g, "")
    .replace(/visionlanguageaction/g, "vla")
    .trim();
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

const candidates = [
  {
    date: "2026-07-20",
    slot: "morning",
    publishTime: "09:30",
    title: "傅利叶机器人UniVLA面经：Late Action Model",
    company: "傅利叶智能",
    role: "具身智能算法工程师",
    direction: "VLA / 具身智能",
    domain: "UniVLA / latent action / late action model",
    sourcePlatform: "牛客",
    sourceDate: "2026-07-22",
    sourceUrl: "https://www.nowcoder.com/feed/main/detail/37af3ac1986b438c81cd26ab90a792a8",
    tags: ["傅利叶智能", "UniVLA", "VLA", "latent action", "具身智能"],
    question: "UniVLA 中 late action model / 潜在动作模型通常怎么搭建，为什么不直接让 VLM 输出关节动作？",
    answer: "这题的核心是把语义理解和低层连续控制解耦。VLM 擅长理解图像、语言和任务语义，但直接输出高频关节动作会遇到动作维度高、控制频率不匹配、训练噪声大和安全边界难约束的问题。late action model 的思路是先让前面的视觉语言主干形成任务相关表征，再在后端接一个动作专家或潜在动作解码器，把语义状态转成可执行的末端位姿、关节增量或 action chunk。潜在动作模型可以用 VQ、VAE、diffusion/flow matching 或 transformer decoder 学习动作分布，优点是能表达多峰动作，比如同一个抓取任务可以从不同方向接近。训练上通常先对齐视觉语言表征，再用遥操作轨迹做行为克隆或生成式动作学习，最后用真机失败样本微调。工程上还要让低层控制器做轨迹跟踪、碰撞检测、速度/力限制和急停。回答时强调：VLA 不是让大模型替代伺服控制，而是让大模型给出具备语义条件的动作意图，低层系统保证实时性和安全性。",
  },
  {
    date: "2026-07-20",
    slot: "afternoon",
    publishTime: "15:30",
    title: "中国移动VLA预训练面经：输入输出与动作空间",
    company: "中国移动",
    role: "VLA预训练及模型架构算法工程师",
    direction: "VLA / 具身智能",
    domain: "VLA 输入输出 / 动作空间 / 预训练",
    sourcePlatform: "CSDN",
    sourceDate: "2026-07-23",
    sourceUrl: "https://blog.csdn.net/ZHHHHH15/article/details/160808758",
    tags: ["中国移动", "VLA", "预训练", "动作空间", "具身智能"],
    question: "VLA 模型的输入和输出分别是什么，为什么动作空间设计会直接影响模型能否落地？",
    answer: "VLA 的输入通常包括视觉观测、语言指令、机器人本体状态和历史动作。视觉可以是 RGB、深度、点云或多相机图像；语言描述任务目标；本体状态包括关节角、末端位姿、夹爪状态、速度和力矩；历史动作帮助模型理解当前执行阶段。输出可以是离散 action token、末端位姿增量、关节增量、轨迹关键点或未来 K 步 action chunk。动作空间决定模型输出是否容易学习、是否能被低层控制器稳定执行。离散 token 方便接入自回归 LLM，但精度受离散化影响；连续动作适合精细控制，但对数据质量和稳定性要求高；action chunk 能降低推理频率，但过长会降低闭环反应速度。落地时要根据机器人平台、控制频率、任务粒度和安全要求选择动作表示。评估不能只看离线 loss，要看真机成功率、动作平滑度、碰撞率、急停次数和跨场景泛化。",
  },
  {
    date: "2026-07-21",
    slot: "morning",
    publishTime: "09:30",
    title: "具身智能面经：Sim-to-Real系统化拆解",
    company: "综合",
    role: "具身智能算法工程师",
    direction: "具身智能 / Sim-to-Real",
    domain: "仿真到真实 / 域随机化 / 系统辨识",
    sourcePlatform: "CSDN",
    sourceDate: "2026-07-23",
    sourceUrl: "https://blog.csdn.net/ZHHHHH15/article/details/160808758",
    tags: ["Sim-to-Real", "域随机化", "系统辨识", "仿真", "具身智能"],
    question: "如何解决 Sim-to-Real 鸿沟，视觉随机化、动力学随机化、系统辨识和真实数据微调分别解决什么问题？",
    answer: "Sim-to-Real 的本质是仿真分布和真实世界分布不一致，差异来自视觉外观、传感器噪声、摩擦、质量、接触、延迟和控制器响应。视觉随机化解决的是外观域偏移，比如纹理、光照、背景、相机视角和噪声，让模型不要过拟合仿真画面。动力学随机化解决物理参数不准的问题，比如摩擦系数、质量、阻尼、关节延迟和接触弹性，让策略对真实硬件误差更鲁棒。系统辨识是反过来测真实机器人和环境参数，再把仿真调得更像真实世界。真实数据微调负责最后一公里，把真实遥操作、真机失败和人工接管样本回流到模型。工程上常见流程是仿真大规模预训练、真实少量对齐、真机闭环评估、失败样本回流。指标要看仿真成功率、真机成功率、gap 大小、碰撞率、恢复成功率和跨物体/跨场景泛化。面试里要强调：只靠域随机化不够，必须把真实数据闭环接进去。",
  },
  {
    date: "2026-07-21",
    slot: "afternoon",
    publishTime: "15:30",
    title: "具身强化学习面经：IL和RL如何结合",
    company: "综合",
    role: "具身智能强化学习算法工程师",
    direction: "具身智能 / 强化学习",
    domain: "IL / RL / 离线强化学习 / 安全探索",
    sourcePlatform: "CSDN",
    sourceDate: "2026-07-23",
    sourceUrl: "https://blog.csdn.net/ZHHHHH15/article/details/160808758",
    tags: ["模仿学习", "强化学习", "离线RL", "安全探索", "具身智能"],
    question: "模仿学习和强化学习在具身任务中各有什么优劣，实际系统里如何组合使用？",
    answer: "模仿学习把专家轨迹当监督信号，优点是样本效率高、训练稳定、适合真实机器人数据昂贵的场景；缺点是容易协变量偏移，测试时一旦偏离专家分布，误差会逐步累积，而且上限受专家策略限制。强化学习通过试错最大化奖励，优点是能优化长期回报和发现更优策略，适合底层控制、恢复策略和仿真中可大量采样的任务；缺点是奖励设计难、探索成本高、真机安全风险大。实际系统通常先用遥操作数据做行为克隆或 diffusion policy 预训练，让策略获得基本能力；再在仿真或安全约束环境中用 RL 微调，提高鲁棒性和恢复能力；最后用真机失败样本做离线 RL、偏好学习或小步在线更新。关键是不要在真实机器人上无约束探索，要加入安全过滤器、动作边界、碰撞检测和人工接管。评估要看成功率、恢复率、探索成本、硬件损伤风险和长尾场景表现。",
  },
  {
    date: "2026-07-22",
    slot: "morning",
    publishTime: "09:30",
    title: "具身RL面经：为什么机械臂抓取常选SAC",
    company: "综合",
    role: "机器人强化学习算法工程师",
    direction: "机器人控制 / 强化学习",
    domain: "SAC / PPO / DDPG / 连续控制",
    sourcePlatform: "牛客",
    sourceDate: "2026-07-24",
    sourceUrl: "https://www.nowcoder.com/discuss/866386013608763392",
    tags: ["SAC", "PPO", "DDPG", "机械臂抓取", "强化学习"],
    question: "机械臂连续控制任务中，为什么很多抓取项目会选择 SAC，而不是 DDPG 或 PPO？",
    answer: "SAC 适合机械臂连续控制，主要因为它是 off-policy 最大熵强化学习，样本效率高且探索更充分。机械臂抓取的动作空间通常是连续的末端位姿、关节速度或力控制，确定性策略如 DDPG 容易探索不足、对超参和噪声敏感，训练时容易陷入局部最优。PPO 稳定但 on-policy 样本效率低，在真实机器人或高保真仿真中采样成本高。SAC 通过最大化奖励和策略熵，让策略在高回报动作附近保持一定随机性，有利于发现不同抓取姿态和绕障路径。工程上 SAC 常用于仿真训练或离线数据增强，真机部署前要加动作平滑、碰撞约束和安全边界。回答时还要讲限制：SAC 需要合理奖励函数，稀疏奖励下仍然困难；仿真训练策略迁移到真机需要域随机化和真实数据校准。指标包括成功率、样本效率、训练稳定性、动作平滑度、碰撞率和 sim-to-real gap。",
  },
  {
    date: "2026-07-22",
    slot: "afternoon",
    publishTime: "15:30",
    title: "VLA动作生成面经：CVAE Diffusion Flow怎么选",
    company: "综合",
    role: "VLA动作生成算法工程师",
    direction: "VLA / 动作生成",
    domain: "CVAE / Diffusion Policy / Flow Matching",
    sourcePlatform: "与非网",
    sourceDate: "2026-07-20",
    sourceUrl: "https://www.eefocus.com/article/2015453.html",
    tags: ["CVAE", "Diffusion Policy", "Flow Matching", "动作生成", "VLA"],
    question: "VLA 动作生成中，CVAE、Diffusion Policy 和 Flow Matching 分别适合什么场景？",
    answer: "三者都在解决动作多峰分布问题，但侧重点不同。CVAE 通过潜变量建模多种可行动作，训练和采样相对简单，适合 ACT 这类 action chunk 模型；缺点是潜变量表达能力有限，复杂接触任务里可能生成平均化动作。Diffusion Policy 通过逐步去噪生成动作序列，能表达复杂多峰轨迹，适合绕障、抓取、插入等存在多种可行解的任务；缺点是采样步数多，部署时要考虑延迟，可用 DDIM、蒸馏或短步数采样优化。Flow Matching 学习从简单分布到动作分布的连续变换，推理可更高效，也适合和大规模 transformer 动作专家结合。实际选择要看任务复杂度、控制频率、延迟预算和数据规模。面试回答要落到工程指标：轨迹成功率、动作平滑度、推理耗时、对多峰动作的覆盖、真机稳定性和失败恢复能力。",
  },
  {
    date: "2026-07-23",
    slot: "morning",
    publishTime: "09:30",
    title: "VLA动作表征面经：人形机器人动作生成",
    company: "综合",
    role: "VLA算法工程师",
    direction: "VLA / 人形机器人",
    domain: "动作表征 / 人形机器人 / 动作优化",
    sourcePlatform: "CSDN",
    sourceDate: "2026-07-17",
    sourceUrl: "https://blog.csdn.net/limengshi138392/article/details/161154768",
    tags: ["VLA", "动作表征", "人形机器人", "动作优化", "具身智能"],
    question: "人形机器人 VLA 动作表征应该关注哪些关键点，如何兼顾语义可控、物理可行和安全约束？",
    answer: "人形机器人的动作表征不能只追求模型容易输出，还必须满足物理可行和安全约束。首先要明确动作层级：高层可以是语言子目标或技能 token，中层可以是末端位姿、足端轨迹、抓取点和目标姿态，低层才是关节角、速度或力矩。其次要考虑全身动力学，人形机器人有平衡、接触、摩擦锥、关节限位和自碰撞约束，不能让 VLA 直接生成无约束关节序列。第三是动作时间尺度，长程任务适合输出 action chunk 或技能片段，短时接触控制需要更高频反馈。第四是可解释性和可干预性，最好保留目标物体、目标位姿、接触点、步态阶段等中间量，便于安全过滤和失败诊断。训练上要用遥操作、仿真、真机失败和人工接管数据覆盖多种状态。评估看任务成功率、跌倒率、碰撞率、能耗、动作平滑度和恢复能力。",
  },
  {
    date: "2026-07-23",
    slot: "afternoon",
    publishTime: "15:30",
    title: "VLA模型对比面经：RT-2 OpenVLA π0 GR00T",
    company: "综合",
    role: "机器人基础模型算法工程师",
    direction: "VLA / 机器人基础模型",
    domain: "RT-2 / OpenVLA / π0 / GR00T / SmolVLA",
    sourcePlatform: "古月居",
    sourceDate: "2026-07-21",
    sourceUrl: "https://www.guyuehome.com/wap/detail?id=2051193990079868929",
    tags: ["RT-2", "OpenVLA", "π0", "GR00T", "VLA"],
    question: "面试中如何系统比较 RT-2、OpenVLA、π0、GR00T 和 SmolVLA 这类 VLA/机器人基础模型？",
    answer: "比较 VLA 模型不要只背论文名，要按统一维度拆。第一看输入输出：是否使用图像、语言、本体状态，输出是离散 token、连续动作还是 action chunk。第二看主干结构：RT-2 更强调把 web-scale VLM 知识迁移到机器人动作，OpenVLA 强调开放数据和通用 VLA，π0 更强调连续动作专家和 flow matching，GR00T 更偏人形机器人通用基础模型，SmolVLA 则关注轻量化部署。第三看数据来源：互联网视觉语言数据、机器人遥操作数据、仿真数据和多机器人数据占比不同，会影响泛化和控制能力。第四看动作表示和实时性：离散 token 接 LLM 方便但精度有限，连续动作适合控制但训练难，轻量模型更适合边缘部署。第五看评估：仿真 benchmark、真机任务成功率、跨场景泛化、延迟和安全失败。回答时最好补一句：模型能力最终要落到数据闭环和真机稳定性，而不是参数规模。",
  },
  {
    date: "2026-07-24",
    slot: "morning",
    publishTime: "09:30",
    title: "优必选导航面经：ROS时间同步与地图构建",
    company: "优必选",
    role: "机器人导航算法工程师",
    direction: "机器人导航 / 具身智能",
    domain: "ROS / 时间同步 / 地图构建 / 路径规划",
    sourcePlatform: "牛客",
    sourceDate: "2026-07-24",
    sourceUrl: "https://www.nowcoder.com/enterprise/679/interview",
    tags: ["优必选", "ROS", "导航", "时间同步", "路径规划"],
    question: "机器人导航中，ROS 时间戳如何对齐，相机/激光雷达/里程计不同步会带来什么问题？",
    answer: "ROS 时间戳对齐是多传感器融合的基础。相机、激光雷达、IMU、轮速计和里程计如果时间不同步，同一个物体会被投影到错误位置，导致建图重影、定位漂移、障碍物位置错误和控制滞后。软件上可以用 message_filters 做 approximate time 或 exact time 同步，用 tf2 根据时间戳查询对应坐标变换；硬件上更可靠的是 PTP、触发线或统一时钟源。对于运动机器人，还要做时间补偿：激光雷达一帧扫描期间机器人在移动，需要 deskew；相机曝光和 IMU 高频数据也要插值对齐。工程排查时看各 topic 的 header.stamp、系统时间、延迟分布、tf buffer 是否过期，以及外参是否和时间同步一起校准。评估指标包括重投影误差、点云地图重影程度、定位漂移、路径跟踪误差和动态障碍误检率。面试里要强调：空间外参和时间同步必须一起看，只校外参不校时间会留下隐性误差。",
  },
  {
    date: "2026-07-24",
    slot: "afternoon",
    publishTime: "15:30",
    title: "机器人规划面经：A* DWA TEB MPC怎么区别",
    company: "优必选",
    role: "机器人导航算法工程师",
    direction: "机器人导航 / 运动规划",
    domain: "A* / DWA / TEB / MPC",
    sourcePlatform: "牛客",
    sourceDate: "2026-07-24",
    sourceUrl: "https://www.nowcoder.com/enterprise/679/interview",
    tags: ["A*", "DWA", "TEB", "MPC", "机器人导航"],
    question: "A*、DWA、TEB 和 MPC 在机器人导航中分别解决什么问题，如何组合使用？",
    answer: "A* 通常用于全局路径规划，在栅格地图上搜索从起点到终点的可行路径，优点是可解释、稳定，缺点是只考虑地图代价，不直接处理机器人动力学。DWA 是局部规划方法，在速度空间采样，选择短时间内不碰撞且更接近目标的速度命令，实时性好，但容易受局部极小值影响。TEB 把轨迹表示成带时间间隔的弹性带，同时优化路径形状、时间、障碍距离和运动学约束，适合差速/全向底盘局部避障。MPC 则显式考虑动力学模型和约束，在预测窗口里优化控制序列，适合高速、强约束或需要平滑控制的场景，但计算成本和建模要求更高。实际系统常用 A* 做全局路径，DWA/TEB/MPC 做局部规划和避障，再由底层控制器跟踪速度或轨迹。评估看路径长度、到达率、碰撞率、重规划频率、控制平滑度和动态障碍场景表现。",
  },
  {
    date: "2026-07-25",
    slot: "morning",
    publishTime: "09:30",
    title: "VLA数据面经：遥操作质量控制与样本筛选",
    company: "综合",
    role: "机器人数据算法工程师",
    direction: "VLA / 机器人数据",
    domain: "遥操作 / 数据质检 / 样本筛选",
    sourcePlatform: "牛客",
    sourceDate: "2026-07-25",
    sourceUrl: "https://www.nowcoder.com/feed/main/detail/7b8f541c9bef4733a0f738d0628b1f65",
    tags: ["遥操作", "机器人数据", "VLA", "数据质检", "具身智能"],
    question: "VLA 遥操作数据采集后，如何做质量控制、异常样本筛选和训练集构造？",
    answer: "遥操作数据不能采完就直接训练。首先要做完整性检查：图像、深度、本体状态、动作、语言指令、时间戳和成功标记是否齐全。其次做时间对齐和轨迹切分，把连续日志切成 episode，并标注成功、失败、中断、人工接管和环境异常。质量控制要筛掉明显坏样本，比如相机遮挡、外参错误、夹爪空抓、动作抖动、延迟过大、任务描述和实际动作不一致。异常样本不能全部删除，失败样本如果标注清楚原因，反而可以用于失败预测、恢复策略和偏好学习。训练集构造要平衡任务、物体、场景、视角和成功/失败比例，避免模型只记住某个背景或操作员习惯。还要保留 hard cases，如遮挡、反光、软物体、狭窄空间和多物体干扰。评估时看数据覆盖率、标注一致性、训练后真机成功率、失败恢复率和跨场景泛化。",
  },
  {
    date: "2026-07-25",
    slot: "afternoon",
    publishTime: "15:30",
    title: "具身世界模型面经：长程任务评估与反事实仿真",
    company: "综合",
    role: "机器人世界模型算法工程师",
    direction: "世界模型 / 具身智能",
    domain: "长程任务 / 反事实仿真 / 闭环评估",
    sourcePlatform: "GitHub",
    sourceDate: "2026-07-25",
    sourceUrl: "https://github.com/WinstonJQ/embodied-interview-qa",
    tags: ["世界模型", "反事实仿真", "长程任务", "闭环评估", "具身智能"],
    question: "具身世界模型如何评估长程任务，为什么需要反事实仿真而不是只看一步预测误差？",
    answer: "长程具身任务里，一步预测误差低不代表策略可用，因为小误差会在多步交互中累积，而且机器人动作会改变未来状态。世界模型要服务决策，就必须评估在不同动作条件下环境如何演化。反事实仿真的价值在于：同一初始状态下，比较不同候选动作会导致什么后果，例如绕左侧是否碰撞、提前闭合夹爪是否滑落、换抓取点是否更稳。训练上可以用真实轨迹学习状态转移，用仿真扩展危险和稀有场景，用失败回流修正模型盲区。评估应从 open-loop 和 closed-loop 两层做：open-loop 看视觉重建、occupancy、物体位姿和接触状态预测；closed-loop 看任务成功率、碰撞率、恢复率、规划收益和长尾场景通过率。还要输出不确定性，告诉规划器哪些预测不可靠。面试回答的关键是：世界模型不是视频生成器，而是能被策略查询、比较和验证的环境动态模型。",
  },
];

function makeArticle(post) {
  const question = post.questions[0];
  const answer = post.questionAnswers[0].answer;
  const shortAnswer = answer.length > 230 ? `${answer.slice(0, 230)}...` : answer;
  return [
    `# 每日精选面试题精讲：${post.company || "综合"}｜${post.direction}`,
    "",
    "> 今日重点：先看面试题目，再看详细解答与分析，最后补充可能追问。",
    "",
    "## 面试题目",
    `1. ${question}`,
    "",
    "## 详细解答与分析",
    `这道题聚焦 ${post.direction}，回答时不要只背模型名，要把问题拆成目标、数据、模型结构、控制链路、安全边界和评估指标。`,
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
const existingQuestions = new Set();
for (const post of posts) {
  for (const question of post.questions || []) existingQuestions.add(normalize(question));
}

const created = [];
for (const candidate of candidates) {
  if (existingQuestions.has(normalize(candidate.question))) continue;
  existingQuestions.add(normalize(candidate.question));
  const postId = `embodied-20260725-${hash(candidate.question)}`;
  const featureId = `daily-${candidate.date}-${hash(`${candidate.date}:${candidate.slot}:${candidate.question}`)}`;
  const post = {
    id: postId,
    title: candidate.title,
    company: candidate.company,
    role: candidate.role,
    direction: candidate.direction,
    domain: candidate.domain,
    category: candidate.direction,
    sourcePlatform: candidate.sourcePlatform,
    sourceDate: candidate.sourceDate,
    sourceUrl: candidate.sourceUrl,
    tags: candidate.tags,
    questions: [candidate.question],
    type: "interview",
    difficulty: "困难",
    content: `2026-07-25 具身智能补发检索候选。来源：${candidate.sourcePlatform}。题目：${candidate.question}`,
    prepTips: "",
    createdAt: now,
    updatedAt: now,
    reviewStatus: "question_ready",
    questionAnswers: [{
      question: candidate.question,
      answer: candidate.answer,
      answerStatus: "model_answered",
      answeredAt: new Date().toISOString(),
      source: "embodied-backfill-2026-07-25",
    }],
  };
  posts.unshift(post);

  const articlePath = `content/xiaohongshu-drafts/${candidate.date}-${hash(`${candidate.slot}:${candidate.question}`)}.md`;
  const feature = {
    id: featureId,
    date: candidate.date,
    slot: candidate.slot,
    publishTime: candidate.publishTime,
    postId,
    title: candidate.title,
    company: candidate.company,
    direction: candidate.direction,
    score: candidate.company && candidate.company !== "综合" ? 90 : 78,
    reasons: [
      "具身智能重点方向",
      "题目文本未重复",
      "已有模型详细回答",
      "带来源链接",
      candidate.company && candidate.company !== "综合" ? `明确公司来源 ${candidate.company}` : "综合来源",
    ],
    sourceUrl: candidate.sourceUrl,
    sourcePlatform: candidate.sourcePlatform,
    sourceDate: candidate.sourceDate,
    articlePath,
    target: "xiaohongshu",
    publishStatus: "draft_ready",
    autoPublish: true,
  };
  features.unshift(feature);
  const draftFile = path.join(ROOT, articlePath);
  await fs.mkdir(DRAFT_DIR, { recursive: true });
  await fs.writeFile(draftFile, `${makeArticle(post)}\n`, "utf8");
  created.push({ featureId, postId, title: candidate.title, date: candidate.date, slot: candidate.slot, articlePath });
}

await writeJson(POSTS_FILE, posts);
await writeJson(FEATURES_FILE, features);
console.log(JSON.stringify({ createdCount: created.length, created }, null, 2));
