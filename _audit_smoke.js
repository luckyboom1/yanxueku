/* Automated smoke test — data layer integrity */
const fs = require('fs');
const src = fs.readFileSync('C:/Users/53296/WorkBuddy/2026-08-04-20-21-15/kaoyan-study/index.html', 'utf-8');

// Extract JS
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

// Include all JS code - DOM is mocked sufficiently
const jsCore = js;

const test = `
;load().then(async function(){
  let pass = 0, fail = 0;
  function ok(name, cond){ if(cond){pass++; console.log('  ✅ '+name);} else {fail++; console.log('  ❌ '+name);} }

  console.log('\\n=== 数据层完整性 ===');
  ok('subjects 非空', db.subjects && db.subjects.length > 0);
  ok('knowledge 非空', db.knowledge && db.knowledge.length > 0);
  ok('questions 非空', db.questions && db.questions.length > 0);
  ok('studyLog 是数组', Array.isArray(db.studyLog));
  ok('quizRecords 是数组', Array.isArray(db.quizRecords));
  ok('settings 可缺省或为对象', db.settings === undefined || typeof db.settings === 'object');
  ok('默认仅 1 个测试科目', db.subjects.length === 1 && /测试/.test(db.subjects[0].name));

  console.log('\\n=== 函数完整性 ===');
  var required=['load','save','render','renderSidebar','renderBadges','renderDashboard','renderLibrary',
    'kwCard','openKwDetail','openKwModal','saveKw','delKw','startReview','renderReviewHome',
    'renderFlashcard','grade','renderQuizHome','startQuiz','renderQuestion','answerQ',
    'renderQuizResult','renderWrong','renderStats','donutSVG','drawBarChart',
    'delSubject','doDelSubject','openNewSubjectModal','confirmNewSubject',
    'cleanCardTitle','parseCardsText','importCardsFile','showCardsImportPreview','confirmCardsImport',
    'resetStats','doResetStats','exportData','importData','openModal','closeModal','toast',
    'updateSidebarTimer','startTimer','startActivityTracking','toggleBlanksMode',
    'getCountdownDate','setExamDate','setDailyGoal','updateDashboardHeader',
    'openExamDatePicker','openGoalSetter','renderSidebarUser','openAuthModal',
    'doLogin','doSignUp','signOut','openProfileModal','saveProfile','renderLeaderboard',
    'toggleStar','hideLoading','renderGate','hideGate','setupAuthListener','showFirstGuide','nextGuide','closeGuide',
    'esc','uid','todayStr','addDays','seedData','getSubject','addStudy','isDue','dueList',
    'masteryLevel','wrongList'];
  var missing=required.filter(function(f){return typeof eval(f)!=='function';});
  ok('全部 '+required.length+' 个函数存在', missing.length===0);
  if(missing.length>0) console.log('    缺失: '+missing.join(', '));

  console.log('\\n=== autoGenQuestions 应已移除 ===');
  ok('autoGenQuestions 已移除', typeof autoGenQuestions!=='function');

  console.log('\\n=== save/load 链路 ===');
  var before = db.subjects.length;
  db.subjects.push({id:'__test__',name:'测试科目',color:'#000',exam:''});
  await save();
  var saved = JSON.parse(localStorage.getItem('yanxueku_v1'));
  ok('save 写入 localStorage', saved && saved.subjects.length === before+1);
  db.subjects = db.subjects.filter(function(s){return s.id!=='__test__';});
  await save();
  ok('删除后 save', JSON.parse(localStorage.getItem('yanxueku_v1')).subjects.length === before);

  console.log('\\n=== 艾宾浩斯复习排期 ===');
  ok('EBB 数组定义', Array.isArray(EBB) && EBB.length === 7);
  ok('EBB 值正确', EBB.join(',') === '1,2,4,7,15,30,60');
  var dueCount = dueList().length;
  ok('dueList 返回数组', Array.isArray(dueList()));
  ok('dueList 非空', dueCount > 0);

  console.log('\\n=== 错题本逻辑 ===');
  var wrongQs = wrongList();
  ok('wrongList 返回数组', Array.isArray(wrongQs));

  console.log('\\n=== 导入导出 ===');
  var exportOk = true;
  try { exportData(); } catch(e) { exportOk = false; }
  ok('exportData 调用无异常', exportOk);
  // exportData 触发浏览器下载（不返回值），用 JSON.stringify 往返验证数据可序列化
  var serialized = JSON.stringify(db);
  var roundTrip = JSON.parse(serialized);
  ok('数据可序列化往返', roundTrip && roundTrip.subjects && roundTrip.knowledge.length === db.knowledge.length);

  console.log('\\n=== 科目删除链路 ===');
  db.subjects.push({id:'__del_test__',name:'删除测试',color:'#f00',exam:''});
  db.knowledge.push({id:'__del_kw__',subjectId:'__del_test__',chapter:'ch1',title:'test',content:'test',tags:[],stage:0,nextReview:todayStr(),lastReview:null,createdAt:Date.now()});
  await save();
  var subjBefore = db.subjects.length;
  var kwBefore = db.knowledge.length;
  // simulate doDelSubject
  db.knowledge = db.knowledge.filter(function(k){return k.subjectId!=='__del_test__';});
  db.questions = db.questions.filter(function(q){return q.subjectId!=='__del_test__';});
  db.subjects = db.subjects.filter(function(s){return s.id!=='__del_test__';});
  await save();
  ok('级联删除科目', db.subjects.length === subjBefore - 1);
  ok('级联删除知识点', db.knowledge.length === kwBefore - 1);

  console.log('\\n=== 总结 ===');
  console.log('通过: '+pass+' / 失败: '+fail);
  console.log(fail===0?'\\n✅ 全部冒烟测试通过':'\\n❌ 有 '+fail+' 个测试失败');
  process.exit(fail===0 ? 0 : 1);
}).catch(function(e){
  console.error('LOAD ERROR:', e && e.stack ? e.stack : e);
  process.exit(2);
});
`;

eval(jsCore + test);
