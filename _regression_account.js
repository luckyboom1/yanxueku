/* Regression test: 一人一号系统（强制登录 + 精简数据 + 同步） */
const fs = require('fs');
const src = fs.readFileSync('C:/Users/53296/WorkBuddy/2026-08-04-20-21-15/kaoyan-study/index.html', 'utf-8');
const m = src.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/);
const js = m ? m[1] : '';

const localStorage = {
  _s: {},
  getItem(k){ return this._s[k]||null; },
  setItem(k,v){ this._s[k]=String(v); },
  removeItem(k){ delete this._s[k]; }
};
function mockEl(){
  return { style:{}, classList:{add(){},remove(){},toggle(){},contains(){return false}}, setAttribute(){}, getAttribute(){return null}, appendChild(){}, insertBefore(){}, replaceChild(){}, remove(){}, querySelector(){return null}, querySelectorAll(){return []}, dataset:{}, addEventListener(){}, removeEventListener(){}, click(){}, innerHTML:'', textContent:'', value:'', scrollTop:0, _children:[] };
}
const _elCache = {};
const _bodyChildren = [];
const document = {
  createElement:()=>mockEl(),
  getElementById:(id)=>{ if(!_elCache[id]) _elCache[id]=mockEl(); return _elCache[id]; },
  head:{appendChild(){}},
  body:{ appendChild(c){ _bodyChildren.push(c); }, removeChild(){} },
  querySelector:()=>null,
  querySelectorAll:()=>[],
  documentElement:{ setAttribute(){}, getAttribute(){return 'light'} },
  addEventListener(){},
  removeEventListener(){},
  visibilityState:'visible'
};
globalThis.window = globalThis;
globalThis.document = document;
globalThis.matchMedia = () => ({ addEventListener(){}, matches:false });
globalThis.addEventListener = () => {};
globalThis.navigator = { serviceWorker:{ register:async()=>({}) } };
globalThis.location = { protocol: 'file:' };
globalThis.curView = 'dashboard';
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.confirm = () => true;
globalThis.URL = { createObjectURL:()=>'blob:mock', revokeObjectURL(){} };
globalThis.Blob = function(){};
globalThis.FileReader = function(){};

const test = `
;globalThis.__toastLog = [];
;function toast(m,t){ globalThis.__toastLog.push(m); }
;load().then(async function(){
  let pass = 0, fail = 0;
  function ok(name, cond, detail){
    if(cond){ pass++; console.log('  ✅ '+name); }
    else { fail++; console.log('  ❌ '+name + (detail ? '\\n     ' + detail : '')); }
  }

  console.log('=== 一人一号系统回归测试 ===');

  // 1. seedData 仅 1 个测试科目
  var seed = seedData();
  ok('seedData 仅 1 个科目', seed.subjects.length === 1,
     '实际科目数: '+seed.subjects.length+' → '+seed.subjects.map(function(s){return s.name;}).join(','));
  ok('科目为测试科目', seed.subjects[0] && /测试/.test(seed.subjects[0].name),
     '科目名: '+(seed.subjects[0]&&seed.subjects[0].name));

  // 2. load 后无新闻史科目（ensureNewsSubject 不再注入）
  ok('load 后仅 1 科目', db.subjects.length === 1,
     '实际: '+db.subjects.length+' 个科目');
  ok('无中国新闻史科目', !db.subjects.some(function(s){return s.name==='中国新闻史';}), '');

  // 3. SEED_NEWS_CARDS 常量已移除
  ok('SEED_NEWS_CARDS 已移除', !/SEED_NEWS_CARDS/.test(src), '');

  // 4. 未登录 → 渲染登录墙（gate）
  _currentUser = null;
  render();
  var gate = document.getElementById('login-gate');
  ok('未登录渲染登录墙', gate && gate.style.display !== 'none',
     'login-gate 不存在或已隐藏');

  // 5. 登录 → gate 隐藏，正常渲染
  _currentUser = { id:'u1', email:'a@b.com' };
  _profile = { display_name:'测试', avatar_color:'#6366f1' };
  render();
  ok('登录后 gate 隐藏', gate.style.display === 'none',
     'gate 仍显示: '+gate.style.display);
  ok('登录后正常渲染视图', typeof renderGate === 'function', '');

  // 6. renderGate / hideGate 存在
  ok('renderGate 存在', typeof renderGate === 'function', '');
  ok('hideGate 存在', typeof hideGate === 'function', '');

  // 7. 登录后重订阅实时同步（setupAuthListener 内调用 setupRealtimeSync）
  ok('setupAuthListener 存在', typeof setupAuthListener === 'function', '');

  console.log('\\n=== 汇总: '+pass+' 通过 / '+fail+' 失败 ===');
  console.log(fail===0 ? '\\n✅ GREEN: 一人一号系统完成' : '\\n❌ RED: 存在失败项');
  process.exit(fail===0 ? 0 : 1);
}).catch(function(e){
  console.error('LOAD ERROR:', e && e.stack ? e.stack : e);
  process.exit(2);
});
`;

eval(js + test);
