import fs from "node:fs";

const POSTS_FILE = "data/posts.json";
const posts = JSON.parse(fs.readFileSync(POSTS_FILE, "utf8"));
const nowSeconds = Math.floor(Date.now() / 1000);
const nowIso = new Date().toISOString();

const candidate = {
  id: "manual-20260701-kuaishou-video-vlm",
  title: "快手多模态算法面试题：短视频理解与多模态样本构造",
  company: "快手",
  role: "多模态算法工程师",
  direction: "视频理解 / 多模态大模型",
  domain: "短视频理解 / VLM / 多模态训练数据",
  category: "视频 / 视觉理解",
  type: "interview",
  difficulty: "中等",
  sourcePlatform: "CSDN",
  sourceDate: "2026-05-04",
  sourceUrl: "https://gitcode.csdn.net/69f8558e54b52172bc71bf4c.html",
  tags: [
    "快手",
    "多模态大模型",
    "视频理解",
    "短视频推荐",
    "VLM",
    "数据构造"
  ],
  questions: [
    "视频理解里如何做长视频分段、层级表征和摘要，避免只看关键帧丢失动作过程？",
    "短视频推荐场景中如何把画面、字幕、音频和用户反馈统一构造成多模态训练样本？"
  ],
  content:
    "来源文章说明其基于 2025-2026 年快手多模态算法岗真实面经整理，覆盖 CLIP/BLIP 原理、视频理解、VLM 对齐、业务场景和训练优化等考点。本文抽取两个更适合日常复习的专业题目：视频理解里如何做长视频分段、层级表征和摘要，避免只看关键帧丢失动作过程？短视频推荐场景中如何把画面、字幕、音频和用户反馈统一构造成多模态训练样本？",
  prepTips: "重点关注视频时序建模、多模态对齐、样本构造、弱标签噪声处理、线上推荐目标和离线评估之间的关系。",
  createdAt: nowSeconds,
  updatedAt: nowSeconds,
  questionAnswers: [
    {
      question: "视频理解里如何做长视频分段、层级表征和摘要，避免只看关键帧丢失动作过程？",
      answer:
        "长视频不能只抽几张关键帧后交给图文模型，因为动作、因果和状态变化都藏在帧间。工程上通常先做分段：可以按镜头切换、时间窗口或事件边界把视频切成 clip，每个 clip 保留连续帧或稀疏帧序列；再做层级表征：底层用视觉编码器或视频 Transformer 提取局部时序特征，中层聚合动作片段和对象状态变化，高层再生成事件摘要或供 LLM 推理。为了避免丢动作过程，采样要覆盖开始、过程、结束三个阶段，不能只取最高置信关键帧；对快速动作可以提高局部帧率，对长静态片段可以降采样。面试里可以强调三点：一是分段要服务任务，例如问答重视事件边界，推荐重视用户停留片段；二是摘要要保留主体、动作、对象、时间顺序和状态变化；三是评估不能只看文本相似度，还要用时序一致性、动作识别准确率、事件定位误差和人工核验检查模型是否真的理解了视频。",
      answerStatus: "model_answered",
      answeredAt: nowIso,
      source: "manual-daily-feature-repair"
    },
    {
      question: "短视频推荐场景中如何把画面、字幕、音频和用户反馈统一构造成多模态训练样本？",
      answer:
        "短视频推荐的数据构造要把内容侧多模态信号和用户侧反馈对齐到同一个样本里。内容侧通常包括视频帧或 clip、封面、OCR 字幕、ASR 文本、背景音乐、声音事件、标题标签和作者信息；用户侧包括曝光、点击、完播、停留时长、点赞、收藏、评论、转发、不感兴趣等行为。构造样本时，先用统一的视频 id 和时间戳把多模态特征对齐，再把用户行为转成监督信号：点击和完播可以做排序目标，长停留和收藏更接近强兴趣，跳出或负反馈可以做负样本。难点在噪声和偏差：字幕可能错、ASR 可能漏，热门视频有曝光偏置，用户点击不一定代表满意。因此需要做去重、质量过滤、曝光校正、负采样和时间切分，避免训练集泄漏到未来。一个成熟回答还要提到多任务训练：用 CTR、完播率、互动率、内容理解辅助任务一起训练，让模型既学会语义对齐，也学会推荐目标。最后用离线 AUC/NDCG、线上 A/B、冷启动效果和长尾内容覆盖率综合评估。",
      answerStatus: "model_answered",
      answeredAt: nowIso,
      source: "manual-daily-feature-repair"
    }
  ]
};

const existingIndex = posts.findIndex((post) => post.id === candidate.id);
if (existingIndex >= 0) {
  posts[existingIndex] = { ...posts[existingIndex], ...candidate };
} else {
  posts.push(candidate);
}

fs.writeFileSync(POSTS_FILE, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
console.log({ upserted: candidate.id, questions: candidate.questions.length });
