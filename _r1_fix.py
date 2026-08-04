"""Round 1 fixes: load() crash-proof, realtime filter, auth sb-guard, guide-skip CSS"""
PATH = r'C:\Users\53296\WorkBuddy\2026-08-04-20-21-15\kaoyan-study\index.html'
with open(PATH, 'r', encoding='utf-8') as f:
    h = f.read()
n = 0

# ---- FIX 1: load() 整体 try/catch，任何异常都 fallback ----
old_load = """async function load(){
  if(sb){
    const uid = _currentUser ? _currentUser.id : null;
    const { data } = uid ? await sb.from('app_state').select('data').eq('user_id', uid).maybeSingle() : {data: null};
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
  // 数据库加载完成后手动隐藏加载屏
  setTimeout(function(){
    var s = document.getElementById('loading-screen');
    if(s) s.classList.add('done');
  }, 100);
}"""
new_load = """async function load(){
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
  db = seedData(); ensureNewsSubject();
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
}"""
if old_load in h:
    h = h.replace(old_load, new_load); n += 1; print('FIX1 load() crash-proof')
else:
    print('WARN FIX1: load() pattern not matched')

# ---- FIX 2: setupRealtimeSync filter 改 user_id ----
old_f = "filter: 'id=eq.1'"
new_f = "filter: 'user_id=eq.'+(_currentUser?_currentUser.id:'')"
if old_f in h:
    h = h.replace(old_f, new_f); n += 1; print('FIX2 realtime filter')
else:
    print('WARN FIX2: filter already updated?')

# ---- FIX 3: doLogin/doSignUp 加 sb null 保护 ----
old_login = """async function doLogin(){
  var e=document.getElementById('auth-email').value.trim(), p=document.getElementById('auth-password').value;
  if(!e||!p){ toast('请填写邮箱和密码','err'); return; }"""
new_login = """async function doLogin(){
  if(!sb){ toast('云端连接不可用，请稍后重试','err'); return; }
  var e=document.getElementById('auth-email').value.trim(), p=document.getElementById('auth-password').value;
  if(!e||!p){ toast('请填写邮箱和密码','err'); return; }"""
if old_login in h:
    h = h.replace(old_login, new_login); n += 1; print('FIX3a doLogin guard')
else:
    print('WARN FIX3a')

old_signup = """async function doSignUp(){
  var e=document.getElementById('auth-email').value.trim(), p=document.getElementById('auth-password').value;"""
new_signup = """async function doSignUp(){
  if(!sb){ toast('云端连接不可用，请稍后重试','err'); return; }
  var e=document.getElementById('auth-email').value.trim(), p=document.getElementById('auth-password').value;"""
if old_signup in h:
    h = h.replace(old_signup, new_signup); n += 1; print('FIX3b doSignUp guard')
else:
    print('WARN FIX3b')

# ---- FIX 4: .guide-skip 样式补齐 ----
if '.guide-skip' in h and '.guide-skip{display:inline-block' not in h:
    old_gs = '.guide-next{display:inline-block;margin-top:10px;padding:6px 16px;border-radius:9px;background:var(--grad);color:#fff;font-size:12px;font-weight:600;cursor:pointer;border:none;font-family:inherit}'
    new_gs = old_gs + '\n.guide-skip{display:inline-block;margin-top:10px;margin-left:8px;padding:6px 12px;border-radius:9px;font-size:12px;color:var(--text-3);cursor:pointer;background:none;border:none;font-family:inherit}\n.guide-skip:hover{color:var(--text-2)}'
    if old_gs in h:
        h = h.replace(old_gs, new_gs); n += 1; print('FIX4 guide-skip CSS')
    else:
        print('WARN FIX4: guide-next CSS not matched')
else:
    print('FIX4: guide-skip already present')

# ---- FIX 5: _dbReady.then 加异常保护 + 移除重复的加载屏隐藏 ----
old_rd = """_dbReady.then(function(){
  startTimer();
  startActivityTracking();
  var shield = document.getElementById('loading-screen');
  if(shield){ setTimeout(function(){ shield.classList.add('done'); }, 300); }
  if(!localStorage.getItem('yanxueku_guided')){
    setTimeout(showFirstGuide, 800);
  }
});"""
new_rd = """_dbReady.then(function(){
  try{ startTimer(); }catch(e){}
  try{ startActivityTracking(); }catch(e){}
  if(!localStorage.getItem('yanxueku_guided')){
    setTimeout(showFirstGuide, 800);
  }
});"""
if old_rd in h:
    h = h.replace(old_rd, new_rd); n += 1; print('FIX5 _dbReady hardening')
else:
    print('WARN FIX5')

with open(PATH, 'w', encoding='utf-8') as f:
    f.write(h)
print(f'\nRound1 fixes: {n}')
