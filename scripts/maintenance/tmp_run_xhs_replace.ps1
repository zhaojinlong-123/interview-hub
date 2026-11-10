$ErrorActionPreference = "Stop"

$items = @(
  @{
    Title = "字节多模态大模型题目精讲"
    ImageDir = "E:\workshop\interview-hub\content\xiaohongshu-assets\xhs-daily-2026-06-12-362a59bc5046"
    Body = @"
每日精选：字节｜多模态大模型题目精讲
本篇图卡包含：面试题目、完整解答、追问方向。第一页先看公司、方向、题目，后面按顺序复习完整答案。

引用来源：知乎，2026-06-06
原文链接：https://www.zhihu.com/search?type=content&q=%E5%A4%9A%E6%A8%A1%E6%80%81%E5%A4%A7%E6%A8%A1%E5%9E%8B%20%E9%9D%A2%E7%BB%8F
#知乎 #字节 #大模型 #多模态 #面经 #多模态大模型 #大模型面试 #AI学习
"@
  },
  @{
    Title = "VLA具身智能题目精讲"
    ImageDir = "E:\workshop\interview-hub\content\xiaohongshu-assets\xhs-daily-2026-06-13-176a8d789a4e"
    Body = @"
每日精选：综合｜VLA / 具身智能题目精讲
本篇图卡包含：面试题目、完整解答、追问方向。重点看 action token、连续动作回归、diffusion policy 与机器人数据闭环。

引用来源：小红书，2026-06-13
原文链接：https://www.xiaohongshu.com/search_result/6a2b71d9000000002202a62b?xsec_token=ABL8XYuRnDDu-jEmdqXTAo83rlnl9vJDVNfaiGNZ9T3Yo%3D&xsec_source=pc_search
#小红书 #VLA #具身智能 #机器人 #面经 #大模型面试 #AI学习
"@
  },
  @{
    Title = "阿里多模态大模型题目精讲"
    ImageDir = "E:\workshop\interview-hub\content\xiaohongshu-assets\xhs-daily-2026-06-13-c026b29d4659"
    Body = @"
每日精选：阿里｜多模态大模型题目精讲
本篇图卡包含：面试题目、完整解答、追问方向。重点看 VLM 对齐、grounding、OCR、幻觉评估和多模态数据构造。

引用来源：掘金，2026-06-13
原文链接：https://juejin.cn/post/7546495958554755098?searchId=20260613114514BAF850FAEA9651B85182
#掘金 #阿里 #大模型 #多模态 #面经 #多模态大模型 #大模型面试 #AI学习
"@
  },
  @{
    Title = "字节VLA具身智能题目精讲"
    ImageDir = "E:\workshop\interview-hub\content\xiaohongshu-assets\xhs-daily-2026-06-13-2d55b23ddce6"
    Body = @"
每日精选：字节｜VLA / 具身智能题目精讲
本篇图卡包含：面试题目、完整解答、追问方向。重点看 VLA 动作表示、机器人数据采集、轨迹切分和失败样本标注。

引用来源：小红书，2026-06-13
原文链接：https://www.xiaohongshu.com/search_result/6980216c000000000a030e49?xsec_token=ABAay3NYslcXQvn4FXjdFFSxABC1imSiNpT9ruf0xxmKE%3D&xsec_source=pc_search
#小红书 #字节 #VLA #具身智能 #机器人 #面经 #大模型面试 #AI学习
"@
  },
  @{
    Title = "蔚来VLA具身智能题目精讲"
    ImageDir = "E:\workshop\interview-hub\content\xiaohongshu-assets\xhs-daily-2026-06-13-a866a4919061"
    Body = @"
每日精选：蔚来｜VLA / 具身智能 / 世界模型题目精讲
本篇图卡包含：面试题目、完整解答、追问方向。重点看自动驾驶世界模型、BEV、occupancy、轨迹预测、仿真闭环与数据回流。

引用来源：牛客，2026-06-13
原文链接：https://www.nowcoder.com/search?query=VLA%20%E5%85%B7%E8%BA%AB%E6%99%BA%E8%83%BD%20%E9%9D%A2%E7%BB%8F&type=post
#牛客 #蔚来 #世界模型 #VLA #自动驾驶 #具身智能 #面经 #AI学习
"@
  },
  @{
    Title = "字节训练框架推理优化题目精讲"
    ImageDir = "E:\workshop\interview-hub\content\xiaohongshu-assets\xhs-daily-2026-06-13-9d3c283ef28d"
    Body = @"
每日精选：字节｜训练框架 / 推理优化题目精讲
本篇图卡包含：面试题目、完整解答、追问方向。重点看 DeepSpeed ZeRO、Megatron 并行、显存拆解、KV cache、PagedAttention 和量化部署。

引用来源：CSDN，2026-06-13
原文链接：https://so.csdn.net/so/search?q=%E5%A4%A7%E6%A8%A1%E5%9E%8B%20%E9%9D%A2%E7%BB%8F&t=blog
#CSDN #字节 #训练框架 #推理优化 #大模型部署 #面经 #大模型面试 #AI学习
"@
  }
)

foreach ($item in $items) {
  powershell -ExecutionPolicy Bypass -File E:\workshop\tmp_xhs_replace_post.ps1 -Title $item.Title -ImageDir $item.ImageDir -Body $item.Body
}
