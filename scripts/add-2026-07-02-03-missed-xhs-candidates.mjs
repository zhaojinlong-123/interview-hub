import fs from "node:fs";

const POSTS_FILE = "data/posts.json";
const posts = JSON.parse(fs.readFileSync(POSTS_FILE, "utf8"));
const nowSeconds = Math.floor(Date.now() / 1000);
const nowIso = new Date().toISOString();

const candidates = [
  {
    id: "manual-20260702-morning-bytedance-dynamic-resolution",
    title: "字节多模态大模型面经：动态分辨率与局部切图",
    company: "字节",
    role: "多模态大模型算法工程师",
    direction: "多模态大模型",
    domain: "高分辨率图像理解 / 视觉语言对齐",
    category: "多模态大模型",
    sourcePlatform: "知乎",
    sourceDate: "2026-07-02",
    sourceUrl: "https://zhuanlan.zhihu.com/p/2014314780802967473",
    tags: ["字节", "多模态大模型", "动态图像分辨率", "局部切图", "细粒度理解"],
    questions: [
      "动态图像分辨率与局部切图如何在细粒度识别和推理成本之间取舍？"
    ],
    answer:
      "动态分辨率和局部切图的本质，是用更多视觉细节换取更高计算成本。固定低分辨率输入适合普通场景理解，但会丢掉小字、小目标、图表细节和密集区域；局部切图会把原图按比例切成多个区域，让模型同时看到全局缩略图和局部高分辨率细节，因此更适合 OCR、图表、文档、多目标计数和细粒度属性识别。代价是视觉 token 数增加，视觉编码耗时、显存占用、上下文长度和首 token 延迟都会上升。工程上通常不应所有图片都开最高切图数，而是先用轻量规则或小模型判断任务是否需要细节：普通问答用低分辨率；涉及文字、表格、小目标和坐标关系时提高切图数；超大图再配合区域检索。面试回答可以强调三点：第一，必须保留全局图，避免局部切图丢上下文；第二，切图数量要受最大 token 和延迟预算约束；第三，评估要分开看普通问答、文字识别、细粒度定位和线上延迟，而不是只看一个综合准确率。"
  },
  {
    id: "manual-20260702-afternoon-xpeng-sensor-data-loop",
    title: "小鹏 VLM/VLA 面经：车端多传感器数据闭环",
    company: "小鹏",
    role: "VLM/VLA 算法实习生",
    direction: "自动驾驶 / 世界模型",
    domain: "车端数据 / 多传感器对齐 / 闭环训练",
    category: "自动驾驶 / 世界模型",
    sourcePlatform: "小红书",
    sourceDate: "2026-07-02",
    sourceUrl: "https://www.xiaohongshu.com/explore/6a4486d500000000170285f1?xsec_source=pc_search",
    tags: ["小鹏", "自动驾驶", "多传感器数据", "数据闭环", "VLA"],
    questions: [
      "车端多传感器数据如何做时间对齐、空间标定和异常样本回流，支撑闭环训练？"
    ],
    answer:
      "车端数据闭环要先保证数据本身可对齐、可复现、可追踪。时间对齐上，每路相机、雷达、定位、车控和规划输出都要带统一时钟时间戳；不同频率的数据不能简单按最近帧拼接，而要记录最大时间差，并对车辆运动做插值或补偿。空间标定上，需要维护相机内参、各传感器到车体坐标系的外参，以及外参漂移监控；车辆行驶时还要考虑滚动快门、震动和同步误差。异常样本回流通常来自接管、急刹、低置信度、预测分歧、规则触发和用户反馈，再经过聚类去重、风险分级和人工复核，进入标注和训练集。闭环训练不能只把新数据堆进去，还要做版本管理：记录数据版本、标注版本、模型版本和评测场景版本。最后通过离线回放、可交互仿真和小流量线上验证确认新模型是否真的降低接管率和风险，而不是只提高单帧指标。"
  },
  {
    id: "manual-20260703-morning-kuaishou-long-video",
    title: "快手视频理解面经：长视频检索与层级摘要",
    company: "快手",
    role: "视频理解算法工程师",
    direction: "视频理解 / 多模态大模型",
    domain: "长视频理解 / 片段检索 / 层级摘要",
    category: "视频 / 视觉理解",
    sourcePlatform: "CSDN",
    sourceDate: "2026-07-03",
    sourceUrl: "https://gitcode.csdn.net/69f8558e54b52172bc71bf4c.html",
    tags: ["快手", "视频理解", "长视频", "片段检索", "层级摘要"],
    questions: [
      "长视频理解中如何用片段检索和层级摘要回答跨时间问题？"
    ],
    answer:
      "长视频不能把所有帧一次性塞进模型，否则成本高、上下文长，而且容易被无关片段稀释。更稳的做法是分层处理：第一层把视频按镜头、时间窗口或事件边界切成片段，为每个片段生成短摘要、关键实体、动作和时间范围；第二层建立可检索索引，用户问题来了以后先召回相关片段；第三层对召回片段做高分辨率或更密集的时序推理；最后再把多个片段的证据合并成答案。跨时间问题的难点是顺序和状态变化，例如“他先做了什么，后来为什么失败”。这时摘要不能只写静态物体，还要记录主体、动作、对象、开始结束、状态变化和因果线索。工程上可以保留全局时间线，避免片段之间互相孤立；对高置信片段用细粒度模型复核，对低相关片段只保留摘要。评估时要看片段召回率、答案正确率、时间定位误差和跨片段一致性。"
  },
  {
    id: "manual-20260703-afternoon-zhiyuan-robot-long-horizon",
    title: "智元具身智能面经：机器人长程任务分层控制",
    company: "智元",
    role: "具身智能算法工程师",
    direction: "VLA / 具身智能",
    domain: "长程任务 / 语言子目标 / 分层控制",
    category: "VLA / 具身智能",
    sourcePlatform: "掘金",
    sourceDate: "2026-07-03",
    sourceUrl: "https://juejin.cn/post/7631311804195471396",
    tags: ["智元", "具身智能", "机器人", "长程任务", "分层控制"],
    questions: [
      "机器人长程任务中如何把语言子目标、视觉状态和低层控制连接起来，避免一步错全局崩？"
    ],
    answer:
      "机器人长程任务要把“想做什么”和“怎么动”分开建模。高层语言模块负责把指令拆成可验证的子目标，例如找到杯子、移动到可抓取位置、抓起、放到指定区域；视觉状态模块负责判断每个子目标是否已经满足，例如目标是否可见、手爪是否接触、物体是否稳定；低层控制器负责执行短时动作，并处理限幅、碰撞、速度和力控约束。为了避免一步错导致全局崩溃，每个子目标执行后都要重新感知和校验，而不是默认动作成功；如果状态不符合预期，要触发重试、重新规划或人工接管。训练数据也要包含失败、恢复和中断样本，让模型学会从偏离状态回到任务轨道。面试里可以用一句话概括：高层做任务分解和状态机，低层做连续控制和安全兜底，中间用可验证状态连接；真正可靠的系统依赖频繁闭环，而不是一次性生成完整动作序列。"
  }
];

for (const candidate of candidates) {
  const item = {
    ...candidate,
    type: "interview",
    difficulty: "中等",
    content: `补发候选来源：${candidate.title}。面试题目：${candidate.questions.join(" ")}`,
    prepTips: "围绕原理、工程取舍、评估指标和线上风险展开回答。",
    createdAt: nowSeconds,
    updatedAt: nowSeconds,
    reviewStatus: "question_ready",
    questionAnswers: candidate.questions.map((question) => ({
      question,
      answer: candidate.answer,
      answerStatus: "model_answered",
      answeredAt: nowIso,
      source: "missed-xhs-candidates-2026-07-02-03"
    }))
  };
  delete item.answer;
  const index = posts.findIndex((post) => post.id === item.id);
  if (index >= 0) posts[index] = { ...posts[index], ...item };
  else posts.push(item);
}

fs.writeFileSync(POSTS_FILE, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ upserted: candidates.map((item) => item.id) }, null, 2));
