"""Replace localStorage with Supabase real-time shared database"""
PATH = r'C:\Users\53296\WorkBuddy\2026-08-04-20-21-15\kaoyan-study\index.html'
with open(PATH, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Add Supabase SDK in <head>
html = html.replace('</head>',
  '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n</head>')

# 2. Replace the data layer: STORE_KEY + load + save
old_layer = """/* ================= 数据层 ================= */
const STORE_KEY = 'yanxueku_v1';
const THEME_KEY = 'yanxueku_theme';
const EBB = [1, 2, 4, 7, 15, 30, 60];"""
new_layer = """/* ================= 数据层（Supabase 共享数据库） ================= */
const SUPABASE_URL = 'https://gwihiemggugzwhutsfea.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3aWhpZW1nZ3VnendodXRzZmVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTMyODksImV4cCI6MjEwMTQyOTI4OX0.UcE502jd3DINEHwxmOgDXsGR3kQ3YYda48v5myCAHA4';
let sb = null;
try{ sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); }catch(e){ console.warn('Supabase init failed, falling back to localStorage'); }
const THEME_KEY = 'yanxueku_theme';
const EBB = [1, 2, 4, 7, 15, 30, 60];"""
html = html.replace(old_layer, new_layer)

# 3. Replace STORE_KEY usage in load function
old_load = """let db;
function load(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(raw){ db = JSON.parse(raw); return; }
  }catch(e){ console.warn('数据读取失败，重置为示例数据', e); }
  db = seedData(); ensureNewsSubject();
  save();
}
function save(){ localStorage.setItem(STORE_KEY, JSON.stringify(db)); }"""

new_load = """let db;
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
            updateSidebarTimer();
            updateDashboardHeader();
          }
        }
      }
    ).subscribe();
}
// 启动时等待 db 就绪
_windowOnLoad = async function(){
  await _dbReady;
  render();
};"""

html = html.replace(old_load, new_load)

# 4. Replace the startup section to use async load
old_startup = """/* ================= 启动 ================= */
applyTheme(themeMode);
load();
render();
if('serviceWorker' in navigator && location.protocol.startsWith('http')){"""
new_startup = """/* ================= 启动 ================= */
applyTheme(themeMode);
load().then(() => { render(); });
if('serviceWorker' in navigator && location.protocol.startsWith('http')){"""
html = html.replace(old_startup, new_startup)

with open(PATH, 'w', encoding='utf-8') as f:
    f.write(html)

print('Supabase integration patched.')
print(f'Size: {len(html)} bytes')
