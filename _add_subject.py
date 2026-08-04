"""Add 'New Subject' feature"""
PATH = r'C:\Users\53296\WorkBuddy\2026-08-04-20-21-15\kaoyan-study\index.html'
with open(PATH, 'r', encoding='utf-8') as f:
    h = f.read()

# 1. Sidebar label: add + button
old_label = '<div class="side-label">专业科目</div>'
new_label = '<div class="side-label">专业科目 <button style="display:inline-flex;width:auto;padding:1px 8px;font-size:16px;line-height:1;border:none;background:none;color:var(--primary);cursor:pointer;font-weight:800" onclick="openNewSubjectModal(event)" title="新建科目">＋</button></div>'
h = h.replace(old_label, new_label)

# 2. CSS: color picker
css_end = h.index('</style>')
picker_css = """
.color-picker{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
.color-picker span{width:32px;height:32px;border-radius:10px;cursor:pointer;border:3px solid transparent;transition:all .2s}
.color-picker span.sel{border-color:var(--text);transform:scale(1.15);box-shadow:0 2px 8px rgba(0,0,0,.2)}
"""
h = h[:css_end] + picker_css + h[css_end:]

# 3. JS: insert new subject functions before "卡片文本导入"
import_marker = '/* ================= 卡片文本导入（真经笔记 OCR 格式） ================= */'
new_js = """/* ================= 新建科目 ================= */
function openNewSubjectModal(ev){
  if(ev) ev.stopPropagation();
  openModal(
    '<button class="modal-close" onclick="closeModal()">✕</button>'+
    '<h3>＋ 新建专业科目</h3>'+
    '<div class="form-row"><label>科目名称 *</label><input id="ns-name" placeholder="如：传播学教程"></div>'+
    '<div class="form-row"><label>考试名称</label><input id="ns-exam" placeholder="如：新闻与传播 440"></div>'+
    '<div class="form-row"><label>科目颜色</label><div class="color-picker" id="ns-colors"></div><input type="hidden" id="ns-hidden-color" value="#6366f1"></div>'+
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="confirmNewSubject()">创建科目</button></div>');
  setTimeout(function(){
    var colors = ['#6366f1','#e11d48','#0ea5e9','#f59e0b','#10b981','#8b5cf6','#0891b2','#ca8a04','#dc2626','#16a34a'];
    var el = document.getElementById('ns-colors');
    if(el) el.innerHTML = colors.map(function(c){
      return '<span style="background:'+c+'" data-color="'+c+'" onclick="var p=this.parentElement;p.querySelectorAll(\\'span\\').forEach(function(s){s.classList.remove(\\'sel\\')});this.classList.add(\\'sel\\');document.getElementById(\\'ns-hidden-color\\').value=\\''+c+'\\'"></span>';
    }).join('');
  }, 10);
}
function confirmNewSubject(){
  var name = document.getElementById('ns-name').value.trim();
  if(!name){ toast('请输入科目名称','err'); return; }
  if(db.subjects.some(function(s){return s.name===name;})){ toast('该科目名称已存在','err'); return; }
  var exam = document.getElementById('ns-exam').value.trim();
  var color = document.getElementById('ns-hidden-color').value || '#6366f1';
  db.subjects.push({ id: uid(), name: name, color: color, exam: exam });
  save(); closeModal();
  libFilter.subject = 'all';
  switchView('library');
  toast('科目「'+name+'」已创建 ✅','ok');
}

""" + import_marker
h = h.replace(import_marker, new_js)

with open(PATH, 'w', encoding='utf-8') as f:
    f.write(h)
print('New subject feature patched.')
