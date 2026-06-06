# 安全与隐私审查记录

审查日期：2026-06-06

## 结论

当前仓库未发现账号、密码、Cookie、Bearer token、私钥、API Key 等硬敏感凭据。

已加固后端写接口：公网部署默认只读；如需开放写入，必须显式配置管理员授权策略。GitHub Pages 发布内容为静态页面，不包含后端写接口。

## 已处理风险

- 后端默认监听地址从 `0.0.0.0` 调整为 `127.0.0.1`，避免本地运行时无意暴露到局域网。
- Render 部署配置已设置 `INTERVIEW_HUB_READONLY=1`，公网后端默认不能新增、修改或删除数据。
- 后端写接口支持 `INTERVIEW_HUB_ADMIN_TOKEN`，配置后需要 `X-Admin-Token` 或 `Authorization: Bearer <token>` 才能写入。
- 后端响应增加安全头：`Content-Security-Policy`、`X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`。
- 页面外链增加 `rel="noopener noreferrer nofollow"` 和 `referrerpolicy="no-referrer"`，降低 opener 劫持和来源泄漏风险。
- `.gitignore` 已排除 `.env`、`logs/`、`__pycache__/`、临时文件。

## 残留风险

- 小红书来源链接中包含 `xsec_token` 参数。它不是账号密码或 Cookie，但属于小红书的链接安全参数，公开后可能过期、被平台风控，或者暴露搜索上下文。当前保留它是因为裸 `/explore/{id}` 链接会触发小红书安全限制。
- 静态页面的收藏夹和学习状态保存在浏览器 `localStorage`，不会上传到 GitHub；但同一浏览器环境下其他同源脚本可读取。当前站点只加载自有脚本，风险可控。
- GitHub Pages 无法直接配置 HTTP 安全响应头。相关安全头只在 `python server.py` 后端服务模式下生效。
- 如果未来开放真实用户发布、评论、收藏同步，需要引入正式登录、权限、审核、限流和数据库备份。

## 建议

- 不要把 `.env`、浏览器 Cookie、登录态文件、Chrome 用户目录、GitHub Token、代理账号密码提交到仓库。
- 若部署后端服务，优先保持只读；需要写入时设置强随机 `INTERVIEW_HUB_ADMIN_TOKEN`，并使用 HTTPS。
- 面经来源链接尽量使用公开可访问链接；对必须依赖平台安全参数的链接，定期重新校验可访问性。
- 定期运行敏感词扫描，重点检查 `password`、`secret`、`cookie`、`token`、`authorization`、`private_key`。
