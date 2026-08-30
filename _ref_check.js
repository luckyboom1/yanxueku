#!/usr/bin/env node
/* 研学库 内联事件引用完整性检查（CODE_REVIEW §2.2 自审项之一）
 * 用法：node _ref_check.js
 * 检查 1：所有内联事件处理器（onclick / onkeydown / onchange / oninput …）
 *         调用的函数都已在仓库中定义（历史教训：id 拼接 + 内联处理器是注入主战场）
 * 检查 2：getElementById 引用的 id 均存在于静态标记或 JS 生成的标记
 * 退出码：0 = 通过；1 = 发现问题
 * 说明：与 CI/本地自审共用；新增内联处理器或动态 id 时若误报，请把该函数/id 的
 *       定义方式改为可被本脚本识别的常规形式，而不是加白名单。 */
'use strict';
const fs = require('fs');
const path = require('path');

const FILES = ['core.js','views.js','quiz.js','quiz_analyzer.js','ai.js','public-lib.js','sw.js','index.html'];
const BUILTINS = new Set(('setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame ' +
  'fetch parseInt parseFloat String Number Boolean Object Array JSON Math Date RegExp Promise Error isNaN isFinite ' +
  'alert confirm prompt encodeURIComponent decodeURIComponent console document window navigator location history ' +
  'localStorage sessionStorage URL URLSearchParams Blob FileReader XMLHttpRequest IntersectionObserver ' +
  'getComputedStyle matchMedia addEventListener removeEventListener scrollIntoView focus blur click querySelector ' +
  'querySelectorAll getElementById createElement closest matches forEach map filter find some every reduce slice ' +
  'splice push join split replace trim charAt charCodeAt indexOf includes hasOwnProperty test exec toString valueOf ' +
  'if else return new typeof this event function requestIdleCallback structuredClone Set Map WeakMap Symbol').split(/\s+/));

const src = {};
for (const f of FILES) {
  const p = path.join(__dirname, f);
  if (!fs.existsSync(p)) { console.error('✗ 缺少文件：' + f); process.exit(1); }
  src[f] = fs.readFileSync(p, 'utf8');
}
const allJs = FILES.filter(f => f.endsWith('.js')).map(f => src[f]).join('\n');
const all = FILES.map(f => src[f]).join('\n');

/* ---- 已定义的函数名（函数声明 / 变量函数表达式 / 后置包装重赋值） ---- */
const defined = new Set();
for (const m of allJs.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)) defined.add(m[1]);
for (const m of allJs.matchAll(/(?:^|\n)\s*(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:function|\(|async)/g)) defined.add(m[1]);
for (const m of allJs.matchAll(/^([A-Za-z_$][\w$]*)\s*=\s*function/gm)) defined.add(m[1]);

/* ---- 检查 1：内联事件处理器调用点 ---- */
const attrVals = [];
for (const m of all.matchAll(/on(?:click|keydown|keyup|change|input)\s*=\s*"([^"]*)"/g)) attrVals.push(m[1]);
for (const m of all.matchAll(/on(?:click|keydown|keyup|change|input)\s*=\s*\\"((?:[^"\\]|\\\\.)*)\\"/g)) attrVals.push(m[1]);
const calls = new Set();
for (const v of attrVals) {
  const un = v.replace(/\\"/g, '"').replace(/\\'/g, "'");
  for (const m of un.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) calls.add(m[1]);
}
const missingCalls = [...calls].filter(c => !defined.has(c) && !BUILTINS.has(c)).sort();

/* ---- 检查 2：getElementById 引用 vs 已定义 id ---- */
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
console.log('内联处理器调用点：' + calls.size + ' 个，函数引用缺失：' + (missingCalls.length || '无'));
if (missingCalls.length) { bad = true; missingCalls.forEach(c => console.log('  ✗ 未定义的处理器函数：' + c)); }
console.log('getElementById 引用：' + refs.size + ' 个，元素 id 缺失：' + (missingIds.length || '无'));
if (missingIds.length) { bad = true; missingIds.forEach(r => console.log('  ✗ 找不到定义的 id：#' + r)); }
console.log(bad ? '_ref_check: FAIL' : '_ref_check: PASS ✓');
process.exit(bad ? 1 : 0);
