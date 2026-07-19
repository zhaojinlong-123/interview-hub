import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POSTS_FILE = path.join(ROOT, "data", "posts.json");

const now = Math.floor(Date.now() / 1000);

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

const candidates = [
  {
    title: "具身智能VLA面经：层级任务规划与低层控制",
    company: "综合",
    role: "具身智能算法工程师",
    direction: "VLA / 具身智能",
    domain: "任务规划 / 低层控制 / 长程执行",
    category: "VLA / 机器人控制",
    sourcePlatform: "牛客",
    sourceDate: "2026-07-17",
    sourceUrl: "https://www.nowcoder.com/search?query=%E5%85%B7%E8%BA%AB%E6%99%BA%E8%83%BDVLA%E9%9D%A2%E7%BB%8F%E5%88%86%E4%BA%AB&type=post",
    tags: ["具身智能", "VLA", "任务规划", "低层控制", "长程任务"],
    questions: [
      {
        question: "长程具身任务中，如何把语言指令拆成子目标，并把子目标稳定落到低层控制器执行？",
        answer: "这题要先说明层级结构：高层负责把自然语言任务拆成可验证的子目标，例如“找到杯子、抓取杯子、移动到桌面、放下杯子”；中层负责把子目标绑定到场景状态和可操作对象；低层控制器负责生成连续动作或轨迹。关键不是简单做 prompt 分解，而是每个子目标都要有可观测的完成条件，例如物体是否被抓住、位姿是否到达、接触力是否稳定。工程上通常会让 VLM/VLA 负责语义理解和动作意图，再由 motion planner、diffusion policy 或 MPC 负责短时控制。为了稳定执行，需要加入状态重估和闭环修正：每执行一个 action chunk 后重新感知，检查目标是否偏移、夹爪是否打滑、环境是否变化。失败时不能一直重试同一动作，而要区分感知失败、抓取失败、路径不可达和动力学异常，再选择重规划、换抓取点或人工接管。评估不能只看最终成功率，还要看子目标完成率、平均重试次数、碰撞率、执行时间和跨场景泛化能力。"
      }
    ],
  },
  {
    title: "具身智能面试题：端到端VLA延迟与动作频率",
    company: "综合",
    role: "VLA 算法工程师",
    direction: "VLA / 具身智能",
    domain: "端到端控制 / 延迟 / action chunk",
    category: "VLA / 系统工程",
    sourcePlatform: "牛客",
    sourceDate: "2026-07-16",
    sourceUrl: "https://www.nowcoder.com/search?query=%E5%85%B7%E8%BA%AB%E6%99%BA%E8%83%BD%E9%9D%A2%E8%AF%95%E9%A2%98%E6%B1%87%E6%80%BB&type=post",
    tags: ["VLA", "端到端控制", "延迟", "action chunk", "机器人系统"],
    questions: [
      {
        question: "端到端 VLA 推理频率低于机器人控制频率时，如何设计 action chunk、插值和安全控制？",
        answer: "VLA 通常运行在较低频率，例如 1-10Hz，而机械臂或底盘控制可能需要 50-1000Hz，所以不能让大模型直接承担所有低层伺服控制。常见做法是让 VLA 输出 action chunk，也就是未来一小段时间的动作序列或关键路点，低层控制器在高频循环里执行插值、轨迹跟踪和安全约束。chunk 不能过长，否则环境变化后动作会滞后；也不能过短，否则模型调用频繁、延迟和抖动会放大。工程上会保留一个滚动窗口：新 chunk 到来后平滑替换旧 chunk，并用观测反馈判断是否提前中止。插值层需要考虑速度、加速度、jerk 和关节限位，不能只做线性插值。安全控制通常放在模型之后，包括碰撞检测、力控阈值、急停、workspace 限制和人机距离约束。面试中可以补充指标：端到端延迟、控制频率、chunk 命中率、动作平滑度、碰撞率、急停次数和任务成功率。核心观点是 VLA 提供语义到动作的意图，低层控制保障实时性和安全边界。"
      }
    ],
  },
  {
    title: "傅利叶机器人面经：人形机器人步态与上肢操作协同",
    company: "傅利叶智能",
    role: "人形机器人算法工程师",
    direction: "具身智能 / 人形机器人",
    domain: "全身控制 / 步态 / 操作协同",
    category: "机器人控制",
    sourcePlatform: "牛客",
    sourceDate: "2026-07-15",
    sourceUrl: "https://www.nowcoder.com/search?query=%E5%82%85%E5%88%A9%E5%8F%B6%E6%9C%BA%E5%99%A8%E4%BA%BA%E5%85%B7%E8%BA%AB%E6%99%BA%E8%83%BD%E4%B8%80%E9%9D%A2%E9%9D%A2%E7%BB%8F&type=post",
    tags: ["傅利叶智能", "人形机器人", "全身控制", "步态", "具身智能"],
    questions: [
      {
        question: "人形机器人同时做行走和上肢操作时，如何处理重心、接触约束和任务优先级？",
        answer: "这题考的是全身控制思路。人形机器人行走时需要保持动态平衡，上肢操作又会改变质心和角动量，因此不能把腿部步态和手臂轨迹完全独立规划。通常会建立全身动力学模型，把足底接触、摩擦锥、关节限位、质心位置和零力矩点等约束统一考虑。任务优先级上，安全和平衡最高，其次是足端接触稳定，再是手部操作精度和姿态舒适性。如果上肢抓取导致身体前倾，控制器需要通过腰部、腿部和足底力矩补偿；如果目标不可达，高层应重新规划站位，而不是强行伸手。工程实现可以用 MPC 规划质心和接触序列，用 QP/WBC 求解关节力矩或速度，再用视觉/力觉反馈修正。评估指标包括跌倒率、足底滑移、质心偏移、抓取成功率、接触力峰值、能耗和扰动恢复时间。回答要强调：具身任务不是单一轨迹跟踪，而是在多约束下做任务优先级优化。"
      }
    ],
  },
  {
    title: "优必选人形机器人面经：灵巧手接触状态估计",
    company: "优必选",
    role: "机器人感知与控制算法工程师",
    direction: "具身智能 / 灵巧操作",
    domain: "触觉 / 接触状态 / 抓取稳定性",
    category: "机器人操作",
    sourcePlatform: "牛客",
    sourceDate: "2026-07-15",
    sourceUrl: "https://www.nowcoder.com/search?query=%E4%BC%98%E5%BF%85%E9%80%89%20%E4%BA%BA%E5%BD%A2%E6%9C%BA%E5%99%A8%E4%BA%BA%20%E9%9D%A2%E7%BB%8F&type=post",
    tags: ["优必选", "灵巧手", "触觉", "抓取", "具身智能"],
    questions: [
      {
        question: "灵巧手抓取透明、柔软或易滑物体时，如何融合视觉和触觉判断接触状态？",
        answer: "透明、柔软和易滑物体会让单纯视觉很不可靠：透明物体边界弱，柔软物体形变大，易滑物体抓住后也可能缓慢滑移。因此接触状态估计要融合视觉、触觉、力矩、电流和末端位姿。视觉负责提供初始物体位置、形状和候选抓取点；触觉或力觉负责判断是否接触、接触面积是否足够、压力分布是否均匀；关节电流和末端位姿变化可以辅助判断夹爪是否空抓或物体是否移动。模型上可以做多模态时序分类，输出未接触、稳定接触、滑移、挤压过大、抓取失败等状态。控制上发现滑移时可以增大法向力、调整手指姿态或重新抓取；发现过度挤压时要减小夹持力，避免损坏物体。数据采集要覆盖不同材质、光照、速度和抓取角度，并标注接触事件和失败原因。评估指标除了抓取成功率，还要看滑移检测延迟、误报率、物体损伤率和跨材质泛化。"
      }
    ],
  },
  {
    title: "宇树机器人面经：视觉定位与运动控制闭环",
    company: "宇树科技",
    role: "机器人算法工程师",
    direction: "具身智能 / 机器人控制",
    domain: "视觉定位 / 运动控制 / 闭环",
    category: "机器人系统",
    sourcePlatform: "牛客",
    sourceDate: "2026-07-14",
    sourceUrl: "https://www.nowcoder.com/search?query=%E5%AE%87%E6%A0%91%20%E6%9C%BA%E5%99%A8%E4%BA%BA%20%E9%9D%A2%E7%BB%8F&type=post",
    tags: ["宇树科技", "机器人控制", "视觉定位", "闭环控制", "具身智能"],
    questions: [
      {
        question: "移动机器人在动态环境中执行视觉导航时，如何处理定位漂移、动态障碍和控制延迟？",
        answer: "动态环境视觉导航要把定位、感知、规划和控制放在闭环里看。定位漂移通常来自纹理不足、光照变化、快速运动和动态物体干扰，需要用视觉里程计、IMU、轮速/腿部里程计和回环检测融合，必要时剔除动态特征点。动态障碍不能只在静态地图里规划，要做实时检测、轨迹预测和局部避障；对行人、车辆、宠物这类非静态目标，需要估计速度和意图。控制延迟会让规划轨迹和真实状态错位，因此要做时间戳同步、状态预测和控制补偿，例如用当前速度外推机器人位姿，再把轨迹下发给低层控制。工程上常用全局规划保证可达性，局部规划或 MPC 保证实时避障和动力学约束。评估时不能只看路径长度，要看定位误差、碰撞率、急停次数、重规划频率、目标到达率、平均速度和在人群中的舒适性。核心答案是：先让状态估计可信，再让规划考虑动态，再让控制补偿延迟。"
      }
    ],
  },
  {
    title: "智元机器人面经：三维空间Grounding与动作落地",
    company: "智元机器人",
    role: "具身基础模型算法工程师",
    direction: "VLA / 具身智能",
    domain: "3D grounding / affordance / 操作策略",
    category: "具身基础模型",
    sourcePlatform: "GitHub",
    sourceDate: "2026-07-14",
    sourceUrl: "https://github.com/search?q=%E6%99%BA%E5%85%83+%E5%85%B7%E8%BA%AB%E6%99%BA%E8%83%BD+VLA+%E9%9D%A2%E7%BB%8F&type=repositories",
    tags: ["智元机器人", "VLA", "3D Grounding", "Affordance", "具身智能"],
    questions: [
      {
        question: "VLA 如何把语言中的对象、部位和空间关系 grounding 到 3D 场景，并生成可执行动作？",
        answer: "语言 grounding 到 3D 场景要分三步：先把语言里的对象、属性、部位和空间关系解析出来，例如“把左边桌上的红杯子放到水槽旁”；再把这些概念和视觉/点云中的实例、位姿、可操作部位对齐；最后把目标状态转成可执行的抓取、移动和放置动作。2D VLM 只能看到图像平面，容易在遮挡、深度和可达性上出错，所以具身系统通常需要深度、点云、相机外参和机器人本体状态。affordance 很关键：不是识别出杯子就能抓，还要知道哪里可抓、是否被遮挡、当前夹爪是否能到达。动作生成前要做碰撞检测、逆运动学和轨迹约束，必要时让 VLA 输出中间表征，如目标物体、目标位姿、抓取点和约束条件，而不是直接输出关节角。评估要覆盖语言定位准确率、3D 位姿误差、抓取成功率、空间关系满足率和遮挡场景泛化。"
      }
    ],
  },
  {
    title: "自动驾驶世界模型面经：规划可用的环境预测",
    company: "综合",
    role: "自动驾驶世界模型算法工程师",
    direction: "世界模型 / 自动驾驶",
    domain: "BEV / occupancy / 闭环规划",
    category: "世界模型",
    sourcePlatform: "CSDN",
    sourceDate: "2026-07-14",
    sourceUrl: "https://so.csdn.net/so/search?q=%E8%87%AA%E5%8A%A8%E9%A9%BE%E9%A9%B6%20%E4%B8%96%E7%95%8C%E6%A8%A1%E5%9E%8B%20%E9%9D%A2%E8%AF%95%E9%A2%98&t=all",
    tags: ["世界模型", "自动驾驶", "BEV", "occupancy", "闭环规划"],
    questions: [
      {
        question: "自动驾驶世界模型如何让 occupancy、轨迹预测和规划动作形成可闭环评估的统一表示？",
        answer: "世界模型如果只分别预测 occupancy 或他车轨迹，很容易变成离线感知模型；要服务规划，必须把自车动作、环境状态和未来演化统一起来。一个常见设计是在 BEV 或 latent space 中表示静态地图、动态障碍、可行驶区域和交通规则，再让模型条件化自车候选动作，预测未来 occupancy、参与者轨迹和风险代价。这样规划器可以比较不同动作造成的环境演化，而不是只看单一路径预测。关键训练信号包括真实日志的未来状态、交互场景、规则违反、碰撞/near miss 和人类接管片段。评估也要闭环：同一个世界模型接到规划器里，观察碰撞率、舒适性、通行效率、接管率和长尾场景通过率，而不是只看 ADE、FDE 或 IoU。工程风险是模型可能学到相关性而非因果，例如默认他车总会让行；所以需要反事实数据、仿真扰动和不确定性输出，让规划器知道哪些预测不可靠。"
      }
    ],
  },
  {
    title: "NVIDIA机器人世界模型面经：仿真数据与真实数据混训",
    company: "NVIDIA",
    role: "机器人世界模型算法工程师",
    direction: "世界模型 / 具身智能",
    domain: "仿真数据 / 合成数据 / Sim-to-Real",
    category: "世界模型",
    sourcePlatform: "GitHub",
    sourceDate: "2026-07-13",
    sourceUrl: "https://github.com/search?q=NVIDIA+robotics+world+model+interview+questions&type=repositories",
    tags: ["NVIDIA", "世界模型", "仿真", "合成数据", "Sim-to-Real"],
    questions: [
      {
        question: "机器人世界模型训练中，仿真数据、合成视频和真实遥操作数据应该如何配比和校准？",
        answer: "这题的核心是数据源各自解决不同问题。真实遥操作数据提供真实传感器噪声、机器人动力学、接触细节和人类策略，是模型可信落地的基准；仿真数据提供可控场景、稀有失败样本和安全边界探索；合成视频可以扩展外观、物体和场景多样性，但不一定满足真实动力学。配比不能固定拍脑袋，通常先用大规模仿真/合成数据做预训练，再用真实遥操作数据做对齐和微调，最后用真实失败样本回流修正。校准上要做视觉域随机化、相机噪声建模、动力学参数随机化、接触模型校准和真实小样本验证。数据筛选时要看任务相关性，不是合成数据越多越好；如果合成视频缺少动作-状态因果，可能提升视觉表征但伤害控制。评估应分离视觉泛化、动力学预测、动作成功率和 sim-to-real gap，并用真实机器人闭环测试做最终判断。"
      }
    ],
  },
  {
    title: "Google机器人基础模型面经：RT类模型数据组织",
    company: "Google",
    role: "机器人基础模型算法工程师",
    direction: "VLA / 机器人基础模型",
    domain: "多任务数据 / 动作空间 / 泛化",
    category: "具身基础模型",
    sourcePlatform: "GitHub",
    sourceDate: "2026-07-13",
    sourceUrl: "https://github.com/search?q=Google+robotics+transformer+VLA+interview+questions&type=repositories",
    tags: ["Google", "VLA", "机器人基础模型", "多任务数据", "泛化"],
    questions: [
      {
        question: "多机器人、多任务数据训练 VLA 时，如何统一动作空间并避免模型只记住机器人平台差异？",
        answer: "多机器人数据的难点是动作空间、相机视角、末端执行器和动力学都不同。如果直接混训，模型可能学到平台 ID，而不是任务策略。统一动作空间有几种做法：用末端笛卡尔位姿增量表示动作，弱化不同关节结构；用离散 action token 表示高层动作意图；或者保留机器人本体状态和平台 embedding，让模型知道当前可执行能力。数据组织上要把任务语言、视觉观测、本体状态、动作和成功标记对齐，并保证不同平台上有足够相似任务，方便模型学习共享策略。训练时可以先学通用视觉语言表征，再做机器人动作微调；也可以用 action normalization 和 robot-aware adapter 缓解平台差异。评估必须做跨平台和跨物体测试，例如训练见过 A 机械臂开抽屉，测试 B 机械臂开相似抽屉。关键风险是负迁移：某个平台的动作尺度或控制延迟会污染其他平台，所以要做分平台指标和失败案例分析。"
      }
    ],
  },
  {
    title: "具身智能面经：机器人失败恢复与数据回流",
    company: "综合",
    role: "具身智能算法工程师",
    direction: "VLA / 机器人数据闭环",
    domain: "失败恢复 / 数据回流 / 主动学习",
    category: "机器人数据",
    sourcePlatform: "知乎",
    sourceDate: "2026-07-13",
    sourceUrl: "https://www.zhihu.com/search?type=content&q=%E5%85%B7%E8%BA%AB%E6%99%BA%E8%83%BD%20VLA%20%E9%9D%A2%E7%BB%8F",
    tags: ["具身智能", "VLA", "失败恢复", "数据闭环", "主动学习"],
    questions: [
      {
        question: "机器人执行失败后，如何把失败原因诊断、恢复策略选择和数据回流做成闭环？",
        answer: "机器人失败不能只记录“失败”，要拆成可学习的原因。常见失败包括感知定位错误、抓取点不可达、夹爪打滑、碰撞风险、动作超时、目标状态变化和语言理解错误。系统上可以在每个子目标后做状态校验：目标是否出现、位姿是否正确、接触力是否稳定、动作是否越界。如果失败，先做诊断分类，再选择恢复策略：重新感知、换抓取点、调整力控、退回安全位姿、重新规划路径或人工接管。数据回流要保存失败前后的多模态观测、动作、控制信号、诊断标签和人工修正轨迹，形成 hard negative 和纠错样本。训练时可以用这些样本做失败预测、策略修正和偏好学习，让模型学会什么时候不该继续执行。评估指标包括失败诊断准确率、自动恢复成功率、二次失败率、人工接管率和回流样本带来的成功率提升。面试回答要强调闭环：发现失败、解释失败、恢复失败、学习失败。"
      }
    ],
  },
];

const posts = JSON.parse(await fs.readFile(POSTS_FILE, "utf8"));
const existingQuestions = new Set();
for (const post of posts) {
  for (const question of post.questions || []) existingQuestions.add(normalize(question));
}

let added = 0;
const addedIds = [];
for (const candidate of candidates) {
  const questions = candidate.questions.filter((item) => !existingQuestions.has(normalize(item.question)));
  if (!questions.length) continue;
  for (const item of questions) existingQuestions.add(normalize(item.question));
  const id = `embodied-20260719-${hash(`${candidate.title}:${questions[0].question}`)}`;
  posts.unshift({
    id,
    title: candidate.title,
    company: candidate.company,
    role: candidate.role,
    direction: candidate.direction,
    domain: candidate.domain,
    category: candidate.category,
    sourcePlatform: candidate.sourcePlatform,
    sourceDate: candidate.sourceDate,
    sourceUrl: candidate.sourceUrl,
    tags: candidate.tags,
    questions: questions.map((item) => item.question),
    type: "interview",
    difficulty: "困难",
    content: `2026-07-19 具身智能专项检索候选。来源：${candidate.sourcePlatform}。题目：${questions.map((item) => item.question).join("；")}`,
    prepTips: "",
    createdAt: now,
    updatedAt: now,
    reviewStatus: "question_ready",
    questionAnswers: questions.map((item) => ({
      question: item.question,
      answer: item.answer,
      answerStatus: "model_answered",
      answeredAt: new Date().toISOString(),
      source: "embodied-search-2026-07-19",
    })),
  });
  added += 1;
  addedIds.push(id);
}

await fs.writeFile(POSTS_FILE, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ added, addedIds }, null, 2));
