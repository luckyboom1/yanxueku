/* actions.js — 统一事件委托层（v3.0.0-beta.25 重构）
 *
 * 标记约定：
 *   data-act-click="动作名"    click 动作
 *   data-act-input="动作名"    input 动作（el.value 为入参）
 *   data-act-change="动作名"   change 动作（文件选择等）
 *   data-act-keydown="动作名"  keydown 动作（data-key 指定键默认 Enter，data-ctrl="1" 要求 Ctrl）
 *   data-arg / data-arg2     字符串参数（id/枚举值/数字串，函数内自行 parseInt）
 *   data-key / data-ctrl     仅 data-act-keydown 用
 *
 * 非原生可交互元素（div 等 role=button 卡片）上的 Enter/Space 等同点击，
 * 原生 <button>/<input>/<a> 由浏览器自身激活语义覆盖，不重复派发。
 * 内层 data-act 元素通过 closest() 优先命中——等价于原 inline 的 stopPropagation。
 *
 * 动作名只在 ACTIONS 表中查名执行：标记值永远不会变成可执行代码，
 * 内联事件注入面（onclick 字符串拼接）随之整体关闭。新增交互：
 * 在这里登记一个函数，不要回写属性形式的 JS。 */
var ACTIONS = {
  /* ---- 通用 ---- */
  closeModal: function(){ closeModal(); },
  noop: function(){},
  pickFile: function(el){ var i = document.getElementById(el.dataset.arg); if(i) i.click(); },
  pickColor: function(el){   // 色板选择（新建科目 pf-color / 资料头像 ns-hidden-color 共用）
    var p = el.parentElement;
    if(p) Array.prototype.forEach.call(p.querySelectorAll('span'), function(s){ s.classList.remove('sel'); });
    el.classList.add('sel');
    var inp = document.getElementById(el.dataset.target);
    if(inp) inp.value = el.dataset.arg;
  },
  /* ---- 导航 ---- */
  switchView: function(el){ switchView(el.dataset.arg || el.dataset.view); },   // 侧栏项自带 data-view，免重复 data-arg
  gotoLibrarySubject: function(el){ switchView('library'); setLibSubject(el.dataset.arg); },
  toggleSidebar: function(){ toggleSidebar(); },
  cycleTheme: function(){ cycleTheme(); },
  /* ---- 认证 ---- */
  signOut: function(){ signOut(); },
  openAuthModal: function(){ openAuthModal(); },
  toggleAuthMode: function(){ toggleAuthMode(); },
  togglePwd: function(){ togglePwd(); },
  doLogin: function(){ doLogin(); },
  doSignUp: function(){ doSignUp(); },
  gateLogin: function(){ gateLogin(); },
  gateScrollDown: function(){ gateScrollDown(); },
  /* ---- 数据导入导出 ---- */
  exportData: function(){ exportData(); },
  importData: function(el, ev){ importData(ev); },
  confirmImportData: function(){ confirmImportData(); },
  closeModalClearImport: function(){ closeModal(); _pendingImportData = null; },
  importCardsFile: function(el, ev){ importCardsFile(ev); },
  importCardPackFile: function(el, ev){ importCardPackFile(ev); },
  confirmPackImport: function(){ confirmPackImport(); },
  closeModalClearPack: function(){ closeModal(); _pendingPackData = null; },
  exportCardPack: function(){ exportCardPack(); },
  confirmCardsImport: function(){ confirmCardsImport(); },
  /* ---- 科目 ---- */
  openNewSubjectModal: function(el, ev){ openNewSubjectModal(ev); },
  confirmNewSubject: function(){ confirmNewSubject(); },
  delSubject: function(el, ev){ delSubject(el.dataset.arg, ev); },
  doDelSubject: function(el){ doDelSubject(el.dataset.arg); },
  setLibSubject: function(el){ setLibSubject(el.dataset.arg); },
  /* ---- 知识库 ---- */
  openKwModal: function(el){ openKwModal(el.dataset.arg || undefined); },
  openKwDetail: function(el){ openKwDetail(el.dataset.arg); },
  delKw: function(el){ delKw(el.dataset.arg); },
  doDelKw: function(el){ doDelKw(el.dataset.arg); },
  saveKw: function(el){ saveKw(el.dataset.arg || ''); },
  saveKwDraft: function(el){ saveKwDraft(el.dataset.arg); },
  toggleStar: function(el, ev){ toggleStar(el.dataset.arg, ev); },
  liveFilterLibrary: function(el){ liveFilterLibrary(el.value); },
  libFilterTag: function(el){ libFilter.tag = (libFilter.tag === el.dataset.tag ? '' : el.dataset.tag); renderLibrary(); },
  /* ---- 复习 ---- */
  startReview: function(el){ startReview(el.dataset.arg || undefined); },
  closeModalStartReview: function(el){ closeModal(); startReview(el.dataset.arg); },
  setReviewSubject: function(el){ setReviewSubject(el.dataset.arg); },
  grade: function(el, ev){ grade(parseInt(el.dataset.arg, 10), ev); },
  flipCard: function(el){ el.classList.toggle('flipped'); },
  /* ---- 刷题 ---- */
  startQuiz: function(){ startQuiz(); },
  quizSubject: function(el){ quizCfg.subject = el.dataset.arg; renderQuizHome(); },
  quizMode: function(el){ quizCfg.mode = el.dataset.arg; renderQuizHome(); },
  quizCount: function(el){ quizCfg.count = parseInt(el.dataset.arg, 10); renderQuizHome(); },
  quizExitView: function(el){ quiz = null; switchView(el.dataset.arg); },
  quizExitHome: function(){ quiz = null; renderQuizHome(); },
  answerQ: function(el){ answerQ(parseInt(el.dataset.arg, 10)); },
  answerInputQ: function(){ answerInputQ(); },
  nextQ: function(){ nextQ(); },
  redoWrong: function(el){ redoWrong(el.dataset.arg, parseInt(el.dataset.arg2, 10)); },
  redoWrongInput: function(el){ redoWrongInput(el.dataset.arg); },
  /* ---- 统计 / 榜单 ---- */
  renderLeaderboard: function(el){ renderLeaderboard(el.dataset.arg); },
  heatmapClick: function(el, ev){ heatmapClick(ev); },
  openGoalSetter: function(){ openGoalSetter(); },
  setDailyGoalInput: function(){ setDailyGoal(parseInt(document.getElementById('goal-input').value, 10) || 20); closeModal(); },
  openExamDatePicker: function(){ openExamDatePicker(); },
  confirmExamDate: function(){ confirmExamDate(); },
  cycleRetention: function(){ cycleRetention(); },
  resetStats: function(){ resetStats(); },
  doResetStats: function(){ doResetStats(); },
  /* ---- 我的 ---- */
  openProfileModal: function(){ openProfileModal(); },
  saveProfile: function(){ saveProfile(); },
  openAccountModal: function(){ openAccountModal(); },
  changeEmail: function(){ changeEmail(); },
  changePassword: function(){ changePassword(); },
  openHotkeyHelp: function(){ openHotkeyHelp(); },
  nextGuide: function(){ nextGuide(); },
  closeGuide: function(){ closeGuide(); },
  /* ---- AI ---- */
  openAiSettings: function(){ openAiSettings(); },
  saveAiSettings: function(){ saveAiSettings(); },
  openAiCardModal: function(){ openAiCardModal(); },
  aiGenerateCardsBtn: function(el){ aiGenerateCardsBtn(el); },
  aiTestConnectionBtn: function(el){ aiTestConnectionBtn(el); },
  aiImportSelected: function(){ aiImportSelected(); },
  toggleEngine: function(){ toggleEngine(); },
  closeModalClearAI: function(){ closeModal(); _aiPendingCards = null; },
  closeModalOpenAiSettings: function(){ closeModal(); openAiSettings(); },
  /* ---- 公共课程库 ---- */
  renderPublicLibrary: function(){ renderPublicLibrary(); },
  plibSubject: function(el){ _pubLibSubject = el.dataset.arg; renderPublicLibrary(); },
  plibBack: function(){ _pubLibSubject = null; renderPublicLibrary(); },
  importPubLibSubject: function(el){ importPubLibSubject(el.dataset.arg); },
  showPubLibKwPreview: function(el){ showPubLibKwPreview(el); }
};

/* ---- 委托分发 ---- */
var _ACT_ATTR = { click: 'actClick', input: 'actInput', change: 'actChange', keydown: 'actKeydown' };
function _actDispatch(ev){
  var t = ev.target;
  var el = t && t.closest ? t.closest('[data-act-' + ev.type + ']') : null;
  if(!el) return;
  var name = el.dataset[_ACT_ATTR[ev.type]];
  var fn = name && ACTIONS[name];
  if(!fn) return;
  if(ev.type === 'keydown'){
    var want = el.dataset.key || 'Enter';
    if(ev.key !== want) return;
    if(el.dataset.ctrl && !ev.ctrlKey) return;
    ev.preventDefault();
  }
  fn(el, ev);
}
['click','input','change','keydown'].forEach(function(type){
  document.addEventListener(type, _actDispatch);
});

/* Enter/Space 通用激活：只补非原生元素（div/span 等 role=button 卡片）；
 * BUTTON/INPUT/TEXTAREA/SELECT/A 走浏览器原生激活，元素自带
 * data-act-keydown 时交给它自己的键位语义，避免双派发。 */
document.addEventListener('keydown', function(ev){
  if(ev.key !== 'Enter' && ev.key !== ' ') return;
  var t = ev.target;
  if(!t || !t.closest) return;
  var tag = t.tagName;
  if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A' || t.isContentEditable) return;
  var el = t.closest('[data-act-click]');
  if(!el || el.dataset.actKeydown) return;
  ev.preventDefault();
  var fn = ACTIONS[el.dataset.actClick];
  if(fn) fn(el, ev);
});
