#!/usr/bin/env node
/* 研学库 纯函数边界测试（CODE_REVIEW §2.2 自审项之一，40 断言）
 * 用法：node _audit_test.js
 * 覆盖：日期工具 / 转义与安全色 / FSRS 引擎（单调性·边界分桶）/ 数据消毒与迁移
 *      （原型链污染·id 白名单·限长）/ 刷题判分 / 连续天数 / AI JSON 解析与端点校验
 *      / 真经笔记解析 / 智能选题。
 * 原理：这些文件是无构建经典脚本且顶层有副作用，故以最小 DOM/浏览器桩加载
 *      core → quiz_analyzer → quiz → ai → views（与 index.html 顺序一致），
 *      再于同一全局作用域执行断言。退出码：0 = 全绿；1 = 有失败。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ---------- 最小 DOM / 浏览器桩 ---------- */
function makeEl(tag){
  return {
    tagName: String(tag || 'div').toUpperCase(), id: '', className: '', innerHTML: '',
    textContent: '', value: '', type: '', style: { cssText: '' }, dataset: {},
    children: [], childNodes: [], disabled: false, nodeType: 1, firstChild: null,
    classList: {
      _s: new Set(),
      add(){ for (const c of arguments) this._s.add(c); },
      remove(){ for (const c of arguments) this._s.delete(c); },
      contains(c){ return this._s.has(c); },
      toggle(c){ this._s.has(c) ? this._s.delete(c) : this._s.add(c); }
    },
    setAttribute(){}, getAttribute(){ return null; }, removeAttribute(){},
    appendChild(c){ this.children.push(c); return c; },
    removeChild(c){ this.children = this.children.filter(x => x !== c); return c; },
    insertBefore(c){ this.children.unshift(c); return c; },
    replaceWith(){}, remove(){},
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    closest(){ return null; }, matches(){ return false; }, contains(){ return false; },
    addEventListener(){}, removeEventListener(){},
    focus(){}, blur(){}, click(){}, setSelectionRange(){},
    getBoundingClientRect(){ return { width: 0, height: 0, left: 0, top: 0 }; }
  };
}
const _elById = {};
const documentStub = {
  documentElement: makeEl('html'), head: makeEl('head'), body: makeEl('body'),
  activeElement: null, title: '', visibilityState: 'visible',
  createElement(t){ return makeEl(t); },
  getElementById(id){
    if (_elById[id]) return _elById[id];
    for (const list of [this.body.children, this.head.children])
      for (const c of list) if (c && c.id === id) { _elById[id] = c; return c; }
    return null;
  },
  querySelector(){ return null; }, querySelectorAll(){ return []; },
  addEventListener(){}, removeEventListener(){}
};
const _store = {};
const localStorageStub = {
  getItem(k){ return Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null; },
  setItem(k, v){ _store[k] = String(v); },
  removeItem(k){ delete _store[k]; }
};
global.window = global;
global.self = global;
global.top = global;
global.document = documentStub;
global.localStorage = localStorageStub;
global.navigator = { userAgent: 'node-audit' };        // 不含 serviceWorker 键 → 跳过 SW 注册
global.location = { protocol: 'file:', search: '', href: 'file:///audit' };
global.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){} });
global.requestAnimationFrame = fn => setTimeout(() => fn(Date.now()), 0);
global.cancelAnimationFrame = id => clearTimeout(id);
global.IntersectionObserver = function(){ this.observe = () => {}; this.disconnect = () => {}; };

/* ---------- 加载应用脚本 ---------- */
const ORDER = ['core.js', 'quiz_analyzer.js', 'quiz.js', 'ai.js', 'views.js'];
let bundle = '';
for (const f of ORDER) bundle += fs.readFileSync(path.join(__dirname, f), 'utf8') + '\n;';

/* ---------- 断言工具 ---------- */
let pass = 0; const failures = [];
function ok(cond, name){ if (cond) pass++; else failures.push(name); }
function eq(actual, expected, name){
  ok(actual === expected, name + '（期望 ' + JSON.stringify(expected) + '，实际 ' + JSON.stringify(actual) + '）');
}

try {
  vm.runInThisContext(bundle, { filename: 'yanxueku-bundle.js' });
} catch (e) {
  console.error('✗ 应用脚本加载失败（桩环境不足或真实语法/引用错误）：');
  console.error(e && e.stack || e);
  process.exit(1);
}

/* ---------- 用例 ---------- */
// 日期工具（时区坑高发区，一律走 todayStr/addDays/diffDays）
eq(addDays('2026-08-30', 1), '2026-08-31', 'addDays 常规 +1 天');
eq(addDays('2026-12-31', 1), '2027-01-01', 'addDays 跨年');
eq(addDays('2026-03-01', -1), '2026-02-28', 'addDays 回退跨月');
eq(diffDays('2026-08-31', '2026-08-30'), 1, 'diffDays 相邻天');
ok(/^\d{4}-\d{2}-\d{2}$/.test(todayStr()), 'todayStr 格式 YYYY-MM-DD');
eq(formatMinutes(125, 'colon'), '02:05', 'formatMinutes 冒号式');
eq(formatMinutes(125, 'compact'), '2h 5m', 'formatMinutes 紧凑式');

// 转义与安全色（XSS 三关的地基）
eq(esc('<b>"a"&\'b\''), '&lt;b&gt;&quot;a&quot;&amp;&#39;b&#39;', 'esc 全量转义');
ok(escAttr('a"b\'c').indexOf('"') === -1 && escAttr('a"b\'c').indexOf("'") === -1, 'escAttr 剥离属性引号');
eq(safeColor('#abc'), '#abc', 'safeColor 接受 #3 位');
eq(safeColor('#aBc123'), '#aBc123', 'safeColor 接受 #6 位');
eq(safeColor('red'), '#6366f1', 'safeColor 拒绝命名色');
eq(safeColor('url(javascript:alert(1))'), '#6366f1', 'safeColor 拒绝注入值');
eq(md('**x**'), '<b>x</b>', 'md 加粗');
eq(md('<i>'), '&lt;i&gt;', 'md 先转义再解析');
ok(uid().charAt(0) === 'k' && uid() !== uid(), 'uid 前缀与唯一性');

// FSRS 引擎（间隔单调性 / 边界分桶）——CODE_REVIEW §3.2 明确要求数值验证
(function(){
  const st = { d: 5, s: 10, reps: 3 };
  const sHard = fsrsNext(st, 2, 10).s, sGood = fsrsNext(st, 3, 10).s, sEasy = fsrsNext(st, 4, 10).s;
  ok(sEasy > sGood && sGood > sHard, 'fsrsNext 稳定性 Easy>Good>Hard（实际 ' + [sHard, sGood, sEasy].map(x => x.toFixed(2)).join('/') + '）');
  ok(fsrsInterval(10) < fsrsInterval(50), 'fsrsInterval 随稳定性单调递增');
  eq(fsrsStageBucket(0.5), 0, 'stage 分桶 s<1');
  eq(fsrsStageBucket(2), 1, 'stage 分桶 s<3');
  eq(fsrsStageBucket(5), 2, 'stage 分桶 s<10');
  eq(fsrsStageBucket(15), 3, 'stage 分桶 s<21');
  eq(fsrsStageBucket(30), 4, 'stage 分桶 s<45');
  eq(fsrsStageBucket(60), 5, 'stage 分桶 s<90');
  eq(fsrsStageBucket(200), 6, 'stage 分桶 长期');
  const k = { stage: 2, nextReview: addDays(todayStr(), -1) };
  applyFsrsGrade(k, 2, todayStr());
  ok(k.fsrs && k.fsrs.s > 0 && k.fsrs.lastReviewDate === todayStr(), 'applyFsrsGrade 初始化并打戳');
  ok(k.nextReview > todayStr(), 'applyFsrsGrade 排期在未来');
})();

// 深度消毒与迁移（红队边界：注入 id / 原型链污染 / 越界值）
(function(){
  const d = { _schemaVersion: 4, subjects: [], knowledge: [], questions: [], quizRecords: [], studyLog: [] };
  d.knowledge = [{ id: "<script>alert(1)</script>", subjectId: 'x', chapter: 'c', title: 't', content: 'x', tags: [], stage: 99, nextReview: 'garbage', createdAt: '2026-01-01' }];
  __deepSanitize(d);
  ok(/^[a-zA-Z0-9_-]*$/.test(d.knowledge[0].id) && d.knowledge[0].id.indexOf('script') !== -1, '__deepSanitize id 白名单消毒');
  eq(d.knowledge[0].stage, 6, '__deepSanitize stage 限幅 0..6');
  eq(d.knowledge[0].nextReview, todayStr(), '__deepSanitize 非法日期回退今天');
  const evil = JSON.parse('{"__proto__":{"times_asked":9},"good1":{"times_asked":2}}');
  const d2 = { _schemaVersion: 4, subjects: [], knowledge: [], questions: [], quizRecords: [], studyLog: [], quizStats: evil };
  __deepSanitize(d2);
  ok(!Object.prototype.hasOwnProperty.call(d2.quizStats, '__proto__'), '__deepSanitize 拒绝 __proto__ 键');
  ok(d2.quizStats.good1 && d2.quizStats.good1.times_asked === 2, '__deepSanitize 保留合法键');
  ok(({}).times_asked === undefined, 'Object.prototype 未被污染');
  ok(sanitizeImport('not an object') === null, 'sanitizeImport 拒绝非对象');
  ok(sanitizeImport({ subjects: [] }) === null, 'sanitizeImport 拒绝缺 knowledge');
  const clean = sanitizeImport({ subjects: [{ id: "a');alert(1);//", name: 'n', color: 'red' }], knowledge: [], questions: [] });
  ok(/^[a-zA-Z0-9_-]*$/.test(clean.subjects[0].id), 'sanitizeImport id 白名单');
  eq(clean.subjects[0].color, '#6366f1', 'sanitizeImport 颜色走 safeColor');
  ok(isPureSeed(seedData()) === true, 'isPureSeed 识别未动过的种子');
  ok(isPureSeed(blankDb()) === false, 'isPureSeed 拒绝空白库');
  const old = { _schemaVersion: 0, subjects: [], knowledge: [{ id: 'k1', stage: 2, nextReview: '2026-01-02', lastReview: '2026-01-01' }],
    questions: [{ id: 'q1', q: '旧题干', explain: '旧解析', options: null }], quizRecords: [], studyLog: [] };
  const mig = migrateData(old);
  eq(mig._schemaVersion, DATA_VERSION, 'migrateData 升到当前版本');
  ok(mig.knowledge[0].fsrs && mig.knowledge[0].fsrs.s > 0, 'migrateData v3→v4 已入学卡补 fsrs');
  ok(mig.questions[0].question === '旧题干' && mig.questions[0].explanation === '旧解析' && mig.questions[0].q === undefined, 'migrateData v2→v3 字段回填并删除旧键');
})();

// 刷题判分与统计
(function(){
  const qFill = { type: 'fill', answer: '北京大学' };
  ok(scoreUserAnswer(' 北京 大学 ', qFill), 'fill 判分忽略空白');
  ok(!scoreUserAnswer('清华大学', qFill), 'fill 判分拒绝错答');
  const qShort = { type: 'short', answer: '孤立恐惧;优势意见;劣势沉默' };
  ok(scoreUserAnswer('核心是孤立恐惧与优势意见的大声疾呼', qShort), 'short 关键词过半判对');
  ok(!scoreUserAnswer('完全不相关的回答内容', qShort), 'short 关键词不足判错');
  const t = todayStr();
  eq(calcStreak(t, [{ date: t, minutes: 5 }, { date: addDays(t, -1), minutes: 5 }, { date: addDays(t, -3), minutes: 5 }]), 2, 'calcStreak 中断即停');
  eq(calcStreak(t, [{ date: addDays(t, -1), minutes: 9 }]), 1, 'calcStreak 今天未学不断连');
  eq(cleanCardTitle('（一）标题内容'), '标题内容', 'cleanCardTitle 去中文序号');
  eq(cleanCardTitle('12、考点提炼'), '考点提炼', 'cleanCardTitle 去数字序号');
})();

// AI 解析与端点校验
(function(){
  eq(matchBrace('{"x":{"y":1}}', 0), 12, 'matchBrace 跨嵌套配对');
  eq(aiParseJson('{"cards":[]}').cards.length, 0, 'aiParseJson 直接对象');
  eq(aiParseJson('前缀 ```json {"a":1} ``` 后缀').a, 1, 'aiParseJson 剥围栏与前后缀');
  let threw = false; try { aiParseJson('根本不是 JSON'); } catch (e) { threw = /不是合法 JSON|无法解析/.test(e.message); }
  ok(threw, 'aiParseJson 失败抛中文错误');
  ok(aiCleanText('javascript:alert(1)').indexOf('javascript:') === -1, 'aiCleanText 中性化危险 scheme');
  ok(aiCleanText('a\u0000b\u0007c') === 'abc', 'aiCleanText 去控制字符');
  eq(sanitizeAiBase('https://api.deepseek.com'), 'https://api.deepseek.com', 'sanitizeAiBase 放行 https');
  eq(sanitizeAiBase('http://evil.example.com'), null, 'sanitizeAiBase 拒绝 http 远端');
  ok(/^http:\/\/(localhost|127\.0\.0\.1)/.test(sanitizeAiBase('http://localhost:8080')), 'sanitizeAiBase 放行本机 http');
  eq(sanitizeAiBase('https://user:pass@api.example.com'), null, 'sanitizeAiBase 拒绝凭据内嵌');
})();

// 选题算法与去重
(function(){
  const qid = 'audit_tmp_q1';
  recordAnswer(qid, true);
  eq(getDifficulty(qid), 0, 'recordAnswer 答对后难度 0');
  recordAnswer(qid, false);
  eq(getDifficulty(qid), 0.5, 'recordAnswer 1对1错难度 0.5');
  delete db.quizStats[qid];
  const pool = db.questions.slice();
  const sel = selectSmartQuiz(pool, 5);
  eq(sel.length, 5, 'selectSmartQuiz 足量返回');
  eq(new Set(sel.map(q => q.id)).size, 5, 'selectSmartQuiz 无重复题');
  const weak = getWeakChapters(null);
  ok(weak.length > 0 && weak.every((c, i) => i === 0 || weak[i - 1].difficulty >= c.difficulty), 'getWeakChapters 按难度降序');
  const used = new Set(['A']);
  eq(deduplicateTitle('A', used), 'A（2）', 'deduplicateTitle 同名加编号');
})();

/* ---------- 报告 ---------- */
const total = pass + failures.length;
console.log('_audit_test: ' + pass + '/' + total + ' 通过');
if (failures.length) {
  failures.forEach(f => console.log('  ✗ ' + f));
  console.log('_audit_test: FAIL');
  process.exit(1);
}
console.log('_audit_test: PASS ✓');
process.exit(0);
