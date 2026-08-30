# 研学库代码审查标准与流程

> 本文档定义研学库的代码审查（Code Review）标准。目标不是仪式感，而是把历史上真实踩过的坑
> （存储型 XSS、供应链投毒面、版本戳漏改、缓存竞态、云端数据覆盖）转化为可执行的检查动作。
> 新贡献者请先通读 README 的「安全模型」与「已知技术债」，审查时按本文档执行。

---

## 一、审查原则与优先级

每条审查意见必须标注优先级，避免"Style 大战"淹没真问题：

| 标记 | 含义 | 处理方式 |
|---|---|---|
| 🔴 **Blocker** | 安全漏洞、数据丢失/覆盖风险、竞态、破坏数据格式契约、缓存事故 | 必须修复后才能合并 |
| 🟡 **Suggestion** | 缺失输入校验、错误处理不足、重复代码该提取、性能隐患 | 应当修复；不修需在 PR 中说明理由 |
| 💭 **Nit** | 命名、注释、风格、可选的更优写法 | 可选，不阻塞合并 |

三条铁律：

1. **对事不对人**：评论指出"第 X 行的 Y 问题会导致 Z"，不评价作者水平
2. **说清 Why**：每条意见附带成因与影响范围，只说"这样不好"不算审查
3. **一次说全**：审查一次性给完整反馈，不挤牙膏式分多轮放问题

---

## 二、审查流程

### 2.1 分支与提交

```
main/master
  └── 特性分支 / 直接提交（维护者）
```

- 提交信息格式：`type: 描述 (vX.Y.Z)`，type 取 `feat / fix / perf / security / refactor / data / ui / chore / copy`
- 版本号跟随发布（见 §4 版本发布检查），一个 PR 原则上对应一个版本号
- 涉及 **安全** 或 **数据格式**（`UPGRADE_SQL.sql` / `migrateData` / 导入导出消毒）的修改，必须在 PR 描述中说明影响范围——这是 README 既有约定

### 2.2 作者自审（提交前必做）

```
📋 自审清单（全部通过才请求审查）
[ ] node --check 所有改动的 .js 文件通过
[ ] node _audit_test.js 全绿（纯函数边界，34 项）
[ ] node _ref_check.js 通过（内联事件引用完整性）
[ ] 浏览器冒烟：登录墙渲染正常、控制台无报错
[ ] 改动了用户可见行为 → 版本号三处同步（见 §4）
[ ] 新增内联事件处理器 → 引用的函数已定义且 id 参数经白名单消毒
[ ] 新增用户数据渲染 → 经过 esc()/escAttr()/md()/safeColor()
[ ] 涉及 db 结构 → migrateData 兼容旧数据，DATA_VERSION 评估是否 +1
```

### 2.3 审查者动作

1. 通读 PR 描述与 diff，先跑一遍 §2.2 的自动化检查确认作者自审属实（**信任但验证**）
2. 按模块清单（§3）逐项检查
3. 按优先级输出评论，结尾给出结论：`Approve` / `Approve with comments` / `Request changes`
4. 🔴 问题修复后**必须复验**：确认修复本身没有引入新问题

### 2.4 合并门槛

- 0 个未解决的 🔴；🟡 要么修复要么有书面理由
- 涉及版本发布的改动：版本戳同步核对完成（人工核对，历史上漏过 3 次）
- 合并后线上冒烟一次（GitHub Pages 部署完成后访问首页 + 打开一个视图）

---

## 三、分模块审查清单

> 研学库无打包无 lint，风险集中在：**渲染转义、数据消毒、全局状态、缓存时序**。
> 按改动落点选择对应清单，全量 PR 侧重渲染与数据两条线。

### 3.1 通用红线（任何 JS 改动都查）

- 🔴 **XSS 三关**：用户可控数据进 `innerHTML` 前必须过 `esc()`（元素内容）/ `escAttr()`（属性值）/ `md()`（受限 Markdown）；颜色值必须过 `safeColor()`。模板字符串里 `${...}` 逐个确认数据来源
- 🔴 **id 白名单**：内联 `onclick="fn('${id}')"` 中的 id 必须来自 `idClean()` 消毒过的数据，禁止拼接原始用户输入（历史教训：beta.2 修过存储型 XSS）
- 🔴 **原型链污染**：以用户数据为键的对象读写，必须 `Object.prototype.hasOwnProperty.call()` 守卫，导入映射键拒绝 `__proto__`/`constructor`/`prototype`（参照 `__deepSanitize`）
- 🔴 **密钥零入库**：anon key 之外的一切密钥（AI Key、token）不得出现在任何被提交的文件
- 🟡 `parseInt/parseFloat` 后判 NaN（`||0` 模式）；`JSON.parse` 必须包 try/catch
- 🟡 异步回调里引用全局可变状态（`db`/`quiz`/`reviewQueue`）时，检查回调执行时该状态是否可能已被替换或清空（beta.14 修过这类竞态）

### 3.2 core.js（数据层 / 认证 / FSRS / 同步）

- 🔴 **云端覆盖防护**：任何新的 upsert 路径都要问"云端读取失败/过期时，这会不会用旧数据覆盖云端新数据"（`_cloudLoadFailed` 标志是既有防线，新路径必须遵守）
- 🔴 **migrateData 深度消毒**：新字段必须定义类型/长度/枚举白名单；旧版本数据（`_schemaVersion` 更低）经过迁移后不得崩溃
- 🔴 **purge / 登出路径**：清除缓存的同时必须停掉活跃计时器、取消 pending 防抖保存，防止空白库回写
- 🟡 `localStorage` 读写配额：新增整包 `JSON.stringify(db)` 的写入点前，先确认 doSave 的降级链没被绕过
- 🟡 FSRS 参数调整必须附数值验证（用 `_audit_test.js` 补用例：间隔单调性、遗忘路径、边界 stage bucket）
- 💭 时间一律用 `todayStr()/addDays()/diffDays()`，禁止裸 `new Date(str)`（时区坑）

### 3.3 views.js / quiz.js（渲染层）

- 🔴 复用 §3.1 转义三关，重点盯 `map(...).join('')` 拼接的列表项
- 🔴 状态越界防御：渲染函数入口对 `quiz.list[quiz.idx]`、`reviewQueue[reviewIdx]`、`db.questions.find(...)` 的结果做空值保护（渲染函数被内联事件异步触发，时序不可控）
- 🟡 内联 onclick 新增引用的函数必须存在且已进 `_ref_check.js` 的解析范围
- 🟡 异步落点（AI 阅卷、定时器回调）里操作 DOM 前先确认元素仍存在（视图可能已切换）
- 💭 用户可见文案变化需要 bump 版本戳（文案也算发布内容，beta.12 有先例）

### 3.4 ai.js（AI 能力层）

- 🔴 端点校验不得放宽：仅 `https:` 与 `http://localhost|127.0.0.1`，拒绝 `user:pass@` 形式（`sanitizeAiBase`）
- 🔴 AI 返回内容入库前必须经长度上限 + 类型白名单清洗（`aiGenerateCardsReq` 的 map/filter 模式）
- 🟡 所有 `await` 阶段（含响应体读取）都要有超时兜底（beta.14 修过响应体无超时）
- 🟡 AI 输出 JSON 解析失败必须降级到关键词评分，不得让答题流程中断

### 3.5 sw.js / index.html / manifest.json（发布面）

- 🔴 **版本戳五处核对**（历史事故高发区：beta.10 漏过 sw.js、beta.14 漏过 `__APP_VERSION`）：
  1. `core.js` `APP_VERSION` + 行内注释
  2. `index.html` 全部 `?v=x.y.z` 查询串
  3. `index.html` 第 21 行 `var __APP_VERSION = "x.y.z"`（版本跳变强制刷新开关，漏改时强刷机制静默失效，用户继续用旧缓存）
  4. `sw.js` `CACHE = 'yanxueku-vN'` +1，且 `ASSETS` 列表与 index.html 引用一一对应（多了会装不上缓存，少了离线打不开）
  5. `views.js` `PLIB_URL`/`PLIB_VER` —— **仅当 public-library.json 数据变化时才 bump**，勿随 APP_VERSION 走
- 🔴 CSP 变更（`script-src`/`connect-src`）必须单独说明安全影响，默认拒绝放宽
- 🔴 **CSP 与代码实际加载源必须逐一对应**：新增/修改外部脚本源（如 SDK CDN 及其回退镜像）时，必须在 `index.html` 的 CSP `script-src` 同步放行。事故先例：代码里配了 `fastly.jsdelivr.net` 回退，CSP 只放行 `cdn.jsdelivr.net`，这条供应链冗余防线被静默拦截、从未生效（beta.20 修复）。验证方法：浏览器动态注入该源脚本，确认 `onload` 触发而非被 CSP 拒绝。
- 🟡 新增静态资源必须同时加入 `ASSETS` 预缓存，否则 PWA 离线模式白屏
- 🟡 缓存策略变更必须说明对"发版即时生效"的影响：静态资源靠 `?v=` 版本戳失效（SWR 安全），**不带版本戳的资源不得进 SWR 路径**

### 3.6 tools/ 与数据（public-library.json）

- 🟡 数据脚本改动不进运行时，但产出的 JSON 必须结构校验：科目/卡数字数合理、无重复 id、无空 content
- 🟡 公共库数据变化 → 同步 bump §3.5 第 5 戳，PR 描述给出新增卡数
- 🟡 大文件（>500K）一律不得进入 SW 预缓存：预缓存是"安装即下载"，只有首屏关键资源才配；按需数据走运行时缓存

### 3.7 SQL（UPGRADE_SQL.sql）

- 🔴 RLS 策略变更必须逐条确认"每人只能读写自己的行"不被打破
- 🟡 新视图/触发器必须在 README「Supabase 后端配置」同步说明（缺省时前端是否有回退）

---

## 四、版本发布检查（独立于代码审查的放行单）

```
🚀 发布前核对
[ ] core.js APP_VERSION 已更新，行内注释新版本说明在最前
[ ] index.html 所有 ?v= 已同步（全局搜索旧版本号应为 0 处）
[ ] sw.js CACHE 版本 +1，ASSETS 与 index.html 资源清单 diff 为空
[ ] index.html 第 21 行 __APP_VERSION 已同步（版本跳变强刷）
[ ] 公共库数据若有变化：views.js PLIB_URL/PLIB_VER 已 bump
[ ] _audit_test.js / _ref_check.js 全绿
[ ] 浏览器冒烟（本地）
[ ] push 后线上访问一次，确认 Service Worker 新缓存生效（DevTools → Application）
```

---

## 五、审查评论模板

```markdown
🔴/🟡/💭 **[类别] 一句话标题**
`文件:行号`：现状描述。

**Why:** 成因 → 触发条件 → 影响范围（谁会踩到、踩到后什么后果）。

**Suggestion:** 修改建议（给方向或示例代码，不替作者重写整个函数）。
```

示例：

```markdown
🔴 **竞态：异步回调引用可被替换的全局状态**
`views.js:167`：AI 阅卷 promise 在 pending 期间用户可能触发 switchView，quiz 被置 null。

**Why:** finalizeInputAnswer 中 quiz.right++ 若无守卫会 TypeError；beta.14 前曾因此崩溃。

**Suggestion:** 回调内使用 `if(correct && quiz)` 守卫（现有写法已正确，此处作为新代码范例引用）。
```

---

## 六、什么可以不审

- `tools/` 下一次性数据脚本的历史补丁（`patch_*.json`、`_*.py` 临时产物）
- 纯文案微调（但需遵守 §3.5 版本戳规则）
- 由自动化工具生成的产物文件

---

*本标准与 README「安全模型」「已知技术债」同步维护：技术债清单变化时，对应模块的审查重点一并更新。*
