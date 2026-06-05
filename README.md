# 面经共创站

这是一个不依赖第三方包的面试经验与面试题共享平台 MVP。

## 功能

- 用户发布面试经验或面试题目。
- 所有访问同一个服务的用户都能看到已发布内容。
- 支持关键词、公司、岗位、类型筛选。
- 数据保存到 `data/posts.json`。

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

## 让公网用户访问

这个项目有后端和共享数据，不能只用 GitHub Pages。可选方案：

- 部署到 Render / Railway / Fly.io 等支持 Python 服务的平台。
- 部署到云服务器：运行 `python server.py`，开放端口或用 Nginx 反向代理。
- 后续升级为 Supabase / Firebase / PostgreSQL 数据库，支持登录、点赞、评论和审核。

## Render 部署

仓库已包含 `render.yaml`，可在 Render 中选择 Blueprint 部署：

1. 打开 Render Dashboard。
2. 选择 New -> Blueprint。
3. 绑定 GitHub 仓库 `zhaojinlong-123/interview-hub`。
4. Render 会读取 `render.yaml` 并运行 `python server.py`。

注意：Render 免费实例重启后，本地 JSON 文件可能丢失或回滚。正式长期使用建议升级到 PostgreSQL / Supabase。

## 后续可加功能

- 用户登录和昵称。
- 评论、收藏、点赞。
- 公司和岗位排行榜。
- Markdown 编辑器。
- 管理员审核与敏感词过滤。
- 导出题库和面经。
