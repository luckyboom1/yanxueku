# 研学库 · 考研专业课高效学习

一个面向考研专业课的在线学习工具：**FSRS 自适应记忆引擎**驱动的复习排期、**AI 建卡与语义批改**、刷题自测、错题本、知识掌握热力图、学习统计与多人排行榜。纯静态前端 + Supabase 云同步，无需构建工具。

## 功能特性

- 🧠 **FSRS 记忆引擎**：每张卡片独立建模难度/稳定性，按你的评分逐卡拟合个人遗忘曲线（可在设置中切回经典艾宾浩斯）
- 🤖 **AI 能力（3.0 新增）**：粘贴教材/讲义片段 → AI 整理成结构化知识卡片，预览勾选导入；简答题 AI 语义阅卷（逐点点评，失败自动回退关键词评分）。自带 OpenAI 兼容 Key（DeepSeek/智谱/Kimi 等），密钥仅存本机浏览器
- 📚 **知识库**：按科目/章节/标签组织笔记，支持 Markdown 加粗/代码、挖空记忆、批量导入、卡包分享
- ✍️ **刷题自测**：单选/判断/填空/简答随机组卷，智能选题与弱项章节分析，答错自动收录
- 📕 **错题本**：重做正确自动移出
- 🔥 **知识掌握热力图**：章节 × 记得程度 × 记忆强度，点击直达复习
- 📊 **学习统计**：近 14 天时长、掌握度分布、考研倒计时、周榜/累计排行榜
- ☁️ **云端同步**：Supabase 实时同步 + 会话验真（过期令牌自动清除，杜绝假登录）
- 📱 **PWA**：可安装到桌面，支持"开始复习/刷题"快捷方式，离线可用
- ⌨️ **键盘友好**：空格翻卡、1-4 评分、数字键答题、`/` 聚焦搜索、`?` 快捷键速查

## 仓库结构

```
index.html            入口（含运行时配置注入）
core.js               数据层 / 认证 / FSRS 引擎 / 仪表盘（经典脚本主文件）
views.js              渲染层：知识库 / 复习 / 统计 / 排行榜 / 认证 UI
quiz.js + quiz_analyzer.js   刷题引擎与题库智能分析
ai.js                AI 能力层（建卡生成 / 语义批改 / 连接管理）
public-lib.js         公共课程库视图
styles.css            应用样式（扁平高级感设计语言）
src/                  ES Modules 入口与工具（过渡期双体系，见技术债）
src/gate.css          登录页样式
sw.js                 Service Worker（network-first，预缓存 v11）
public-library.json   公共课程库数据（13 科 616 卡）
tools/                数据构建脚本与历史补丁（运行时不需要）
UPGRADE_SQL.sql       Supabase 建表 / 视图 / 防刷触发器
config.template.js    配置模板 → 复制为 config.js（本地开发用）
```

## 本地运行

```bash
git clone https://github.com/luckyboom1/yanxueku.git
cd yanxueku
cp config.template.js config.js   # 填入 Supabase 与 Turnstile 配置
python -m http.server 8080
```

线上（GitHub Pages）的配置直接内联在 `index.html` 中，与 `config.js` 需同步维护（anon key 属公开凭据）。

## Supabase 后端配置

1. 创建 Supabase 项目，执行 `UPGRADE_SQL.sql`（注意按文件头部说明先单独跑 `DROP TABLE`）
2. **执行文件尾部两段可选加固**：`leaderboard_week` 周榜视图（缺省时前端自动回退累计榜）与学习时长防刷触发器
3. Authentication 中配置邮箱确认策略；若启用 Turnstile，请在 Auth → Protection 关闭 Supabase 自带 CAPTCHA

## 安全模型

- 前端仅持有公开凭据（anon key / Turnstile Site Key）；RLS 保证每人只能读写自己的行
- 启动时对会话做服务端验真，过期/无效令牌自动清除并回到登录墙
- 导入数据（备份/卡包）经结构校验、长度限制、id 字符集白名单消毒
- AI 功能使用用户自配的第三方接口：CSP connect-src 已放行 https 出站；API Key 仅存本机 localStorage，不经过研学库服务器

## 已知技术债

- **双模块体系**：`src/*`（ESM）与经典脚本并存，常量存在两份实现（以经典脚本为准），待合并
- **单行 JSONB**：用户数据整包存于 `app_state.data`，全量 upsert；结构化拆表是多人大功能的前提
- **内联 onclick**：事件处理器以字符串拼接为主（id 已做白名单加固），长期应迁移事件委托

## 贡献

欢迎 Issue 与 PR。涉及安全或数据格式的修改请先在 PR 中说明影响范围。

## License

MIT
