/* 验证：浏览器场景 window.supabase 存在时，sb 初始化和 auth 监听注册 */
const fs = require('fs');
const src = fs.readFileSync('C:/Users/53296/WorkBuddy/2026-08-04-20-21-15/kaoyan-study/index.html', 'utf-8');
const m = src.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/);
const js = m[1];

let authCb = null;
globalThis.localStorage = {
  _s: {},
  getItem(k){ return this._s[k]||null; },
  setItem(k,v){ this._s[k]=String(v); },
  removeItem(k){ delete this._s[k]; }
};
globalThis.window = globalThis;
globalThis.supabase = { createClient: () => ({
  auth: { onAuthStateChange: (cb) => { globalThis.__authCb = cb; }, getSession: async () => ({ data: { session: null } }) },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }), single: async () => ({ data: null }) }) }) }),
  channel: () => ({ on: () => ({ subscribe: () => ({}) }) })
}) };
function mockEl(){
  return { style:{}, classList:{add(){},remove(){},toggle(){},contains(){return false}}, setAttribute(){}, getAttribute(){return null}, appendChild(){}, insertBefore(){}, replaceChild(){}, remove(){}, querySelector(){return null}, querySelectorAll(){return []}, dataset:{}, addEventListener(){}, removeEventListener(){}, click(){}, innerHTML:'', textContent:'', value:'', scrollTop:0, _children:[] };
}
const _elCache = {};
globalThis.document = {
  createElement: () => mockEl(),
  getElementById: (id) => { if(!_elCache[id]) _elCache[id] = mockEl(); return _elCache[id]; },
  head: { appendChild(){} },
  querySelector: () => null,
  querySelectorAll: () => [],
  documentElement: { setAttribute(){}, getAttribute(){ return 'light'; } },
  addEventListener(){},
  removeEventListener(){},
  visibilityState: 'visible'
};
globalThis.matchMedia = () => ({ addEventListener(){}, matches:false });
globalThis.addEventListener = () => {};
globalThis.navigator = { serviceWorker:{ register: async () => ({}) } };
globalThis.location = { protocol: 'http:' };
globalThis.curView = 'dashboard';
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);

eval(js + `
;setTimeout(function(){
  console.log('sb 初始化:', sb ? 'PASS (sb 非空)' : 'FAIL (sb 为空)');
  console.log('auth 监听注册:', globalThis.__authCb ? 'PASS' : 'FAIL');
  console.log('CDN script 标签:', ${JSON.stringify(src.includes('supabase-js'))} ? 'PASS (页面已引入)' : 'FAIL');
  process.exit(sb && globalThis.__authCb ? 0 : 1);
}, 200);
`);
