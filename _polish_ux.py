"""UX polish: loading skeleton + SEO/branding + micro-interactions"""
PATH = r'C:\Users\53296\WorkBuddy\2026-08-04-20-21-15\kaoyan-study\index.html'
with open(PATH, 'r', encoding='utf-8') as f:
    h = f.read()
fixed = 0

# ===== 1. Head: 补齐 SEO meta 标签 + OG 分享卡片 =====
head_end = h.index('</head>')
seo_meta = """<meta name="description" content="研学库 - 考研专业课高效学习系统。艾宾浩斯遗忘曲线智能复习、刷题自测、错题本、学习统计。支持多人实时同步，永久免费。">
<meta name="keywords" content="考研,专业课,艾宾浩斯,记忆复习,闪卡,刷题,学习系统">
<meta property="og:title" content="研学库 · 考研专业课高效学习系统">
<meta property="og:description" content="基于艾宾浩斯遗忘曲线的智能复习工具，支持知识库管理、刷题自测、错题本、学习统计。学习小组多人实时同步。">
<meta property="og:type" content="website">
<meta property="og:url" content="https://luckyboom1.github.io/yanxueku/">
<meta property="og:image" content="https://luckyboom1.github.io/yanxueku/icon-512.png">
<meta name="twitter:card" content="summary">
<meta name="format-detection" content="telephone=no">
"""
h = h[:head_end] + seo_meta + h[head_end:]
fixed += 1

# ===== 2. CSS: 加载骨架屏 + 按钮波纹 + 引导提示 =====
css_end = h.index('</style>')
polish_css = """
/* 加载骨架屏 */
.loading-shield{position:fixed;inset:0;z-index:999;background:var(--bg-grad);display:flex;flex-direction:column;align-items:center;justify-content:center;transition:opacity .4s,visibility .4s}
.loading-shield.done{opacity:0;visibility:hidden;pointer-events:none}
.loading-pulse{width:48px;height:48px;border-radius:14px;background:var(--grad);animation:loadPulse 1.2s cubic-bezier(.4,0,.2,1) infinite}
@keyframes loadPulse{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.15);opacity:1}}
.loading-text{margin-top:18px;font-size:14px;color:var(--text-2);font-weight:600;letter-spacing:.5px}
/* 按钮点击波纹 */
.btn,.grade-btn,.mini-btn,.chip,.nav-item,.q-opt,.opt-card{position:relative;overflow:hidden}
.ripple{position:absolute;border-radius:50%;background:rgba(255,255,255,.35);transform:scale(0);animation:ripple .5s linear;pointer-events:none}
@keyframes ripple{to{transform:scale(4);opacity:0}}
/* 首次引导气泡 */
.guide-bubble{position:fixed;z-index:250;max-width:260px;background:var(--surface);border:1.5px solid var(--primary);border-radius:16px;padding:16px 20px;box-shadow:var(--shadow-lg);font-size:13px;line-height:1.7;animation:bubbleIn .4s cubic-bezier(.16,1,.3,1)}
.guide-bubble::after{content:'';position:absolute;bottom:-8px;left:40px;width:14px;height:14px;background:var(--surface);border-right:1.5px solid var(--primary);border-bottom:1.5px solid var(--primary);transform:rotate(45deg)}
@keyframes bubbleIn{from{opacity:0;transform:translateY(10px)}}
.guide-next{display:inline-block;margin-top:10px;padding:6px 16px;border-radius:9px;background:var(--grad);color:#fff;font-size:12px;font-weight:600;cursor:pointer;border:none;font-family:inherit}
.guide-skip{display:inline-block;margin-top:10px;margin-left:8px;padding:6px 12px;font-size:12px;color:var(--text-3);cursor:pointer}
/* 空状态品牌统一 */
.empty-state .big{font-size:48px;margin-bottom:12px;opacity:.85}
"""
h = h[:css_end] + polish_css + h[css_end:]
fixed += 1

# ===== 3. HTML: 加载骨架屏 div (body最前面) =====
body_start = h.index('<body>')
loading_div = """<body>
<div class="loading-shield" id="loading-screen">
  <div class="loading-pulse"></div>
  <div class="loading-text">研学库加载中…</div>
</div>
"""
h = h[:body_start] + loading_div + h[body_start + len('<body>'):]
fixed += 1

# ===== 4. JS: 加载完成后隐藏骨架屏 =====
old_load_done = """_dbReady.then(function(){
  startTimer();
  startActivityTracking();
});"""
new_load_done = """_dbReady.then(function(){
  startTimer();
  startActivityTracking();
  // 隐藏加载屏
  var shield = document.getElementById('loading-screen');
  if(shield){ setTimeout(function(){ shield.classList.add('done'); }, 300); }
  // 首次使用引导
  if(!localStorage.getItem('yanxueku_guided')){
    setTimeout(showFirstGuide, 800);
  }
});"""
h = h.replace(old_load_done, new_load_done)
fixed += 1

# ===== 5. JS: 按钮波纹效果 + 首次引导 =====
# Insert before "/* ====== 学习计时器 ====== */"
old_timer_section = "/* ====== 学习计时器 ====== */"
ripple_js = """/* ====== 按钮波纹 ====== */
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

""" + old_timer_section
h = h.replace(old_timer_section, ripple_js)
fixed += 1

with open(PATH, 'w', encoding='utf-8') as f:
    f.write(h)
print(f'UX polish applied: {fixed} changes')
