"""Multi-user system: Auth + per-user data + leaderboard + favorites"""
PATH = r'C:\Users\53296\WorkBuddy\2026-08-04-20-21-15\kaoyan-study\index.html'
with open(PATH, 'r', encoding='utf-8') as f:
    h = f.read()
fixed = 0

# ===== 1. Auth CSS (sidebar profile area) =====
css_end = h.index('</style>')
auth_css = """
/* 用户系统 */
.side-user{display:flex;align-items:center;gap:10px;padding:10px 12px;margin:8px 0;border-radius:12px;background:var(--surface-2);border:1px solid var(--border)}
.side-user .avatar{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:15px;flex-shrink:0}
.side-user .info{flex:1;min-width:0}
.side-user .name{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.side-user .email{font-size:11px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.side-user .actions{display:flex;gap:4px}
.side-user .actions button{width:26px;height:26px;border-radius:7px;border:1px solid var(--border);background:var(--surface);color:var(--text-2);cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;transition:all .15s}
.side-user .actions button:hover{color:var(--danger);border-color:var(--danger)}
/* 排行榜 */
.leader-row{display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;transition:all .2s}
.leader-row:hover{background:var(--surface-2)}
.leader-row .rank{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px}
.leader-row .rank.top{color:#fff}
.leader-row .rank.t1{background:#f59e0b}
.leader-row .rank.t2{background:#94a3b8}
.leader-row .rank.t3{background:#cd853f}
.leader-row .rank.t{background:var(--surface-2);color:var(--text-2)}
.leader-row .ld-name{flex:1;font-weight:600}
.leader-row .ld-time{color:var(--primary);font-weight:700;font-size:12px}
/* 收藏星标 */
.kw-star{position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:8px;border:none;background:transparent;color:var(--text-3);font-size:16px;cursor:pointer;z-index:2;transition:all .2s;display:flex;align-items:center;justify-content:center}
.kw-star:hover{color:#f59e0b;transform:scale(1.2)}
.kw-star.on{color:#f59e0b}
/* 举报按钮 */
.report-btn{font-size:11px;color:var(--text-3);cursor:pointer;background:none;border:none;padding:4px 8px;border-radius:6px;font-family:inherit}
.report-btn:hover{color:var(--danger);background:rgba(239,68,68,.08)}
"""
h = h[:css_end] + auth_css + h[css_end]
fixed += 1

# ===== 2. HTML: Sidebar user area (before .side-label) =====
old_label = '<div class="side-label">专业科目 <button'
new_label = '<div id="sidebar-user-area"></div>\n    <div class="side-label">专业科目 <button'
h = h.replace(old_label, new_label)

# ===== 3. JS: Replace data layer with auth-aware version =====
old_layer_top = """const SUPABASE_URL = 'https://gwihiemggugzwhutsfea.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3aWhpZW1nZ3VnendodXRzZmVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTMyODksImV4cCI6MjEwMTQyOTI4OX0.UcE502jd3DINEHwxmOgDXsGR3kQ3YYda48v5myCAHA4';
let sb = null;
try{ sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); }catch(e){ console.warn('Supabase init failed, falling back to localStorage'); }
const THEME_KEY = 'yanxueku_theme';
const EBB = [1, 2, 4, 7, 15, 30, 60];"""

new_layer_top = """const SUPABASE_URL = 'https://gwihiemggugzwhutsfea.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3aWhpZW1nZ3VnendodXRzZmVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTMyODksImV4cCI6MjEwMTQyOTI4OX0.UcE502jd3DINEHwxmOgDXsGR3kQ3YYda48v5myCAHA4';
let sb = null, _currentUser = null, _profile = null;
try{ sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); }catch(e){ console.warn('Supabase init failed'); }
const THEME_KEY = 'yanxueku_theme';
const EBB = [1, 2, 4, 7, 15, 30, 60];
// 收藏标记
let _starred = new Set(JSON.parse(localStorage.getItem('yanxueku_stars')||'[]'));"""

h = h.replace(old_layer_top, new_layer_top)
fixed += 1

# ===== 4. JS: Replace load/save with auth-aware versions =====
old_load_save = """let db;
let _loadResolve = null;
const _dbReady = new Promise(r => { _loadResolve = r; });
async function load(){
  if(sb){
    const { data, error } = await sb.from('app_state').select('data').eq('id', 1).maybeSingle();
    if(data && data.data && data.data.subjects){
      db = data.data;
      _loadResolve(db);
      setupRealtimeSync();
      return;
    }
  }
  // Fallback: localStorage or seed
  try{
    const raw = localStorage.getItem('yanxueku_v1');
    if(raw){ db = JSON.parse(raw); _loadResolve(db); setupRealtimeSync(); return; }
  }catch(e){}
  db = seedData(); ensureNewsSubject();
  await save();
  _loadResolve(db);
  setupRealtimeSync();
}
async function save(){
  if(sb){
    try{ await sb.from('app_state').upsert({ id: 1, data: db, updated_at: new Date().toISOString() }); }catch(e){ console.warn('Supabase save failed'); }
  }
  localStorage.setItem('yanxueku_v1', JSON.stringify(db)); // always mirror to localStorage as backup
}
function setupRealtimeSync(){
  if(!sb) return;
  sb.channel('app_state_changes')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_state', filter: 'id=eq.1' },
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
}"""

new_load_save = """let db;
let _loadResolve = null;
const _dbReady = new Promise(r => { _loadResolve = r; });
async function load(){
  if(sb && _currentUser){
    const { data, error } = await sb.from('app_state').select('data').eq('user_id', _currentUser.id).maybeSingle();
    if(data && data.data && data.data.subjects){
      db = data.data;
      _loadResolve(db);
      if(sb) setupRealtimeSync();
      return;
    }
  }
  // Fallback: localStorage or seed (only for non-authed users)
  try{
    const raw = localStorage.getItem('yanxueku_v1');
    if(raw){ db = JSON.parse(raw); _loadResolve(db); if(sb&&_currentUser) setupRealtimeSync(); return; }
  }catch(e){}
  db = seedData(); ensureNewsSubject();
  if(_currentUser) await save();
  _loadResolve(db);
  if(sb && _currentUser) setupRealtimeSync();
}
async function save(){
  if(sb && _currentUser){
    try{ await sb.from('app_state').upsert({ user_id: _currentUser.id, data: db, updated_at: new Date().toISOString() }); }catch(e){ console.warn('Supabase save failed'); }
  }
  localStorage.setItem('yanxueku_v1', JSON.stringify(db));
}
function setupRealtimeSync(){
  if(!sb||!_currentUser) return;
  sb.channel('app_'+_currentUser.id.slice(0,8))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_state', filter: 'user_id=eq.'+_currentUser.id },
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
}"""

h = h.replace(old_load_save, new_load_save)
fixed += 1

# ===== 5. Auth UI + profile + leaderboard functions — insert before timer =====
old_timer = "/* ====== 学习计时器 ====== */"
auth_js = """/* ====== 用户认证系统 ====== */
function renderSidebarUser(){
  var el = document.getElementById('sidebar-user-area');
  if(!el) return;
  if(_currentUser && _profile){
    el.innerHTML =
      '<div class="side-user">'+
        '<div class="avatar" style="background:'+(_profile.avatar_color||'#6366f1')+'">'+
          (_profile.display_name||_currentUser.email||'?').charAt(0).toUpperCase()+
        '</div>'+
        '<div class="info">'+
          '<div class="name">'+esc(_profile.display_name||'考研人')+'</div>'+
          '<div class="email">'+esc(_currentUser.email)+'</div>'+
        '</div>'+
        '<div class="actions">'+
          '<button onclick="openProfileModal()" title="编辑资料">⚙</button>'+
          '<button onclick="signOut()" title="退出">↩</button>'+
        '</div>'+
      '</div>';
  }else{
    el.innerHTML =
      '<div class="side-user" style="cursor:pointer;justify-content:center" onclick="openAuthModal()">'+
        '<span style="color:var(--primary);font-weight:600;font-size:13px">👤 登录 / 注册</span>'+
      '</div>';
  }
}

function openAuthModal(){
  var isLogin = true;
  function renderAuth(){
    openModal(
      '<button class="modal-close" onclick="closeModal()">✕</button>'+
      '<h3>'+(isLogin?'👤 登录':'✨ 注册')+' · 研学库</h3>'+
      (isLogin?'':'<div class="form-row"><label>显示名称</label><input id="auth-name" placeholder="你的昵称"></div>')+
      '<div class="form-row"><label>邮箱</label><input id="auth-email" type="email" placeholder="example@mail.com"></div>'+
      '<div class="form-row"><label>密码</label><input id="auth-password" type="password" placeholder="至少6位"></div>'+
      '<div class="modal-actions" style="justify-content:space-between;flex-wrap:wrap">'+
        '<button class="btn btn-ghost" onclick="isLogin=!isLogin;renderAuth()">'+(isLogin?'没有账号？去注册':'已有账号？去登录')+'</button>'+
        '<button class="btn btn-primary" onclick="'+(isLogin?'doLogin':'doSignUp')+'()">'+(isLogin?'登录':'注册')+'</button>'+
      '</div>');
  }
  renderAuth();
}
async function doLogin(){
  var email = document.getElementById('auth-email').value.trim();
  var password = document.getElementById('auth-password').value;
  if(!email||!password){ toast('请填写邮箱和密码','err'); return; }
  var { data, error } = await sb.auth.signInWithPassword({ email, password });
  if(error){ toast('登录失败：'+error.message,'err'); return; }
  closeModal(); toast('登录成功 ✅','ok');
}
async function doSignUp(){
  var email = document.getElementById('auth-email').value.trim();
  var password = document.getElementById('auth-password').value;
  var name = document.getElementById('auth-name')?.value?.trim() || email.split('@')[0];
  if(!email||!password){ toast('请填写邮箱和密码','err'); return; }
  var { data, error } = await sb.auth.signUp({
    email, password,
    options: { data: { display_name: name } }
  });
  if(error){ toast('注册失败：'+error.message,'err'); return; }
  closeModal();
  if(data.session){
    toast('注册成功 ✅','ok');
  }else{
    toast('请检查邮箱确认链接 📧','info');
  }
}
async function signOut(){
  _currentUser = null; _profile = null;
  await sb.auth.signOut();
  db = seedData(); ensureNewsSubject();
  localStorage.removeItem('yanxueku_v1');
  renderSidebarUser(); switchView('dashboard');
  toast('已退出登录','info');
}
function openProfileModal(){
  openModal(
    '<button class="modal-close" onclick="closeModal()">✕</button>'+
    '<h3>👤 个人资料</h3>'+
    '<div class="form-row"><label>显示名称</label><input id="pf-name" value="'+esc(_profile.display_name||'')+'"></div>'+
    '<div class="form-row"><label>头像颜色</label><div class="color-picker" id="pf-colors"></div><input type="hidden" id="pf-color" value="'+(_profile.avatar_color||'#6366f1')+'"></div>'+
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="saveProfile()">保存</button></div>');
  setTimeout(function(){
    var colors=['#6366f1','#e11d48','#0ea5e9','#f59e0b','#10b981','#8b5cf6','#0891b2','#ca8a04'];
    var el=document.getElementById('pf-colors');
    if(el) el.innerHTML=colors.map(function(c){return '<span style="background:'+c+'" data-color="'+c+'" onclick="var p=this.parentElement;p.querySelectorAll(\\'span\\').forEach(function(s){s.classList.remove(\\'sel\\')});this.classList.add(\\'sel\\');document.getElementById(\\'pf-color\\').value=\\''+c+'\\'"></span>';}).join('');
  },10);
}
async function saveProfile(){
  var name = document.getElementById('pf-name').value.trim() || _currentUser.email.split('@')[0];
  var color = document.getElementById('pf-color').value || '#6366f1';
  await sb.from('profiles').upsert({ user_id: _currentUser.id, display_name: name, avatar_color: color });
  _profile = { display_name: name, avatar_color: color };
  closeModal(); renderSidebarUser();
  toast('资料已更新','ok');
}

// Auth state listener
if(sb){
  sb.auth.onAuthStateChange(async function(event, session){
    if(session&&session.user){
      _currentUser = session.user;
      var { data } = await sb.from('profiles').select('*').eq('user_id', _currentUser.id).single();
      _profile = data || { display_name: '考研人', avatar_color: '#6366f1' };
      await load();
    }
    renderSidebarUser();
    if(curView===window._lastView) render();
  });
}

/* ====== 排行榜 ====== */
let _leaderboardCache = null;
async function renderLeaderboard(){
  var panel = document.getElementById('leaderboard-panel');
  if(!panel) return;
  panel.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-3)">加载中…</div>';
  if(!sb){ panel.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-3)">请先登录查看排行榜</div>'; return; }
  try{
    var { data } = await sb.from('leaderboard').select('*').order('study_log', { ascending: false }).limit(20);
    if(!data||!data.length){ panel.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-3)">暂无数据</div>'; return; }
    var rows = data.map(function(r,i){
      var totalMin = 0;
      try{ JSON.parse(r.study_log||'[]').forEach(function(x){ totalMin += x.minutes||0; }); }catch(e){}
      var rankClass = i<3 ? (' top t'+(i+1)) : ' t';
      return '<div class="leader-row"><div class="rank'+rankClass+'">'+(i+1)+'</div>'+
        '<div class="avatar" style="width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;background:'+r.avatar_color+'">'+
          (r.display_name||'?').charAt(0)+'</div>'+
        '<div class="ld-name">'+esc(r.display_name||'考研人')+'</div>'+
        '<div class="ld-time">'+Math.floor(totalMin/60)+'h '+totalMin%60+'m</div></div>';
    }).join('');
    panel.innerHTML = rows;
  }catch(e){ panel.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-3)">加载失败</div>'; }
}

// 在仪表盘渲染后注入排行榜区
const __origRD2 = renderDashboard;
renderDashboard = function(){
  __origRD2();
  setTimeout(function(){
    var content = document.getElementById('view-dashboard');
    if(content && !content.querySelector('#leaderboard-panel')){
      var div = document.createElement('div');
      div.innerHTML = '<div class="panel" style="margin-top:20px"><div class="panel-title">🏅 学习排行榜 <span class="sub" onclick="renderLeaderboard()" style="cursor:pointer;color:var(--primary)">刷新</span></div><div id="leaderboard-panel"></div></div>';
      content.appendChild(div);
      renderLeaderboard();
    }
  }, 50);
};

/* ====== 收藏系统 ====== */
function toggleStar(kwId, ev){
  if(ev) ev.stopPropagation();
  if(_starred.has(kwId)) _starred.delete(kwId); else _starred.add(kwId);
  localStorage.setItem('yanxueku_stars', JSON.stringify([..._starred]));
  renderLibrary();
}
// 在知识卡片渲染后注入星标按钮
const __origKwCard = kwCard;
kwCard = function(k){
  var html = __origKwCard(k);
  html = html.replace('<div class="kw-card"',
    '<div class="kw-card"');
  // Add star after card open tag
  html = html.replace('">',
    '"><button class="kw-star' + (_starred.has(k.id)?' on':'') + '" onclick="toggleStar(\\''+k.id+'\\',event)" title="收藏">' + (_starred.has(k.id)?'⭐':'☆') + '</button>');
  return html;
};

// 确保 sidebar timer 在 renderSidebarUser 之后调用
const __origRenderSidebar = renderSidebar;
renderSidebar = function(){
  __origRenderSidebar();
  renderSidebarUser();
};

// 启动: 先等 auth 状态就绪
_dbReady.then(function(){
  startTimer();
  startActivityTracking();
  var shield = document.getElementById('loading-screen');
  if(shield){ setTimeout(function(){ shield.classList.add('done'); }, 300); }
  if(!localStorage.getItem('yanxueku_guided')){
    setTimeout(showFirstGuide, 800);
  }
});

""" + old_timer
h = h.replace(old_timer, auth_js)
fixed += 1

with open(PATH, 'w', encoding='utf-8') as f:
    f.write(h)
print(f'Multi-user patch applied: {fixed} changes')
