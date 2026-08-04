"""Multi-user: targeted edits only, no block replacements"""
PATH = r'C:\Users\53296\WorkBuddy\2026-08-04-20-21-15\kaoyan-study\index.html'
with open(PATH, 'r', encoding='utf-8') as f:
    h = f.read()
fixed = 0

# ===== 1. CSS追加 =====
css_end = h.index('</style>')
auth_css = """
/* 用户系统 */
.side-user{display:flex;align-items:center;gap:10px;padding:10px 12px;margin:8px 0;border-radius:12px;background:var(--surface-2);border:1px solid var(--border)}
.side-user .avatar{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:15px;flex-shrink:0}
.side-user .info{flex:1;min-width:0}
.side-user .name{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.side-user .email{font-size:11px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.side-user .actions{display:flex;gap:4px}
.side-user .actions button{width:26px;height:26px;border-radius:7px;border:1px solid var(--border);background:var(--surface);color:var(--text-2);cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center}
.side-user .actions button:hover{color:var(--danger);border-color:var(--danger)}
.leader-row{display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px}
.leader-row .rank{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px}
.leader-row .rank.t1{background:#f59e0b;color:#fff}.leader-row .rank.t2{background:#94a3b8;color:#fff}.leader-row .rank.t3{background:#cd853f;color:#fff}.leader-row .rank.t{background:var(--surface-2)}
.leader-row .ld-name{flex:1;font-weight:600}.leader-row .ld-time{color:var(--primary);font-weight:700;font-size:12px}
.kw-star{position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:8px;border:none;background:transparent;color:var(--text-3);font-size:16px;cursor:pointer;z-index:2;display:flex;align-items:center;justify-content:center}
.kw-star.on{color:#f59e0b}.kw-star:hover{color:#f59e0b;transform:scale(1.2)}
"""
h = h[:css_end] + auth_css + h[css_end]
fixed += 1

# ===== 2. HTML: sidebar user area =====
old = '<div class="side-label">专业科目 <button'
h = h.replace(old, '<div id="sidebar-user-area"></div>\n    ' + old)
fixed += 1

# ===== 3. JS: Add _currentUser, _profile, _starred globals =====
old = 'let sb = null;'
h = h.replace(old, 'let sb = null, _currentUser = null, _profile = null;\nlet _starred = new Set(JSON.parse(localStorage.getItem(\'yanxueku_stars\')||\'[]\'));')
fixed += 1

# ===== 4. load: change id=1 to user_id = _currentUser.id =====
old = "const { data, error } = await sb.from('app_state').select('data').eq('id', 1).maybeSingle();"
new = "const uid = _currentUser ? _currentUser.id : null;\n    const { data, error } = uid ? await sb.from('app_state').select('data').eq('user_id', uid).maybeSingle() : {data: null};"
h = h.replace(old, new)
fixed += 1

# ===== 5. save: change id=1 to user_id =====
old = "try{ await sb.from('app_state').upsert({ id: 1, data: db, updated_at: new Date().toISOString() }); }catch(e){ console.warn('Supabase save failed'); }"
new = "try{ if(_currentUser) await sb.from('app_state').upsert({ user_id: _currentUser.id, data: db, updated_at: new Date().toISOString() }); }catch(e){ console.warn('Supabase save failed'); }"
h = h.replace(old, new)
fixed += 1

# ===== 6. realtime: change filter =====
old = "filter: 'id=eq.1'"
h = h.replace(old, "filter: 'user_id=eq.'+(_currentUser?_currentUser.id:'')")
fixed += 1

# ===== 7. Insert auth/profile/leaderboard/favorites JS before timer section =====
old_timer = "/* ====== 学习计时器 ====== */"
auth_js = """/* ====== 用户系统 ====== */
function renderSidebarUser(){
  var el = document.getElementById('sidebar-user-area');
  if(!el) return;
  if(_currentUser && _profile){
    el.innerHTML = '<div class="side-user"><div class="avatar" style="background:'+(_profile.avatar_color||'#6366f1')+'">'+(esc(_profile.display_name||'考研人').charAt(0))+'</div><div class="info"><div class="name">'+esc(_profile.display_name||'考研人')+'</div><div class="email">'+esc(_currentUser.email||'')+'</div></div><div class="actions"><button onclick="openProfileModal()" title="编辑">⚙</button><button onclick="signOut()" title="退出">↩</button></div></div>';
  }else{
    el.innerHTML = '<div class="side-user" style="cursor:pointer" onclick="openAuthModal()"><span style="color:var(--primary);font-weight:600;font-size:13px">👤 登录 / 注册</span></div>';
  }
}
function openAuthModal(){
  var isLogin=true;
  function ra(){
    var h='<button class="modal-close" onclick="closeModal()">✕</button><h3>'+(isLogin?'👤 登录':'✨ 注册')+'</h3>';
    if(!isLogin) h+='<div class="form-row"><label>昵称</label><input id="auth-name"></div>';
    h+='<div class="form-row"><label>邮箱</label><input id="auth-email" type="email"></div>';
    h+='<div class="form-row"><label>密码（≥6位）</label><input id="auth-password" type="password"></div>';
    h+='<div class="modal-actions"><button class="btn btn-ghost" onclick="isLogin=!isLogin;ra()">'+(isLogin?'去注册':'去登录')+'</button><button class="btn btn-primary" onclick="'+(isLogin?'doLogin':'doSignUp')+'()">'+(isLogin?'登录':'注册')+'</button></div>';
    openModal(h);
  }
  ra();
}
async function doLogin(){
  var e=document.getElementById('auth-email').value.trim(), p=document.getElementById('auth-password').value;
  if(!e||!p){ toast('请填写邮箱和密码','err'); return; }
  var r=await sb.auth.signInWithPassword({email:e,password:p});
  if(r.error){ toast(r.error.message,'err'); return; }
  closeModal(); toast('登录成功 ✅','ok');
}
async function doSignUp(){
  var e=document.getElementById('auth-email').value.trim(), p=document.getElementById('auth-password').value;
  var n=document.getElementById('auth-name'); n=n?n.value.trim()||e.split('@')[0]:e.split('@')[0];
  if(!e||!p){ toast('请填写邮箱和密码','err'); return; }
  var r=await sb.auth.signUp({email:e,password:p,options:{data:{display_name:n}}});
  if(r.error){ toast(r.error.message,'err'); return; }
  closeModal(); toast(r.data.session?'注册成功 ✅':'请检查邮箱 📧','ok');
}
async function signOut(){
  _currentUser=null; _profile=null; await sb.auth.signOut();
  db=seedData(); ensureNewsSubject(); localStorage.removeItem('yanxueku_v1');
  renderSidebarUser(); switchView('dashboard'); toast('已退出','info');
}
function openProfileModal(){
  openModal('<button class="modal-close" onclick="closeModal()">✕</button><h3>👤 个人资料</h3>'+
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
  var n=document.getElementById('pf-name').value.trim()||'考研人';
  var c=document.getElementById('pf-color').value||'#6366f1';
  await sb.from('profiles').upsert({user_id:_currentUser.id,display_name:n,avatar_color:c});
  _profile={display_name:n,avatar_color:c}; closeModal(); renderSidebarUser(); toast('资料已更新','ok');
}
if(sb){sb.auth.onAuthStateChange(async function(ev,session){
  if(session&&session.user){
    _currentUser=session.user;
    var r=await sb.from('profiles').select('*').eq('user_id',_currentUser.id).single();
    _profile=r.data||{display_name:'考研人',avatar_color:'#6366f1'};
    await load();
  }
  renderSidebarUser();
  if(curView) render();
});}

/* ====== 排行榜 ====== */
async function renderLeaderboard(id){
  var panel=document.getElementById(id||'leaderboard-panel'); if(!panel) return;
  panel.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-3)">加载中…</div>';
  if(!sb||!_currentUser){ panel.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-3)">登录后可见</div>'; return; }
  try{
    var {data}=await sb.from('leaderboard').select('*').limit(20);
    if(!data||!data.length){ panel.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-3)">暂无数据</div>'; return; }
    var rows=data.map(function(r,i){
      var m=0; try{ JSON.parse(r.study_log||'[]').forEach(function(x){m+=x.minutes||0}); }catch(e){}
      return '<div class="leader-row"><div class="rank '+(i<3?'t'+(i+1):'t')+'">'+(i+1)+'</div><div class="avatar" style="width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;background:'+r.avatar_color+'">'+(r.display_name||'?').charAt(0)+'</div><div class="ld-name">'+esc(r.display_name||'考研人')+'</div><div class="ld-time">'+Math.floor(m/60)+'h '+m%60+'m</div></div>';
    }).join('');
    panel.innerHTML=rows;
  }catch(e){ panel.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-3)">加载失败</div>'; }
}
// 仪表盘注入排行榜
var _origRD = renderDashboard;
renderDashboard = function(){
  _origRD();
  setTimeout(function(){
    var el = document.getElementById('view-dashboard');
    if(el && !el.querySelector('#leaderboard-panel')){
      var div=document.createElement('div');
      div.innerHTML='<div class="panel" style="margin-top:20px"><div class="panel-title">🏅 学习排行榜 <span class="sub" onclick="renderLeaderboard()" style="cursor:pointer;color:var(--primary)">刷新</span></div><div id="leaderboard-panel"></div></div>';
      el.appendChild(div); renderLeaderboard();
    }
  },60);
};

/* ====== 收藏 ====== */
function toggleStar(kwId,ev){ if(ev)ev.stopPropagation(); if(_starred.has(kwId))_starred.delete(kwId); else _starred.add(kwId); localStorage.setItem('yanxueku_stars',JSON.stringify([..._starred])); renderLibrary(); }
var _origKC = kwCard;
kwCard = function(k){
  var s = _origKC(k);
  var star = _starred.has(k.id) ? '⭐' : '☆';
  return s.replace('<div class="kw-card"','<div class="kw-card"><button class="kw-star' + (_starred.has(k.id)?' on':'') + '" onclick="toggleStar(\\''+k.id+'\\',event)">'+star+'</button>');
};

// 侧栏用户区渲染
var _origRS = renderSidebar;
renderSidebar = function(){ _origRS(); renderSidebarUser(); };

""" + old_timer
h = h.replace(old_timer, auth_js)
fixed += 1

with open(PATH, 'w', encoding='utf-8') as f:
    f.write(h)
print(f'Fixed: {fixed}')
