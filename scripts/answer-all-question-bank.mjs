import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const POSTS_FILE = path.join(ROOT, "data", "posts.json");
const SHOULD_WRITE = process.argv.includes("--write");

function answerFor(question) {
  const q = String(question || "");

  if (/action token.*连续动作回归.*diffusion policy|action token、连续动作回归和 diffusion policy/i.test(q)) {
    return "Action token 把动作离散成词表，便于复用语言模型的自回归建模和长程规划，适合技能选择、粗粒度控制与跨机器人统一表示，但存在量化误差。连续动作回归直接输出关节、末端位姿或速度，延迟低，适合高频闭环和精细操作，但容易对多解动作取平均。Diffusion Policy 生成整段 action chunk，能表达多峰轨迹并保持平滑，适合抓取、装配等示范分布复杂的任务，代价是多步采样较慢。工程上常采用高层 token 规划、低层连续控制或 diffusion chunk 滚动执行。";
  }
  if (/遥操作.*采集|多相机.*机械臂状态.*力控|时间同步.*语言指令/i.test(q)) {
    return "遥操作采集应为所有传感器和控制流使用统一单调时钟，并记录高精度时间戳。相机按硬件触发或时间戳重采样对齐，机械臂关节、末端位姿和力矩以高频采集，语言指令记录开始、结束与对应任务阶段。离线构建样本时，以控制周期为主时间轴，对连续状态做插值，对图像取最近帧并限制最大时间差；同时保存时钟漂移、丢帧和网络延迟。轨迹按任务边界和关键事件切成 episode，失败样本标注失败时刻、原因、是否接管以及可否恢复。";
  }
  if (/轨迹.*切分 episode|成功、失败、中断|人为接管/i.test(q)) {
    return "Episode 应按完整任务语义和控制连续性切分：从指令下发或进入初始状态开始，到成功、失败、超时、中断或人工接管结束。除最终标签外，还要记录子目标边界、关键接触事件、重试次数、接管时刻和终止原因。成功需由可验证条件判断；失败要区分感知、规划、控制、碰撞和任务超时；中断要区分系统异常与人为暂停。保留失败前后的观测和动作，可用于训练失败检测、恢复策略和困难负样本。";
  }
  if (/imitation learning.*online RL|模仿学习.*强化学习|IL.*RL/i.test(q)) {
    return "模仿学习直接拟合专家示范，样本效率高、训练稳定，适合先得到可用策略，但会受分布偏移和复合误差影响。强化学习能围绕长期成功率、恢复能力和效率继续优化，但真实机器人探索昂贵且危险。常见流程是先用行为克隆或 SFT 初始化，再用离线 RL、仿真 RL 或受约束在线 RL 小步改进；在线阶段加入动作限幅、碰撞检查、不确定性门控和人工接管。失败轨迹应回流为负样本、恢复样本或 reward/critic 数据，而不是直接丢弃。";
  }
  if (/语言规划.*低层控制|skill library|hierarchical policy/i.test(q)) {
    return "语言规划负责把长任务分解为可执行子目标，低层控制负责把子目标转成稳定的连续动作。若任务由可复用且边界清晰的技能组成，例如抓取、开门、放置，适合使用 skill library：高层选择技能并传参数，便于验证和复用。若技能组合复杂、环境动态或需要端到端优化，可用 hierarchical policy，让高层以较低频率产生 latent skill 或目标状态，低层高频执行。分层接口必须包含前置条件、终止条件、失败码和状态反馈，避免高层计划与低层真实执行脱节。";
  }
  if (/Sim-to-real|视觉域随机化|动力学随机化/i.test(q)) {
    return "Sim-to-real 差距主要来自视觉外观、动力学、传感器噪声、控制延迟和接触模型不一致。视觉域随机化改变纹理、光照、背景、相机位姿和遮挡，提升感知鲁棒性；动力学随机化改变质量、摩擦、阻尼、执行器延迟和接触参数，提升控制稳定性；真实少样本微调用少量目标机器人数据校准剩余偏差。还可结合系统辨识、仿真图像风格迁移和残差策略。随机化范围过窄无法泛化，过宽会降低可学习性，因此需用真实验证集迭代校准。";
  }
  if (/具身.*评估.*成功率|鲁棒性.*安全性.*泛化|不能只看成功率/i.test(q)) {
    return "成功率只说明任务是否最终完成，不能反映过程是否安全、稳定和可扩展。具身评估还应包括碰撞率、力/速度越界、人工接管率、near miss、恢复成功率、轨迹平滑度、完成时间和能耗。鲁棒性要测试光照、遮挡、物体位置、传感器噪声和动力学扰动；泛化要覆盖新物体、新场景、新指令组合和不同机器人平台。长程任务还应统计子目标完成率、重规划次数和错误累积。";
  }
  if (/长程任务|长程具身|记忆、子目标分解|动作不可逆/i.test(q)) {
    return "长程 VLA 需要分层记忆与闭环重规划。高层维护任务状态、已完成子目标、物体关系和历史失败，低层只执行短时 action chunk。每个子目标执行后重新感知并验证结果，而不是假设动作成功。对于不可逆动作，应在执行前做风险预测、可达性检查和安全确认，并提供替代方案或人工接管。记忆可由短期时序状态、结构化场景图和可检索事件日志组成，避免把全部历史都塞进上下文。";
  }

  if (/均匀采样.*关键帧采样|帧采样.*取舍/i.test(q)) {
    return "均匀采样覆盖全局时间轴，适合视频分类和整体摘要，但可能漏掉短暂事件；关键帧采样依据镜头切换、语义变化或显著性，适合事件定位和摘要；运动感知采样根据光流或帧差增加快速动作区域的采样密度；自适应采样由轻量模型根据问题和内容动态决定取帧，效果最好但增加系统复杂度。实际系统常先低成本均匀扫描，再对高变化或与问题相关的片段加密采样。";
  }
  if (/temporal token.*压缩|长上下文 attention.*取舍/i.test(q)) {
    return "Temporal token 压缩通过池化、聚类、token merging、事件边界聚合或可学习 query，把相邻帧的冗余表示合并。为保留动作变化，应对高运动、状态转折和关键对象交互降低压缩率，并加入时间位置编码和顺序监督。直接长上下文 attention 保留细节更完整，但计算与 KV Cache 随 token 数快速增长；压缩显著降低成本，却可能丢失短暂事件和精确顺序。常见方案是多尺度表示：低频全局 token 加高频关键片段 token。";
  }
  if (/视频问答.*评估|动作理解.*事件边界.*因果|跨镜头一致性/i.test(q)) {
    return "视频问答评估应按能力拆分。动作理解测试主体、动作和对象是否正确；事件边界用 temporal IoU、mAP 或边界误差衡量起止时间；因果关系需设计仅看单帧无法回答的前因后果题；跨镜头一致性检查同一实体、状态和事件在镜头切换后是否保持；细粒度属性再评估颜色、数量和局部动作。除自动准确率外，还需人工判断答案是否真正依赖视频证据，并用反事实或打乱帧顺序检测模型是否只靠语言先验。";
  }
  if (/视频模型.*时序一致性.*动作理解.*事件边界.*身份保持/i.test(q)) {
    return "视频模型评估应拆成四个独立维度。时序一致性检查状态变化是否连续，可用帧间特征距离、光流一致性和人工闪烁评分；动作理解用动作类别、主体-动作-对象三元组和顺序问答；事件边界用 temporal IoU、边界误差和 mAP；身份保持用跨帧人脸/物体特征相似度、ID switch 和属性稳定性。还应加入帧顺序打乱、遮挡和镜头切换测试，判断模型是否真正利用时间信息。";
  }
  if (/长视频理解.*记忆压缩|片段检索.*滑窗|跨片段/i.test(q)) {
    return "长视频可采用“分段编码、索引检索、局部推理、全局融合”。先把视频切成语义片段并生成视觉 token、字幕和事件摘要；用向量索引根据问题检索候选片段；对候选片段做高分辨率滑窗推理；最后通过时间图、层次 Transformer 或外部记忆融合跨片段证据。记忆压缩保存实体状态和关键事件，避免重复编码；滑窗保留局部细节，但窗口重叠和跨窗实体对齐必须处理。";
  }
  if (/视频生成.*时序一致性|身份保持.*物理合理性|指令遵循/i.test(q)) {
    return "视频生成评估应覆盖四类指标。时序一致性看帧间结构、运动连续性和闪烁，可结合光流误差、temporal LPIPS 和人评；身份保持检查人物或物体跨帧特征一致性；物理合理性评估重力、碰撞、遮挡、物体恒常性和因果关系；指令遵循检查主体、动作、场景、镜头和时间顺序是否符合文本。FVD 等总体分数不能单独使用，应配合分项 benchmark、人工偏好和真实失败案例。";
  }
  if (/video grounding|视频 grounding|时空定位指标/i.test(q)) {
    return "图像 grounding 只需在单帧定位区域，视频 grounding 还需确定时间范围并保持目标跨帧身份，因此同时包含空间框和时间片段。常见指标包括 temporal IoU、spatial IoU、时空 tube IoU、Recall@IoU、mAP，以及起止边界误差。对移动目标还应评估轨迹连续性和身份切换。数据集要覆盖短事件、长事件、遮挡、镜头切换和多个相似实例，防止模型只靠字幕或单帧线索。";
  }
  if (/视频数据清洗|字幕、ASR|画面内容.*问题答案/i.test(q)) {
    return "多模态视频清洗需先做时间对齐：字幕和 ASR 绑定到精确时间段，画面按镜头或事件切片。随后检查 ASR 置信度、字幕重复和语言一致性，并用视觉文本相似度验证语音描述是否对应画面。问答数据要确认答案能从指定时间段获得，排除只依赖常识、标题或泄漏字幕的样本。还应检测静态视频、黑屏、重复片段、音画错位和敏感内容，并通过抽样人审校准自动阈值。";
  }
  if (/在线视频理解服务|帧抽取成本|encoder 缓存|响应延迟/i.test(q)) {
    return "在线视频理解应将解码、取帧、视觉编码和语言推理解耦。先用低成本镜头切分或运动检测减少无效帧，再按问题自适应加密关键片段；相同视频的视觉特征按视频哈希和时间段缓存，避免重复跑 encoder；长视频采用分段批处理和异步预取。延迟监控要拆成视频下载、解码、encoder、检索和 LLM 阶段，并限制最大帧数、分辨率和上下文 token。热点视频可预计算特征，实时流则使用滑窗增量编码。";
  }
  if (/视频模型如何建模动作|因果关系.*事件边界/i.test(q)) {
    return "动作建模需要同时保留局部运动和长程状态变化，可结合时空视觉编码器、光流/轨迹特征和 temporal attention。事件边界可用帧级分类、边界回归或变化点检测；因果关系需要对事件先后、反事实和主体状态转移建模，而不能只做共现匹配；跨镜头一致性依赖实体重识别、场景图和长期记忆。训练数据应包含动作起止、主体对象、状态前后变化和跨镜头关联标注。";
  }

  if (/RLHF、DPO、GRPO、PPO|优化目标.*训练数据.*稳定性/i.test(q)) {
    return "PPO 和 GRPO 属于在线策略优化：PPO 用 value model/GAE 估计优势并限制更新幅度，灵活但模型多、显存高；GRPO 用同一 prompt 的组内相对奖励构造优势，可省去 value model，适合可验证推理。DPO 直接用 chosen/rejected 偏好对优化策略与参考模型的相对概率，训练简单稳定，但依赖离线偏好数据覆盖。RLHF 是更宽泛流程，通常包含 SFT、奖励模型和策略优化。共同风险包括 reward hacking、长度偏置、KL 失控和分布外泛化差。";
  }
  if (/Reward model.*偏好数据|reward hacking|长度偏置/i.test(q)) {
    return "奖励模型通常用同一 prompt 下的回答对训练，使 preferred 回答得分高于 rejected 回答。数据应覆盖正确性、帮助性、安全性、格式和不同长度，并保留标注分歧。为降低长度偏置，可做长度配对、分桶采样和残差校准；为防 reward hacking，要加入对抗样本、规则审计和独立测试集；分布外回答可通过不确定性估计、拒绝评分和周期性在线人审处理。奖励模型不能只看训练准确率，还要验证与真实任务通过率和人工偏好的一致性。";
  }
  if (/helpfulness.*harmlessness.*truthfulness|对齐训练如何评估/i.test(q)) {
    return "对齐评估应拆成帮助性、安全性、真实性和任务能力。Helpfulness 看指令完成度、相关性和可执行性；harmlessness 用红队集测试违法、伤害、隐私和越权请求；truthfulness 检查事实准确、引用可靠和不确定性表达；复杂任务通过率则用代码测试、数学验证器、工具调用成功率和多步任务完成率。还需监控过度拒答、回答长度偏置、能力回退和不同语言/群体上的公平性。";
  }

  if (/自动驾驶世界模型.*BEV.*occupancy|环境动态/i.test(q)) {
    return "自动驾驶世界模型把历史多传感器观测、车辆状态和候选动作编码为场景状态，并预测未来。BEV 提供统一鸟瞰坐标，occupancy 描述空间占用和可见/不可见区域，轨迹预测表示交通参与者可能运动，规划动作作为条件影响未来演化。训练可结合重建、未来 occupancy、运动、轨迹和控制损失。真正价值需在闭环仿真中检验：模型不仅要预测像素或特征，还要在自车动作变化时生成合理交互结果。";
  }
  if (/驾驶数据闭环|长尾场景挖掘.*自动标注|训练回流.*仿真评测/i.test(q)) {
    return "驾驶数据闭环从线上日志中用接管、急刹、碰撞预警、低置信度和规则触发挖掘候选场景，再做聚类去重和优先级排序。自动标注结合多帧融合、教师模型和地图信息生成 3D 目标、车道、occupancy 与轨迹，并对低置信样本送人审。训练后先离线回放，再在可交互仿真中评估安全、舒适和法规指标；新的失败案例继续回流。关键是版本化数据、标签、模型和场景，才能追踪每次迭代收益。";
  }
  if (/BEV、occupancy、轨迹预测.*端到端规划|表示角色/i.test(q)) {
    return "BEV 将多摄像头和雷达信息映射到统一鸟瞰空间，便于几何推理；occupancy 进一步表达每个空间单元是否被占用、类别和运动状态，能覆盖非规则物体；轨迹预测描述其他参与者未来的多模态行为；端到端规划根据这些状态和导航目标直接输出自车轨迹或控制。世界模型可把它们组织成从当前状态到未来状态的层次表示，但应避免中间表示与最终规划目标割裂。";
  }
  if (/世界模型和传统感知|传统感知预测规划|优势.*风险.*可解释/i.test(q)) {
    return "传统栈将感知、预测和规划模块化，接口清晰、易定位问题，但误差会逐级传播且难以联合优化。世界模型学习环境状态转移，可利用海量无标签视频、做反事实 rollout，并让规划直接考虑动作对未来的影响。风险包括生成未来不真实、长时误差累积、闭环分布漂移和难以给出安全保证。可解释性可通过显式 BEV/occupancy、对象轨迹、因果探针和反事实场景提升，同时保留规则安全层和模块化诊断指标。";
  }
  if (/多传感器数据.*相机.*激光雷达|时间空间对齐/i.test(q)) {
    return "时间对齐需使用硬件同步、PTP/GPS 时钟或统一高精度时间戳，并估计传感器固定延迟和时钟漂移；对不同频率数据按目标时间插值或取最近帧。空间对齐先做相机内参，再求各传感器到车体坐标系的外参，并在线监控震动导致的漂移。车辆运动期间还需用 IMU/里程计做运动补偿，将点云、图像和雷达测量变换到同一参考时刻。校准质量可用重投影误差、地图对齐和跨传感器目标一致性评估。";
  }
  if (/端到端自动驾驶.*安全边界|法规约束.*分布外|可解释性/i.test(q)) {
    return "端到端模型不应独自承担全部安全责任。训练中加入法规、碰撞、可行驶区域和舒适性损失；推理时由独立安全层检查速度、间距、交通规则和轨迹可达性，必要时覆盖模型输出。分布外检测可结合特征距离、模型集成和不确定性，触发降级或人工接管。可解释性通过输出关键对象、占用、候选轨迹及风险评分实现。验证必须覆盖闭环仿真、故障注入、长尾场景和形式化安全约束。";
  }
  if (/仿真评测.*场景真实性|交互合理性.*覆盖率/i.test(q)) {
    return "仿真真实性包括传感器外观、道路几何、交通行为和车辆动力学与真实分布的一致性；交互合理性要求其他参与者会响应自车动作，而非固定回放。覆盖率应按天气、道路、交通密度、行为类型和风险等级建立场景 taxonomy，并重点覆盖长尾。指标除碰撞、接管和任务完成外，还要包含法规、舒适性、最小 TTC 和恢复能力。通过真实日志回放校准仿真，并用场景参数与结果链路保证可解释和可复现。";
  }
  if (/corner case|near miss|接管片段|标注不确定/i.test(q)) {
    return "Corner case 可由规则触发、模型低置信、预测分歧和异常检测共同挖掘；near miss 可用 TTC、急刹、横向距离和风险模型识别；接管片段需向前回溯若干秒捕获诱因，并区分安全接管与舒适性接管。标注不确定样本可根据多标注者分歧、教师模型方差和时序不一致筛选。候选场景还需聚类去重、按风险和新颖度排序，避免数据闭环被大量相似普通样本淹没。";
  }
  if (/座舱多模态.*语音.*视觉|车控状态.*用户上下文/i.test(q)) {
    return "座舱模型应把语音 ASR、摄像头视觉、车辆 CAN 状态、导航和用户历史按时间对齐，并通过模态专用编码器接入统一语言模型。用户请求先做意图与权限判断，再生成可执行车控计划；涉及驾驶安全的功能必须经过白名单、状态机和二次确认，禁止模型直接发送任意控制指令。隐私上要最小化采集、区分本地与云端处理并隔离用户记忆。评估既看交互成功率，也看误触发、越权、分心风险和不同噪声场景鲁棒性。";
  }

  if (/DeepSpeed ZeRO、Megatron|数据并行.*张量并行.*流水|序列并行.*专家并行/i.test(q)) {
    return "数据并行复制模型并切分 batch，适合模型能放入单卡但需要扩吞吐；张量并行切分单层矩阵，解决单层过宽；流水线并行按层切分，解决模型过深但有 bubble；序列并行沿 token 维切分 LayerNorm、激活等，降低长序列显存；专家并行把 MoE 专家分布到不同设备，通过 all-to-all 路由 token。ZeRO/FSDP 则切分优化器状态、梯度和参数。实际系统通常组合使用，瓶颈在显存、通信、负载均衡和调度复杂度。";
  }
  if (/ZeRO-1\/2\/3|分别切分哪些状态/i.test(q)) {
    return "ZeRO-1 只切分优化器状态，通信变化较小；ZeRO-2 再切分梯度，进一步省显存；ZeRO-3 连参数也切分，每层计算前按需 all-gather 参数，显存节省最大但通信和调度最复杂。以 Adam 为例，优化器状态通常是显存大头，因此 ZeRO-1 已有明显收益；ZeRO-3 适合单卡无法容纳模型参数的情况。选择时要考虑网络带宽、micro-batch、参数重用、通信重叠和 CPU/NVMe offload，不能只看理论显存。";
  }
  if (/Megatron.*tensor parallel|列切分.*行切分|collective 通信/i.test(q)) {
    return "Megatron 张量并行通过列切分和行切分让相邻线性层的通信最小化。第一层按输出维列切分，每卡产生部分隐藏特征，后续可直接并行计算；第二层按输入维行切分，每卡计算部分结果，最后用 all-reduce 合并。注意力头和 FFN 中间维也按类似方式切分。Collective 通信保证不同卡上的部分张量在需要时聚合；切分顺序若设计不当，会在每层之间产生额外 all-gather，吞吐显著下降。";
  }
  if (/训练.*显存.*参数.*梯度.*优化器|临时 buffer|通信 buffer/i.test(q)) {
    return "训练显存由模型参数、梯度、优化器状态、激活值和临时/通信缓冲组成。BF16 参数约 2 字节，梯度通常再 2 字节；Adam 的一阶、二阶矩及可能的 FP32 主权重会带来每参数约 8–12 字节额外开销。激活随 micro-batch、序列长度、隐藏维和层数增长，长序列时常成为主项。临时 buffer 来自 attention、算子 workspace 和通信桶。优化可用 ZeRO/FSDP、混合精度、checkpointing、FlashAttention、序列并行和 offload。KV Cache 主要属于推理显存，不应和训练激活混为一谈。";
  }
  if (/gradient checkpointing.*FlashAttention|activation offload/i.test(q)) {
    return "Gradient checkpointing 不保存部分前向激活，反向时重算，显著省显存但增加计算；FlashAttention 通过分块和在线 softmax 减少注意力矩阵的显存读写，通常同时提升速度和降低显存；activation offload 把激活移到 CPU/NVMe，显存收益大但受 PCIe 带宽和同步影响。三者可组合，但需避免重算与 offload 造成过多等待。稳定性方面 FlashAttention 应验证数值误差，checkpointing 要保证随机算子状态一致，offload 要监控传输超时。";
  }
  if (/FP16、BF16、FP8|混合精度.*FP16/i.test(q)) {
    return "FP16 尾数精度较高但指数范围小，容易梯度溢出，通常需要 loss scaling；BF16 与 FP32 指数范围相同，训练更稳定，现代大模型常优先使用，但细粒度精度略低；FP8 显存和算力收益更大，需要硬件支持、逐张量/通道缩放、amax 历史和高精度累积。选择时看硬件、模型规模和稳定性：BF16 常作默认，FP16 用于旧硬件，FP8 适合成熟训练栈的大规模加速，并需监控 loss spike 和层级溢出。";
  }
  if (/global batch.*micro batch|pipeline bubble|通信重叠/i.test(q)) {
    return "Global batch = micro-batch × 数据并行度 × 梯度累积步数。增大 micro-batch 可提高算子利用率，但会增加激活显存；减小 micro-batch 并增加累积能省显存，却可能降低吞吐。流水线并行需要足够多 micro-batch 填满各 stage，减少 bubble；通信重叠则把梯度 all-reduce、参数 all-gather 放到相邻计算后面。调参时先满足显存，再通过 profile 找算子、流水线空闲和通信占比，并同步调整学习率与 global batch。";
  }
  if (/loss spike|梯度溢出|数据异常|通信 hang/i.test(q)) {
    return "定位大规模训练异常要保存 step 级 loss、梯度范数、学习率、数据批次 ID 和通信事件。Loss spike 先排查异常样本、长度突变和学习率，再检查数值溢出；梯度溢出可查看各层 amax、loss scale 和 NaN 首发层；数据异常通过固定批次复现和数据哈希定位；通信 hang 则检查各 rank 是否走到同一 collective、张量形状是否一致、超时日志和网络错误。应支持自动跳过坏批次、保存故障 checkpoint 和最小规模复现。";
  }

  if (/KV cache.*显存.*batch|序列长度.*层数.*head/i.test(q)) {
    return "KV Cache 显存近似为 batch × 序列长度 × 层数 × 2(K/V) × KV 头数 × head_dim × 数据类型字节数。对普通 MHA，KV 头数等于注意力头数；GQA/MQA 通过减少 KV 头显著降低缓存。显存随 batch 和上下文长度线性增长，生成过程中还会继续累积。部署时应同时考虑并发序列、最大上下文、beam 数、前缀共享和显存碎片，并用分页缓存、KV 量化或 eviction 控制水位。";
  }
  if (/PagedAttention.*显存利用率|连续 KV cache/i.test(q)) {
    return "传统 KV Cache 为每个请求预留连续最大空间，实际长度不一会造成内部浪费和外部碎片。PagedAttention 把缓存切成固定大小 block，逻辑地址连续但物理块可分散分配，请求增长时按需追加，结束后立即回收；前缀还可通过引用计数共享。这样能提高显存利用率和并发数。代价是块表查询、调度与拷贝更复杂，block 太小管理开销高，太大又增加尾部浪费。";
  }
  if (/continuous batching.*吞吐|调度公平性/i.test(q)) {
    return "Continuous batching 不等待整个静态 batch 完成，而是在每个 decode step 动态加入新请求、移除已完成请求，使 GPU 长期保持高利用率。吞吐因此提高，但长请求可能占用资源更久，短请求可能排队；过大的 token batch 也会增加单步时间和 P99 延迟。调度器通常结合优先级、等待时间、剩余长度估计和 prefill/decode 分离，设置最大 batch token、抢占或 chunked prefill，在吞吐与公平性间取舍。";
  }
  if (/speculative decoding|draft model.*接受率/i.test(q)) {
    return "Speculative decoding 由小 draft model 一次提出多个 token，大模型并行验证；被接受的连续 token 可减少大模型串行 decode 次数。收益取决于 draft 速度、提议长度、接受率、大模型验证效率和额外 KV/调度开销。接受率高且 draft 足够小才有明显加速；提议太长会增加拒绝后的浪费。应在不同任务、温度和上下文长度下测平均接受 token 数、端到端延迟和吞吐，而不是只看理论步数。";
  }
  if (/INT8、INT4、AWQ、GPTQ、SmoothQuant|量化.*部署/i.test(q)) {
    return "GPTQ 是基于校准数据和二阶近似的离线权重量化，适合单批或低并发部署；AWQ 保护重要激活通道，常用于低比特权重量化且质量较稳；SmoothQuant 把激活离群值部分迁移到权重，适合权重与激活 INT8；INT8 通常质量风险较低，INT4 显存收益更大但对数学、代码和长上下文更敏感。部署选择还取决于硬件 kernel、是否量化 KV Cache、吞吐目标和校准集代表性。";
  }
  if (/RoPE scaling.*KV eviction|prefix cache|长上下文推理/i.test(q)) {
    return "RoPE scaling 调整位置频率以扩展模型可处理的长度，但可能损害短上下文和远距离注意力；KV eviction 在缓存不足时删除低价值历史 token，需要保留系统指令、关键实体和近期上下文；prefix cache 复用相同系统提示或文档前缀的 KV，降低重复 prefill；检索增强则把海量历史放在外部索引中，按需取回证据。它们分别解决位置外推、缓存容量、重复计算和知识规模问题，通常组合使用。";
  }
  if (/TTFT.*TPOT|显存水位.*队列等待/i.test(q)) {
    return "线上推理应同时监控请求级和系统级指标。TTFT 反映排队、prefill 和调度，TPOT 反映 decode 速度；吞吐统计 token/s 和 requests/s；显存看权重、KV Cache、水位峰值和碎片；稳定性看错误率、OOM、超时和重试；队列等待按优先级与输入长度分桶。还应记录 batch token、活跃序列数、cache 命中和抢占次数。告警需关联这些指标，例如 TTFT 上升但 TPOT 正常，多半是排队或 prefill 拥塞。";
  }
  if (/LoRA 多租户|adapter 热切换|权重合并.*隔离/i.test(q)) {
    return "多租户 LoRA 服务通常共享基座权重，把 adapter 独立存储并按请求加载。热门 adapter 常驻 GPU，冷门 adapter 放 CPU 并异步预取；批处理时尽量聚合同一 adapter，或使用支持多 adapter 的 fused kernel。永久合并适合单一固定业务，动态服务不宜频繁合并。缓存需按模型版本、adapter ID 和精度隔离，租户权限控制防止越权加载；还要限制 adapter 大小、校验权重来源，并监控切换延迟和显存抖动。";
  }
  if (/线上推理如何权衡首 token|上下文长度.*服务稳定/i.test(q)) {
    return "首 token 延迟主要由排队、输入预处理和 prefill 决定，吞吐则依赖 batching 和 GPU 利用率；增大 batch 能提吞吐，却可能拉高 TTFT。长上下文增加 attention 计算和 KV Cache，压缩并发空间。工程上通过 chunked prefill、continuous batching、PagedAttention、prefix cache、量化和请求分级控制取舍。稳定性要求设置输入长度上限、显存水位保护、超时、降级模型和 admission control，并分别监控 TTFT、TPOT、吞吐、P99、OOM 和队列长度。";
  }

  if (/Vision encoder 输出.*LLM token|projector、Q-Former|cross-attention adapter/i.test(q)) {
    return "视觉 encoder 输出是连续视觉 token，需要映射到 LLM 的隐藏维和语义空间。Linear/MLP projector 参数少、延迟低，适合保留较多视觉 token，但压缩和交互能力有限；Q-Former 用可学习 query 从视觉特征中抽取固定数量语义 token，节省上下文但可能丢局部细节；cross-attention adapter 让语言层在多层读取视觉特征，交互更强但计算和改造成本高。选择取决于分辨率、细粒度任务、token 预算和是否冻结基座。";
  }
  if (/多模态模型如何评估 grounding|OCR、空间关系|多轮视觉对话/i.test(q)) {
    return "多模态评估应按能力拆分。Grounding 用 bbox/区域 IoU、指代表达准确率和区域问答；OCR 分别测试识别、版面理解和文字推理；空间关系覆盖左右、前后、遮挡、计数和相对大小；幻觉用不存在对象提及率和证据一致性；多轮视觉对话检查指代、历史一致性和纠错能力。除公开 benchmark 外，还需构建业务 hard case，并通过图像遮挡、问题改写和反事实样本验证模型是否真正使用视觉证据。";
  }
  if (/指令微调数据.*噪声|OCR 泄漏|答案模板化|评测集污染/i.test(q)) {
    return "图文/视频指令数据应覆盖描述、问答、OCR、grounding、比较、时序和多轮任务。清洗时去重相似图片与文本，检测图文不匹配、模板化答案和低质量合成；OCR 任务要防止答案直接出现在元数据或文件名中；负样本要包含相似对象、错误区域和无法回答问题。评测集需按原始媒体哈希、文本近似和来源站点与训练数据隔离。合成数据最好由视觉验证器或人工抽样确认，不能只相信生成模型自检。";
  }
  if (/VLM 训练中图文对齐|指令微调和偏好对齐/i.test(q)) {
    return "图文对齐阶段让视觉特征进入语言语义空间，常用图文对比、caption 或冻结 LLM 的连接器训练；指令微调让模型学会按用户要求完成 VQA、OCR、grounding、多图和视频任务；偏好对齐进一步优化回答正确性、格式、安全性和拒答行为。三阶段不能颠倒：视觉没对齐时做偏好训练，模型可能只学语言风格；指令数据过窄又会造成能力遗忘。每阶段应使用独立验证集监控视觉利用率和通用能力回退。";
  }
  if (/高分辨率.*动态分辨率|tile 切分|patch 数量.*token 压缩/i.test(q)) {
    return "高分辨率图像的成本主要来自 patch/token 数。动态分辨率按图像长宽和内容选择 token 数，灵活但 batch 形状复杂；tile 切分保留局部细节，适合 OCR、文档和小目标，但需处理跨 tile 关系与重复区域；token 压缩通过池化、合并或 resampler 降低 LLM 上下文成本，可能损失细节。常见方案是低分辨率全局图加若干高分辨率局部 tile，并根据任务选择压缩率。评估需分小字、计数、空间关系和普通场景。";
  }
  if (/OCR、grounding、计数、空间关系|设计评估集/i.test(q)) {
    return "OCR 评估集要覆盖字体、旋转、低清、表格和版面，并分别看字符准确率与问答正确率；grounding 需要对象/区域标注，用 IoU、Recall@K 和指代表达准确率；计数要控制遮挡、密集度和类别混淆，避免答案可由语言先验猜出；空间关系覆盖绝对位置、相对位置、深度、遮挡和多对象组合。四类数据都应包含困难负样本、跨语言和分辨率分层，并检查训练集泄漏。";
  }
  if (/多图理解.*跨图实体|图间关系.*时间顺序/i.test(q)) {
    return "多图理解首先要为每张图加入位置和顺序标识，再通过共享实体表示或跨图 attention 建立关联。跨图实体一致性可用对象重识别、属性匹配和名称绑定；时间顺序需要显式时间 token 与状态变化监督；比较推理则构造必须同时引用多图证据的问题。训练中应随机交换图片顺序、加入相似干扰图和缺失图，防止模型只看单张或依赖固定位置。评估要记录证据图选择和最终答案两个指标。";
  }
  if (/VLM.*视觉幻觉|为什么 VLM 容易出现/i.test(q)) {
    return "视觉幻觉来自训练图文弱对齐、语言先验过强、视觉 token 压缩、细粒度特征不足和解码时无证据约束。数据侧应清洗图文不匹配、加入不存在对象的负样本和区域级标注；模型侧可增强高分辨率/局部特征、跨模态交互和视觉对比损失；解码侧使用区域检索、置信度校准和证据引用；评测侧构建反事实、遮挡和对象不存在测试。仅靠扩大模型通常不能解决，因为语言能力越强也可能越会“合理编造”。";
  }
  if (/caption 数据.*VQA 数据.*合成指令/i.test(q)) {
    return "Caption 数据提供广泛视觉语义和对象属性，适合预训练对齐，但描述通常泛化且缺少精确推理；VQA 数据把视觉证据与具体问题绑定，能训练计数、空间、OCR 和推理，但任务分布较窄；合成指令数据可快速扩展任务和难度，适合多轮、拒答和长尾覆盖，但容易模板化、事实错误和自我偏见。合理配比是用大规模 caption 建基础，再用高质量 VQA/grounding 强化能力，最后用经过验证的合成数据补缺口。";
  }
  if (/多模态模型线上服务|图片预处理|vision encoder 复用|首 token/i.test(q)) {
    return "多模态服务延迟可拆为图片下载/解码、resize/tile、vision encoder、视觉 token 投影、LLM prefill 和 decode。对相同图片用内容哈希缓存 encoder 输出；批量请求按分辨率和 tile 数分桶，减少 padding；热点图片预计算视觉 token；高分辨率任务采用全局低分辨率加局部 tile。首 token 延迟主要受预处理、encoder 和 prefill 影响，可并行下载与预处理、使用更快视觉 backbone、token 压缩和 chunked prefill。";
  }
  if (/CLIP 预训练.*对比学习目标/i.test(q)) {
    return "CLIP 用 batch 内图文配对做双向对比学习，使真实图文对相似度高于其他组合，从而学习开放词汇视觉语义。该目标让后续 VLM 获得强检索和零样本分类基础，但偏向全局语义，对局部属性、计数和空间关系较弱。接入 VLM 时通常保留 CLIP 视觉 encoder，再通过 projector/Q-Former 对齐 LLM，并用 caption、VQA、grounding 和细粒度负样本补足。温度、负样本质量和数据噪声会直接影响对齐空间。";
  }
  if (/Linear projector、MLP projector|信息保留.*训练成本.*推理延迟/i.test(q)) {
    return "Linear projector 仅做维度映射，参数和延迟最低，但难以重组视觉信息；MLP projector 增加非线性，表达更强，成本仍较低；Q-Former 用少量 query 压缩视觉 token，显著节省 LLM 上下文，但可能丢失小目标；cross-attention adapter 在语言层多次读取视觉特征，信息交互最充分，训练和推理成本最高。高吞吐问答可优先 projector，长视觉序列适合 Q-Former，细粒度和多图复杂推理更适合跨层 cross-attention。";
  }
  if (/视觉 grounding.*bbox|指代表达.*hallucination rate/i.test(q)) {
    return "Grounding 评估应同时检查定位与语言理解。BBox 用 IoU、mAP 和 Recall@K；指代表达要求模型根据属性、关系和上下文找到唯一目标；区域问答验证定位后是否正确读取区域内容；hallucination rate 统计模型定位或描述不存在对象的比例。还应覆盖小目标、遮挡、同类多实例、否定指令和复杂关系，并要求模型输出证据区域，避免答案正确但定位错误。";
  }
  if (/视觉 encoder 输出如何对齐到 LLM token|Linear projector.*Q-Former/i.test(q)) {
    return "视觉 encoder 产生的 patch 特征与 LLM 的词向量维度和语义分布不同，需要连接器映射。Linear projector 快且保留全部 token，适合简单高吞吐方案；Q-Former 用可学习 query 做语义压缩，降低 token 数但可能损失局部信息；cross-attention adapter 让 LLM 层直接查询视觉特征，跨模态交互更强但改造和延迟更高。训练通常先冻结两端做对齐，再联合指令微调，并用 OCR、grounding 和细粒度任务验证连接器没有只保留全局语义。";
  }

  if (/音频|语音大模型/i.test(q)) {
    return "音频大模型通常把波形经声学 encoder 转成低频音频 token，再通过 projector 或 cross-attention 接入语言模型。训练需同时覆盖 ASR、语音理解、说话人、情感、环境声和音频问答，并处理采样率、噪声和长音频切分。评估不能只看字错率，还要看语义问答、时间定位、说话人一致性和噪声鲁棒性。在线服务应使用流式分块、缓存声学状态和端点检测控制延迟。";
  }

  return "";
}

const posts = JSON.parse(await fs.readFile(POSTS_FILE, "utf8"));
const unmatched = [];
const answered = [];

for (const post of posts) {
  const existing = new Map((post.questionAnswers || []).map((item) => [item.question, item]));
  const next = [...(post.questionAnswers || [])];
  for (const question of post.questions || []) {
    const current = existing.get(question);
    if (current && ["model_answered", "verified"].includes(current.answerStatus) && String(current.answer || "").length >= 40) {
      continue;
    }
    const answer = answerFor(question);
    if (!answer) {
      unmatched.push({ postId: post.id, title: post.title, direction: post.direction, question });
      continue;
    }
    const record = {
      question,
      answer,
      answerStatus: "model_answered",
      answeredAt: new Date().toISOString(),
      source: "answer-all-question-bank",
    };
    const index = next.findIndex((item) => item.question === question);
    if (index >= 0) next[index] = record;
    else next.push(record);
    answered.push({ postId: post.id, question });
  }
  post.questionAnswers = next;
  if (next.length) post.updatedAt = Math.floor(Date.now() / 1000);
}

if (unmatched.length) {
  console.error(JSON.stringify({ unmatchedCount: unmatched.length, unmatched }, null, 2));
  process.exit(1);
}

if (SHOULD_WRITE) {
  await fs.writeFile(POSTS_FILE, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify({
  mode: SHOULD_WRITE ? "write" : "dry-run",
  answered: answered.length,
  unmatched: unmatched.length,
  samples: answered.slice(0, 20),
}, null, 2));
