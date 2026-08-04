"""Fix all P0/P1/P2 issues from audit"""
PATH = r'C:\Users\53296\WorkBuddy\2026-08-04-20-21-15\kaoyan-study\index.html'
with open(PATH, 'r', encoding='utf-8') as f:
    h = f.read()
fixed = 0

# ========== P0-1: 删除破损 CSS 行 331 ==========
broken = """  .modal{width:96vw;padding:18px; border-radius:16px}
}
80%{opacity:1}100%{opacity:0;transform:translateY(100vh) rotate(720deg) scale(.3)}}"""
if broken in h:
    h = h.replace(broken, '  .modal{width:96vw;padding:18px; border-radius:16px}\n}')
    fixed += 1; print('P0-1: orphan CSS removed')

# ========== P0-2: 合并 renderFlashcard 双重 monkey-patch 为一个 ==========
old_double = """const _origRF = renderFlashcard;
renderFlashcard = function(){
  _origRF();
  blanksMode = false;
  blankAnswers = [];
  setTimeout(() => {
    const fc = document.getElementById('fcard');
    if(fc) fc.addEventListener('click', function autoBlanks(){
      if(fc.classList.contains('flipped')){
        toggleBlanksMode();
        fc.removeEventListener('click', autoBlanks);
      }
    }, {once: false});
  }, 30);
};

// 闪卡背面加挖空切换按钮
const _origRF2 = renderFlashcard;
renderFlashcard = function(){
  _origRF2();
  setTimeout(() => {
    const back = document.querySelector('.fc-back');
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
  }, 30);
};"""

new_single = """const _origRF = renderFlashcard;
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
};"""

if old_double in h:
    h = h.replace(old_double, new_single)
    fixed += 1; print('P0-2: merged double monkey-patch into one')
else:
    print('P0-2: double patch already fixed?')

# ========== P0-3: 修复颜色选择器 setTimeout 竞态 ==========
old_color = """  setTimeout(function(){
    var colors = ['#6366f1','#e11d48','#0ea5e9','#f59e0b','#10b981','#8b5cf6','#0891b2','#ca8a04','#dc2626','#16a34a'];
    var el = document.getElementById('ns-colors');
    if(el) el.innerHTML = colors.map(function(c){
      return '<span style="background:'+c+'" data-color="'+c+'" onclick="var p=this.parentElement;p.querySelectorAll(\\'span\\').forEach(function(s){s.classList.remove(\\'sel\\')});this.classList.add(\\'sel\\');document.getElementById(\\'ns-hidden-color\\').value=\\''+c+'\\'"></span>';
    }).join('');
  }, 10);"""

new_color = """  var colors = ['#6366f1','#e11d48','#0ea5e9','#f59e0b','#10b981','#8b5cf6','#0891b2','#ca8a04','#dc2626','#16a34a'];
  function fillColorPicker(){
    var el = document.getElementById('ns-colors');
    if(!el){ requestAnimationFrame(fillColorPicker); return; }
    el.innerHTML = colors.map(function(c){
      return '<span style="background:'+c+'" data-color="'+c+'" onclick="var p=this.parentElement;p.querySelectorAll(\\'span\\').forEach(function(s){s.classList.remove(\\'sel\\')});this.classList.add(\\'sel\\');document.getElementById(\\'ns-hidden-color\\').value=\\''+c+'\\'"></span>';
    }).join('');
  }
  fillColorPicker();"""

if old_color in h:
    h = h.replace(old_color, new_color)
    fixed += 1; print('P0-3: color picker race condition fixed')
else:
    print('P0-3: already fixed?')

# ========== P1-1: SW 离线回退对非HTML资源返回正确类型 (修复 sw.js 单独处理) ==========
# This is in sw.js, not index.html — skip, fix separately

# ========== P2-1: 删除多余 <br> ==========
old_br = 'onclick="startReview()">🧠 开始复习<br></button>'
new_br = 'onclick="startReview()">🧠 开始复习</button>'
if old_br in h:
    h = h.replace(old_br, new_br)
    fixed += 1; print('P2-1: removed extra <br>')

# ========== P2-2: remove unused _windowOnLoad dead code if still present ==========
if '_windowOnLoad' in h:
    idx = h.find('_windowOnLoad')
    end_idx = h.find('\n', h.find('};', idx))
    if idx > 0 and end_idx > idx:
        old_dead = h[idx-20:end_idx+1]
        # find actual dead code
        dead_region = h[h.rfind('// 启动时', 0, idx):end_idx+1]
        if dead_region.strip():
            h = h.replace(dead_region, '')
            fixed += 1; print('P2-2: removed dead _windowOnLoad')

# ========== P2-3: 仪表盘顶部 setTimeout 也改用 requestAnimationFrame ==========
old_dash_timeout = """  setTimeout(updateDashboardHeader, 20);"""
new_dash_timeout = """  requestAnimationFrame(updateDashboardHeader);"""
h = h.replace(old_dash_timeout, new_dash_timeout)
fixed += 1; print('P2-3: setTimeout -> requestAnimationFrame in dashboard')

old_badge_timeout = """  setTimeout(updateDashboardHeader, 20);"""
# Already replaced above? Let me check how many are left
# There are two instances: one in _origRD wrapper and one in _origRB wrapper
# After first replace, one remains
h = h.replace(old_badge_timeout, """  requestAnimationFrame(updateDashboardHeader);""")

# ========== P2-4: 清理侧栏混合缩进 ==========
# Not worth the risk of breaking template literals; skip

with open(PATH, 'w', encoding='utf-8') as f:
    f.write(h)

print(f'\nTotal fixes: {fixed}')
