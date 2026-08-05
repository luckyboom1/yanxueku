# 研学库 · 考研专业课高效学习

一个面向考研专业课的 PWA 学习工具，支持艾宾浩斯记忆复习、刷题自测、错题本、学习统计与多人排行榜。

## 功能特性

- 📚 **知识库**：按科目与章节组织专业课笔记，支持 Markdown 加粗/代码
- 🧠 **记忆复习**：基于艾宾浩斯遗忘曲线自动排期
- ✍️ **刷题自测**：单选/判断题随机组卷，答错自动收录
- 📕 **错题本**：重做正确后自动移除
- 📊 **学习统计**：近 14 天学习时长、知识点掌握度分布、排行榜
- ☁️ **云端同步**：登录后数据同步到 Supabase，离线自动回退本地
- 🌓 **主题切换**：浅色/深色/跟随系统
- 📱 **PWA**：可安装到手机桌面，离线可用

## 本地运行

本项目是纯静态前端，无需构建工具。

```bash
git clone https://github.com/luckyboom1/yanxueku.git
cd yanxueku

# 复制配置模板并填入真实配置
cp config.template.js config.js
# 编辑 config.js，填入你的 Supabase 与 Turnstile 配置

# 任意静态服务器启动
python -m http.server 8080
# 或 npx serve .
```

然后访问 `http://localhost:8080`。

## 配置说明

复制 `config.template.js` 为 `config.js`，并填入以下配置：

```javascript
window.__YANXUEKU_CONFIG__ = {
  SUPABASE_URL: 'https://your-project.supabase.co',
  SUPABASE_KEY: 'your-anon-key',
  TURNSTILE_SITE_KEY: '' // 可选，留空则关闭注册人机验证
};
```

> 📌 本项目部署在 GitHub Pages（纯静态托管，文件仅来自 git 仓库），故 `config.js` 随仓库提交以保证线上可用。其中仅含 **公开凭据**（anon key / Turnstile Site Key，前端每次请求都会携带），提交无安全风险；真正的敏感凭据（service_role、Turnstile secret）**绝不**出现在前端。

## Supabase 后端配置

1. 在 Supabase 中创建项目。
2. 执行 `UPGRADE_SQL.sql` 中的 SQL（注意先单独跑 `DROP TABLE IF EXISTS app_state CASCADE;`）。
3. 在 Authentication → Settings 中配置邮箱确认策略。
4. 若启用 Cloudflare Turnstile，请在 Auth → Protection 中关闭 Supabase 自带 CAPTCHA 强制校验（本应用采用尽力而为模式）。

## 部署

本项目可直接部署到 GitHub Pages、Vercel、Netlify、Cloudflare Pages 等静态托管平台。

部署前请确保：

- `config.js` 随仓库提交（仅含公开凭据，见上文说明）；若改用 Vercel/Netlify 等支持环境变量的托管，可改为在平台配置 `SUPABASE_URL`/`SUPABASE_KEY`/`TURNSTILE_SITE_KEY`。
- 已轮换 Supabase anon key，且旧 key 不再使用（若曾暴露在 Git 历史中）。

## 安全提示

- 不要在前端源码中硬编码 Supabase anon key、Turnstile secret key 等敏感信息。
- 生产环境建议在 Supabase 中开启邮箱确认、使用强密码策略。
- 定期审查 RLS 策略与视图字段，避免泄露用户敏感标识（如 `user_id`）。

## 贡献

欢迎提交 Issue 与 Pull Request。修改涉及安全或数据格式时，请优先在 PR 中说明影响范围。

## License

MIT
