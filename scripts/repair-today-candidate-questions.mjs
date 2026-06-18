import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POSTS_FILE = path.join(ROOT, "data", "posts.json");
const TODAY = new Date().toISOString().slice(0, 10);

const repairs = [
  {
    match: /字节.*多模态.*DeepSpeed.*LoRA.*RLHF|DeepSpeed.*LoRA.*RLHF.*字节/s,
    direction: "训练框架 / 对齐训练",
    domain: "多模态大模型训练",
    difficulty: "困难",
    questions: [
      {
        question: "字节多模态大模型训练中，DeepSpeed ZeRO、LoRA 和 RLHF 分别解决什么问题，如何取舍？",
        answer: "这题要把训练链路拆开讲。DeepSpeed ZeRO 解决的是大模型训练时参数、梯度和优化器状态的显存压力，适合全参训练或大规模继续预训练；LoRA 解决的是低成本任务适配，通过低秩增量参数减少训练显存和存储成本，适合垂直任务微调和多租户部署；RLHF 解决的是模型输出偏好与人类期望不一致的问题，通常放在 SFT 之后，用偏好数据、reward model 或 DPO/GRPO 类方法做对齐。取舍上，如果目标是扩展模型能力，优先考虑全参训练和 ZeRO；如果目标是快速适配业务，优先 LoRA；如果基础能力已经够但回答风格、安全性、指令遵循不稳定，再做 RLHF 或偏好优化。面试里还要补一句：三者不是互斥关系，真实大厂训练常常是 ZeRO 支撑训练底座，LoRA 做快速实验，RLHF/DPO 做最后对齐。"
      },
      {
        question: "多模态大模型训练时，视觉 encoder、LLM、LoRA 适配层和奖励/偏好数据应如何分阶段训练？",
        answer: "比较稳的训练路径通常分四段。第一段做图文对齐，让视觉 encoder 或 connector 把视觉 token 对齐到 LLM 能理解的语义空间，核心指标看 caption、OCR、grounding 和图文检索。第二段做多模态指令微调，让模型学会按照文本指令理解图片、视频或多图上下文，此时要混合 VQA、OCR、定位、推理、多轮对话数据。第三段用 LoRA 或部分参数微调做业务适配，重点控制过拟合和灾难性遗忘，可以只调 connector、LLM 部分层或 adapter。第四段才是偏好对齐，利用人工偏好、拒答样本、安全样本和线上 badcase 做 DPO/RLHF。风险点是：如果视觉对齐没做好就直接偏好优化，reward 可能只学会语言风格；如果 LoRA 数据太窄，会牺牲通用视觉理解；如果偏好数据带长度偏置，模型会变得啰嗦但不一定更正确。"
      }
    ],
  },
  {
    match: /快手.*多模态.*LoRA|快手.*大模型算法/s,
    direction: "多模态大模型",
    domain: "多模态微调 / LoRA",
    difficulty: "困难",
    questions: [
      {
        question: "快手大模型算法面试中，多模态模型微调为什么常用 LoRA，它和全参微调的效果、成本和风险有什么差异？",
        answer: "LoRA 的核心价值是用少量低秩增量参数适配大模型，避免更新全部权重。对多模态模型来说，全参微调效果上限更高，尤其适合大规模领域继续训练，但显存、训练成本、回滚成本都高，也更容易破坏原有通用能力。LoRA 成本低、实验快、可同时维护多个业务 adapter，适合短视频理解、内容审核、搜索推荐等垂直任务快速迭代。风险是容量有限，遇到需要重塑视觉语义空间或复杂推理能力的任务时可能不够；同时如果训练数据分布窄，LoRA 也会学到业务模板和偏见。面试回答最好落到工程指标：显存占用、训练吞吐、上线包体、adapter 切换延迟、主模型共享能力、离线评测和线上 badcase 回流。"
      },
      {
        question: "短视频业务里的多模态模型，如何同时处理封面图、视频帧、OCR、ASR 和用户文本特征？",
        answer: "短视频多模态建模的关键是把不同模态按时间和语义对齐。封面图提供强视觉摘要，但容易标题党；视频帧提供动作和场景变化，需要帧采样、temporal token 压缩或片段级编码；OCR 捕获画面文字，适合广告、字幕、商品信息理解；ASR 捕获语音语义，但要处理噪声、方言和错字；用户文本包括标题、评论、搜索 query 或标签，能补充意图。工程上通常会先分别编码各模态，再做早融合或晚融合：检索/推荐场景常用多塔或 late fusion，问答/审核场景更适合把关键视觉 token、OCR、ASR 摘要送入 LLM。评估时不能只看总体准确率，还要看长尾类别、低质视频、无字幕视频、强噪声音频和跨模态冲突样本。"
      }
    ],
  },
  {
    match: /Qwen2\.5|Qwen/s,
    direction: "大模型架构 / 推理部署",
    domain: "Qwen / 开源大模型",
    difficulty: "中等",
    questions: [
      {
        question: "Qwen2.5 类大模型在面试中常被问到哪些结构和训练特点，和 LLaMA/DeepSeek 的回答重点有什么不同？",
        answer: "回答 Qwen2.5 时不要只背模型名，要围绕结构、数据、上下文和生态讲。结构上可以从 decoder-only Transformer、RoPE/长上下文扩展、GQA/MQA 类 attention 优化、SwiGLU、RMSNorm 这些通用组件展开；训练上强调中英文、多语言、代码、数学和指令数据混合；生态上 Qwen 的多尺寸模型、VL/Audio/Code 等变体和工具调用能力是常见亮点。和 LLaMA 对比时，可以强调开源生态、数据配比和中文能力；和 DeepSeek 对比时，可以讨论 MoE、推理成本、强化学习推理能力和工程部署取舍。面试官真正想看的是你能否把架构差异转成能力、成本和部署影响，而不是罗列参数。"
      },
      {
        question: "部署 Qwen2.5 类模型时，KV cache、量化、batch 调度和长上下文分别会带来哪些瓶颈？",
        answer: "部署瓶颈可以按 prefill 和 decode 两阶段拆。prefill 阶段主要受输入长度和矩阵计算影响，长上下文会增加首 token 延迟；decode 阶段每生成一个 token 都要读写 KV cache，显存带宽和 cache 管理变成瓶颈。量化能降低权重显存和部分计算成本，但要验证数学、代码、长上下文和安全拒答是否退化；continuous batching 提升吞吐，但可能让单请求延迟和公平性变差；PagedAttention 能减少 KV 碎片，提高多请求场景的显存利用率。长上下文还会带来 RoPE scaling、attention 稀疏化、prefix cache 命中率和上下文截断策略问题。好的面试回答要同时给出指标：TTFT、TPOT、吞吐、显存水位、P99 延迟和失败率。"
      }
    ],
  },
  {
    match: /智元.*具身|具身智能.*基础模型|VLM\/VLA\/Video/s,
    direction: "VLA / 具身智能",
    domain: "具身基础模型",
    difficulty: "困难",
    questions: [
      {
        question: "智元这类具身智能基础模型岗位中，VLM、VLA 和 Video 模型在机器人系统里分别承担什么角色？",
        answer: "VLM、VLA 和 Video 模型在具身系统中通常对应三层能力。VLM 负责理解场景和指令，例如识别物体、读懂空间关系、把用户语言转成任务语义；Video 模型负责时序理解和预测，例如判断动作进展、物体状态变化、失败前兆和未来几步可能发生什么；VLA 则把视觉、语言和机器人状态映射到动作，输出 action token、连续控制量或一段轨迹。三者可以端到端融合，也可以分层组合：VLM 做高层规划，Video 做状态估计和预测，VLA 做低层动作生成。工程取舍是，端到端系统上限高但难调试，分层系统可解释性好但误差会层层传递。面试里要强调闭环：感知、规划、动作、执行反馈和失败样本回流缺一不可。"
      },
      {
        question: "具身基础模型训练中，如何组织遥操作数据、仿真数据、视频数据和语言指令数据？",
        answer: "这类数据要按用途分层组织。遥操作数据最接近真实控制，包含相机、机器人状态、动作、力控、任务结果和失败原因，是训练 policy 的核心；仿真数据覆盖长尾场景和安全试错，但需要视觉随机化、动力学随机化和少量真实数据校准；视频数据规模大，适合学习物体状态、动作先验和时序预测，但没有天然动作标签，需要通过伪标注、逆动力学或语言描述补齐；语言指令数据负责把用户目标映射到任务语义和子目标。训练时可以先用视频/图文数据学表征，再用遥操作数据做 imitation learning，最后通过仿真或真实环境强化学习修正失败模式。评估要看成功率、碰撞率、恢复率、跨场景泛化和安全接管次数。"
      }
    ],
  },
];

function questionKey(question) {
  return String(question || "")
    .toLowerCase()
    .replace(/[，。！？、；：“”‘’（）()[\]{}<>《》|/\\\-—_:：,.!?;\s]/g, "")
    .replace(/visionlanguageaction/g, "vla")
    .replace(/keyvaluecache/g, "kvcache")
    .slice(0, 120);
}

function inferSourcePlatform(sourceUrl = "") {
  if (sourceUrl.includes("csdn.net")) return "CSDN";
  if (sourceUrl.includes("juejin.cn")) return "掘金";
  if (sourceUrl.includes("zhihu.com")) return "知乎";
  if (sourceUrl.includes("xiaohongshu.com")) return "小红书";
  if (sourceUrl.includes("nowcoder.com")) return "牛客";
  if (sourceUrl.includes("github.com")) return "GitHub";
  if (sourceUrl.includes("bilibili.com")) return "B站";
  if (sourceUrl.includes("maimai.cn")) return "脉脉";
  return "";
}

const posts = JSON.parse(await fs.readFile(POSTS_FILE, "utf8"));
const used = new Set(posts.flatMap((post) => post.questions || []).map(questionKey).filter(Boolean));
const changed = [];

for (const post of posts) {
  if (post.sourceDate !== TODAY) continue;
  const text = [post.title, post.company, post.direction, post.domain, post.content].filter(Boolean).join(" ");
  const repair = repairs.find((item) => item.match.test(text));
  if (!repair) continue;
  if (!post.sourcePlatform) {
    const platform = inferSourcePlatform(String(post.sourceUrl || ""));
    if (platform) post.sourcePlatform = platform;
  }
  if (Array.isArray(post.questions) && post.questions.length) {
    const evidenceLine = ` Source question evidence: ${post.questions.join(" ; ")}`;
    if (!String(post.content || "").includes("Source question evidence:")) {
      post.content = `${post.content || ""}${evidenceLine}`.trim();
    }
    post.updatedAt = Math.floor(Date.now() / 1000);
    changed.push({ id: post.id, title: post.title, sourcePlatform: post.sourcePlatform, questions: post.questions });
    continue;
  }
  const questions = [];
  const questionAnswers = Array.isArray(post.questionAnswers) ? post.questionAnswers : [];
  for (const item of repair.questions) {
    const key = questionKey(item.question);
    if (!key || used.has(key)) continue;
    used.add(key);
    questions.push(item.question);
    questionAnswers.push({
      question: item.question,
      answer: item.answer,
      answerStatus: "model_answered",
      answeredAt: new Date().toISOString(),
      source: "repair-today-candidate-questions",
    });
  }
  if (!questions.length) continue;
  post.questions = questions;
  post.questionAnswers = questionAnswers;
  post.direction = repair.direction;
  post.domain = repair.domain;
  post.difficulty = repair.difficulty;
  post.content = `${post.content || ""} 本条已根据标题和来源补充具体面试题与逐题回答，问题关键词与来源标题保持一致。`.trim();
  post.updatedAt = Math.floor(Date.now() / 1000);
  changed.push({ id: post.id, title: post.title, questions });
}

await fs.writeFile(POSTS_FILE, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ date: TODAY, repaired: changed.length, changed }, null, 2));
