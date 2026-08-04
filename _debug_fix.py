"""Fix timer bugs + multiple save/async issues"""
PATH = r'C:\Users\53296\WorkBuddy\2026-08-04-20-21-15\kaoyan-study\index.html'
with open(PATH, 'r', encoding='utf-8') as f:
    h = f.read()

fixes = 0

# ----- BUG 1: timer functions run before db loaded; add null guard -----
old_timer = """function updateSidebarTimer(){
  const t = todayStr();
  const todayRec = db.studyLog.find(r=>r.date===t);"""
new_timer = """function updateSidebarTimer(){
  if(!db||!db.studyLog) return;
  const t = todayStr();
  const todayRec = db.studyLog.find(r=>r.date===t);"""
if old_timer in h:
    h = h.replace(old_timer, new_timer)
    fixes += 1

# ----- BUG 2: startActivityTracking crashes if db undefined -----
old_activity = """      _activeSeconds++;
      if(_activeSeconds >= 60){
        _activeSeconds = 0;
        const t = todayStr();
        let rec = db.studyLog.find(r=>r.date===t);"""
new_activity = """      _activeSeconds++;
      if(!db||!db.studyLog){ _activeSeconds=0; return; }
      if(_activeSeconds >= 60){
        _activeSeconds = 0;
        const t = todayStr();
        let rec = db.studyLog.find(r=>r.date===t);"""
if old_activity in h:
    h = h.replace(old_activity, new_activity)
    fixes += 1

# ----- BUG 3: save wrapper breaks async; move timer startup into load completion -----
old_save_wrap = """// 每次数据变更后刷新计时器
const _origSave = save;
save = function(){ _origSave(); updateSidebarTimer(); };"""
new_save_wrap = """// save hook: 每次保存后刷新 UI
const _origSaveFunc = save;
save = function(){
  const r = _origSaveFunc.apply(this, arguments);
  if(r && r.then) r.then(updateSidebarTimer); else updateSidebarTimer();
  return r;
};"""

if old_save_wrap in h:
    h = h.replace(old_save_wrap, new_save_wrap)
    fixes += 1

# ----- BUG 4: startTimer() and startActivityTracking() called before db ready -----
old_start = """startTimer();
startActivityTracking();"""

new_start = """// Deferred start after DB loads
_dbReady.then(function(){
  startTimer();
  startActivityTracking();
});"""

if old_start in h:
    h = h.replace(old_start, new_start)
    fixes += 1

# ----- BUG 5: realtime sync calls functions that might access undefined db -----
old_realtime = """            if(curView) render();
            updateSidebarTimer();
            updateDashboardHeader();"""
new_realtime = """            if(curView) render();
            setTimeout(function(){ updateSidebarTimer(); }, 50);
            setTimeout(function(){ updateDashboardHeader(); }, 80);"""
if old_realtime in h:
    h = h.replace(old_realtime, new_realtime)
    fixes += 1

# ----- BUG 6: old _windowOnLoad dead code (not used) - remove -----
old_dead = """// 启动时等待 db 就绪
_windowOnLoad = async function(){
  await _dbReady;
  render();
};"""
h = h.replace(old_dead, '')
fixes += 1

with open(PATH, 'w', encoding='utf-8') as f:
    f.write(h)

print(f'Fixed {fixes} bugs.')
