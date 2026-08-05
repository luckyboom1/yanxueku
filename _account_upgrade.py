#!/usr/bin/env python3
"""一人一号系统改造 v2：强制登录 + 精简默认数据 + 移除新闻史注入（精确锚点版）"""
PATH = r'C:\Users\53296\WorkBuddy\2026-08-04-20-21-15\kaoyan-study\index.html'
with open(PATH, 'r', encoding='utf-8') as f:
    h = f.read()

report = []
def ok(name, cond):
    report.append(('✅ ' if cond else '❌ ') + name)
    if not cond:
        raise SystemExit('中止：' + name)

# ---------- 1. seedData 精简 ----------
NEW_SEED = '''function seedData(){
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
      '**大O记号**：表示算法运行时间的上界。\\n常见复杂度排序：O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(2ⁿ)。\\n**易错点**：最好/最坏/平均时间复杂度要分清，考研常考"最坏情况"。',
      ['复杂度','测试'], 0, 0),
    K('demo2','demo','线性表','栈与队列的区别',
      '**栈**：后进先出（LIFO），仅允许在栈顶插入删除。\\n应用：函数调用、表达式求值、括号匹配。\\n**队列**：先进先出（FIFO），队尾入、队头出。\\n应用：层次遍历、缓冲区、BFS。',
      ['栈','队列','测试'], 0, 1),
    K('demo3','demo','树与二叉树','二叉树的三种遍历',
      '前序：**根 → 左 → 右**；中序：左 → 根 → 右；后序：左 → 右 → 根。\\n**考点**：已知前序+中序 或 后序+中序 可唯一重建二叉树；前序+后序 **不能**唯一确定。',
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
}'''

start = h.find('function seedData(){')
end_marker = '  return {subjects, knowledge, questions, quizRecords, studyLog};\n}'
end = h.find(end_marker, start)
ok('seedData 定位', start >= 0 and end >= 0)
end += len(end_marker)
h = h[:start] + NEW_SEED + h[end:]
ok('seedData 精简替换', True)

# ---------- 2. 删除 SEED_NEWS_CARDS 行 ----------
ns = h.find('const SEED_NEWS_CARDS=[')
ok('SEED_NEWS_CARDS 定位', ns >= 0)
nl = h.find('\n', ns)
h = h[:ns] + h[nl+1:]
ok('SEED_NEWS_CARDS 删除', True)

# ---------- 3. 删除 ensureNewsSubject 函数 ----------
es = h.find('function ensureNewsSubject(){')
ok('ensureNewsSubject 定位', es >= 0)
# 函数结束：找到函数内第一个独立的 "  save();\n}"（函数体结尾）
body_end = h.find('\n}\n', es)
ok('ensureNewsSubject 函数体结束定位', body_end >= 0)
h = h[:es] + h[body_end+3:]
ok('ensureNewsSubject 删除', True)

# ---------- 4. load() 移除 ensureNewsSubject 调用 ----------
old_load = '  db = seedData(); ensureNewsSubject();'
ok('load 调用锚点', old_load in h)
h = h.replace(old_load, '  db = seedData();', 1)
ok('load 修改', True)

# ---------- 5. render() 登录墙检查 ----------
old_render = 'function render(){\n  renderSidebar(); renderBadges();'
ok('render 锚点', old_render in h)
h = h.replace(old_render, 'function render(){\n  if(!_currentUser){ renderGate(); return; }\n  hideGate();\n  renderSidebar(); renderBadges();', 1)
ok('render 登录墙', True)

# ---------- 6. 登录墙 JS ----------
GATE_JS = '''
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
'''
anchor = '/* ====== 学习计时器 ====== */'
ok('计时器锚点', anchor in h)
h = h.replace(anchor, GATE_JS + anchor, 1)
ok('登录墙 JS', True)

# ---------- 7. setupAuthListener 同步增强 ----------
old_auth = """    try{ localStorage.setItem('yanxueku_v1', JSON.stringify(db)); }catch(e){}
    }else{ _currentUser=null; _profile=null; }
    renderSidebarUser();
    if(curView) render();"""
ok('setupAuthListener 锚点', old_auth in h)
h = h.replace(old_auth, """    try{ localStorage.setItem('yanxueku_v1', JSON.stringify(db)); }catch(e){}
      hideGate();
      setupRealtimeSync();
    }else{ _currentUser=null; _profile=null; renderGate(); }
    renderSidebarUser();
    if(curView) render();""", 1)
ok('setupAuthListener 增强', True)

# ---------- 8. 登录墙 CSS ----------
GATE_CSS = '''
/* ---------- 登录墙 ---------- */
#login-gate{position:fixed;inset:0;z-index:1000;display:none;align-items:center;justify-content:center;background:var(--bg-grad);backdrop-filter:blur(8px);padding:20px}
#login-gate .gate-card{width:min(92vw,420px);background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:36px 32px;text-align:center;box-shadow:var(--shadow-lg)}
#login-gate .gate-logo{width:56px;height:56px;border-radius:16px;background:var(--grad);display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;margin:0 auto 16px;box-shadow:0 8px 24px rgba(99,102,241,.35)}
#login-gate h2{margin-bottom:8px;font-size:19px}
#login-gate p{color:var(--text-2);font-size:13px;margin-bottom:24px;line-height:1.8}'''
ok('CSS 锚点', '</style>' in h)
h = h.replace('</style>', GATE_CSS + '\n</style>', 1)
ok('登录墙 CSS', True)

with open(PATH, 'w', encoding='utf-8') as f:
    f.write(h)

print('=' * 50)
for r in report:
    print('  ' + r[0] + r[1])
print('=' * 50)
print('新文件大小:', len(h.encode('utf-8')), 'bytes')
