# 每日精选面试题精讲：字节｜多模态大模型

> 今日重点：第一页先给公司、方向、题目，后续图片按题目展开完整答案与分析。

## 面试题目
1. Vision encoder 输出如何与 LLM token 空间对齐？Linear projector、Q-Former、cross-attention adapter 的差异是什么？

## 详细解答与分析
这道题聚焦 多模态大模型。回答时要把目标、数据、模型结构、控制链路、安全边界和评估指标讲完整。

## 逐题解答
### 题目 1：Vision encoder 输出如何与 LLM token 空间对齐？Linear projector、Q-Former、cross-attention adapter 的差异是什么？

**详细回答：**
视觉 encoder 输出是连续视觉 token，需要映射到 LLM 的隐藏维和语义空间。Linear/MLP projector 参数少、延迟低，适合保留较多视觉 token，但压缩和交互能力有限；Q-Former 用可学习 query 从视觉特征中抽取固定数量语义 token，节省上下文但可能丢局部细节；cross-attention adapter 让语言层在多层读取视觉特征，交互更强但计算和改造成本高。选择取决于分辨率、细粒度任务、token 预算和是否冻结基座。

**面试展开：**
如果面试官继续追问，可以把答案落到真实项目：数据从哪里来、如何标注、模型输出什么、低层控制怎么兜底、失败样本如何回流、最终指标如何证明有效。

## 可能追问方向
- 如果真实机器人效果不稳定，如何定位是感知、数据、模型还是控制问题？
- 如果离线指标提升但真机成功率不升，下一步怎么排查？
- 这个方案在实时性、安全性、泛化性之间有什么取舍？
- 如何把失败样本转成下一轮训练数据？

## 面经信息
- 公司：字节
- 岗位：大模型相关岗位
- 方向：多模态大模型
- 领域：视觉语言理解
- 难度：中等
- 来源：知乎 2026-06-14
- 原始链接：https://zhuanlan.zhihu.com/p/2014314780802967473

## 核心考点速记
- Vision encoder 输出如何与 LLM token 空间对齐？Linear projector、Q-Former、cross-attention adapter 的差异是什么？

## 小红书发布文案
每日精选：字节｜多模态大模型 题目精讲

面试题目
1. Vision encoder 输出如何与 LLM token 空间对齐？Linear projector、Q-Former、cross-attention adapter 的差异是什么？

一句话答案
视觉 encoder 输出是连续视觉 token，需要映射到 LLM 的隐藏维和语义空间。Linear/MLP projector 参数少、延迟低，适合保留较多视觉 token，但压缩和交互能力有限；Q-Former 用可学习 query 从视觉特征中抽取固定数量语义 token，节省上下文但可能丢局部细节；cross-attention adapter 让语言层在多层读取视觉特征，交互更强但计算和改造成本高。选择取决于分辨率、细粒度任务、token 预算...

引用来源：知乎 2026-06-14
原文链接：https://zhuanlan.zhihu.com/p/2014314780802967473

#具身智能 #VLA #机器人 #世界模型 #大模型面试 #AI学习
