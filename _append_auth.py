"""Append auth/profile/leaderboard/favorites JS before </script>"""
with open(r'C:\Users\53296\WorkBuddy\2026-08-04-20-21-15\kaoyan-study\index.html', 'r', encoding='utf-8') as f:
    html = f.read()

auth_js = r"""

/* ====== v5: 用户系统 + 排行榜 + 收藏 ====== */
let _currentUser = null, _profile = null;
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

function openAuthModal(){
  var isLogin = true;
  function ra(){
    var m = '<button class="modal-close" onclick="closeModal()">✕</button><h3>'+(isLogin?'👤 登录':'✨ 注册')+'</h3>';
    if(!isLogin) m += '<div class="form-row"><label>昵称</label><input id="auth-name"></div>';
    m += '<div class="form-row"><label>邮箱</label><input id="auth-email" type="email"></div>';
    m += '<div class="form-row"><label>密码（≥6位）</label><input id="auth-password" type="password"></div>';
    m += '<div class="modal-actions"><button class="btn btn-ghost" onclick="isLogin=!isLogin;ra()">'+(isLogin?'去注册':'去登录')+'</button><button class="btn btn-primary" onclick="'+(isLogin?'doLogin':'doSignUp')+'()">'+(isLogin?'登录':'注册')+'</button></div>';
    openModal(m);
  }
  ra();
}
async function doLogin(){
  var e=document.getElementById('auth-email').value.trim(), p=document.getElementById('auth-password').value;
  if(!e||!p){ toast('请填写邮箱和密码','err'); return; }
  var r = await sb.auth.signInWithPassword({email:e, password:p});
  if(r.error){ toast(r.error.message,'err'); return; }
  closeModal(); toast('登录成功 ✅','ok');
}
async function doSignUp(){
  var e=document.getElementById('auth-email').value.trim(), p=document.getElementById('auth-password').value;
  var n=document.getElementById('auth-name'); n=n?n.value.trim()||e.split('@')[0]:e.split('@')[0];
  if(!e||!p){ toast('请填写邮箱和密码','err'); return; }
  var r = await sb.auth.signUp({email:e, password:p, options:{data:{display_name:n}}});
  if(r.error){ toast(r.error.message,'err'); return; }
  closeModal(); toast(r.data.session?'注册成功 ✅':'请检查邮箱确认 📧','ok');
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
  await sb.from('profiles').upsert({user_id:_currentUser.id, display_name:n, avatar_color:c});
  _profile={display_name:n, avatar_color:c}; closeModal(); renderSidebarUser(); toast('资料已更新','ok');
}
if(sb){sb.auth.onAuthStateChange(async function(ev,session){
  if(session && session.user){
    _currentUser = session.user;
    var r=await sb.from('profiles').select('*').eq('user_id', _currentUser.id).single();
    _profile = r.data || {display_name:'考研人', avatar_color:'#6366f1'};
    var rd = await sb.from('app_state').select('data').eq('user_id', _currentUser.id).maybeSingle();
    if(rd && rd.data && rd.data.data && rd.data.data.subjects){ db = rd.data.data; }
    localStorage.setItem('yanxueku_v1', JSON.stringify(db));
  }else{ _currentUser=null; _profile=null; }
  renderSidebarUser();
  if(curView) render();
});}
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
var ___origRD = renderDashboard;
renderDashboard = function(){
  ___origRD();
  setTimeout(function(){
    var el=document.getElementById('view-dashboard');
    if(el&&!el.querySelector('#leaderboard-panel')){
      var div=document.createElement('div');
      div.innerHTML='<div class="panel" style="margin-top:20px"><div class="panel-title">🏅 学习排行榜 <span class="sub" onclick="renderLeaderboard()" style="cursor:pointer;color:var(--primary)">刷新</span></div><div id="leaderboard-panel"></div></div>';
      el.appendChild(div); renderLeaderboard();
    }
  },60);
};
function toggleStar(kwId, ev){ if(ev)ev.stopPropagation(); if(_starred.has(kwId))_starred.delete(kwId); else _starred.add(kwId); localStorage.setItem('yanxueku_stars', JSON.stringify([..._starred])); renderLibrary(); }
var ___origKC = kwCard;
kwCard = function(k){ return ___origKC(k).replace('<div class="kw-card"', '<div class="kw-card"><button class="kw-star' + (_starred.has(k.id)?' on':'') + '" onclick="toggleStar(\\''+k.id+'\\',event)">' + (_starred.has(k.id)?'⭐':'☆') + '</button>'); };

"""

idx = html.rindex('</script>')
html = html[:idx] + auth_js + html[idx:]
with open(r'C:\Users\53296\WorkBuddy\2026-08-04-20-21-15\kaoyan-study\index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('Auth JS appended. Size:', len(html))
