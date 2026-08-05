/* Regression test: kwCard 渲染完整性（收藏按钮 monkey-patch Bug） */
const fs = require('fs');
const src = fs.readFileSync('C:/Users/53296/WorkBuddy/2026-08-04-20-21-15/kaoyan-study/index.html', 'utf-8');

// 提取 JS
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
;load().then(function(){
  let pass = 0, fail = 0;
  function ok(name, cond, detail){
    if(cond){ pass++; console.log('  ✅ '+name); }
    else { fail++; console.log('  ❌ '+name + (detail ? '\\n     ' + detail : '')); }
  }

  console.log('=== kwCard 渲染回归测试 ===');
  const k = db.knowledge[0];
  console.log('测试卡片:', k.id, '/', k.title);

  const html = kwCard(k);

  // 1. div 的 onclick 属性必须完好（可点开卡片）
  ok('div onclick 属性完好', html.includes("onclick=\\"openKwDetail('"+k.id+"')\\""),
     '期望包含 onclick="openKwDetail(\\''+k.id+'\\')"\\n实际: '+html.slice(0, 200));

  // 2. div start tag 完整（style 属性未被破坏成文本）
  ok('div style 属性保留', html.includes('<div class="kw-card" style='),
     'div start tag 被按钮注入破坏 → 属性变裸文本\\n实际: '+html.slice(0, 160));

  // 3. 收藏按钮已注入
  ok('收藏按钮已注入', html.includes('<button class="kw-star'),
     '缺少收藏按钮');

  // 4. 按钮 onclick 无引号嵌套（用单引号包 id）
  ok('按钮 onclick 合法', html.includes("toggleStar('"+k.id+"',event)"),
     '期望 toggleStar(\\''+k.id+'\\',event)\\n实际: '+(html.match(/toggleStar\([^)]*\)/g)||[]).join(' | '));

  // 5. 无双引号嵌套残留
  ok('无双引号嵌套', !/toggleStar\\(\s*"/.test(html),
     '检测到 toggleStar("... 双引号嵌套');

  // 6. 输出中不应出现裸属性文本（style= 后面跟着 > 而非值）
  ok('无裸属性文本', !/style=\\s*">/.test(html),
     '检测到 style= 后跟 > 的裸文本');

  // ---- renderLibrary 标签 chip（同类引号嵌套隐患）----
  console.log('\\n=== renderLibrary 标签 chip 回归 ===');
  // 造一个含单引号的标签，验证不会破坏 onclick
  db.knowledge.push({id:'__tag_test__', subjectId:'ds', chapter:'ch', title:'t', content:'c',
    tags:["O'Brien"], stage:0, nextReview:todayStr(), lastReview:null, createdAt:todayStr()});
  libFilter = {subject:'all', tag:'', search:''};
  renderLibrary();
  var libHtml = document.getElementById('view-library').innerHTML;
  ok('标签 chip 使用 data-tag', libHtml.indexOf("O'Brien") >= 0,
     'chip 应通过 data-tag 传递标签值');
  ok('标签 chip onclick 无字符串嵌入', libHtml.includes('this.dataset.tag'),
     'onclick 不应嵌入标签字符串');
  ok('标签 chip 无双引号嵌套', !/libFilter\.tag===\\s*['"]/.test(libHtml),
     'onclick 不应直接嵌入标签字面量');

  console.log('\\n=== 汇总: '+pass+' 通过 / '+fail+' 失败 ===');
  console.log(fail===0 ? '\\n✅ GREEN: kwCard 渲染完整' : '\\n❌ RED: kwCard 渲染异常');
  process.exit(fail===0 ? 0 : 1);
}).catch(function(e){
  console.error('LOAD ERROR:', e && e.stack ? e.stack : e);
  process.exit(2);
});
`;

eval(js + test);
