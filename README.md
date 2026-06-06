# 大模型面经学习站

这是一个面向大模型、多模态、VLA/具身智能、视频理解、自动驾驶数据闭环、训练框架、推理优化和 Agent/RAG 方向的面经学习网页。

## 当前功能

- 面经、面试题、视频复盘、题库合集展示。
- 支持关键词、公司、岗位、大分类、来源平台、难度、标签、时间范围筛选。
- 支持学习看板：重点内容、待复习、来源覆盖、平均题量。
- 支持快捷方向筛选：Agent/RAG、VLA 具身、多模态、训练框架。
- 支持学习状态：未读、已读、重点、待复习。
- 支持本地收藏夹、收藏导出、复制复习卡。
- 数据保存在 `data/posts.json`。

## 数据来源

当前样例和自动更新脚本会重点关注：

- 已登录/可控 Chrome 标签页：知乎、小红书、脉脉、牛客、GitHub、力扣中文、博客园、知识星球。
- 公开搜索入口：B站、CSDN、掘金、51CTO、微信公众号搜狗、OfferShow、GitHub。

自动脚本只保存摘要和复习问题，不大段复制原帖正文。

检索平台配置保存在 `data/platforms.json`。通过本地或服务器版网页的“当前检索平台”面板添加、停用、启用或删除平台后，下一次 `scripts/update-interviews.mjs` 会读取最新配置进行检索。GitHub Pages 是静态页面，不能直接写入这个配置文件；需要运行 `python server.py` 或部署后端服务后才能持久化修改。

## 本地运行

```powershell
cd E:\workshop\interview-hub
python server.py
```

访问：

```text
http://127.0.0.1:8088
```

局域网访问：

```text
http://你的电脑局域网IP:8088
```

如果其他电脑打不开，需要在 Windows 防火墙放行 `8088` 端口。

## 手动更新面经

前提：可控 Chrome 已经用远程调试端口启动，并且需要登录的网站已经登录。

默认端口：

```text
http://127.0.0.1:9222
```

手动搜索并追加新面经：

```powershell
cd E:\workshop\interview-hub
node scripts\update-interviews.mjs
```

搜索、去重、追加后自动提交并推送：

```powershell
cd E:\workshop\interview-hub
node scripts\update-interviews.mjs --push
```

脚本会：

- 读取当前 Chrome 已打开的登录页。
- 临时打开公开搜索页并抓取候选结果。
- 根据标题、来源链接去重。
- 追加最多 40 条新候选到 `data/posts.json`。
- 在 `logs/update-YYYY-MM-DD.json` 记录本次更新。

## 每周自动更新

可以注册 Windows 每周任务，让系统每周五固定运行更新脚本。

默认每周五 20:30 执行：

```powershell
cd E:\workshop\interview-hub
powershell -ExecutionPolicy Bypass -File scripts\register-weekly-task.ps1
```

自定义时间：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\register-weekly-task.ps1 -Time "21:30" -Day "FRI"
```

注意：

- 定时任务运行时，最好保持可控 Chrome 的 `9222` 端口可访问。
- 如果小红书、脉脉、知乎、知识星球等登录态过期，需要重新登录。
- 自动任务会运行 `node scripts\update-interviews.mjs --push`，有新增内容时自动推送到 GitHub。
- 最近一次任务日志在 `logs/weekly-task-last.log`。

## 每日精选与小红书草稿

每日精选配置保存在 `data/daily-settings.json`，包含发布时间、重点检索方向和发布目标。网页里的“每日大模型学习精选”面板可以在本地/服务器后端模式下修改这些配置；GitHub Pages 静态页面只能展示，不能持久化保存。

生成每日精选草稿：

```powershell
cd E:\workshop\interview-hub
node scripts\generate-daily-feature.mjs
```

生成后自动提交并推送：

```powershell
node scripts\generate-daily-feature.mjs --push
```

注册每天 9:30 的 Windows 任务：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\register-daily-feature-task.ps1 -Time "09:30"
```

评分体系会综合近期性、重点方向匹配、大厂/重点机构、稀缺方向、高频问题数量、来源链接、难度和摘要信息量。已精选过的面经会记录在 `data/daily-features.json`，后续不会重复选择。生成的小红书草稿保存在 `content/xiaohongshu-drafts/`。

当前没有把小红书账号、密码或 Cookie 写入代码，也不会无授权自动发帖。自动发帖需要额外的浏览器登录态和人工授权；默认策略是生成待发布草稿。

## 公网部署

这个项目有后端和共享数据，不能只用 GitHub Pages。可选方案：

- Render / Railway / Fly.io 等支持 Python 服务的平台。
- 云服务器运行 `python server.py`，开放端口或用 Nginx 反向代理。
- 正式长期使用建议升级到 Supabase / PostgreSQL，支持登录、评论、点赞、收藏同步和审核。

## Render 部署

仓库包含 `render.yaml`，可在 Render 中选择 Blueprint 部署：

1. 打开 Render Dashboard。
2. 选择 New -> Blueprint。
3. 绑定 GitHub 仓库 `zhaojinlong-123/interview-hub`。
4. Render 会读取 `render.yaml` 并运行 `python server.py`。

注意：Render 免费实例重启后，本地 JSON 文件可能丢失或回滚。正式长期使用建议升级到 PostgreSQL / Supabase。
