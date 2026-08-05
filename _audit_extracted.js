
/* ================= 数据层（Supabase 共享数据库） ================= */
const SUPABASE_URL = 'https://gwihiemggugzwhutsfea.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3aWhpZW1nZ3VnendodXRzZmVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTMyODksImV4cCI6MjEwMTQyOTI4OX0.UcE502jd3DINEHwxmOgDXsGR3kQ3YYda48v5myCAHA4';
let sb = null;
let _supabaseTried = false;
function tryInitSupabase(){
  if(sb || _supabaseTried) return !!sb;
  _supabaseTried = true;
  if(window.supabase && window.supabase.createClient){
    try{ sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); }catch(e){ console.warn('Supabase init failed:', e && e.message); }
  }
  return !!sb;
}
tryInitSupabase();
if(!sb){
  // 兜底：jsdelivr 不可用时动态加载 unpkg
  var _s = document.createElement('script');
  _s.src = 'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  _s.onload = function(){ tryInitSupabase(); setupAuthListener(); };
  document.head.appendChild(_s);
}
const THEME_KEY = 'yanxueku_theme';
const EBB = [1, 2, 4, 7, 15, 30, 60];            // 艾宾浩斯间隔（天），stage 0..6
const EBB_LABEL = ['新学', '第2天', '第4天', '第7天', '第15天', '第30天', '长期记忆'];

function todayStr(){ return dayStr(new Date()); }
function dayStr(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function addDays(str, n){ const d = new Date(str+'T00:00:00'); d.setDate(d.getDate()+n); return dayStr(d); }
function diffDays(a, b){ return Math.round((new Date(a+'T00:00:00') - new Date(b+'T00:00:00'))/86400000); }
function uid(){ return 'k'+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function md(s){
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\n/g,'<br>');
}

/* ---------- 内置示例数据 ---------- */
function seedData(){
  const t = todayStr();
  const subjects = [
    {id:'demo', name:'数据结构 · 测试', color:'#6366f1', exam:'考研 408'},
  ];
  const K = (id, subjectId, chapter, title, content, tags, stage, dueIn) => ({
    id, subjectId, chapter, title, content, tags,
    stage, nextReview: addDays(t, dueIn), lastReview: stage>0 ? addDays(t, dueIn-EBB[Math.min(stage,6)]) : null,
    createdAt: addDays(t, -20)
  });
  const knowledge = [
    K('demo1','demo','绪论','时间复杂度与渐进记号',
      '**大O记号**：表示算法运行时间的上界。\n常见复杂度排序：O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(2ⁿ)。\n**易错点**：最好/最坏/平均时间复杂度要分清，考研常考"最坏情况"。',
      ['复杂度','测试'], 0, 0),
    K('demo2','demo','线性表','栈与队列的区别',
      '**栈**：后进先出（LIFO），仅允许在栈顶插入删除。\n应用：函数调用、表达式求值、括号匹配。\n**队列**：先进先出（FIFO），队尾入、队头出。\n应用：层次遍历、缓冲区、BFS。',
      ['栈','队列','测试'], 0, 1),
    K('demo3','demo','树与二叉树','二叉树的三种遍历',
      '前序：**根 → 左 → 右**；中序：左 → 根 → 右；后序：左 → 右 → 根。\n**考点**：已知前序+中序 或 后序+中序 可唯一重建二叉树；前序+后序 **不能**唯一确定。',
      ['二叉树','测试'], 0, 2),
  ];
  const Q = (id, subjectId, chapter, type, q, options, answer, explain) => ({id, subjectId, chapter, type, q, options, answer, explain});
  const questions = [
    Q('q_demo1','demo','绪论','single','下列排序算法中，属于不稳定排序的是（ ）',
      ['冒泡排序','直接插入排序','快速排序','归并排序'], 2,
      '口诀"快选希堆"不稳定：快速排序、简单选择、希尔排序、堆排序均为不稳定排序。'),
    Q('q_demo2','demo','线性表','single','栈的操作特点是（ ）',
      ['先进先出','后进先出','随机存取','只能插入不能删除'], 1,
      '栈是限定仅在栈顶进行插入和删除的线性表，特点是后进先出（LIFO）。'),
    Q('q_demo3','demo','树与二叉树','judge','已知前序和中序序列可唯一确定一棵二叉树。',
      null, 1,
      '正确。前序+中序、后序+中序都可唯一确定一棵二叉树。'),
  ];
  const studyLog = [];
  const quizRecords = [];
  return {subjects, knowledge, questions, quizRecords, studyLog};
}


let db;
let _loadResolve = null;
let _currentUser = null, _profile = null;   // 提前声明，避免 load() 中访问触发 TDZ
const _dbReady = new Promise(r => { _loadResolve = r; });
async function load(){
  // Supabase 查询包在 try/catch 里：任何异常都不影响本地回退
  if(sb){
    try{
      const uid = _currentUser ? _currentUser.id : null;
      const { data } = uid ? await sb.from('app_state').select('data').eq('user_id', uid).maybeSingle() : {data: null};
      if(data && data.data && data.data.subjects){
        db = data.data;
        _loadResolve(db);
        setupRealtimeSync();
        hideLoading();
        return;
      }
    }catch(e){ console.warn('Supabase load failed, using local:', e.message); }
  }
  // Fallback: localStorage or seed
  try{
    const raw = localStorage.getItem('yanxueku_v1');
    if(raw){ db = JSON.parse(raw); _loadResolve(db); setupRealtimeSync(); hideLoading(); return; }
  }catch(e){}
  db = seedData();
  try{ await save(); }catch(e){ console.warn('save failed:', e.message); }
  _loadResolve(db);
  setupRealtimeSync();
  hideLoading();
}
function hideLoading(){
  setTimeout(function(){
    var s = document.getElementById('loading-screen');
    if(s && !s.classList.contains('done')) s.classList.add('done');
  }, 120);
}
async function save(){
  if(sb && _currentUser){
    try{ await sb.from('app_state').upsert({ user_id: _currentUser.id, data: db, updated_at: new Date().toISOString() }); }catch(e){ console.warn('Supabase save failed'); }
  }
  try{ localStorage.setItem('yanxueku_v1', JSON.stringify(db)); }catch(e){ console.warn('localStorage save failed:', e.message); } // always mirror to localStorage as backup
}
function setupRealtimeSync(){
  if(!sb) return;
  sb.channel('app_state_changes')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_state', filter: 'user_id=eq.'+(_currentUser?_currentUser.id:'') },
      payload => {
        if(payload.new && payload.new.data && payload.new.data.subjects){
          const oldUpdated = new Date(db.updated_at||0).getTime();
          const newUpdated = new Date(payload.new.data.updated_at||0).getTime();
          if(newUpdated > oldUpdated){
            db = payload.new.data;
            try{ localStorage.setItem('yanxueku_v1', JSON.stringify(db)); }catch(e){}
            if(curView) render();
            setTimeout(function(){ updateSidebarTimer(); }, 50);
            setTimeout(function(){ updateDashboardHeader(); }, 80);
          }
        }
      }
    ).subscribe();
}


function getSubject(id){ return db.subjects.find(s=>s.id===id); }
function addStudy(min){
  const t = todayStr();
  let rec = db.studyLog.find(r=>r.date===t);
  if(!rec){ rec = {date:t, minutes:0}; db.studyLog.push(rec); }
  rec.minutes += min;
  save();
}
function isDue(k){ return k.nextReview <= todayStr(); }
function dueList(){ return db.knowledge.filter(isDue).sort((a,b)=> a.nextReview < b.nextReview ? -1 : 1); }
function masteryLevel(k){ if(k.stage<=0) return 0; if(k.stage<=2) return 1; if(k.stage<=4) return 2; return 3; }
const MASTERY_NAMES = ['未掌握','初学','熟练','掌握'];
const MASTERY_COLORS = ['#94a3b8','#f59e0b','#0ea5e9','#10b981'];
function wrongList(){
  const latest = {};
  db.quizRecords.forEach(r=>{ latest[r.qid] = r; });
  return db.questions.filter(q=> latest[q.id] && !latest[q.id].correct);
}

/* ================= 主题 ================= */
function applyTheme(mode){
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = mode==='system' ? (prefersDark?'dark':'light') : mode;
  document.documentElement.setAttribute('data-theme', theme);
  const icons = {light:'☀️ 浅色', dark:'🌙 深色', system:'🌓 跟随系统'};
  const btn = document.getElementById('theme-btn');
  if(btn) btn.textContent = icons[mode] || mode;
  localStorage.setItem(THEME_KEY, mode);
  themeMode = mode;
}
let themeMode = localStorage.getItem(THEME_KEY) || 'system';
function cycleTheme(){
  const order = ['light','dark','system'];
  themeMode = order[(order.indexOf(themeMode)+1)%order.length];
  applyTheme(themeMode);
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ()=>{ if(themeMode==='system') applyTheme('system'); });

/* ================= 导航 ================= */
const VIEW_META = {
  dashboard:{title:'学习仪表盘', sub:''},
  library:{title:'知识库', sub:'按科目与章节组织你的专业课笔记'},
  review:{title:'记忆复习', sub:'基于艾宾浩斯遗忘曲线智能排期'},
  quiz:{title:'刷题自测', sub:'随机组卷 · 即时判分 · 解析回顾'},
  wrong:{title:'错题本', sub:'答错自动收录，重做正确后移除'},
  stats:{title:'学习统计', sub:'用数据看见自己的进步'},
};
let curView = 'dashboard';
let libFilter = {subject:'all', tag:'', search:''};

function switchView(name){
  curView = name;
  document.querySelectorAll('.nav-item').forEach(n=> n.classList.toggle('active', n.dataset.view===name));
  document.querySelectorAll('.view').forEach(v=> v.classList.toggle('active', v.id==='view-'+name));
  const meta = VIEW_META[name];
  document.getElementById('page-title').textContent = meta.title;
  document.getElementById('page-sub').textContent = meta.sub;
  render();
  document.getElementById('content').scrollTop = 0;
}
function toggleSidebar(){
  if(window.innerWidth<=767){
    const s=document.getElementById('sidebar');
    s.classList.toggle('open');
    let ov=document.getElementById('sidebar-overlay');
    if(!ov&&s.classList.contains('open')){
      ov=document.createElement('div');ov.id='sidebar-overlay';
      ov.onclick=()=>{s.classList.remove('open');ov.remove();};
      document.body.appendChild(ov);
    }
    if(ov){if(s.classList.contains('open')) ov.classList.add('open');else{ov.remove();}}
  } else {
    document.getElementById('sidebar').classList.toggle('collapsed');
  }
}
window.addEventListener('resize', ()=>{
  if(window.innerWidth>767){
    document.getElementById('sidebar').classList.remove('open');
    const ov=document.getElementById('sidebar-overlay');if(ov)ov.remove();
  }
});

function render(){
  if(!_currentUser){ renderGate(); return; }
  hideGate();
  renderSidebar(); renderBadges();
  ({dashboard:renderDashboard, library:renderLibrary, review:renderReviewHome, quiz:renderQuizHome, wrong:renderWrong, stats:renderStats})[curView]();
}
function renderSidebar(){
  if(!db||!db.subjects) return;
  const el = document.getElementById('subj-list');
  if(!el) return;
  el.innerHTML = db.subjects.map(s=>{
    const cnt = db.knowledge.filter(k=>k.subjectId===s.id).length;
    const due = db.knowledge.filter(k=>k.subjectId===s.id && isDue(k)).length;
    return `<div class="subj-item" onclick="switchView('library');setLibSubject('${s.id}')">
      <span class="subj-dot" style="background:${s.color}"></span>${esc(s.name)}
      <span class="subj-count">${due>0? due+' 待复习 · ' : ''}${cnt}</span>
      <button class="subj-del" title="删除科目" onclick="delSubject('${s.id}',event)">✕</button></div>`;
  }).join('');
}
function renderBadges(){
  if(!db||!db.knowledge) return;
  const due = dueList().length;
  const b1 = document.getElementById('badge-due');
  b1.style.display = due? 'flex':'none'; b1.textContent = due;
  const wn = wrongList().length;
  const b2 = document.getElementById('badge-wrong');
  b2.style.display = wn? 'flex':'none'; b2.textContent = wn;
}

/* ================= 仪表盘 ================= */
function renderDashboard(){
  if(!db||!db.studyLog) return;
  const el = document.getElementById('view-dashboard');
  const t = todayStr();
  const due = dueList();
  const todayMin = (db.studyLog.find(r=>r.date===t)||{minutes:0}).minutes;
  // 连续学习天数
  let streak = 0;
  for(let i=0;;i++){
    const d = addDays(t,-i);
    const rec = db.studyLog.find(r=>r.date===d);
    if(rec && rec.minutes>0) streak++;
    else { if(i===0){ continue; } break; }
    if(i>365) break;
  }
  const mastered = db.knowledge.filter(k=>masteryLevel(k)===3).length;
  const totalQ = db.questions.length;
  const doneQ = new Set(db.quizRecords.map(r=>r.qid)).size;
  const correctQ = db.quizRecords.filter(r=>r.correct).length;
  const acc = db.quizRecords.length? Math.round(correctQ/db.quizRecords.length*100) : 0;
  const hour = new Date().getHours();
  const greet = hour<6?'夜深了':hour<12?'早上好':hour<14?'中午好':hour<18?'下午好':'晚上好';
  const dateStr = new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});

  // 未来7天复习计划
  const plan = [];
  for(let i=0;i<7;i++){
    const d = addDays(t,i);
    const n = db.knowledge.filter(k=>k.nextReview===d).length;
    const over = i===0 ? db.knowledge.filter(k=>k.nextReview<d).length : 0;
    plan.push({d, n: n+over, label: i===0?'今天': i===1?'明天': (d.slice(5).replace('-','/'))});
  }
  const maxPlan = Math.max(1, ...plan.map(p=>p.n));

  el.innerHTML = `
    
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:18px">
      <div>
        <h2 style="font-size:22px;font-weight:800">${greet}，考研人 💪</h2>
        <div style="color:var(--text-3);font-size:13px">${dateStr} · 今天的每一点积累，都是上岸的底气</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap" id="dash-header-right"></div>
    </div>
    <div class="grid-stats">
      <div class="stat-card" style="--sc:linear-gradient(90deg,#ef4444,#f87171)">
        <div class="stat-ico">⏰</div>
        <div class="stat-num">${due.length}<small> 个</small></div>
        <div class="stat-label">今日待复习知识点</div>
      </div>
      <div class="stat-card" style="--sc:linear-gradient(90deg,#6366f1,#8b5cf6)">
        <div class="stat-ico">🔥</div>
        <div class="stat-num">${streak}<small> 天</small></div>
        <div class="stat-label">连续学习</div>
      </div>
      <div class="stat-card" style="--sc:linear-gradient(90deg,#0ea5e9,#38bdf8)">
        <div class="stat-ico">⏱️</div>
        <div class="stat-num">${todayMin}<small> 分钟</small></div>
        <div class="stat-label">今日学习时长</div>
      </div>
      <div class="stat-card" style="--sc:linear-gradient(90deg,#10b981,#34d399)">
        <div class="stat-ico">🏆</div>
        <div class="stat-num">${mastered}<small> / ${db.knowledge.length}</small></div>
        <div class="stat-label">已掌握知识点</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-title">📅 未来 7 天复习计划 <span class="sub">逾期任务已并入今天</span></div>
      <div style="display:flex;align-items:flex-end;gap:10px;height:110px;padding-top:6px">
        ${plan.map(p=>`
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end">
            <span style="font-size:12px;font-weight:700;color:${p.n?'var(--primary)':'var(--text-3)'}">${p.n||''}</span>
            <div style="width:100%;max-width:44px;height:${Math.round(p.n/maxPlan*72)}px;min-height:${p.n?6:2}px;border-radius:7px;background:${p.n?'var(--grad)':'var(--border)'};opacity:${p.n?1:.5};transition:height .5s"></div>
            <span style="font-size:11px;color:var(--text-3)">${p.label}</span>
          </div>`).join('')}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px" class="dash-2col">
      <div class="panel">
        <div class="panel-title">⚡ 快捷操作</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <button class="btn btn-primary" style="justify-content:center;padding:15px" onclick="startReview()">🧠 开始复习</button>
          <button class="btn btn-ghost" style="justify-content:center;padding:15px" onclick="switchView('quiz')">✍️ 随机自测</button>
          <button class="btn btn-ghost" style="justify-content:center;padding:15px" onclick="openKwModal()">＋ 记知识点</button>
          <button class="btn btn-ghost" style="justify-content:center;padding:15px" onclick="switchView('stats')">📊 学习统计</button>
        </div>
      </div>
      <div class="panel">
        <div class="panel-title">🎯 刷题概况</div>
        <div style="display:flex;gap:22px;align-items:center;flex-wrap:wrap">
          <div>
            <div style="font-size:26px;font-weight:800">${acc}%</div>
            <div style="font-size:12px;color:var(--text-3)">答题正确率</div>
          </div>
          <div>
            <div style="font-size:26px;font-weight:800">${doneQ}<span style="font-size:13px;color:var(--text-3)"> / ${totalQ}</span></div>
            <div style="font-size:12px;color:var(--text-3)">已练习题目</div>
          </div>
          <div>
            <div style="font-size:26px;font-weight:800;color:var(--danger)">${wrongList().length}</div>
            <div style="font-size:12px;color:var(--text-3)">待攻克错题</div>
          </div>
        </div>
      </div>
    </div>`;
}

/* ================= 知识库 ================= */
function setLibSubject(id){ libFilter.subject = id; renderLibrary(); }
function renderLibrary(){
  if(!db||!db.knowledge) return;
  const el = document.getElementById('view-library');
  const tags = [...new Set(db.knowledge.flatMap(k=>k.tags))];
  let list = db.knowledge.slice();
  if(libFilter.subject!=='all') list = list.filter(k=>k.subjectId===libFilter.subject);
  if(libFilter.tag) list = list.filter(k=>k.tags.includes(libFilter.tag));
  if(libFilter.search){
    const q = libFilter.search.toLowerCase();
    list = list.filter(k=> (k.title+k.content+k.chapter+k.tags.join('')).toLowerCase().includes(q));
  }
  list.sort((a,b)=> (isDue(a)?0:1)-(isDue(b)?0:1) || a.nextReview.localeCompare(b.nextReview));

  el.innerHTML = `
    <div class="filter-bar">
      <div class="search-box">
        <span class="s-ico">🔍</span>
        <input placeholder="搜索标题 / 内容 / 标签…" value="${esc(libFilter.search)}" oninput="libFilter.search=this.value;renderLibrary()">
      </div>
      <div class="chip ${libFilter.subject==='all'?'active':''}" onclick="setLibSubject('all')">全部科目</div>
      ${db.subjects.map(s=>`<div class="chip ${libFilter.subject===s.id?'active':''}" onclick="setLibSubject('${s.id}')">${esc(s.name)}</div>`).join('')}
      <button class="btn btn-ghost" style="margin-left:auto" onclick="document.getElementById('import-cards-file').click()">📥 导入卡片文本</button>
      <button class="btn btn-primary" onclick="openKwModal()">＋ 新建知识点</button>
    </div>
    ${tags.length?`<div class="filter-bar" style="margin-top:-6px">
      <span style="font-size:12px;color:var(--text-3)">标签：</span>
      ${tags.map(t=>`<div class="chip ${libFilter.tag===t?'active':''}" style="padding:5px 12px;font-size:12px" data-tag="${esc(t)}" onclick="libFilter.tag = libFilter.tag===this.dataset.tag ? '' : this.dataset.tag; renderLibrary()">${esc(t)}</div>`).join('')}
    </div>`:''}
    ${list.length? `<div class="kw-grid">${list.map(kwCard).join('')}</div>`
      : `<div class="empty-state"><div class="big">🗂️</div><h3>没有找到相关知识点</h3><p>换个关键词试试，或者新建一个知识点</p></div>`}`;
}
function kwCard(k){
  const s = getSubject(k.subjectId);
  const ml = masteryLevel(k);
  const t = todayStr();
  let dueCls, dueTxt;
  if(k.nextReview < t){ dueCls='today'; dueTxt='已逾期 '+diffDays(t,k.nextReview)+' 天'; }
  else if(k.nextReview===t){ dueCls='today'; dueTxt='今日待复习'; }
  else if(diffDays(k.nextReview,t)<=3){ dueCls='soon'; dueTxt=diffDays(k.nextReview,t)+' 天后复习'; }
  else { dueCls='later'; dueTxt=k.nextReview.slice(5).replace('-','/')+' 复习'; }
  return `<div class="kw-card" style="--kc:${s?s.color:'#6366f1'}" onclick="openKwDetail('${k.id}')">
    <div class="kw-head">
      <span class="kw-chapter">${esc(s?s.name:'')} · ${esc(k.chapter)}</span>
      <span class="kw-due ${dueCls}">${dueTxt}</span>
    </div>
    <div class="kw-title">${esc(k.title)}</div>
    <div class="kw-preview">${esc(k.content).slice(0,120)}</div>
    <div class="kw-foot">
      ${k.tags.map(tg=>`<span class="tag">${esc(tg)}</span>`).join('')}
      <span class="mastery" title="掌握度：${MASTERY_NAMES[ml]}">${[0,1,2,3].map(i=>`<i class="${i<=ml && k.stage>0 || i<ml ? 'on':''}"></i>`).join('')}</span>
    </div>
  </div>`;
}
function openKwDetail(id){
  const k = db.knowledge.find(x=>x.id===id);
  if(!k) return;
  const s = getSubject(k.subjectId);
  openModal(`
    <button class="modal-close" onclick="closeModal()">✕</button>
    <h3><span class="subj-dot" style="background:${s?s.color:'#6366f1'};width:11px;height:11px"></span>${esc(k.title)}</h3>
    <div class="review-info">
      <span>📖 ${esc(s?s.name:'')} · ${esc(k.chapter)}</span>
      <span>🧠 记忆阶段：${EBB_LABEL[Math.min(k.stage,6)]}</span>
      <span>📅 下次复习：${k.nextReview}</span>
      <span>📈 掌握度：${MASTERY_NAMES[masteryLevel(k)]}</span>
    </div>
    <div class="detail-content">${md(k.content)}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">${k.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>
    <div class="modal-actions">
      <button class="btn btn-ghost" style="color:var(--danger)" onclick="delKw('${k.id}')">删除</button>
      <button class="btn btn-ghost" onclick="openKwModal('${k.id}')">编辑</button>
      <button class="btn btn-primary" onclick="closeModal();startReview('${k.id}')">立即复习</button>
    </div>`);
}
function openKwModal(id){
  const k = id? db.knowledge.find(x=>x.id===id) : null;
  openModal(`
    <button class="modal-close" onclick="closeModal()">✕</button>
    <h3>${k?'✏️ 编辑知识点':'＋ 新建知识点'}</h3>
    <div class="form-2col">
      <div class="form-row"><label>所属科目</label>
        <select id="f-subject">${db.subjects.map(s=>`<option value="${s.id}" ${k&&k.subjectId===s.id?'selected':''}>${esc(s.name)}（${esc(s.exam)}）</option>`).join('')}</select>
      </div>
      <div class="form-row"><label>章节</label>
        <input id="f-chapter" placeholder="如：树与二叉树" value="${k?esc(k.chapter):''}">
      </div>
    </div>
    <div class="form-row"><label>标题</label><input id="f-title" placeholder="一句话概括这个知识点" value="${k?esc(k.title):''}"></div>
    <div class="form-row"><label>内容（支持 **加粗** 和 \`代码\`）</label><textarea id="f-content" rows="7" placeholder="用自己的话记录考点，记得更牢…">${k?esc(k.content):''}</textarea></div>
    <div class="form-row"><label>标签（用逗号分隔）</label><input id="f-tags" placeholder="如：高频考点, 计算题" value="${k?esc(k.tags.join(', ')):''}"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="saveKw('${k?k.id:''}')">${k?'保存修改':'创建并加入复习计划'}</button>
    </div>`);
}
function saveKw(id){
  const subjectId = document.getElementById('f-subject').value;
  const chapter = document.getElementById('f-chapter').value.trim() || '未分章';
  const title = document.getElementById('f-title').value.trim();
  const content = document.getElementById('f-content').value.trim();
  const tags = document.getElementById('f-tags').value.split(/[,，]/).map(s=>s.trim()).filter(Boolean);
  if(!title){ toast('请填写标题','err'); return; }
  if(!content){ toast('请填写内容','err'); return; }
  if(id){
    const k = db.knowledge.find(x=>x.id===id);
    Object.assign(k, {subjectId, chapter, title, content, tags});
    toast('知识点已更新','ok');
  }else{
    db.knowledge.push({id:uid(), subjectId, chapter, title, content, tags, stage:0, nextReview:todayStr(), lastReview:null, createdAt:todayStr()});
    toast('已创建并加入今日复习 🎉','ok');
  }
  save(); closeModal(); render();
}
function delKw(id){
  const k = db.knowledge.find(x=>x.id===id);
  openModal(`
    <button class="modal-close" onclick="closeModal()">✕</button>
    <h3>⚠️ 确认删除</h3>
    <p style="color:var(--text-2);line-height:1.8">即将删除知识点「<b>${esc(k.title)}</b>」，删除后不可恢复，确定吗？</p>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" style="background:linear-gradient(135deg,#ef4444,#f87171)" onclick="doDelKw('${id}')">确认删除</button>
    </div>`);
}
function doDelKw(id){
  db.knowledge = db.knowledge.filter(k=>k.id!==id);
  save(); closeModal(); render();
  toast('已删除','info');
}

/* ================= 艾宾浩斯复习 ================= */
let reviewQueue = [], reviewIdx = 0, reviewDone = 0;
function startReview(focusId){
  let q = dueList();
  if(focusId){
    const k = db.knowledge.find(x=>x.id===focusId);
    q = k? [k] : [];
  }
  if(!q.length){ toast('今日没有待复习内容，太棒了！🎉','ok'); return; }
  reviewQueue = q; reviewIdx = 0; reviewDone = 0;
  switchView('review');
}
function renderReviewHome(){
  if(!db||!db.knowledge) return;
  const el = document.getElementById('view-review');
  if(!reviewQueue.length || reviewIdx>=reviewQueue.length){
    const due = dueList();
    if(!due.length){
      el.innerHTML = `<div class="empty-state"><div class="big">🎉</div><h3>今日复习任务全部完成</h3><p>保持节奏，艾宾浩斯会帮你把知识焊在脑子里</p>
        <button class="btn btn-primary" style="margin-top:18px" onclick="switchView('dashboard')">回到仪表盘</button></div>`;
    }else{
      reviewQueue = due; reviewIdx = 0; reviewDone = 0;
      renderFlashcard(); return;
    }
    return;
  }
  renderFlashcard();
}
function renderFlashcard(){
  const el = document.getElementById('view-review');
  const k = reviewQueue[reviewIdx];
  const s = getSubject(k.subjectId);
  el.innerHTML = `
    <div class="review-wrap">
      <div class="review-progress">
        <span class="rp-text">进度 ${reviewIdx+1} / ${reviewQueue.length}</span>
        <div class="rp-bar"><div class="rp-fill" style="width:${Math.round(reviewIdx/reviewQueue.length*100)}%"></div></div>
        <span class="rp-text" style="color:var(--success)">已完成 ${reviewDone}</span>
      </div>
      <div class="flashcard" id="fcard" onclick="this.classList.toggle('flipped')">
        <div class="fc-inner">
          <div class="fc-face fc-front">
            <span class="fc-chapter">${esc(s?s.name:'')} · ${esc(k.chapter)} · ${EBB_LABEL[Math.min(k.stage,6)]}</span>
            <div class="fc-title">${esc(k.title)}</div>
            <div class="fc-hint">👆 点击卡片查看答案</div>
          </div>
          <div class="fc-face fc-back">
            <span class="fc-chapter" style="align-self:center">${esc(k.title)}</span>
            <div class="fc-content">${md(k.content)}</div>
          </div>
        </div>
      </div>
      <div class="grade-row">
        <button class="grade-btn g-forgot" onclick="grade(0,event)">😵 忘记了<small>明天重新复习</small></button>
        <button class="grade-btn g-blur" onclick="grade(1,event)">🤔 有点模糊<small>缩短间隔再巩固</small></button>
        <button class="grade-btn g-good" onclick="grade(2,event)">😎 记得牢固<small>进入下一记忆阶段</small></button>
      </div>
    </div>`;
}
function grade(g, ev){
  ev.stopPropagation();
  const k = reviewQueue[reviewIdx];
  const t = todayStr();
  if(g===0){ k.stage = 0; k.nextReview = addDays(t, 1); }
  else if(g===1){ const iv = Math.max(1, Math.round(EBB[Math.min(k.stage,6)]/2)); k.nextReview = addDays(t, iv); }
  else { k.stage = Math.min(k.stage+1, EBB.length-1); k.nextReview = addDays(t, EBB[k.stage]); }
  k.lastReview = t;
  reviewDone++;
  addStudy(2);
  save();
  reviewIdx++;
  if(reviewIdx >= reviewQueue.length){
    addStudy(3);
    const el = document.getElementById('view-review');
    el.innerHTML = `<div class="empty-state"><div class="big">🏆</div><h3>本轮复习完成！</h3>
      <p>共复习 ${reviewDone} 个知识点，遗忘曲线已更新</p>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:18px">
        <button class="btn btn-ghost" onclick="switchView('dashboard')">回到仪表盘</button>
        <button class="btn btn-primary" onclick="switchView('quiz')">去刷几道题巩固一下</button>
      </div></div>`;
    reviewQueue = [];
    renderBadges();
    toast(`本轮复习完成，记忆进度已更新 ✅`,'ok');
  }else{
    renderFlashcard();
    renderBadges();
  }
}

/* ================= 刷题自测 ================= */
let quiz = null; // {list, idx, right, answered}
let quizCfg = {subject:'all', count:10};
function renderQuizHome(){
  if(!db||!db.questions) return;
  const el = document.getElementById('view-quiz');
  if(quiz && quiz.idx < quiz.list.length){ renderQuestion(); return; }
  el.innerHTML = `
    <div class="quiz-setup panel">
      <div class="panel-title">📝 组卷设置</div>
      <div style="font-size:13px;font-weight:600;color:var(--text-2);margin-bottom:4px">选择科目</div>
      <div class="opt-grid">
        <div class="opt-card ${quizCfg.subject==='all'?'sel':''}" onclick="quizCfg.subject='all';renderQuizHome()">全部科目</div>
        ${db.subjects.map(s=>`<div class="opt-card ${quizCfg.subject===s.id?'sel':''}" onclick="quizCfg.subject='${s.id}';renderQuizHome()">${esc(s.name)}（${db.questions.filter(q=>q.subjectId===s.id).length}题）</div>`).join('')}
      </div>
      <div style="font-size:13px;font-weight:600;color:var(--text-2);margin-bottom:4px">题目数量</div>
      <div class="opt-grid">
        ${[5,10,20].map(n=>`<div class="opt-card ${quizCfg.count===n?'sel':''}" onclick="quizCfg.count=${n};renderQuizHome()">${n} 题</div>`).join('')}
      </div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;padding:14px;font-size:14px" onclick="startQuiz()">🚀 开始自测</button>
      <div style="text-align:center;font-size:12px;color:var(--text-3);margin-top:12px">答错的题目会自动进入错题本</div>
    </div>`;
}
function startQuiz(){
  let pool = db.questions.slice();
  if(quizCfg.subject!=='all') pool = pool.filter(q=>q.subjectId===quizCfg.subject);
  if(!pool.length){ toast('该科目暂无题目','err'); return; }
  pool = pool.sort(()=>Math.random()-.5).slice(0, Math.min(quizCfg.count, pool.length));
  quiz = {list:pool, idx:0, right:0};
  renderQuestion();
}
function renderQuestion(){
  const el = document.getElementById('view-quiz');
  const q = quiz.list[quiz.idx];
  const s = getSubject(q.subjectId);
  const opts = q.type==='judge' ? ['正确','错误'] : q.options;
  el.innerHTML = `
    <div class="review-wrap" style="max-width:720px">
      <div class="review-progress">
        <span class="rp-text">第 ${quiz.idx+1} / ${quiz.list.length} 题</span>
        <div class="rp-bar"><div class="rp-fill" style="width:${Math.round(quiz.idx/quiz.list.length*100)}%"></div></div>
        <span class="rp-text" style="color:var(--success)">答对 ${quiz.right}</span>
      </div>
      <div class="q-card">
        <div class="q-meta">
          <span class="q-type ${q.type}">${q.type==='judge'?'判断题':'单选题'}</span>
          <span class="kw-chapter">${esc(s?s.name:'')} · ${esc(q.chapter)}</span>
        </div>
        <div class="q-text">${esc(q.question)}</div>
        <div id="q-opts">
          ${opts.map((o,i)=>`<div class="q-opt" onclick="answerQ(${i})"><span class="key">${q.type==='judge'?(i===0?'✓':'✗'):'ABCD'[i]}</span><span>${esc(o)}</span></div>`).join('')}
        </div>
        <div id="q-feedback"></div>
      </div>
    </div>`;
}
function answerQ(i){
  const q = quiz.list[quiz.idx];
  const optEls = document.querySelectorAll('#q-opts .q-opt');
  if(optEls[0].classList.contains('locked')) return;
  const correct = i === q.answer;
  optEls.forEach((el,j)=>{
    el.classList.add('locked');
    if(j===q.answer) el.classList.add('correct');
    else if(j===i) el.classList.add('wrong');
  });
  db.quizRecords.push({qid:q.id, correct, date:todayStr()});
  addStudy(1);
  save();
  if(correct) quiz.right++;
  const isLast = quiz.idx+1 >= quiz.list.length;
  document.getElementById('q-feedback').innerHTML = `
    <div class="q-explain"><b>📖 解析：</b>${md(q.explanation)}</div>
    <div class="q-foot">
      <span class="q-result-badge ${correct?'ok':'no'}">${correct?'✅ 回答正确':'❌ 回答错误，已加入错题本'}</span>
      <button class="btn btn-primary" onclick="nextQ()">${isLast?'查看成绩 🏁':'下一题 →'}</button>
    </div>`;
  renderBadges();
}
function nextQ(){
  quiz.idx++;
  if(quiz.idx >= quiz.list.length){ renderQuizResult(); return; }
  renderQuestion();
}
function renderQuizResult(){
  const total = quiz.list.length, right = quiz.right;
  const pct = Math.round(right/total*100);
  const wrongs = quiz.list.filter(q=>{
    const recs = db.quizRecords.filter(r=>r.qid===q.id);
    return recs.length && !recs[recs.length-1].correct;
  });
  const C = 2*Math.PI*52;
  document.getElementById('view-quiz').innerHTML = `
    <div class="review-wrap" style="max-width:560px">
      <div class="q-card" style="text-align:center">
        <h3 style="font-size:18px;margin-bottom:4px">🏁 本次自测成绩</h3>
        <div class="score-ring">
          <svg width="150" height="150" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" stroke-width="10"/>
            <circle cx="60" cy="60" r="52" fill="none" stroke="url(#sg)" stroke-width="10" stroke-linecap="round"
              stroke-dasharray="${C}" stroke-dashoffset="${C*(1-pct/100)}" style="transition:stroke-dashoffset 1s cubic-bezier(.16,1,.3,1)"/>
            <defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs>
          </svg>
          <div class="val"><b>${pct}</b><span>正确率 %</span></div>
        </div>
        <p style="color:var(--text-2)">${total} 题答对 ${right} 题${wrongs.length?`，${wrongs.length} 道错题已收入错题本`:'，全部答对，太稳了！'}</p>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:20px">
          <button class="btn btn-ghost" onclick="quiz=null;renderQuizHome()">再来一组</button>
          ${wrongs.length?`<button class="btn btn-primary" onclick="quiz=null;switchView('wrong')">去攻克错题</button>`:`<button class="btn btn-primary" onclick="quiz=null;switchView('dashboard')">回到仪表盘</button>`}
        </div>
      </div>
    </div>`;
  renderBadges();
}

/* ================= 错题本 ================= */
function renderWrong(){
  if(!db||!db.questions) return;
  const el = document.getElementById('view-wrong');
  const list = wrongList();
  if(!list.length){
    el.innerHTML = `<div class="empty-state"><div class="big">✨</div><h3>错题本空空如也</h3><p>去「刷题自测」练练手，答错的题会自动收录到这里</p>
      <button class="btn btn-primary" style="margin-top:18px" onclick="switchView('quiz')">去刷题</button></div>`;
    return;
  }
  el.innerHTML = `
    <div class="panel" style="display:flex;align-items:center;gap:12px;padding:16px 22px">
      <span style="font-size:22px">📕</span>
      <div><b>${list.length} 道错题待攻克</b><div style="font-size:12px;color:var(--text-3)">重做正确后将自动移出错题本</div></div>
    </div>
    ${list.map(q=>{
      const s = getSubject(q.subjectId);
      const opts = q.type==='judge'? ['正确','错误'] : q.options;
      return `<div class="row-item" id="wq-${q.id}">
        <div class="q-meta">
          <span class="q-type ${q.type}">${q.type==='judge'?'判断题':'单选题'}</span>
          <span class="kw-chapter">${esc(s?s.name:'')} · ${esc(q.chapter)}</span>
        </div>
        <div class="q-text">${esc(q.question)}</div>
        <div>${opts.map((o,i)=>`<div class="q-opt" onclick="redoWrong('${q.id}',${i})"><span class="key">${q.type==='judge'?(i===0?'✓':'✗'):'ABCD'[i]}</span><span>${esc(o)}</span></div>`).join('')}</div>
        <div class="wq-feedback"></div>
      </div>`;
    }).join('')}`;
}
function redoWrong(qid, i){
  const q = db.questions.find(x=>x.id===qid);
  const box = document.getElementById('wq-'+qid);
  const optEls = box.querySelectorAll('.q-opt');
  if(optEls[0].classList.contains('locked')) return;
  const correct = i === q.answer;
  optEls.forEach((el,j)=>{
    el.classList.add('locked');
    if(j===q.answer) el.classList.add('correct');
    else if(j===i) el.classList.add('wrong');
  });
  db.quizRecords.push({qid, correct, date:todayStr()});
  addStudy(1);
  save();
  const fb = box.querySelector('.wq-feedback');
  if(correct){
    fb.innerHTML = `<div class="q-explain" style="border-color:rgba(16,185,129,.35);background:rgba(16,185,129,.06)"><b>🎉 答对了！</b>本题已移出错题本。<br><b>📖 解析：</b>${md(q.explanation)}</div>`;
    toast('错题攻克成功，已移出 🎉','ok');
    setTimeout(()=>{ box.style.transition='all .4s'; box.style.opacity='0'; box.style.transform='translateX(30px)';
      setTimeout(()=>renderWrong(), 400); }, 1200);
  }else{
    fb.innerHTML = `<div class="q-explain"><b>💪 再想想！</b>仍留在错题本中。<br><b>📖 解析：</b>${md(q.explanation)}</div>`;
  }
  renderBadges();
}

/* ================= 数据统计 ================= */
function renderStats(){
  if(!db||!db.studyLog) return;
  const el = document.getElementById('view-stats');
  const t = todayStr();
  // 近14天
  const days = [];
  for(let i=13;i>=0;i--){
    const d = addDays(t,-i);
    const rec = db.studyLog.find(r=>r.date===d);
    days.push({d, m: rec?rec.minutes:0});
  }
  const totalMin = db.studyLog.reduce((s,r)=>s+r.minutes,0);
  // 掌握度分布
  const dist = [0,0,0,0];
  db.knowledge.forEach(k=> dist[masteryLevel(k)]++);
  el.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn btn-ghost" style="color:var(--warn)" onclick="resetStats()">🔄 重置学习数据</button>
    </div>
    <div class="grid-stats" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
      <div class="stat-card" style="--sc:var(--grad)"><div class="stat-num">${db.knowledge.length}</div><div class="stat-label">知识点总数</div></div>
      <div class="stat-card" style="--sc:linear-gradient(90deg,#0ea5e9,#38bdf8)"><div class="stat-num">${db.quizRecords.length}</div><div class="stat-label">累计答题次数</div></div>
      <div class="stat-card" style="--sc:linear-gradient(90deg,#f59e0b,#fbbf24)"><div class="stat-num">${Math.floor(totalMin/60)}<small> 时 </small>${totalMin%60}<small> 分</small></div><div class="stat-label">累计学习时长</div></div>
      <div class="stat-card" style="--sc:linear-gradient(90deg,#10b981,#34d399)"><div class="stat-num">${db.knowledge.length?Math.round(dist[3]/db.knowledge.length*100):0}<small> %</small></div><div class="stat-label">知识点掌握率</div></div>
    </div>
    <div class="stats-grid">
      <div class="panel">
        <div class="panel-title">📈 近 14 天学习时长（分钟）</div>
        <canvas id="chart-days"></canvas>
      </div>
      <div class="panel">
        <div class="panel-title">🧠 知识点掌握度分布</div>
        <div class="donut-wrap">${donutSVG(dist)}<div class="legend">
          ${MASTERY_NAMES.map((n,i)=>`<div class="legend-item"><span class="dot" style="background:${MASTERY_COLORS[i]}"></span>${n}<b>${dist[i]}</b></div>`).join('')}
        </div></div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-title">📚 各科目掌握进度</div>
      ${db.subjects.map(s=>{
        const ks = db.knowledge.filter(k=>k.subjectId===s.id);
        if(!ks.length) return '';
        const avg = ks.reduce((sum,k)=>sum+masteryLevel(k),0)/ks.length/3*100;
        const due = ks.filter(isDue).length;
        return `<div class="subj-bar-row">
          <div class="subj-bar-head"><b><span class="subj-dot" style="background:${s.color};display:inline-block;margin-right:6px"></span>${esc(s.name)}</b>
          <span>${ks.length} 个知识点 · ${due} 个待复习 · 掌握 ${Math.round(avg)}%</span></div>
          <div class="subj-bar"><i style="width:${Math.round(avg)}%;background:${s.color}"></i></div>
        </div>`;
      }).join('')}
    </div>`;
  drawBarChart(days);
}
function donutSVG(dist){
  const total = dist.reduce((a,b)=>a+b,0) || 1;
  const R = 52, C = 2*Math.PI*R;
  let off = 0;
  const segs = dist.map((v,i)=>{
    if(!v) return '';
    const len = v/total*C;
    const s = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${MASTERY_COLORS[i]}" stroke-width="16"
      stroke-dasharray="${len} ${C-len}" stroke-dashoffset="${-off}" style="transition:stroke-dasharray .8s"/>`;
    off += len; return s;
  }).join('');
  return `<svg width="140" height="140" viewBox="0 0 140 140" style="transform:rotate(-90deg)">${segs}
    <circle cx="70" cy="70" r="36" fill="var(--surface)"/></svg>`;
}
function drawBarChart(days){
  const cv = document.getElementById('chart-days');
  if(!cv) return;
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = 260;
  cv.width = W*dpr; cv.height = H*dpr;
  const ctx = cv.getContext('2d');
  ctx.scale(dpr,dpr);
  const dark = document.documentElement.getAttribute('data-theme')==='dark';
  const cText = dark? '#a3a9c9' : '#5a5f7a';
  const cGrid = dark? '#272b47' : '#e6e8f2';
  const max = Math.max(10, ...days.map(d=>d.m));
  const padL = 34, padB = 26, padT = 14, padR = 8;
  const cw = (W-padL-padR)/days.length;
  // 网格线
  ctx.strokeStyle = cGrid; ctx.fillStyle = cText; ctx.lineWidth = 1;
  ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
  for(let g=0; g<=4; g++){
    const y = padT + (H-padT-padB)*g/4;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W-padR, y); ctx.stroke();
    ctx.fillText(Math.round(max*(4-g)/4), padL-6, y+3);
  }
  // 柱子
  const grad = ctx.createLinearGradient(0,padT,0,H-padB);
  grad.addColorStop(0,'#6366f1'); grad.addColorStop(1,'#8b5cf6');
  days.forEach((d,i)=>{
    const bh = d.m/max*(H-padT-padB);
    const x = padL + i*cw + cw*0.2, w = cw*0.6;
    const y = H-padB-bh;
    ctx.fillStyle = d.m? grad : cGrid;
    ctx.beginPath();
    const r = Math.min(5, w/2);
    if(bh>0){
      ctx.moveTo(x, y+r); ctx.arcTo(x, y, x+r, y, r); ctx.arcTo(x+w, y, x+w, y+r, r);
      ctx.lineTo(x+w, H-padB); ctx.lineTo(x, H-padB); ctx.closePath(); ctx.fill();
    }else{
      ctx.fillRect(x, H-padB-2, w, 2);
    }
    ctx.fillStyle = cText; ctx.textAlign = 'center'; ctx.font = '9.5px sans-serif';
    ctx.fillText(d.d.slice(5).replace('-','/'), padL+i*cw+cw/2, H-padB+14);
    if(d.m>0){ ctx.font = 'bold 9.5px sans-serif'; ctx.fillText(d.m, padL+i*cw+cw/2, y-4); }
  });
}

/* ================= 科目删除 ================= */
function delSubject(id, ev){
  if(ev) ev.stopPropagation();
  const s = getSubject(id);
  if(!s) return;
  const kwN = db.knowledge.filter(k=>k.subjectId===id).length;
  const qN = db.questions.filter(q=>q.subjectId===id).length;
  openModal(`
    <button class="modal-close" onclick="closeModal()">✕</button>
    <h3>⚠️ 删除科目「${esc(s.name)}」</h3>
    <p style="color:var(--text-2);line-height:1.9">该科目下的以下内容将被一并删除，且不可恢复：</p>
    <div class="review-info" style="margin:12px 0">
      <span>📚 <b>${kwN}</b> 个知识点（含复习进度）</span>
      <span>✍️ <b>${qN}</b> 道题目（含答题记录）</span>
    </div>
    <p style="color:var(--text-3);font-size:12px">建议先通过侧栏「⬇ 导出」备份全部数据。</p>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" style="background:linear-gradient(135deg,#ef4444,#f87171)" onclick="doDelSubject('${id}')">确认删除</button>
    </div>`);
}
function doDelSubject(id){
  const s = getSubject(id);
  const qids = new Set(db.questions.filter(q=>q.subjectId===id).map(q=>q.id));
  db.subjects = db.subjects.filter(x=>x.id!==id);
  db.knowledge = db.knowledge.filter(k=>k.subjectId!==id);
  db.questions = db.questions.filter(q=>q.subjectId!==id);
  db.quizRecords = db.quizRecords.filter(r=>!qids.has(r.qid));
  if(libFilter.subject===id) libFilter.subject = 'all';
  save(); closeModal(); render();
  toast(`科目「${esc(s.name)}」已删除`,'info');
}

/* ================= 新建科目 ================= */
function openNewSubjectModal(ev){
  if(ev) ev.stopPropagation();
  openModal(
    '<button class="modal-close" onclick="closeModal()">✕</button>'+
    '<h3>＋ 新建专业科目</h3>'+
    '<div class="form-row"><label>科目名称 *</label><input id="ns-name" placeholder="如：传播学教程"></div>'+
    '<div class="form-row"><label>考试名称</label><input id="ns-exam" placeholder="如：新闻与传播 440"></div>'+
    '<div class="form-row"><label>科目颜色</label><div class="color-picker" id="ns-colors"></div><input type="hidden" id="ns-hidden-color" value="#6366f1"></div>'+
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="confirmNewSubject()">创建科目</button></div>');
  var colors = ['#6366f1','#e11d48','#0ea5e9','#f59e0b','#10b981','#8b5cf6','#0891b2','#ca8a04','#dc2626','#16a34a'];
  function fillColorPicker(){
    var el = document.getElementById('ns-colors');
    if(!el){ requestAnimationFrame(fillColorPicker); return; }
    el.innerHTML = colors.map(function(c){
      return '<span style="background:'+c+'" data-color="'+c+'" onclick="var p=this.parentElement;p.querySelectorAll(\'span\').forEach(function(s){s.classList.remove(\'sel\')});this.classList.add(\'sel\');document.getElementById(\'ns-hidden-color\').value=\''+c+'\'"></span>';
    }).join('');
  }
  fillColorPicker();
}
function confirmNewSubject(){
  var name = document.getElementById('ns-name').value.trim();
  if(!name){ toast('请输入科目名称','err'); return; }
  if(db.subjects.some(function(s){return s.name===name;})){ toast('该科目名称已存在','err'); return; }
  var exam = document.getElementById('ns-exam').value.trim();
  var color = document.getElementById('ns-hidden-color').value || '#6366f1';
  db.subjects.push({ id: uid(), name: name, color: color, exam: exam });
  save(); closeModal();
  libFilter.subject = 'all';
  switchView('library');
  toast('科目「'+name+'」已创建 ✅','ok');
}

/* ================= 卡片文本导入（真经笔记 OCR 格式） ================= */
let pendingCards = null;
function cleanCardTitle(t){
  return String(t||'').trim()
    .replace(/^[（(]?[一二三四五六七八九十百]+[）)、．.]\s*/, '')
    .replace(/^\d+[、．.]\s*/, '')
    .trim();
}
function parseCardsText(text){
  text = String(text).replace(/^\uFEFF/, '');
  const HDR = /(?:20\d{2}\s*)?真经新闻史笔记[丨|1lI」]?\s*大伟的学习重要性提醒[：:]\s*([一二两三四五])星/g;
  const NOISE = [
    /(?:20\d{2}\s*)?真经新闻史笔记[丨|1lI」]?\s*大伟的学习重要性提醒[：:]\s*[一二两三四五]星/g,
    /20\d{2}\s*新传考研真经中国新闻史课程配套讲义[，,]?\s*仅供内部交流/g,
    /新传考研真经同行/g
  ];
  const lines = text.split(/\r?\n/);
  let chapter = '未分章';
  const cards = [];
  lines.forEach(raw=>{
    const line = raw.trim();
    if(!line) return;
    if(line.startsWith('#')){
      chapter = line.replace(/^#+\s*/, '').trim() || chapter;
      return;
    }
    const idx = line.indexOf('|');
    const head = idx>=0 ? line.slice(0, idx) : '';
    const body = (idx>=0 ? line.slice(idx+1) : line).trim();
    HDR.lastIndex = 0;
    const pts = [];
    let m;
    while((m = HDR.exec(body)) !== null){ if(m.index > 0) pts.push(m.index); }
    const segs = [];
    let prev = 0;
    pts.forEach(p=>{ segs.push(body.slice(prev, p)); prev = p; });
    segs.push(body.slice(prev));
    segs.forEach((seg, si)=>{
      let title = si===0 ? cleanCardTitle(head) : '';
      let star = '';
      const sm = seg.match(/重要性提醒[：:]\s*([一二两三四五])星/);
      if(sm) star = sm[1]+'星';
      let content = seg;
      NOISE.forEach(rx=>{ content = content.replace(rx, ' '); });
      content = content.replace(/\s+/g, ' ').trim();
      const pm = content.match(/^[（(][一二三四五六七八九十]+[）)]\s*([^【]{1,30}?)(?=【)/);
      if(pm){ title = pm[1].trim(); content = content.slice(pm[0].length).trim(); }
      if(!title || title.replace(/[《》<>「」“”"'\s]/g,'').length < 2){
        const bm = content.match(/《[^》]{1,20}》/);
        if(bm) title = bm[0];
        else{
          const fm = content.match(/^【[^】]*】\s*[“"]?([^，。；：]{2,15})/);
          title = fm ? fm[1].trim() : '卡片 ' + (cards.length+1);
        }
      }
      if(content.length < 10) return;
      cards.push({chapter, title, content, star});
    });
  });
  return cards;
}
function importCardsFile(ev){
  const f = ev.target.files[0];
  ev.target.value = '';
  if(!f) return;
  const reader = new FileReader();
  reader.onload = e=>{
    const cards = parseCardsText(e.target.result);
    if(!cards.length){ toast('未解析到任何卡片，请检查文件格式','err'); return; }
    pendingCards = cards;
    showCardsImportPreview(f.name);
  };
  reader.readAsText(f);
}
function showCardsImportPreview(fname){
  const cards = pendingCards;
  const guess = /新闻史|新传|新闻/.test(fname + cards.map(c=>c.chapter).join('')) ? '中国新闻史' : fname.replace(/\.[^.]+$/,'');
  const byChapter = {};
  cards.forEach(c=>{ byChapter[c.chapter] = (byChapter[c.chapter]||0)+1; });
  const seen = {};
  const dup = cards.filter(c=>{
    const existed = db.knowledge.some(k=>k.title===c.title) || seen[c.title];
    seen[c.title] = true;
    return existed;
  }).length;
  openModal(`
    <button class="modal-close" onclick="closeModal()">✕</button>
    <h3>📥 导入预览</h3>
    <div class="form-row"><label>导入到科目（不存在则自动创建）</label>
      <input id="imp-subject" value="${esc(guess)}">
    </div>
    <div class="review-info">
      <span>📄 ${esc(fname)}</span>
      <span>🗂️ 共 <b>${cards.length}</b> 张卡片 · ${Object.keys(byChapter).length} 个章节</span>
      ${dup?`<span style="color:var(--warn)">⚠️ ${dup} 张同名卡片将自动加序号区分</span>`:''}
    </div>
    <div style="max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:12px;padding:12px 16px;background:var(--surface-2)">
      ${Object.entries(byChapter).map(([ch,n])=>`
        <div style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px dashed var(--border)">
          <span>${esc(ch)}</span><b style="color:var(--primary)">${n} 张</b>
        </div>`).join('')}
    </div>
    <div style="font-size:12px;color:var(--text-3);margin-top:10px;line-height:1.7">
      星级标记将转为标签（如「两星」）；全部卡片进入今日复习队列。导入后可随时在知识库中编辑修正。
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="confirmCardsImport()">确认导入 ${cards.length} 张卡片</button>
    </div>`);
}
function confirmCardsImport(){
  const name = document.getElementById('imp-subject').value.trim() || '导入科目';
  let subj = db.subjects.find(s=>s.name===name);
  if(!subj){
    const palette = ['#e11d48','#7c3aed','#0891b2','#ca8a04','#16a34a','#dc2626','#2563eb'];
    subj = {id: uid(), name, color: palette[db.subjects.length % palette.length], exam:'新闻与传播'};
    db.subjects.push(subj);
  }
  let added = 0;
  const t = todayStr();
  const usedTitles = new Set(db.knowledge.filter(k=>k.subjectId===subj.id).map(k=>k.title));
  pendingCards.forEach(c=>{
    let title = c.title, n = 2;
    while(usedTitles.has(title)){ title = c.title + '（' + n + '）'; n++; }
    usedTitles.add(title);
    const tags = ['真经笔记'];
    if(c.star) tags.push(c.star);
    db.knowledge.push({
      id: uid(), subjectId: subj.id, chapter: c.chapter, title, content: c.content,
      tags, stage: 0, nextReview: t, lastReview: null, createdAt: t
    });
    added++;
  });
  pendingCards = null;
  save(); closeModal();
  libFilter.subject = subj.id;
  switchView('library');
  toast(`成功导入 ${added} 张卡片 🎉`,'ok');
}

/* ================= 数据重置 ================= */
function resetStats(){
  openModal(`
    <button class="modal-close" onclick="closeModal()">✕</button>
    <h3>🔄 重置学习数据</h3>
    <p style="color:var(--text-2);line-height:1.9">此操作将清空以下数据：</p>
    <div class="review-info" style="margin:12px 0">
      <span>⏱️ 学习时长与打卡记录</span>
      <span>✍️ 刷题答题记录与错题本</span>
      <span>🧠 所有知识点的复习进度（回到初始状态）</span>
    </div>
    <p style="color:var(--text-3);font-size:12px">知识点本身（标题/内容）不会删除。此操作不可恢复，建议先导出备份。</p>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" style="background:linear-gradient(135deg,#f59e0b,#fbbf24)" onclick="doResetStats()">确认重置</button>
    </div>`);
}
function doResetStats(){
  const t = todayStr();
  db.studyLog = [{date: t, minutes: 0}]; _activeSeconds = 0;
  db.quizRecords = [];
  db.knowledge.forEach(k => { k.stage = 0; k.nextReview = t; k.lastReview = null; });
  save(); closeModal(); render();
  toast('学习数据已重置 ✅','info');
}

/* ================= 导入导出 ================= */
function exportData(){
  const blob = new Blob([JSON.stringify(db, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '研学库备份_'+todayStr()+'.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('数据已导出 📦','ok');
}
function importData(ev){
  const f = ev.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = e=>{
    try{
      const data = JSON.parse(e.target.result);
      if(!data.subjects || !data.knowledge) throw new Error('格式不正确');
      db = data; save(); render();
      toast('导入成功，数据已恢复 ✅','ok');
    }catch(err){ toast('导入失败：文件格式不正确','err'); }
  };
  reader.readAsText(f);
  ev.target.value = '';
}

/* ================= 弹窗 & 提示 ================= */
function openModal(html){
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-mask" onclick="closeModal()"></div><div class="modal">${html}</div>`;
  root.classList.add('open');
}
function closeModal(){
  const root = document.getElementById('modal-root');
  root.classList.remove('open'); root.innerHTML = '';
}
function toast(msg, type){
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast '+(type||'info');
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>el.remove(), 300); }, 2600);
}
document.addEventListener('keydown', e=>{
  if(e.key==='Escape') closeModal();
  if(e.key===' ' && curView==='review' && reviewQueue.length && !e.target.matches('input,textarea')){
    const fc = document.getElementById('fcard');
    if(fc){ e.preventDefault(); fc.classList.toggle('flipped'); }
  }
});

/* ================= 启动 ================= */
applyTheme(themeMode);
load();
render();

/* ====== 按钮波纹 ====== */
document.addEventListener('click', function(e){
  var el = e.target.closest('.btn,.grade-btn,.mini-btn');
  if(!el||el.querySelector('.ripple')) return;
  var r = document.createElement('span');
  r.className = 'ripple';
  var rect = el.getBoundingClientRect();
  var size = Math.max(rect.width, rect.height);
  r.style.width = r.style.height = size + 'px';
  r.style.left = (e.clientX - rect.left - size/2) + 'px';
  r.style.top = (e.clientY - rect.top - size/2) + 'px';
  el.appendChild(r);
  setTimeout(function(){ r.remove(); }, 500);
});

/* ====== 首次引导 ====== */
function showFirstGuide(){
  var bubble = document.createElement('div');
  bubble.className = 'guide-bubble';
  bubble.id = 'guide-bubble';
  bubble.innerHTML = '<b>👋 欢迎使用研学库！</b><br>这是你的考研专业课学习系统。<br>· 侧栏「知识库」管理考点<br>· 「记忆复习」自动排期复盘<br>· 「刷题自测」检验掌握程度<br><button class="guide-next" onclick="nextGuide()">知道了，开始使用</button><button class="guide-skip" onclick="closeGuide()">跳过</button>';
  bubble.style.top = '90px';
  bubble.style.left = '260px';
  document.body.appendChild(bubble);
}
function nextGuide(){
  closeGuide();
  switchView('library');
  setTimeout(function(){
    var b2 = document.createElement('div');
    b2.className = 'guide-bubble';
    b2.id = 'guide-bubble';
    b2.innerHTML = '<b>📖 从新建知识点开始</b><br>点击右上角「＋ 记知识点」或点击任意卡片查看详情。<br>已内置 104 张中国新闻史卡片，可随时删除。<br><button class="guide-next" onclick="closeGuide()">明白了</button>';
    b2.style.top = '130px';
    b2.style.left = '280px';
    document.body.appendChild(b2);
  }, 400);
}
function closeGuide(){
  var b = document.getElementById('guide-bubble');
  if(b) b.remove();
  localStorage.setItem('yanxueku_guided', '1');
}


/* ====== 登录墙（一人一号，强制登录） ====== */
function renderGate(){
  let g = document.getElementById('login-gate');
  if(!g){
    g = document.createElement('div');
    g.id = 'login-gate';
    g.innerHTML = '<div class="gate-card">'+
      '<div class="gate-logo">📚</div>'+
      '<h2>登录后开始学习</h2>'+
      '<p>一人一号 · 学习资料云端专属存储<br>登录即可同步历史学习进度与个人知识库</p>'+
      '<button class="btn btn-primary" style="width:100%;justify-content:center;padding:12px" onclick="openAuthModal()">👤 登录 / 注册</button>'+
      '</div>';
    document.body.appendChild(g);
  }
  g.style.display = 'flex';
}
function hideGate(){
  const g = document.getElementById('login-gate');
  if(g) g.style.display = 'none';
}
/* ====== 学习计时器 ====== */
let _timerInterval = null;
function updateSidebarTimer(){
  if(!db||!db.studyLog) return;
  const t = todayStr();
  const todayRec = db.studyLog.find(r=>r.date===t);
  const m = todayRec ? todayRec.minutes : 0;
  const el = document.getElementById('sidebar-timer');
  if(el) el.textContent = String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
  const totalMin = db.studyLog.reduce((s,r)=>s+r.minutes,0);
  const totalEl = document.getElementById('sidebar-total');
  if(totalEl) totalEl.textContent = Math.floor(totalMin/60)+'时'+totalMin%60+'分';
}
function startTimer(){
  if(_timerInterval) clearInterval(_timerInterval);
  _timerInterval = setInterval(updateSidebarTimer, 1000);
  updateSidebarTimer();
}
// save hook: 每次保存后刷新 UI
const _origSaveFunc = save;
save = function(){
  const r = _origSaveFunc.apply(this, arguments);
  if(r && r.then) r.then(updateSidebarTimer); else updateSidebarTimer();
  return r;
};

// 学习时自动 +1 分钟（每 60 秒检测活跃状态）
let _activeSeconds = 0;
let _activeTimer = null;
function startActivityTracking(){
  if(_activeTimer) return;
  _activeTimer = setInterval(()=>{
    if(document.visibilityState === 'visible'){
      _activeSeconds++;
      if(!db||!db.studyLog){ _activeSeconds=0; return; }
      if(_activeSeconds >= 60){
        _activeSeconds = 0;
        const t = todayStr();
        let rec = db.studyLog.find(r=>r.date===t);
        if(!rec){ rec = {date:t, minutes:0}; db.studyLog.push(rec); }
        rec.minutes++;
        save();
        updateSidebarTimer();
      }
    }
  }, 1000);
}

// Deferred start after DB loads
_dbReady.then(function(){
  try{ startTimer(); }catch(e){}
  try{ startActivityTracking(); }catch(e){}
  // 首次使用引导
  if(!localStorage.getItem('yanxueku_guided')){
    setTimeout(showFirstGuide, 800);
  }
});


/* ====== v3.1: 挖空模式 + 倒计时 + 每日目标 ====== */

// --- 挖空模式 ---
let blanksMode = false;
let blankAnswers = [];
function toggleBlanksMode(){
  blanksMode = !blanksMode;
  const el = document.querySelector('.fc-back');
  if(!el) return;
  if(blanksMode){
    el.classList.add('blanks-mode');
    // 解析当前背面内容，隐藏 <b> 和 <code> 标签，替换为可点击的填空
    const original = el.innerHTML;
    if(!el.dataset.blanksOriginal) el.dataset.blanksOriginal = original;
    const bolds = el.querySelectorAll('b');
    const codes = el.querySelectorAll('code');
    blankAnswers = [];
    bolds.forEach(b => {
      const txt = b.textContent.trim();
      if(txt.length < 2 || txt.length > 25) return;
      const span = document.createElement('span');
      span.className = 'blank-reveal'; span.textContent = txt;
      span.dataset.answer = txt;
      span.onclick = function(){ this.classList.add('revealed'); this.textContent = this.dataset.answer; };
      b.replaceWith(span);
      blankAnswers.push({el: span, txt: txt});
    });
    codes.forEach(c => {
      const txt = c.textContent.trim();
      if(txt.length < 2 || txt.length > 20) return;
      const span = document.createElement('span');
      span.className = 'blank-reveal'; span.textContent = txt;
      span.dataset.answer = txt;
      span.onclick = function(){ this.classList.add('revealed'); this.textContent = this.dataset.answer; };
      c.replaceWith(span);
      blankAnswers.push({el: span, txt: txt});
    });
    // 添加计数提示
    if(blankAnswers.length > 0){
      const hint = document.createElement('div');
      hint.className = 'blank-count';
      hint.id = 'blank-hint';
      hint.textContent = '🔍 '+blankAnswers.length+' 个挖空 · 点击依次揭示';
      el.appendChild(hint);
    }
  }else{
    el.classList.remove('blanks-mode');
    el.innerHTML = el.dataset.blanksOriginal || el.innerHTML;
    el.dataset.blanksOriginal = '';
    blankAnswers = [];
  }
}

// 翻卡后默认开启挖空模式
const _origRF = renderFlashcard;
renderFlashcard = function(){
  _origRF();
  blanksMode = false;
  blankAnswers = [];
  // 单次设置：autoBlanks 监听 + 挖空切换按钮
  requestAnimationFrame(() => {
    const fc = document.getElementById('fcard');
    const back = document.querySelector('.fc-back');
    // 自动挖空
    if(fc){
      fc.addEventListener('click', function autoBlanks(){
        if(fc.classList.contains('flipped')){
          toggleBlanksMode();
          fc.removeEventListener('click', autoBlanks);
        }
      }, {once: false});
    }
    // 挖空切换按钮
    if(back && !back.querySelector('.blanks-toggle')){
      const btn = document.createElement('div');
      btn.className = 'blank-count';
      btn.style.cssText = 'cursor:pointer;color:var(--primary);font-weight:600;margin-bottom:8px';
      btn.textContent = '🔍 挖空模式（关闭）';
      btn.onclick = function(e){
        e.stopPropagation();
        toggleBlanksMode();
        this.textContent = blanksMode ? '🔍 挖空模式（开启中）' : '🔍 挖空模式（关闭）';
      };
      back.insertBefore(btn, back.firstChild);
    }
  });
};

// --- 考研倒计时 ---
function getCountdownDate(){
  const saved = localStorage.getItem('yanxueku_exam_date');
  if(saved) return new Date(saved);
  // 默认：当前年份12月第三个周末的周六
  const now = new Date();
  const y = now.getFullYear();
  const dec = new Date(y, 11, 20); // 12月20日附近
  while(dec.getDay() !== 6) dec.setDate(dec.getDate() + 1); // 调到周六
  // 如果已经过了今年12月，用明年
  if(now > dec){ dec.setFullYear(y + 1); dec.setMonth(11); dec.setDate(20); while(dec.getDay() !== 6) dec.setDate(dec.getDate() + 1); }
  return dec;
}
function setExamDate(d){
  localStorage.setItem('yanxueku_exam_date', d.toISOString().slice(0,10));
  if(localStorage.getItem('yanxueku_exam_date_set') !== '1'){
    localStorage.setItem('yanxueku_exam_date_set', '1');
  }
  updateDashboardHeader();
}
let _dailyGoal = parseInt(localStorage.getItem('yanxueku_daily_goal') || '20');
function setDailyGoal(n){
  _dailyGoal = n;
  localStorage.setItem('yanxueku_daily_goal', n);
  updateDashboardHeader();
}
function updateDashboardHeader(){
  if(!db||!db.knowledge) return;
  const el = document.getElementById('dash-header-right');
  if(!el) return;
  const examDate = getCountdownDate();
  const now = new Date();
  const diff = Math.ceil((examDate - now) / 86400000);
  const dueList = db.knowledge.filter(k => k.nextReview <= todayStr());
  const todayDone = db.knowledge.filter(k => k.lastReview === todayStr()).length;
  el.innerHTML = `
    <div class="countdown-badge" onclick="openExamDatePicker()" title="点击设置考研日期">
      <div style="text-align:center"><div class="num">${Math.max(0, diff)}</div><div class="unit">天</div></div>
      <div style="line-height:1.3"><div style="font-size:12px">距考研</div><div style="font-size:10px;opacity:.7">${examDate.toLocaleDateString('zh-CN',{month:'long',day:'numeric'})}</div></div>
    </div>
    <div style="font-size:12px;line-height:1.5">
      <div>📋 今日目标 <b>${todayDone}</b> / <b onclick="openGoalSetter()" style="cursor:pointer;color:var(--primary)" title="点击设置目标">${_dailyGoal}</b> 个</div>
      <div class="goal-bar" style="width:80px"><div class="goal-fill" style="width:${Math.min(100, Math.round(todayDone/_dailyGoal*100))}%"></div></div>
    </div>`;
}
function openExamDatePicker(){
  const d = getCountdownDate();
  openModal(
    '<div style="position:absolute;top:16px;right:16px"><button class="modal-close" onclick="closeModal()">✕</button></div>'+
    '<h3>📅 设定考研日期</h3>'+
    '<div class="form-row"><label>考试日期</label><input id="exam-date-input" type="date" value="'+d.toISOString().slice(0,10)+'"></div>'+
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="setExamDate(new Date(document.getElementById(\'exam-date-input\').value));closeModal()">确定</button></div>');
}
function openGoalSetter(){
  openModal(
    '<div style="position:absolute;top:16px;right:16px"><button class="modal-close" onclick="closeModal()">✕</button></div>'+
    '<h3>🎯 每日复习目标</h3>'+
    '<div class="form-row"><label>每天想复习多少个知识点？</label><input id="goal-input" type="number" value="'+_dailyGoal+'" min="1" max="200"></div>'+
    '<div style="font-size:12px;color:var(--text-3)">建议从 15~30 开始，根据实际节奏调整</div>'+
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="setDailyGoal(parseInt(document.getElementById(\'goal-input\').value)||20);closeModal()">确定</button></div>');
}
// 在 renderDashboard 和 renderBadges 后更新头部
const _origRD = renderDashboard;
const _origRB = renderBadges;
renderDashboard = function(){
  _origRD();
  requestAnimationFrame(updateDashboardHeader);
  // 排行榜面板注入（合并进同一包装，避免二次包装）
  setTimeout(function(){
    var el = document.getElementById('view-dashboard');
    if(el && !el.querySelector('#leaderboard-panel')){
      var div = document.createElement('div');
      div.innerHTML = '<div class="panel" style="margin-top:20px"><div class="panel-title">🏅 学习排行榜 <span class="sub" onclick="renderLeaderboard()" style="cursor:pointer;color:var(--primary)">刷新</span></div><div id="leaderboard-panel"></div></div>';
      el.appendChild(div); renderLeaderboard();
    }
  }, 60);
};
renderBadges = function(){
  _origRB();
  requestAnimationFrame(updateDashboardHeader);
};


if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}




/* ====== v5: 用户系统 + 排行榜 + 收藏 ====== */
let _starred = new Set(JSON.parse(localStorage.getItem('yanxueku_stars')||'[]'));

function renderSidebarUser(){
  var el = document.getElementById('sidebar-user-area'); if(!el) return;
  if(_currentUser && _profile){
    el.innerHTML = '<div class="side-user"><div class="avatar" style="background:'+(_profile.avatar_color||'#6366f1')+'">'+(esc(_profile.display_name||'?').charAt(0))+'</div><div class="info"><div class="name">'+esc(_profile.display_name||'考研人')+'</div><div class="email">'+esc(_currentUser.email)+'</div></div><div class="actions"><button onclick="openProfileModal()">⚙</button><button onclick="signOut()">↩</button></div></div>';
  }else{
    el.innerHTML = '<div class="side-user" style="cursor:pointer;justify-content:center" onclick="openAuthModal()"><span style="color:var(--primary);font-weight:600;font-size:13px">👤 登录 / 注册</span></div>';
  }
}
var __orig_rs = renderSidebar; renderSidebar = function(){ __orig_rs(); renderSidebarUser(); };

let _authMode = 'login';        // login / signup
let _authSubmitting = false;    // 防重复提交
function validateEmail(s){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s==null?'':s).trim()); }
function validatePassword(p){ return String(p==null?'':p).length >= 6; }
function renderAuthModal(){
  const isLogin = _authMode === 'login';
  const m =
    '<button class="modal-close" onclick="closeModal()">✕</button>'+
    '<h3>'+(isLogin?'👤 登录':'✨ 注册')+'</h3>'+
    (isLogin?'':'<div class="form-row"><label>昵称（选填）</label><input id="auth-name" placeholder="怎么称呼你？"></div>')+
    '<div class="form-row"><label>邮箱</label><input id="auth-email" type="email" placeholder="you@example.com"></div>'+
    '<div class="form-row"><label>密码（≥6位）</label><div class="pwd-wrap"><input id="auth-password" type="password" placeholder="至少 6 位"><button class="pwd-eye" onclick="togglePwd()" title="显示/隐藏密码">👁</button></div></div>'+
    (isLogin?'':'<div class="form-row"><label>确认密码</label><input id="auth-confirm" type="password" placeholder="再输入一次密码"></div>')+
    '<div class="modal-actions">'+
    '<button class="btn btn-ghost" onclick="toggleAuthMode()">'+(isLogin?'去注册':'去登录')+'</button>'+
    '<button class="btn btn-primary" id="auth-submit" onclick="'+(isLogin?'doLogin':'doSignUp')+'()">'+(isLogin?'登录':'注册')+'</button>'+
    '</div>';
  openModal(m);
}
function toggleAuthMode(){
  _authMode = _authMode === 'login' ? 'signup' : 'login';
  renderAuthModal();
}
function togglePwd(){
  const inp = document.getElementById('auth-password');
  if(inp) inp.type = inp.type === 'password' ? 'text' : 'password';
}
function openAuthModal(){
  _authMode = 'login';
  _authSubmitting = false;
  renderAuthModal();
}
function setAuthLoading(on){
  const b = document.getElementById('auth-submit');
  if(!b) return;
  if(on){ b.disabled = true; b.dataset.orig = b.textContent; b.textContent = '处理中…'; }
  else { b.disabled = false; b.textContent = b.dataset.orig || b.textContent; }
}
async function doLogin(){
  const e = document.getElementById('auth-email').value.trim();
  const p = document.getElementById('auth-password').value;
  if(!validateEmail(e)){ toast('请输入有效的邮箱地址','err'); return; }
  if(!validatePassword(p)){ toast('密码长度至少 6 位','err'); return; }
  if(!sb){ toast('云端连接不可用，请稍后重试','err'); return; }
  if(_authSubmitting) return;
  _authSubmitting = true; setAuthLoading(true);
  try{
    const r = await sb.auth.signInWithPassword({email:e, password:p});
    if(r.error){ toast(r.error.message||'登录失败','err'); return; }
    closeModal(); toast('登录成功 ✅','ok');
  }catch(err){ toast('网络错误，请检查网络后重试','err'); }
  finally{ _authSubmitting = false; setAuthLoading(false); }
}
async function doSignUp(){
  const e = document.getElementById('auth-email').value.trim();
  const p = document.getElementById('auth-password').value;
  const nEl = document.getElementById('auth-name');
  const n = nEl ? nEl.value.trim()||e.split('@')[0] : e.split('@')[0];
  const cpEl = document.getElementById('auth-confirm');
  const cp = cpEl ? cpEl.value : p;
  if(!validateEmail(e)){ toast('请输入有效的邮箱地址','err'); return; }
  if(!validatePassword(p)){ toast('密码长度至少 6 位','err'); return; }
  if(cpEl && p !== cp){ toast('两次输入的密码不一致','err'); return; }
  if(!sb){ toast('云端连接不可用，请稍后重试','err'); return; }
  if(_authSubmitting) return;
  _authSubmitting = true; setAuthLoading(true);
  try{
    const r = await sb.auth.signUp({email:e, password:p, options:{data:{display_name:n}}});
    if(r.error){ toast(r.error.message||'注册失败','err'); return; }
    closeModal(); toast(r.data.session?'注册成功 ✅':'注册成功！请到邮箱确认 📧','ok');
  }catch(err){ toast('网络错误，请检查网络后重试','err'); }
  finally{ _authSubmitting = false; setAuthLoading(false); }
}
async function signOut(){
  if(!sb) return;
  _currentUser=null; _profile=null;
  try{ await sb.auth.signOut(); }catch(e){}
  // 登出保留本地数据：把当前 db 写回 localStorage（不重置为示例数据，避免数据丢失）
  try{ localStorage.setItem('yanxueku_v1', JSON.stringify(db)); }catch(e){}
  renderSidebarUser(); switchView('dashboard'); toast('已退出','info');
}
function openProfileModal(){
  if(!_profile){ toast('请先登录','err'); return; }
  openModal('<button class="modal-close" onclick="closeModal()">✕</button><h3>👤 个人资料</h3>'+
    '<div class="form-row"><label>显示名称</label><input id="pf-name" value="'+esc(_profile.display_name||'')+'"></div>'+
    '<div class="form-row"><label>头像颜色</label><div class="color-picker" id="pf-colors"></div><input type="hidden" id="pf-color" value="'+(_profile.avatar_color||'#6366f1')+'"></div>'+
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="saveProfile()">保存</button></div>');
  setTimeout(function(){
    var colors=['#6366f1','#e11d48','#0ea5e9','#f59e0b','#10b981','#8b5cf6','#0891b2','#ca8a04'];
    var el=document.getElementById('pf-colors');
    if(el) el.innerHTML=colors.map(function(c){return '<span style="background:'+c+'" data-color="'+c+'" onclick="var p=this.parentElement;p.querySelectorAll(&apos;span&apos;).forEach(function(s){s.classList.remove(&apos;sel&apos;)});this.classList.add(&apos;sel&apos;);document.getElementById(&apos;pf-color&apos;).value=&apos;'+c+'&apos;"></span>';}).join('');
  },10);
}
async function saveProfile(){
  if(!sb||!_currentUser){ toast('未登录','err'); return; }
  var n=document.getElementById('pf-name').value.trim()||'考研人';
  var c=document.getElementById('pf-color').value||'#6366f1';
  try{
    await sb.from('profiles').upsert({user_id:_currentUser.id, display_name:n, avatar_color:c});
    _profile={display_name:n, avatar_color:c}; closeModal(); renderSidebarUser(); toast('资料已更新','ok');
  }catch(e){ toast('保存失败，请重试','err'); }
}
let _authListenerReady = false;
function setupAuthListener(){
  if(!sb || _authListenerReady) return;
  _authListenerReady = true;
  sb.auth.onAuthStateChange(async function(ev,session){
    if(session && session.user){
      _currentUser = session.user;
      var r=await sb.from('profiles').select('*').eq('user_id', _currentUser.id).single();
      _profile = r.data || {display_name:'考研人', avatar_color:'#6366f1'};
      var rd = await sb.from('app_state').select('data').eq('user_id', _currentUser.id).maybeSingle();
      if(rd && rd.data && rd.data.data && rd.data.data.subjects){
        db = rd.data.data;                                  // 云端有数据 → 用云端
      }else if(db && db.subjects && db.subjects.length){
        try{ await sb.from('app_state').upsert({ user_id: _currentUser.id, data: db, updated_at: new Date().toISOString() }); }catch(e){} // 云端无数据 → 上传本地（首次同步）
      }
      try{ localStorage.setItem('yanxueku_v1', JSON.stringify(db)); }catch(e){}
      hideGate();
      setupRealtimeSync();
    }else{ _currentUser=null; _profile=null; renderGate(); }
    renderSidebarUser();
    if(curView) render();
  });
}
setupAuthListener();
async function renderLeaderboard(){
  var panel=document.getElementById('leaderboard-panel'); if(!panel) return;
  panel.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-3)">加载中…</div>';
  if(!sb||!_currentUser){ panel.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-3)">登录后可见</div>'; return; }
  try{
    var x=await sb.from('leaderboard').select('*').limit(20);
    var data=x.data||[], rows='';
    data.forEach(function(r,i){
      var m=0; try{ JSON.parse(r.study_log||'[]').forEach(function(x){m+=x.minutes||0}); }catch(e){}
      rows+='<div class="leader-row"><div class="rank '+(i<3?'t'+(i+1):'t')+'">'+(i+1)+'</div><div class="avatar" style="width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;background:'+r.avatar_color+'">'+(r.display_name||'?').charAt(0)+'</div><div class="ld-name">'+esc(r.display_name||'考研人')+'</div><div class="ld-time">'+Math.floor(m/60)+'h '+m%60+'m</div></div>';
    });
    panel.innerHTML=rows||'<div style="text-align:center;padding:20px;color:var(--text-3)">暂无数据</div>';
  }catch(e){ panel.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-3)">加载失败</div>'; }
}
function toggleStar(kwId, ev){ if(ev)ev.stopPropagation(); if(_starred.has(kwId))_starred.delete(kwId); else _starred.add(kwId); localStorage.setItem('yanxueku_stars', JSON.stringify([..._starred])); renderLibrary(); }
var ___origKC = kwCard;
kwCard = function(k){
  var on = _starred.has(k.id);
  var star = '<button class="kw-star' + (on?' on':'') + '" onclick="toggleStar(\'' + k.id + '\',event)" title="收藏">' + (on?'⭐':'☆') + '</button>';
  return ___origKC(k).replace('>', '>' + star);
};


// 安全兜底：3秒后强制隐藏加载屏
setTimeout(function(){var s=document.getElementById("loading-screen");if(s&&!s.classList.contains("done"))s.classList.add("done");},3000);
