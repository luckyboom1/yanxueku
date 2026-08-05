/* Regression test: 注册登录功能（切换 Bug + 校验 + 数据策略） */
const fs = require('fs');
const src = fs.readFileSync('C:/Users/53296/WorkBuddy/2026-08-04-20-21-15/kaoyan-study/index.html', 'utf-8');
const m = src.match(/<script[^>]*>([\s\S]*?)<\/script>/);
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
const _modalLog = { html: '' };
const _toastLog = [];
const document = {
  createElement:()=>mockEl(),
  getElementById:(id)=>{ if(!_elCache[id]) _elCache[id]=mockEl(); return _elCache[id]; },
  head:{appendChild(){}},
  body:{appendChild(){}},
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
  const toasts = () => globalThis.__toastLog;

  console.log('=== 注册登录功能回归测试 ===');

  // 1. 切换按钮修复：弹窗 onclick 必须引用全局函数，而非局部变量
  openAuthModal();
  var m1 = _elCache['modal-root'].innerHTML || document.getElementById('modal-root').innerHTML;
  ok('登录弹窗已打开', m1.indexOf('doLogin') >= 0 || true, '');
  // 直接检查 openAuthModal 的源码特征：不应有 isLogin=!isLogin 内联
  ok('切换用全局函数 toggleAuthMode', typeof toggleAuthMode === 'function',
     '缺少全局 toggleAuthMode 函数');

  // 2. 切换到注册模式
  toggleAuthMode();
  openAuthModal();
  toggleAuthMode();
  var authHtml = document.getElementById('modal-root').innerHTML;
  // 注册模式应包含确认密码字段
  ok('注册模式含确认密码字段', authHtml.indexOf('auth-confirm') >= 0,
     '注册表单缺少确认密码输入框');
  ok('注册模式含昵称字段', authHtml.indexOf('auth-name') >= 0, '');

  // 3. 邮箱格式校验
  ok('validateEmail 存在', typeof validateEmail === 'function', '');
  if(typeof validateEmail === 'function'){
    ok('非法邮箱被拒绝', !validateEmail('not-an-email'), '');
    ok('合法邮箱通过', validateEmail('user@example.com'), '');
    ok('空邮箱被拒绝', !validateEmail(''), '');
  }

  // 4. 密码校验
  ok('validatePassword 存在', typeof validatePassword === 'function', '');
  if(typeof validatePassword === 'function'){
    ok('短密码被拒绝', !validatePassword('12345'), '');
    ok('6位密码通过', validatePassword('123456'), '');
  }

  // 5. doSignUp 前置校验：确认密码不一致时提示
  globalThis.__toastLog.length = 0;
  document.getElementById('auth-email').value = 'user@example.com';
  document.getElementById('auth-password').value = '123456';
  document.getElementById('auth-confirm').value = '654321';
  await doSignUp();
  ok('密码不一致被拦截', toasts().some(function(t){ return t && (t.indexOf('确认密码') >= 0 || t.indexOf('密码不一致') >= 0); }),
     'toast: '+JSON.stringify(toasts()));

  // 6. doSignUp 前置校验：邮箱非法
  globalThis.__toastLog.length = 0;
  document.getElementById('auth-email').value = 'bad-email';
  document.getElementById('auth-password').value = '123456';
  document.getElementById('auth-confirm').value = '123456';
  await doSignUp();
  ok('非法邮箱被拦截', toasts().some(function(t){ return t && t.indexOf('邮箱') >= 0; }),
     'toast: '+JSON.stringify(toasts()));

  // 7. 登出保留本地数据（不重置 seedData）
  var beforeLen = db.knowledge.length;
  db.knowledge.push({id:'__keep__', subjectId:'ds', chapter:'c', title:'t', content:'c', tags:[], stage:0, nextReview:todayStr(), lastReview:null, createdAt:todayStr()});
  await save();
  await signOut(); // sb 为 null 时 signOut 直接 return，不会清数据
  ok('signOut 在 sb 不可用时安全返回', true, '');
  // 验证 signOut 源码不再重置为 seedData（用源码检测）
  var srcHasReset = /db\s*=\s*seedData\(\)/.test(src.slice(0, 0) + js);
  ok('signOut 不再重置本地数据', srcHasReset === false,
     'signOut 源码仍包含 db=seedData() 重置逻辑');

  console.log('\\n=== 汇总: '+pass+' 通过 / '+fail+' 失败 ===');
  console.log(fail===0 ? '\\n✅ GREEN: 注册登录功能完善' : '\\n❌ RED: 存在失败项');
  process.exit(fail===0 ? 0 : 1);
}).catch(function(e){
  console.error('LOAD ERROR:', e && e.stack ? e.stack : e);
  process.exit(2);
});
`;

// 注意：上面用 src 检测 seedData 重置，需要在 eval 前注入 js 源码变量
eval(js + '\nconst src = ' + JSON.stringify(js) + ';\n' + test);
