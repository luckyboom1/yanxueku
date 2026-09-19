#!/usr/bin/env node
/* 研学库 事件引用完整性检查（CODE_REVIEW §2.2 自审项之一）
 * 用法：node _ref_check.js
 * 检查 1：所有 data-act-* 动作名都已登记在 actions.js 的 ACTIONS 注册表
 *         （事件委托层的契约：标记值永远不会变成可执行代码）
 * 检查 2：残留内联事件处理器（onclick/onkeydown/onchange/oninput … 属性）
 *         一律视为回归——beta.25 起禁止新增，发现即失败
 * 检查 3：getElementById 引用的 id 均存在于静态标记或 JS 生成的标记
 * 退出码：0 = 通过；1 = 发现问题 */
'use strict';
const fs = require('fs');
const path = require('path');

const FILES = ['core.js','views.js','quiz.js','quiz_analyzer.js','ai.js','actions.js','boot.js','config.js','sw.js','index.html'];

const src = {};
for (const f of FILES) {
  const p = path.join(__dirname, f);
  if (!fs.existsSync(p)) { console.error('✗ 缺少文件：' + f); process.exit(1); }
  src[f] = fs.readFileSync(p, 'utf8');
}
const all = FILES.map(f => src[f]).join('\n');

/* ---- ACTIONS 注册表：解析 actions.js 中 var ACTIONS = { ... } 的顶层键 ---- */
const actSrc = src['actions.js'];
const blockStart = actSrc.indexOf('var ACTIONS = {');
const blockEnd = actSrc.indexOf('\n};', blockStart);
if (blockStart < 0 || blockEnd < 0) { console.error('✗ actions.js 中找不到 ACTIONS 注册表'); process.exit(1); }
const registry = new Set();
for (const m of actSrc.slice(blockStart, blockEnd).matchAll(/^\s{2}([A-Za-z_$][\w$]*)\s*:/gm)) registry.add(m[1]);

/* ---- 检查 1：data-act-* 引用点 ---- */
const actRefs = new Set();
// 字面量值：data-act-click="name"
for (const m of all.matchAll(/data-act-(?:click|input|change|keydown)\s*=\s*\\?"([A-Za-z_$][\w$]*)\\?"/g)) actRefs.add(m[1]);
// 动态值：data-act-click="'+(cond?'a':'b')+'" —— 抽取内部所有单引号字符串
for (const m of all.matchAll(/data-act-(?:click|input|change|keydown)\s*=\s*\\?"'\+([^\\]*?)\+'\\?"/g)) {
  for (const q of m[1].matchAll(/'([A-Za-z_$][\w$]*)'/g)) actRefs.add(q[1]);
}
// 对象契约：openModal({actions:[{action:'name'}]}) 调点
for (const m of all.matchAll(/\baction\s*:\s*'([A-Za-z_$][\w$]*)'/g)) actRefs.add(m[1]);
const missingActs = [...actRefs].filter(a => !registry.has(a)).sort();
// 反向：注册表中从未被静态引用的条目（可能是纯动态调用，也可能已死——列出提示，不判失败）
const unusedActs = [...registry].filter(a => !actRefs.has(a)).sort();

/* ---- 检查 2：残留内联事件处理器（回归检测） ---- */
const inlineResidual = [];
for (const f of FILES) {
  for (const m of src[f].matchAll(/on(?:click|keydown|keyup|change|input|focus|blur|submit|load|error)\s*=\s*["']/g)) {
    // .onX = 的 JS 属性赋值合法（动态元素/FileReader/XHR），只拦属性形式 on...="
    const tail = src[f].slice(m.index + m[0].length - 1, m.index + m[0].length + 60);
    inlineResidual.push(f + ' @' + m.index + ': ' + m[0] + tail.slice(0, 50).replace(/\n/g, ' '));
  }
}
// JS 赋值型（obj.onclick = fn）不含 =" 紧跟引号，上面的正则已只匹配 on*="<引号>
// 但属性值在 JS 字符串里可能写成 on*=\" —— 也纳入
for (const f of FILES) {
  for (const m of src[f].matchAll(/on(?:click|keydown|keyup|change|input|focus|blur|submit)\s*=\s*\\"/g)) {
    inlineResidual.push(f + ' @' + m.index + ': (escaped) ' + m[0]);
  }
}

/* ---- 检查 3：getElementById 引用 vs 已定义 id ---- */
const refs = new Set();
for (const m of all.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)) refs.add(m[1]);
const dyn = new Set();   // 拼接型 id（如 'wq-'+qid）：按前缀放行
for (const m of all.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\+/g)) dyn.add(m[1]);
const ids = new Set();
for (const m of all.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)) ids.add(m[1]);
for (const m of all.matchAll(/\.id\s*=\s*['"]([^'"]+)['"]/g)) ids.add(m[1]);
for (const m of all.matchAll(/\bid:\s*['"]([^'"]+)['"]/g)) ids.add(m[1]);
const missingIds = [...refs].filter(r => !ids.has(r) && ![...dyn].some(d => r.startsWith(d))).sort();

/* ---- 报告 ---- */
let bad = false;
console.log('ACTIONS 注册表：' + registry.size + ' 个动作；data-act 引用：' + actRefs.size + ' 个，缺失登记：' + (missingActs.length || '无'));
if (missingActs.length) { bad = true; missingActs.forEach(a => console.log('  ✗ 未登记的动作名：' + a)); }
if (unusedActs.length) console.log('  ℹ 未被静态引用的注册动作（动态调用或冗余）：' + unusedActs.join(', '));
console.log('内联事件处理器残留：' + (inlineResidual.length || '无'));
if (inlineResidual.length) { bad = true; inlineResidual.slice(0, 20).forEach(r => console.log('  ✗ ' + r)); }
console.log('getElementById 引用：' + refs.size + ' 个，元素 id 缺失：' + (missingIds.length || '无'));
if (missingIds.length) { bad = true; missingIds.forEach(r => console.log('  ✗ 找不到定义的 id：#' + r)); }
console.log(bad ? '_ref_check: FAIL' : '_ref_check: PASS ✓');
process.exit(bad ? 1 : 0);
