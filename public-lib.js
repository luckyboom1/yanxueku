/* 研学库 Public Library v2.1.1 — Browse and import from 10-subject course library */
/* ================= 公共课程库 ================= */
var _pubLib = null, _pubLibLoading = false, _pubLibSubject = null;

/* 加载公共课程库（缓存到内存） */
function loadPublicLibrary(cb){
  if(_pubLib){ cb(_pubLib); return; }
  if(_pubLibLoading) return; // 正在加载中不重复请求
  _pubLibLoading = true;
  var el = document.getElementById('view-public-library');
  el.innerHTML = '<div class="empty-state"><div class="big">🏛️</div><h3>课程库加载中…</h3><p>正在获取十大热门考研专业课数据</p></div>';

  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'public-library.json', true);
  xhr.onload = function(){
    _pubLibLoading = false;
    if(xhr.status >= 200 && xhr.status < 300){
      try {
        _pubLib = JSON.parse(xhr.responseText);
        if(cb) cb(_pubLib);
      } catch(e){ toast('课程库数据解析失败','err'); }
    } else {
      toast('课程库加载失败，请检查网络连接','err');
    }
  };
  xhr.onerror = function(){ _pubLibLoading = false; toast('课程库加载失败','err'); };
  xhr.send();
}

function renderPublicLibrary(){
  if(_pubLibSubject){ renderPubLibDetail(_pubLibSubject); return; }
  loadPublicLibrary(function(lib){
    if(!lib || !lib.subjects) return;
    var el = document.getElementById('view-public-library');
    var html = '<div class="plib-header"><h2>🏛️ 公共课程库</h2></div>';
    html += '<div style="font-size:13px;color:var(--text-3);margin-bottom:16px">十大热门考研专业课 · 共 <b>'+lib.subjects.length+'</b> 个科目 · 点击科目卡片查看详情并导入</div>';
    html += '<div class="plib-subject-grid">';

    lib.subjects.forEach(function(s){
      var appSubj = db.subjects.find(function(x){ return x.name === s.name; });
      var importedTag = appSubj ? '<span style="font-size:11px;color:var(--success);font-weight:600">✅ 已导入</span>' : '';
      html += '<div class="plib-subject-card" onclick="_pubLibSubject=\''+s.id+'\';renderPublicLibrary()">' +
        '<div class="plib-subject-header">' +
          '<div class="plib-subject-icon" style="background:'+s.color+'">'+s.icon+'</div>' +
          '<div><h3 style="font-size:15px;margin-bottom:2px">'+esc(s.name)+'</h3>' +
          '<div style="font-size:12px;color:var(--text-3)">'+esc(s.desc)+'</div></div>' +
        '</div>' +
        '<div class="plib-subject-stats">' +
          '<span>📚 <b>'+s.chapters.length+'</b> 章</span>' +
          '<span>🧠 <b>'+s.cardCount+'</b> 张卡片</span>' +
          '<span>📝 '+esc(s.exam)+'</span>' +
        '</div>' +
        '<div class="plib-subject-footer">' +
          '<button class="plib-preview-btn" onclick="event.stopPropagation();_pubLibSubject=\''+s.id+'\';renderPublicLibrary()">👁 预览卡片</button>' +
          '<button class="plib-import-btn" onclick="event.stopPropagation();importPubLibSubject(\''+s.id+'\')">📥 导入我的科目</button>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
  });
}

function renderPubLibDetail(subjectId){
  loadPublicLibrary(function(lib){
    var s = (lib.subjects || []).find(function(x){ return x.id === subjectId; });
    if(!s){ _pubLibSubject = null; renderPublicLibrary(); return; }
    var el = document.getElementById('view-public-library');

    // Group cards by chapter
    var chapterMap = {};
    s.cards.forEach(function(c){
      if(!chapterMap[c.chapter]) chapterMap[c.chapter] = [];
      chapterMap[c.chapter].push(c);
    });

    var appSubj = db.subjects.find(function(x){ return x.name === s.name; });

    var html = '<div class="plib-detail-back" onclick="_pubLibSubject=null;renderPublicLibrary()">← 返回课程列表</div>';
    html += '<div class="plib-header">' +
      '<div class="plib-subject-icon" style="background:'+s.color+';width:48px;height:48px;border-radius:14px;font-size:22px">'+s.icon+'</div>' +
      '<div><h2>'+esc(s.name)+'</h2><div style="font-size:13px;color:var(--text-3)">'+esc(s.exam)+' · '+s.cardCount+' 张卡片 · '+s.chapters.length+' 章</div></div>' +
      '</div>' +
      '<div style="display:flex;gap:10px;margin-bottom:20px">' +
        '<button class="plib-import-btn" style="padding:12px 24px;font-size:14px" onclick="importPubLibSubject(\''+s.id+'\')">📥 一键导入到「'+esc(s.name)+'」</button>' +
        (appSubj ? '<span class="btn btn-ghost" style="cursor:default">✅ 科目已存在（导入将新增不重复卡片）</span>' : '') +
      '</div>';

    // Render chapters
    var chapterNames = s.chapters;
    chapterNames.forEach(function(ch){
      var cards = chapterMap[ch] || [];
      html += '<div class="plib-chapter-group"><div class="plib-chapter-title">📖 '+esc(ch)+' <span style="font-weight:400;font-size:12px;color:var(--text-3)">'+cards.length+' 张</span></div>';
      html += '<div class="plib-kw-list">';
      cards.forEach(function(c){
        var tagHTML = (c.tags||[]).map(function(t){ return '<span class="tag tag-blue" style="font-size:10.5px;padding:2px 8px">'+esc(t)+'</span>'; }).join('');
        html += '<div class="plib-kw-item" onclick="showPubLibKwPreview(\''+esc(c.title)+'\',\''+esc(c.content.replace(/\n/g,'<br>').replace(/'/g,'\\\'')) +'\')">' +
          '<div class="title">'+esc(c.title)+'</div>' +
          '<div style="font-size:12px;color:var(--text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px">'+esc(c.content.slice(0,60))+'…</div>' +
          (tagHTML ? '<div class="tags">'+tagHTML+'</div>' : '') +
        '</div>';
      });
      html += '</div></div>';
    });

    el.innerHTML = html;
    el.scrollTop = 0;
  });
}

function showPubLibKwPreview(title, content){
  openModal(
    '<button class="modal-close" onclick="closeModal()">✕</button>' +
    '<div class="plib-kw-preview">' +
      '<h4>'+title+'</h4>' +
      '<div class="content">'+content+'</div>' +
    '</div>'
  );
}

function importPubLibSubject(subjectId){
  loadPublicLibrary(function(lib){
    var s = (lib.subjects || []).find(function(x){ return x.id === subjectId; });
    if(!s){ toast('科目数据未找到','err'); return; }
    // 查找或创建科目
    var appSubj = db.subjects.find(function(x){ return x.name === s.name; });
    if(!appSubj){
      var palette = ['#6366f1','#10b981','#ef4444','#f59e0b','#0ea5e9','#ec4899','#8b5cf6','#14b8a6','#dc2626','#ca8a04'];
      var newId = 'pubimp_'+Date.now().toString(36);
      appSubj = {id: newId, name: s.name, color: palette[db.subjects.length % palette.length], exam: s.exam};
      db.subjects.push(appSubj);
    }

    var addedKw = 0, skippedKw = 0;
    var titleCount = {};
    s.cards.forEach(function(c){
      titleCount[c.title] = (titleCount[c.title] || 0) + 1;
      var finalTitle = titleCount[c.title] > 1 ? c.title + ' (' + titleCount[c.title] + ')' : c.title;
      var exists = db.knowledge.some(function(k){ return k.title === finalTitle; });
      if(exists){ skippedKw++; return; }
      db.knowledge.push({
        id: uid(), subjectId: appSubj.id,
        chapter: c.chapter, title: finalTitle,
        content: c.content, tags: (c.tags || []).slice(0,20),
        stage: 0, nextReview: todayStr(), lastReview: null, createdAt: todayStr()
      });
      addedKw++;
    });

    save(); render();
    _analytics.packImported(addedKw, 0);
    toast('导入完成 ✅ 新增 '+addedKw+' 张卡片'+(skippedKw?'，跳过 '+skippedKw+' 张重复':'')+'，已加入今日复习队列','ok');
  });
}
