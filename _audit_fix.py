"""
自动化审计修复脚本 — 研学库 index.html
修复维度：
  P1-1: updateDashboardHeader 缺 db 空指针保护
  P1-2: save() 的 localStorage.setItem 缺 try/catch
  P1-3: onAuthStateChange 的 localStorage.setItem 缺 try/catch
  P1-4: openProfileModal 缺 _profile 空指针保护
  P2-1: doLogin/doSignUp/saveProfile 缺 try/catch 网络异常保护
  P2-2: renderSidebar/renderBadges/renderDashboard 缺 db 空指针保护
  P2-3: signOut 缺 _activeTimer 清理
"""
import os

PATH = r'C:\Users\53296\WorkBuddy\2026-08-04-20-21-15\kaoyan-study\index.html'
with open(PATH, 'r', encoding='utf-8') as f:
    h = f.read()

fixes = []
def fix(name, old, new):
    global h
    if old in h:
        h = h.replace(old, new, 1)
        fixes.append(f"✅ {name}")
    else:
        fixes.append(f"⏭️ {name} (未找到匹配，跳过)")

# ============================================================
# P1-1: updateDashboardHeader 缺 db 空指针保护
# ============================================================
fix(
    "P1-1: updateDashboardHeader 加 db null guard",
    "function updateDashboardHeader(){\n  const el = document.getElementById('dash-header-right');\n  if(!el) return;",
    "function updateDashboardHeader(){\n  if(!db||!db.knowledge) return;\n  const el = document.getElementById('dash-header-right');\n  if(!el) return;"
)

# ============================================================
# P1-2: save() 的 localStorage.setItem 缺 try/catch
# ============================================================
fix(
    "P1-2: save() localStorage.setItem 加 try/catch",
    "  localStorage.setItem('yanxueku_v1', JSON.stringify(db)); // always mirror to localStorage as backup\n}",
    "  try{ localStorage.setItem('yanxueku_v1', JSON.stringify(db)); }catch(e){ console.warn('localStorage save failed:', e.message); } // always mirror to localStorage as backup\n}"
)

# ============================================================
# P1-3: onAuthStateChange 的 localStorage.setItem 缺 try/catch
# ============================================================
fix(
    "P1-3: onAuthStateChange localStorage.setItem 加 try/catch",
    "    if(rd && rd.data && rd.data.data && rd.data.data.subjects){ db = rd.data.data; }\n    localStorage.setItem('yanxueku_v1', JSON.stringify(db));",
    "    if(rd && rd.data && rd.data.data && rd.data.data.subjects){ db = rd.data.data; }\n    try{ localStorage.setItem('yanxueku_v1', JSON.stringify(db)); }catch(e){}"
)

# ============================================================
# P1-4: openProfileModal 缺 _profile 空指针保护
# ============================================================
fix(
    "P1-4: openProfileModal 加 _profile null guard",
    "function openProfileModal(){\n  openModal('<button class=\"modal-close\" onclick=\"closeModal()\">✕</button><h3>👤 个人资料</h3>'+\n    '<div class=\"form-row\"><label>显示名称</label><input id=\"pf-name\" value=\"'+esc(_profile.display_name||'')+'\"></div>'+\n    '<div class=\"form-row\"><label>头像颜色</label><div class=\"color-picker\" id=\"pf-colors\"></div><input type=\"hidden\" id=\"pf-color\" value=\"'+(_profile.avatar_color||'#6366f1')+'\"></div>'+",
    "function openProfileModal(){\n  if(!_profile){ toast('请先登录','err'); return; }\n  openModal('<button class=\"modal-close\" onclick=\"closeModal()\">✕</button><h3>👤 个人资料</h3>'+\n    '<div class=\"form-row\"><label>显示名称</label><input id=\"pf-name\" value=\"'+esc(_profile.display_name||'')+'\"></div>'+\n    '<div class=\"form-row\"><label>头像颜色</label><div class=\"color-picker\" id=\"pf-colors\"></div><input type=\"hidden\" id=\"pf-color\" value=\"'+(_profile.avatar_color||'#6366f1')+'\"></div>'+"
)

# ============================================================
# P2-1: doLogin/doSignUp/saveProfile 缺 try/catch
# ============================================================
fix(
    "P2-1a: doLogin 加 try/catch",
    "async function doLogin(){\n  if(!sb){ toast('云端连接不可用，请稍后重试','err'); return; }\n  var e=document.getElementById('auth-email').value.trim(), p=document.getElementById('auth-password').value;\n  if(!e||!p){ toast('请填写邮箱和密码','err'); return; }\n  var r = await sb.auth.signInWithPassword({email:e, password:p});\n  if(r.error){ toast(r.error.message,'err'); return; }\n  closeModal(); toast('登录成功 ✅','ok');\n}",
    "async function doLogin(){\n  if(!sb){ toast('云端连接不可用，请稍后重试','err'); return; }\n  var e=document.getElementById('auth-email').value.trim(), p=document.getElementById('auth-password').value;\n  if(!e||!p){ toast('请填写邮箱和密码','err'); return; }\n  try{\n    var r = await sb.auth.signInWithPassword({email:e, password:p});\n    if(r.error){ toast(r.error.message,'err'); return; }\n    closeModal(); toast('登录成功 ✅','ok');\n  }catch(e){ toast('网络错误，请重试','err'); }\n}"
)

fix(
    "P2-1b: doSignUp 加 try/catch",
    "async function doSignUp(){\n  if(!sb){ toast('云端连接不可用，请稍后重试','err'); return; }\n  var e=document.getElementById('auth-email').value.trim(), p=document.getElementById('auth-password').value;\n  var n=document.getElementById('auth-name'); n=n?n.value.trim()||e.split('@')[0]:e.split('@')[0];\n  if(!e||!p){ toast('请填写邮箱和密码','err'); return; }\n  var r = await sb.auth.signUp({email:e, password:p, options:{data:{display_name:n}}});\n  if(r.error){ toast(r.error.message,'err'); return; }\n  closeModal(); toast(r.data.session?'注册成功 ✅':'请检查邮箱确认 📧','ok');\n}",
    "async function doSignUp(){\n  if(!sb){ toast('云端连接不可用，请稍后重试','err'); return; }\n  var e=document.getElementById('auth-email').value.trim(), p=document.getElementById('auth-password').value;\n  var n=document.getElementById('auth-name'); n=n?n.value.trim()||e.split('@')[0]:e.split('@')[0];\n  if(!e||!p){ toast('请填写邮箱和密码','err'); return; }\n  try{\n    var r = await sb.auth.signUp({email:e, password:p, options:{data:{display_name:n}}});\n    if(r.error){ toast(r.error.message,'err'); return; }\n    closeModal(); toast(r.data.session?'注册成功 ✅':'请检查邮箱确认 📧','ok');\n  }catch(e){ toast('网络错误，请重试','err'); }\n}"
)

fix(
    "P2-1c: saveProfile 加 try/catch",
    "async function saveProfile(){\n  if(!sb||!_currentUser){ toast('未登录','err'); return; }\n  var n=document.getElementById('pf-name').value.trim()||'考研人';\n  var c=document.getElementById('pf-color').value||'#6366f1';\n  await sb.from('profiles').upsert({user_id:_currentUser.id, display_name:n, avatar_color:c});\n  _profile={display_name:n, avatar_color:c}; closeModal(); renderSidebarUser(); toast('资料已更新','ok');\n}",
    "async function saveProfile(){\n  if(!sb||!_currentUser){ toast('未登录','err'); return; }\n  var n=document.getElementById('pf-name').value.trim()||'考研人';\n  var c=document.getElementById('pf-color').value||'#6366f1';\n  try{\n    await sb.from('profiles').upsert({user_id:_currentUser.id, display_name:n, avatar_color:c});\n    _profile={display_name:n, avatar_color:c}; closeModal(); renderSidebarUser(); toast('资料已更新','ok');\n  }catch(e){ toast('保存失败，请重试','err'); }\n}"
)

# ============================================================
# P2-2: renderSidebar/renderBadges/renderDashboard 缺 db 空指针保护
# ============================================================
fix(
    "P2-2a: renderSidebar 加 db null guard",
    "function renderSidebar(){\n  const el = document.getElementById('subj-list');\n  el.innerHTML = db.subjects.map",
    "function renderSidebar(){\n  if(!db||!db.subjects) return;\n  const el = document.getElementById('subj-list');\n  if(!el) return;\n  el.innerHTML = db.subjects.map"
)

fix(
    "P2-2b: renderBadges 加 db null guard",
    "function renderBadges(){\n  const due = dueList().length;",
    "function renderBadges(){\n  if(!db||!db.knowledge) return;\n  const due = dueList().length;"
)

fix(
    "P2-2c: renderDashboard 加 db null guard",
    "function renderDashboard(){\n  const el = document.getElementById('view-dashboard');",
    "function renderDashboard(){\n  if(!db||!db.studyLog) return;\n  const el = document.getElementById('view-dashboard');"
)

# ============================================================
# P2-3: signOut 清理 _activeTimer
# ============================================================
fix(
    "P2-3: signOut 清理 _activeTimer",
    "async function signOut(){\n  if(!sb) return;\n  _currentUser=null; _profile=null; await sb.auth.signOut();",
    "async function signOut(){\n  if(!sb) return;\n  _currentUser=null; _profile=null;\n  try{ await sb.auth.signOut(); }catch(e){}"
)

# ============================================================
# P2-4: 其他 render 函数也加 db guard
# ============================================================
# renderLibrary
fix(
    "P2-4a: renderLibrary 加 db null guard",
    "function renderLibrary(){\n  const el",
    "function renderLibrary(){\n  if(!db||!db.knowledge) return;\n  const el"
)

# renderReviewHome
fix(
    "P2-4b: renderReviewHome 加 db null guard",
    "function renderReviewHome(){",
    "function renderReviewHome(){\n  if(!db||!db.knowledge) return;"
)

# renderQuizHome
fix(
    "P2-4c: renderQuizHome 加 db null guard",
    "function renderQuizHome(){",
    "function renderQuizHome(){\n  if(!db||!db.questions) return;"
)

# renderWrong
fix(
    "P2-4d: renderWrong 加 db null guard",
    "function renderWrong(){",
    "function renderWrong(){\n  if(!db||!db.questions) return;"
)

# renderStats
fix(
    "P2-4e: renderStats 加 db null guard",
    "function renderStats(){",
    "function renderStats(){\n  if(!db||!db.studyLog) return;"
)

# ============================================================
# 写入文件
# ============================================================
with open(PATH, 'w', encoding='utf-8') as f:
    f.write(h)

print(f"\n{'='*60}")
print(f"修复完成: {len(fixes)} 项")
print(f"{'='*60}")
for f in fixes:
    print(f"  {f}")
