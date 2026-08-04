/* Round 5: comprehensive runtime verification (all in eval scope) */
const fs = require('fs');
const src = fs.readFileSync('C:/Users/53296/WorkBuddy/2026-08-04-20-21-15/kaoyan-study/_check.js', 'utf-8');

const localStorage = {
  _s: {},
  getItem(k){ return this._s[k]||null; },
  setItem(k,v){ this._s[k]=String(v); },
  removeItem(k){ delete this._s[k]; }
};
const document = { createElement:()=>({}), getElementById:()=>null, head:{appendChild(){}}, body:{appendChild(){}}, querySelector:()=>null, querySelectorAll:()=>[] };
globalThis.window = globalThis;
globalThis.matchMedia = () => ({ addEventListener(){}, matches:false });
globalThis.addEventListener = () => {};
globalThis.navigator = { serviceWorker:{ register:async()=>({}) } };
globalThis.curView = 'dashboard';

const cut = src.indexOf('/* ================= 主题');

const verify = `
;load().then(async function(){
  console.log('=== 数据层 ===');
  console.log('subjects:', db.subjects.length, '| knowledge:', db.knowledge.length, '| questions:', db.questions.length);
  console.log('新闻史:', db.subjects.some(s=>s.name==='中国新闻史')?'OK':'MISSING');

  console.log('\\n=== 函数完整性 ===');
  var required=['load','save','render','renderSidebar','renderBadges','renderDashboard','renderLibrary','kwCard','openKwDetail','openKwModal','saveKw','delKw','startReview','renderReviewHome','renderFlashcard','grade','renderQuizHome','startQuiz','renderQuestion','answerQ','renderQuizResult','renderWrong','renderStats','donutSVG','drawBarChart','delSubject','doDelSubject','openNewSubjectModal','confirmNewSubject','cleanCardTitle','parseCardsText','importCardsFile','showCardsImportPreview','confirmCardsImport','resetStats','doResetStats','exportData','importData','openModal','closeModal','toast','updateSidebarTimer','startTimer','startActivityTracking','toggleBlanksMode','getCountdownDate','setExamDate','setDailyGoal','updateDashboardHeader','openExamDatePicker','openGoalSetter','renderSidebarUser','openAuthModal','doLogin','doSignUp','signOut','openProfileModal','saveProfile','renderLeaderboard','toggleStar','hideLoading','ensureNewsSubject','showFirstGuide','nextGuide','closeGuide'];
  var missing=required.filter(function(f){return typeof eval(f)!=='function';});
  console.log(missing.length===0?'全部 '+required.length+' 个函数存在 OK':'缺失: '+missing.join(','));

  console.log('\\n=== 智能出题（应已移除）===');
  console.log(typeof autoGenQuestions==='function'?'存在(异常)':'已移除 OK');

  console.log('\\n=== 增删改链路 ===');
  var before=db.subjects.length;
  db.subjects.push({id:'t1',name:'测试',color:'#000',exam:''});
  await save();
  var ok1=JSON.parse(localStorage.getItem('yanxueku_v1')).subjects.length===before+1;
  db.subjects=db.subjects.filter(function(s){return s.id!=='t1';});
  await save();
  console.log('save/load 链路:', ok1?'OK':'FAIL', '| 删除后:', db.subjects.length===before?'OK':'FAIL');

  console.log('\\n=== 计时器函数 ===');
  console.log('updateSidebarTimer:', typeof updateSidebarTimer==='function'?'OK':'FAIL');
  console.log('EBB:', EBB.join(','));
  console.log('\\n✅ Round5 验证完成');
}).catch(function(e){ console.error('LOAD ERROR:', e && e.message); });
`;

eval(src.slice(0, cut) + verify);
