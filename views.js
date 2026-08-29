/* 研学库 Views v2.3 — All render functions: Library, Review, Stats, Mine, Auth, PublicLib */

// === 共享辅助：科目创建 + 标题去重 ===
function findOrCreateSubject(name, exam) {
  let subj = db.subjects.find(function(s){ return s.name === name; });
  if (!subj) {
    subj = { id: uid(), name: name, color: nextSubjectColor(), exam: exam || '' };
    db.subjects.push(subj);
  }
  return subj;
}
function deduplicateTitle(title, usedTitles) {
  let final = title;
  let n = 2;
  while (usedTitles.has(final)) { final = title + '\uff08' + n + '\uff09'; n++; }
  usedTitles.add(final);
  return final;
}

// === 知识库 ===
// 搜索改为"就地过滤"：输入时只切换卡片可见性，不再整页 innerHTML 重建。
// 600+ 卡片时每次键入重建 6000+ DOM 节点是输入卡顿的主要来源。
// 干草堆按数据版本缓存：任何 save()（数据变更）后版本号 +1，下一次渲染才重建索引。
var _libHayCache = {};    // kwId -> {v: 数据版本, h: 小写拼接文本}
var _libHaystacks = [];   // 与 #kw-grid 内卡片顺序一一对应
var _libDataVer = 0;
var _liveFilterTimer = null;
var _libRenderLimit = 60; // 首屏只渲染 60 张，滚动到底部增量加载（千卡级首屏流畅）
var _libSentinel = null;
function _libLoadMore(){
  if(_libSentinel){ _libSentinel.disconnect(); _libSentinel = null; }
  _libRenderLimit += 60;
  renderLibrary();
}
function liveFilterLibrary(v){
  libFilter.search = String(v == null ? '' : v);
  clearTimeout(_liveFilterTimer);
  // 搜索即重建：renderLibrary 在搜索态渲染全部匹配项（匹配集小、干草堆有缓存）
  _liveFilterTimer = setTimeout(renderLibrary, 150);
}
function buildHaystacks(list){
  _libHaystacks = list.map(function(k){
    var c = _libHayCache[k.id];
    if(!c || c.v !== _libDataVer){
      c = _libHayCache[k.id] = { v: _libDataVer, h: (k.title+' '+k.content+' '+k.chapter+' '+((k.tags)||[]).join(' ')).toLowerCase() };
    }
    return c.h;
  });
}
function setLibSubject(id){ libFilter.subject = id; renderLibrary(); }
function renderLibrary(){
  if(!db||!db.knowledge) return;
  const el = document.getElementById('view-library');
  // 记录搜索框焦点与光标位置，innerHTML 全量重建后恢复，避免输入中断
  var prevSearch = document.getElementById('lib-search');
  var searchCaret = (prevSearch && document.activeElement === prevSearch) ? prevSearch.selectionStart : null;
  const tags = [...new Set(db.knowledge.flatMap(k=>k.tags))];
  let list = db.knowledge.slice();
  if(libFilter.subject!=='all') list = list.filter(k=>k.subjectId===libFilter.subject);
  if(libFilter.tag) list = list.filter(k=>k.tags.includes(libFilter.tag));
  if(libFilter.search){
    const q = libFilter.search.toLowerCase();
    list = list.filter(k=> (k.title+k.content+k.chapter+k.tags.join('')).toLowerCase().includes(q));
  }
  list.sort((a,b)=> (isDue(a)?0:1)-(isDue(b)?0:1) || a.nextReview.localeCompare(b.nextReview));
  buildHaystacks(list);
  // 搜索时必须全量匹配（干草堆覆盖全部卡片），无搜索时增量渲染
  var searching = !!libFilter.search;
  var shown = searching ? list : list.slice(0, _libRenderLimit);

  el.innerHTML = `
    <div class="filter-bar">
      <div class="search-box">
        <span class="s-ico">🔍</span>
        <input id="lib-search" placeholder="搜索标题 / 内容 / 标签…" value="${esc(libFilter.search)}" oninput="liveFilterLibrary(this.value)">
      </div>
      <div class="chip ${libFilter.subject==='all'?'active':''}" onclick="setLibSubject('all')">全部科目</div>
      ${db.subjects.map(s=>`<div class="chip ${libFilter.subject===s.id?'active':''}" onclick="setLibSubject('${s.id}')">${esc(s.name)}</div>`).join('')}
      <button class="btn btn-ghost" style="padding:9px 14px" onclick="document.getElementById('import-cards-file').click()">📥 导入卡片</button>
      <button class="btn btn-ghost" style="padding:9px 14px" onclick="exportCardPack()">📦 导出卡包</button>
      <button class="btn btn-ghost" style="padding:9px 14px" onclick="document.getElementById('import-pack-file').click()">📥 导入卡包</button>
      <button class="btn btn-primary" onclick="openKwModal()">＋ 新建知识点</button>
      <button class="btn btn-ghost" onclick="openAiCardModal()">🤖 AI 建卡</button>
    </div>
    ${tags.length?`<div class="filter-bar" style="margin-top:-6px">
      <span style="font-size:12px;color:var(--text-3)">标签：</span>
      ${tags.map(t=>`<div class="chip ${libFilter.tag===t?'active':''}" style="padding:5px 12px;font-size:12px" data-tag="${esc(t)}" onclick="libFilter.tag = libFilter.tag===this.dataset.tag ? '' : this.dataset.tag; renderLibrary()">${esc(t)}</div>`).join('')}
    </div>`:''}
    ${list.length? `<div class="kw-grid${searching?' no-anim':''}" id="kw-grid">${shown.map(kwCard).join('')}</div>`
      : `<div class="empty-state"><div class="big">🗂️</div><h3>没有找到相关知识点</h3><p>换个关键词试试，或者新建一个知识点</p></div>`}`;
  if(searchCaret != null){
    var newSearch = document.getElementById('lib-search');
    if(newSearch){ newSearch.focus(); try{ newSearch.setSelectionRange(searchCaret, searchCaret); }catch(e){} }
  }
  // 增量加载哨兵：滚动接近底部前 400px 预取下一批
  if(!searching && list.length > shown.length){
    if(_libSentinel){ _libSentinel.disconnect(); }
    var more = document.createElement('div');
    more.id = 'kw-more';
    more.style.cssText = 'text-align:center;padding:16px;color:var(--text-3);font-size:12.5px';
    more.textContent = '↓ 已显示 ' + shown.length + ' / ' + list.length + ' 张，继续滚动加载';
    el.appendChild(more);
    _libSentinel = new IntersectionObserver(function(entries){
      if(entries.some(function(en){ return en.isIntersecting; })) _libLoadMore();
    }, {rootMargin: '400px'});
    _libSentinel.observe(more);
  } else if(_libSentinel){ _libSentinel.disconnect(); _libSentinel = null; }
}
function kwCard(k){
  const s = getSubject(k.subjectId);
  const ml = masteryLevel(k);
  const t = todayStr();
  let dueCls, dueTxt;
  if(k.nextReview < t){ dueCls='today'; dueTxt='已逾期 '+diffDays(t,k.nextReview)+' 天'; }
  else if(k.nextReview===t){ dueCls='today'; dueTxt='今日待复习'; }
  else if(diffDays(k.nextReview,t)<=3){ dueCls='soon'; dueTxt=diffDays(k.nextReview,t)+' 天后复习'; }
  else { dueCls='later'; dueTxt=k.nextReview.slice(5).replace('-','/')+' 复习'; }
  return `<div class="kw-card" role="button" tabindex="0" style="--kc:${safeColor(s?s.color:'#6366f1')}" onclick="openKwDetail('${k.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openKwDetail('${k.id}')}">
    <div class="kw-head">
      <span class="kw-chapter">${esc(s?s.name:'')} · ${esc(k.chapter)}</span>
      <span class="kw-due ${dueCls}">${dueTxt}</span>
    </div>
    <div class="kw-title">${esc(k.title)}</div>
    <div class="kw-preview">${esc(String(k.content||'').slice(0,120))}</div>
    <div class="kw-foot">
      ${k.tags.map(tg=>`<span class="tag">${esc(tg)}</span>`).join('')}
      <span class="mastery" title="掌握度：${MASTERY_NAMES[ml]}">${[0,1,2,3].map(i=>`<i class="${i<=ml && k.stage>0 || i<ml ? 'on':''}"></i>`).join('')}</span>
    </div>
  </div>`;
}
function openKwDetail(id){
  const k = db.knowledge.find(x=>x.id===id);
  if(!k) return;
  const s = getSubject(k.subjectId);
  openModal(`
    <button class="modal-close" onclick="closeModal()">✕</button>
    <h3><span class="subj-dot" style="background:${safeColor(s?s.color:'#6366f1')};width:11px;height:11px"></span>${esc(k.title)}</h3>
    <div class="review-info">
      <span>📖 ${esc(s?s.name:'')} · ${esc(k.chapter)}</span>
      <span>🧠 ${cardStageLabel(k)}${k.fsrs&&k.fsrs.s?'（强度 '+k.fsrs.s.toFixed(1)+' 天）':''}</span>
      <span>📅 下次复习：${esc(k.nextReview)}</span>
      <span>📈 掌握度：${MASTERY_NAMES[masteryLevel(k)]}</span>
    </div>
    <div class="detail-content">${md(k.content)}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">${k.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>
    <div class="modal-actions">
      <button class="btn btn-ghost" style="color:var(--danger)" onclick="delKw('${k.id}')">删除</button>
      <button class="btn btn-ghost" onclick="openKwModal('${k.id}')">编辑</button>
      <button class="btn btn-primary" onclick="closeModal();startReview('${k.id}')">立即复习</button>
    </div>`);
}
function openKwModal(id){
  const k = id? db.knowledge.find(x=>x.id===id) : null;
  var kid = k? k.id : 'new';
  openModal(`
    <button class="modal-close" onclick="closeModal()">✕</button>
    <h3>${k?'✏️ 编辑知识点':'＋ 新建知识点'}</h3>
    <div class="form-2col">
      <div class="form-row"><label>所属科目</label>
        <select id="f-subject" onchange="saveKwDraft('${kid}')">${db.subjects.map(s=>`<option value="${s.id}" ${k&&k.subjectId===s.id?'selected':''}>${esc(s.name)}（${esc(s.exam)}）</option>`).join('')}</select>
      </div>
      <div class="form-row"><label>章节</label>
        <input id="f-chapter" placeholder="如：树与二叉树" value="${k?esc(k.chapter):''}" oninput="saveKwDraft('${kid}')">
      </div>
    </div>
    <div class="form-row"><label>标题</label><input id="f-title" placeholder="一句话概括这个知识点" value="${k?esc(k.title):''}" oninput="saveKwDraft('${kid}')"></div>
    <div class="form-row"><label>内容（支持 **加粗** 和 \`代码\`）</label><textarea id="f-content" rows="7" placeholder="用自己的话记录考点，记得更牢…" oninput="saveKwDraft('${kid}')">${k?esc(k.content):''}</textarea></div>
    <div class="form-row"><label>标签（用逗号分隔）</label><input id="f-tags" placeholder="如：高频考点, 计算题" value="${k?esc(k.tags.join(', ')):''}" oninput="saveKwDraft('${kid}')"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="saveKw('${k?k.id:''}')">${k?'保存修改':'创建并加入复习计划'}</button>
    </div>`);
  // 恢复上次未保存的草稿（误触关闭不丢内容）
  try{
    var d = JSON.parse(localStorage.getItem('yanxueku_draft_kw_'+kid)||'null');
    if(d && (d.title || d.content)){
      if(d.title != null) document.getElementById('f-title').value = d.title;
      if(d.content != null) document.getElementById('f-content').value = d.content;
      if(d.chapter != null) document.getElementById('f-chapter').value = d.chapter;
      if(d.tags != null) document.getElementById('f-tags').value = d.tags;
      if(d.subjectId) document.getElementById('f-subject').value = d.subjectId;
      toast('已恢复上次未保存的草稿','info');
    }
  }catch(e){}
}
// 草稿存取：任何字段输入即落 localStorage，保存成功后清除
function saveKwDraft(kid){
  try{
    var g = function(fid){ var e2 = document.getElementById(fid); return e2 ? e2.value : ''; };
    localStorage.setItem('yanxueku_draft_kw_'+(kid||'new'), JSON.stringify({
      subjectId: g('f-subject'), chapter: g('f-chapter'), title: g('f-title'), content: g('f-content'), tags: g('f-tags')
    }));
  }catch(e){}
}
function clearKwDraft(kid){ try{ localStorage.removeItem('yanxueku_draft_kw_'+(kid||'new')); }catch(e){} }
function saveKw(id){
  const subjectId = document.getElementById('f-subject').value;
  const chapter = document.getElementById('f-chapter').value.trim() || '未分章';
  const title = document.getElementById('f-title').value.trim();
  const content = document.getElementById('f-content').value.trim();
  const tags = document.getElementById('f-tags').value.split(/[,，]/).map(s=>s.trim()).filter(Boolean);
  if(!title){ toast('请填写标题','err'); return; }
  if(!content){ toast('请填写内容','err'); return; }
  if(id){
    const k = db.knowledge.find(x=>x.id===id);
    if(!k){ toast('知识点不存在或已被删除','err'); closeModal(); render(); return; }
    Object.assign(k, {subjectId, chapter, title, content, tags});
    toast('知识点已更新','ok');
  }else{
    db.knowledge.push({id:uid(), subjectId, chapter, title, content, tags, stage:0, nextReview:todayStr(), lastReview:null, createdAt:todayStr()});
    _analytics.kwCreated(subjectId, tags.length > 0);
    toast('已创建并加入今日复习 🎉','ok');
  }
  save(); closeModal(); clearKwDraft(id||'new'); render();
}
function delKw(id){
  const k = db.knowledge.find(x=>x.id===id);
  openModal(`
    <button class="modal-close" onclick="closeModal()">✕</button>
    <h3>⚠️ 确认删除</h3>
    <p style="color:var(--text-2);line-height:1.8">即将删除知识点「<b>${esc(k.title)}</b>」，删除后不可恢复，确定吗？</p>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" style="background:#ef4444" onclick="doDelKw('${id}')">确认删除</button>
    </div>`);
}
function doDelKw(id){
  db.knowledge = db.knowledge.filter(k=>k.id!==id);
  save(); closeModal(); render();
  toast('已删除','info');
}

/* ================= 艾宾浩斯复习 ================= */

// === 复习队列 ===
let reviewQueue = [], reviewIdx = 0, reviewDone = 0;
function startReview(focusId){
  let q = dueList();
  if(focusId){
    const k = db.knowledge.find(x=>x.id===focusId);
    q = k? [k] : [];
  }
  if(!q.length){ toast('今日没有待复习内容，太棒了！🎉','ok'); return; }
  const total = q.length;
  if(!focusId && q.length > 10) q = q.slice(0,10); // 逾期积压分批：先复习最旧的 10 张，完成后自动继续
  reviewQueue = q; reviewIdx = 0; reviewDone = 0;
  _analytics.reviewStart(q.length);
  switchView('review');
  if(focusId){ toast('开始复习该知识点','info'); }
  else if(total > q.length){ toast(`今日待复习 ${total} 张，先复习最旧的 ${q.length} 张，完成后自动继续`,'info'); }
  else { toast(`本轮共 ${q.length} 张，预计约 ${Math.ceil(q.length*1.5)} 分钟`,'info'); }
}
function renderReviewHome(){
  if(!db||!db.knowledge) return;
  const el = document.getElementById('view-review');
  if(!reviewQueue.length || reviewIdx>=reviewQueue.length){
    const due = dueList();
    if(!due.length){
      el.innerHTML = `<div class="empty-state"><div class="big">🎉</div><h3>今日复习任务全部完成</h3><p>保持节奏，艾宾浩斯会帮你把知识焊在脑子里</p>
        <button class="btn btn-primary" style="margin-top:18px" onclick="switchView('dashboard')">回到仪表盘</button></div>`;
    }else{
      reviewQueue = due; reviewIdx = 0; reviewDone = 0;
      renderFlashcard(); return;
    }
    return;
  }
  renderFlashcard();
}
function renderFlashcard(){
  const el = document.getElementById('view-review');
  const k = reviewQueue[reviewIdx];
  const s = getSubject(k.subjectId);
  el.innerHTML = `
    <div class="review-wrap">
      <div class="review-progress">
        <span class="rp-text">进度 ${reviewIdx+1} / ${reviewQueue.length}</span>
        <div class="rp-bar"><div class="rp-fill" style="width:${Math.round(reviewIdx/reviewQueue.length*100)}%"></div></div>
        <span class="rp-text" style="color:var(--success)">已完成 ${reviewDone}</span>
      </div>
      <div class="flashcard" id="fcard" onclick="this.classList.toggle('flipped')">
        <div class="fc-inner">
          <div class="fc-face fc-front">
            <span class="fc-chapter">${esc(s?s.name:'')} · ${esc(k.chapter)} · ${cardStageLabel(k)}</span>
            <div class="fc-title">${esc(k.title)}</div>
            <div class="fc-hint">👆 点击卡片查看答案（翻卡后可按 1/2/3/4 评分）</div>
          </div>
          <div class="fc-face fc-back">
            <span class="fc-chapter" style="align-self:center">${esc(k.title)}</span>
            <div class="fc-content">${md(k.content)}</div>
          </div>
        </div>
      </div>
      <div class="grade-row">
        <button class="grade-btn g-forgot" onclick="grade(0,event)">😵 忘记了<small>${engineMode()==='fsrs'?'重置进度':'明天重新复习'}</small></button>
        <button class="grade-btn g-blur" onclick="grade(1,event)">🤔 有点模糊<small>缩短间隔巩固</small></button>
        <button class="grade-btn g-good" onclick="grade(2,event)">😎 记得牢固<small>正常推进</small></button>
        ${engineMode()==='fsrs'?'<button class="grade-btn g-easy" onclick="grade(3,event)">🚀 轻松<small>大幅拉长间隔</small></button>':''}
      </div>
    </div>`;
}
function grade(level, ev){
  ev.stopPropagation();
  const k = reviewQueue[reviewIdx];
  if(!k){  // 卡片已被删除（如另一设备同步后）：跳过而不是崩溃
    reviewIdx++;
    if(reviewIdx >= reviewQueue.length){ reviewQueue = []; renderReviewHome(); }
    else { renderFlashcard(); }
    return;
  }
  const today = todayStr();
  if(engineMode()==='fsrs'){
    applyFsrsGrade(k, Math.min(level,3), today);
  } else {
    level = Math.min(level,2);   // 经典引擎只有三档
    if(level===0){ k.stage = 0; k.nextReview = addDays(today, 1); }
    else if(level===1){ const iv = Math.max(1, Math.round(EBB[Math.min(k.stage,6)]/2)); k.nextReview = addDays(today, iv); }
    else { k.stage = Math.min(k.stage+1, EBB.length-1); k.nextReview = addDays(today, EBB[k.stage]); }
  }
  k.lastReview = today;
  reviewDone++;
  addStudy(2);
  save();
  reviewIdx++;
  if(reviewIdx >= reviewQueue.length){
    addStudy(3);
    const el = document.getElementById('view-review');
    el.innerHTML = `<div class="empty-state"><div class="big">🏆</div><h3>本轮复习完成！</h3>
      <p>共复习 ${reviewDone} 个知识点，遗忘曲线已更新</p>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:18px">
        <button class="btn btn-ghost" onclick="switchView('dashboard')">回到仪表盘</button>
        <button class="btn btn-primary" onclick="switchView('quiz')">去刷几道题巩固一下</button>
      </div></div>`;
    reviewQueue = [];
    _analytics.reviewComplete(reviewDone);
    renderBadges();
    toast(`本轮复习完成，记忆进度已更新 ✅`,'ok');
  }else{
    renderFlashcard();
    renderBadges();
  }
}

/* ================= 数据统计 ================= */
function renderStats(){
  if(!db||!db.studyLog) return;
  const el = document.getElementById('view-stats');
  const t = todayStr();
  // 近14天
  const days = [];
  for(let i=13;i>=0;i--){
    const d = addDays(t,-i);
    const rec = db.studyLog.find(r=>r.date===d);
    days.push({d, m: rec?rec.minutes:0});
  }
  const totalMin = db.studyLog.reduce((s,r)=>s+r.minutes,0);
  // 掌握度分布
  const dist = [0,0,0,0];
  db.knowledge.forEach(k=> dist[masteryLevel(k)]++);
  el.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn btn-ghost" style="color:var(--warn)" onclick="resetStats()">🔄 重置学习数据</button>
    </div>
    <div class="grid-stats" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
      <div class="stat-card" style="--sc:var(--grad)"><div class="stat-num">${db.knowledge.length}</div><div class="stat-label">知识点总数</div></div>
      <div class="stat-card" style="--sc:#0ea5e9"><div class="stat-num">${db.quizRecords.length}</div><div class="stat-label">累计答题次数</div></div>
      <div class="stat-card" style="--sc:#f59e0b"><div class="stat-num">${Math.floor(totalMin/60)}<small> 时 </small>${totalMin%60}<small> 分</small></div><div class="stat-label">累计学习时长</div></div>
      <div class="stat-card" style="--sc:#10b981"><div class="stat-num">${db.knowledge.length?Math.round(dist[3]/db.knowledge.length*100):0}<small> %</small></div><div class="stat-label">知识点掌握率</div></div>
    </div>
    <div class="stats-grid">
      <div class="panel">
        <div class="panel-title">📈 近 14 天学习时长（分钟）</div>
        <canvas id="chart-days"></canvas>
      </div>
      <div class="panel">
        <div class="panel-title">🧠 知识点掌握度分布</div>
        <div class="donut-wrap">${donutSVG(dist)}<div class="legend">
          ${MASTERY_NAMES.map((n,i)=>`<div class="legend-item"><span class="dot" style="background:${MASTERY_COLORS[i]}"></span>${n}<b>${dist[i]}</b></div>`).join('')}
        </div></div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-title">📚 各科目掌握进度</div>
      ${db.subjects.map(s=>{
        const ks = db.knowledge.filter(k=>k.subjectId===s.id);
        if(!ks.length) return '';
        const avg = ks.reduce((sum,k)=>sum+masteryLevel(k),0)/ks.length/3*100;
        const due = ks.filter(isDue).length;
        return `<div class="subj-bar-row">
          <div class="subj-bar-head"><b><span class="subj-dot" style="background:${safeColor(s.color)};display:inline-block;margin-right:6px"></span>${esc(s.name)}</b>
          <span>${ks.length} 个知识点 · ${due} 个待复习 · 掌握 ${Math.round(avg)}%</span></div>
          <div class="subj-bar"><i style="width:${Math.round(avg)}%;background:${safeColor(s.color)}"></i></div>
        </div>`;
      }).join('')}
    </div>
    ${renderHeatmap()}`;
  drawBarChart(days);
  _deferRaf(function(){ animateStatNums(el); });
  // 完整排行榜（仪表盘 Top3 的"查看完整排行"入口指向这里）
  _defer(function(){
    const el = document.getElementById('view-stats');
    if(el && !el.querySelector('#leaderboard-panel')){
      const div = document.createElement('div');
      div.innerHTML = '<div class="panel" style="margin-top:20px"><div class="panel-title">🏅 学习排行榜 <span class="sub"><span class="chip'+(_lbMode==='week'?' active':'')+'" style="padding:3px 14px" onclick="renderLeaderboard(\'week\')">近7天</span> <span class="chip'+(_lbMode==='total'?' active':'')+'" style="padding:3px 14px" onclick="renderLeaderboard(\'total\')">累计</span></span></div><div id="leaderboard-panel"></div></div>';
      el.appendChild(div); renderLeaderboard();
    }
  }, 60);
}
/* ================= 知识掌握热力图 ================= */
function heatCellStyle(v){
  if(v < 20) return 'background:var(--surface-2);color:var(--text-3)';
  if(v < 40) return 'background:rgba(239,68,68,.14);color:#dc2626';
  if(v < 60) return 'background:rgba(245,158,11,.16);color:#b45309';
  if(v < 80) return 'background:rgba(132,204,22,.2);color:#4d7c0f';
  return 'background:rgba(16,185,129,.22);color:#047857';
}
function renderHeatmap(){
  if(!db || !db.knowledge || !db.knowledge.length){
    return '<div class="panel"><div class="panel-title">🔥 知识掌握热力图</div><div class="empty-state" style="padding:30px 10px"><p>先在知识库里添加知识点，这里会按章节展示掌握强弱</p></div></div>';
  }
  var bySubject = {};
  db.knowledge.forEach(function(k){
    if(!bySubject[k.subjectId]) bySubject[k.subjectId] = [];
    bySubject[k.subjectId].push(k);
  });
  var html = '<div class="panel" onclick="heatmapClick(event)"><div class="panel-title">🔥 知识掌握热力图 <span class="sub">记得程度 × 记忆强度 · 点击章节直达</span></div>';
  html += '<div style="display:flex;gap:6px;align-items:center;font-size:11px;color:var(--text-3);margin-bottom:14px"><span>弱</span>' +
    [15,35,55,75,95].map(function(v){ return '<span style="width:28px;height:12px;border-radius:4px;display:inline-block;'+heatCellStyle(v)+'"></span>'; }).join('') +
    '<span>强</span></div>';
  var any = false;
  db.subjects.forEach(function(s){
    var ks = bySubject[s.id];
    if(!ks || !ks.length) return;
    any = true;
    var chapters = {};
    ks.forEach(function(k){ var c = k.chapter || '未分章'; (chapters[c] = chapters[c] || []).push(k); });
    var subjAvg = Math.round(ks.reduce(function(sum,k){ return sum + cardHeat(k); },0) / ks.length);
    html += '<div class="heat-block"><div class="heat-head"><b>' + esc(s.name) + '</b>' +
      '<span style="font-size:11px;color:var(--text-3)">' + ks.length + ' 张 · 均 ' + subjAvg + '</span></div>';
    html += '<div class="heat-grid" data-sid="'+escAttr(s.id)+'">';
    Object.keys(chapters).forEach(function(c){
      var arr = chapters[c];
      var avg = Math.round(arr.reduce(function(sum,k){ return sum + cardHeat(k); },0) / arr.length);
      html += '<div class="heat-cell" style="'+heatCellStyle(avg)+'" data-ch="'+escAttr(c)+'" title="'+esc(c)+' · '+arr.length+' 张 · 平均掌握 '+avg+'">' +
        '<div class="h-val">'+avg+'</div><div class="h-name">'+esc(c)+'</div></div>';
    });
    html += '</div></div>';
  });
  if(!any) return '';
  return html + '</div>';
}
function heatmapClick(ev){
  var cell = ev.target.closest('.heat-cell'); if(!cell) return;
  var grid = cell.closest('.heat-grid'); if(!grid) return;
  openChapter(grid.getAttribute('data-sid'), cell.getAttribute('data-ch'));
}
function openChapter(sid, ch){
  libFilter.subject = sid; libFilter.search = ch || ''; libFilter.tag = '';
  switchView('library');
}
function donutSVG(dist){
  const total = dist.reduce((a,b)=>a+b,0) || 1;
  const R = 52, C = 2*Math.PI*R;
  let off = 0;
  const segs = dist.map((v,i)=>{
    if(!v) return '';
    const len = v/total*C;
    const s = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${MASTERY_COLORS[i]}" stroke-width="16"
      stroke-dasharray="${len} ${C-len}" stroke-dashoffset="${-off}" style="transition:stroke-dasharray .8s"/>`;
    off += len; return s;
  }).join('');
  return `<svg width="140" height="140" viewBox="0 0 140 140" style="transform:rotate(-90deg)">${segs}
    <circle cx="70" cy="70" r="36" fill="var(--surface)"/></svg>`;
}
function drawBarChart(days){
  const canvas = document.getElementById('chart-days');
  if(!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const chartWidth = canvas.clientWidth, chartHeight = 260;
  canvas.width = chartWidth*dpr; canvas.height = chartHeight*dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr,dpr);
  const dark = document.documentElement.getAttribute('data-theme')==='dark';
  const cText = dark? '#a3a9c9' : '#5a5f7a';
  const cGrid = dark? '#272b47' : '#e6e8f2';
  const max = Math.max(10, ...days.map(d=>d.m));
  const padL = 34, padB = 26, padT = 14, padR = 8;
  const colWidth = (chartWidth-padL-padR)/days.length;
  // 网格线
  ctx.strokeStyle = cGrid; ctx.fillStyle = cText; ctx.lineWidth = 1;
  ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
  for(let g=0; g<=4; g++){
    const y = padT + (chartHeight-padT-padB)*g/4;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(chartWidth-padR, y); ctx.stroke();
    ctx.fillText(Math.round(max*(4-g)/4), padL-6, y+3);
  }
  // 柱子
  const grad = ctx.createLinearGradient(0,padT,0,chartHeight-padB);
  grad.addColorStop(0,'#6366f1'); grad.addColorStop(1,'#8b5cf6');
  days.forEach((d,i)=>{
    const bh = d.m/max*(chartHeight-padT-padB);
    const x = padL + i*colWidth + colWidth*0.2, w = colWidth*0.6;
    const y = chartHeight-padB-bh;
    ctx.fillStyle = d.m? grad : cGrid;
    ctx.beginPath();
    const r = Math.min(5, w/2);
    if(bh>0){
      ctx.moveTo(x, y+r); ctx.arcTo(x, y, x+r, y, r); ctx.arcTo(x+w, y, x+w, y+r, r);
      ctx.lineTo(x+w, chartHeight-padB); ctx.lineTo(x, chartHeight-padB); ctx.closePath(); ctx.fill();
    }else{
      ctx.fillRect(x, chartHeight-padB-2, w, 2);
    }
    ctx.fillStyle = cText; ctx.textAlign = 'center'; ctx.font = '9.5px sans-serif';
    ctx.fillText(d.d.slice(5).replace('-','/'), padL+i*colWidth+colWidth/2, chartHeight-padB+14);
    if(d.m>0){ ctx.font = 'bold 9.5px sans-serif'; ctx.fillText(d.m, padL+i*colWidth+colWidth/2, y-4); }
  });
}

/* ================= 卡片文本导入（真经笔记 OCR 格式） ================= */
let pendingCards = null;
function cleanCardTitle(t){
  return String(t||'').trim()
    .replace(/^[（(]?[一二三四五六七八九十百]+[）)、．.]\s*/, '')
    .replace(/^\d+[、．.]\s*/, '')
    .trim();
}
function parseCardsText(text){
  text = String(text).replace(/^\uFEFF/, '');
  const HDR = /(?:20\d{2}\s*)?真经新闻史笔记[丨|1lI」]?\s*大伟的学习重要性提醒[：:]\s*([一二两三四五])星/g;
  const NOISE = [
    /(?:20\d{2}\s*)?真经新闻史笔记[丨|1lI」]?\s*大伟的学习重要性提醒[：:]\s*[一二两三四五]星/g,
    /20\d{2}\s*新传考研真经中国新闻史课程配套讲义[，,]?\s*仅供内部交流/g,
    /新传考研真经同行/g
  ];
  const lines = text.split(/\r?\n/);
  let chapter = '未分章';
  const cards = [];
  lines.forEach(raw=>{
    const line = raw.trim();
    if(!line) return;
    if(line.startsWith('#')){
      chapter = line.replace(/^#+\s*/, '').trim() || chapter;
      return;
    }
    const idx = line.indexOf('|');
    const head = idx>=0 ? line.slice(0, idx) : '';
    const body = (idx>=0 ? line.slice(idx+1) : line).trim();
    HDR.lastIndex = 0;
    const pts = [];
    let m;
    while((m = HDR.exec(body)) !== null){ if(m.index > 0) pts.push(m.index); }
    const segs = [];
    let prev = 0;
    pts.forEach(p=>{ segs.push(body.slice(prev, p)); prev = p; });
    segs.push(body.slice(prev));
    segs.forEach((seg, si)=>{
      let title = si===0 ? cleanCardTitle(head) : '';
      let star = '';
      const sm = seg.match(/重要性提醒[：:]\s*([一二两三四五])星/);
      if(sm) star = sm[1]+'星';
      let content = seg;
      NOISE.forEach(rx=>{ content = content.replace(rx, ' '); });
      content = content.replace(/\s+/g, ' ').trim();
      const pm = content.match(/^[（(][一二三四五六七八九十]+[）)]\s*([^【]{1,30}?)(?=【)/);
      if(pm){ title = pm[1].trim(); content = content.slice(pm[0].length).trim(); }
      if(!title || title.replace(/[《》<>「」“”"'\s]/g,'').length < 2){
        const bm = content.match(/《[^》]{1,20}》/);
        if(bm) title = bm[0];
        else{
          const fm = content.match(/^【[^】]*】\s*[“"]?([^，。；：]{2,15})/);
          title = fm ? fm[1].trim() : '卡片 ' + (cards.length+1);
        }
      }
      if(content.length < 10) return;
      cards.push({chapter, title, content, star});
    });
  });
  return cards;
}
function importCardsFile(ev){
  const f = ev.target.files[0];
  ev.target.value = '';
  if(!f) return;
  const reader = new FileReader();
  reader.onload = e=>{
    const cards = parseCardsText(e.target.result);
    if(!cards.length){ toast('未解析到任何卡片，请检查文件格式','err'); return; }
    pendingCards = cards;
    showCardsImportPreview(f.name);
  };
  reader.readAsText(f);
}
function showCardsImportPreview(fname){
  const cards = pendingCards;
  const guess = /新闻史|新传|新闻/.test(fname + cards.map(c=>c.chapter).join('')) ? '中国新闻史' : fname.replace(/\.[^.]+$/,'');
  const byChapter = {};
  cards.forEach(c=>{ byChapter[c.chapter] = (byChapter[c.chapter]||0)+1; });
  const seen = {};
  const dup = cards.filter(c=>{
    const existed = db.knowledge.some(k=>k.title===c.title) || seen[c.title];
    seen[c.title] = true;
    return existed;
  }).length;
  openModal(`
    <button class="modal-close" onclick="closeModal()">✕</button>
    <h3>📥 导入预览</h3>
    <div class="form-row"><label>导入到科目（不存在则自动创建）</label>
      <input id="imp-subject" value="${esc(guess)}">
    </div>
    <div class="review-info">
      <span>📄 ${esc(fname)}</span>
      <span>🗂️ 共 <b>${cards.length}</b> 张卡片 · ${Object.keys(byChapter).length} 个章节</span>
      ${dup?`<span style="color:var(--warn)">⚠️ ${dup} 张同名卡片将自动加序号区分</span>`:''}
    </div>
    <div style="max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:12px;padding:12px 16px;background:var(--surface-2)">
      ${Object.entries(byChapter).map(([ch,n])=>`
        <div style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px dashed var(--border)">
          <span>${esc(ch)}</span><b style="color:var(--primary)">${n} 张</b>
        </div>`).join('')}
    </div>
    <div style="font-size:12px;color:var(--text-3);margin-top:10px;line-height:1.7">
      星级标记将转为标签（如「两星」）；全部卡片进入今日复习队列。导入后可随时在知识库中编辑修正。
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="confirmCardsImport()">确认导入 ${cards.length} 张卡片</button>
    </div>`);
}
function confirmCardsImport(){
  const name = document.getElementById('imp-subject').value.trim() || '导入科目';
  const subj = findOrCreateSubject(name);
  let added = 0;
  const t = todayStr();
  const usedTitles = new Set(db.knowledge.filter(k=>k.subjectId===subj.id).map(k=>k.title));
  pendingCards.forEach(c=>{
    const title = deduplicateTitle(c.title, usedTitles);
    const tags = ['真经笔记'];
    if(c.star) tags.push(c.star);
    db.knowledge.push({
      id: uid(), subjectId: subj.id, chapter: String(c.chapter || '未分章').slice(0,100),
      title: title.slice(0,200), content: String(c.content || '').slice(0,20000),
      tags: tags.slice(0,20), stage: 0, nextReview: t, lastReview: null, createdAt: t
    });
    added++;
  });
  pendingCards = null;
  save(); closeModal();
  libFilter.subject = subj.id;
  switchView('library');
  toast(`成功导入 ${added} 张卡片 🎉`,'ok');
}

/* ====== v5: 用户系统 + 排行榜 + 收藏 ====== */
// 收藏以 db.stars 为准（随云端同步）；此处理合并 localStorage 遗留数据兜底
let _starred = new Set(Array.isArray(db && db.stars) ? db.stars : []);
try{
  (JSON.parse(localStorage.getItem('yanxueku_stars') || '[]') || []).forEach(function(id){ _starred.add(id); });
}catch(e){}

function renderSidebarUser(){
  var el = document.getElementById('sidebar-user-area'); if(!el) return;
  if(_currentUser && _profile){
    el.innerHTML = '<div class="side-user"><div class="avatar" style="background:'+safeColor(_profile.avatar_color)+'">'+(esc(_profile.display_name||'?').charAt(0))+'</div><div class="info"><div class="name">'+esc(_profile.display_name||'考研人')+'</div><div class="email">'+esc(_currentUser.email)+'</div></div><div class="actions"><button onclick="openProfileModal()" title="编辑资料">⚙</button><button onclick="signOut()" title="退出登录">↩</button></div></div>';
  }else{
    el.innerHTML = '<div class="side-user" style="cursor:pointer;justify-content:center" onclick="openAuthModal()"><span style="color:var(--primary);font-weight:600;font-size:13px">👤 登录 / 注册</span></div>';
  }
}
var __orig_rs = renderSidebar; renderSidebar = function(){ __orig_rs(); renderSidebarUser(); };


// === 认证 UI 状态 ===
let _authMode = 'login';        // login / signup
let _authSubmitting = false;    // 防重复提交
let _loginFails = 0;            // 登录失败计数（内存级，仅本标签页生效）
let _loginLockUntil = 0;        // 连续失败后的临时锁定截止时间
function validateEmail(s){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s==null?'':s).trim()); }
function cleanEmail(s){ return String(s==null?'':s).replace(/[\u200B-\u200D\uFEFF\u00A0\u3000]/g,'').trim(); }
// Supabase/GoTrue 错误中文化：避免用户看到英文错误码（如 invalid / rate limit exceeded）
function authErrorMsg(err){
  if(!err) return '操作失败，请重试';
  const code = String(err.error_code||err.code||err.status||'');
  if(/rate_limit|over_email|too_many/i.test(code)) return '请求过于频繁，请稍后再试（邮箱发送限额）';
  if(code==='captcha_failed'||/captcha/i.test(code)) return '人机验证未通过，请刷新后重试';
  if(code==='email_address_invalid') return '邮箱地址格式无效，请检查后重试';
  if(code==='user_already_exists'||code==='user_exists') return '该邮箱已注册，请直接登录';
  if(code==='invalid_credentials') return '邮箱或密码错误';
  if(code==='weak_password'||/password/i.test(code)) return '密码强度不足，请使用至少 8 位包含字母和数字的密码';
  const m = String(err.message||'');
  if(/captcha/i.test(m)) return '人机验证未通过，请刷新后重试';
  if(/rate limit|too many requests/i.test(m)) return '请求过于频繁，请稍后再试';
  if(/already registered|already exists/i.test(m)) return '该邮箱已注册，请直接登录';
  if(/invalid format|invalid email/i.test(m)) return '邮箱地址格式无效，请检查后重试';
  return m || '操作失败，请重试';
}
function validatePassword(p){ return String(p==null?'':p).length >= 8; }

/* ===== Cloudflare Turnstile 人机验证（尽力而为模式） =====
 * 设计：Turnstile 可用时强制人机验证；不可用时（SDK 加载失败 /
 * 渲染失败 / 10 秒未完成验证=Cloudflare 连不上）自动降级放行，
 * 不阻塞注册 —— 面向国内用户，challenges.cloudflare.com 访问不稳定
 * 前提：Supabase 侧 CAPTCHA 需关闭强制校验（否则无 token 请求被 400 拒）
 */

// === 认证与 Turnstile ===
const TURNSTILE_SITE_KEY = _cfg.TURNSTILE_SITE_KEY || ''; // Cloudflare Turnstile Site Key（从 config.js 读取，空字符串表示关闭）
let _captchaToken = null;
let _turnstileWidget = null;
let _turnstileSDKLoading = false;
let _captchaDegraded = false;      // true = Turnstile 不可用，允许跳过验证
let _captchaDegradeTimer = null;
function loadTurnstileSDK(cb){
  if(window.turnstile){ cb(); return; }
  if(_turnstileSDKLoading){ return; }
  _turnstileSDKLoading = true;
  var s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  s.async = true;
  s.onload = function(){ _turnstileSDKLoading = false; cb(); };
  s.onerror = function(){ _turnstileSDKLoading = false; _captchaDegraded = true; }; // SDK 加载失败 → 降级放行
  document.head.appendChild(s);
}
function renderTurnstile(){
  if(!TURNSTILE_SITE_KEY || !window.turnstile) return;
  var holder = document.getElementById('auth-captcha');
  if(!holder || _turnstileWidget) return;
  _captchaToken = null;
  _captchaDegraded = false;
  try{
    _turnstileWidget = window.turnstile.render(holder, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: document.documentElement.getAttribute('data-theme')==='dark' ? 'dark' : 'light',
      callback: function(token){ _captchaToken = token; if(_captchaDegradeTimer){ clearTimeout(_captchaDegradeTimer); _captchaDegradeTimer = null; } },
      'expired-callback': function(){ _captchaToken = null; },
      'error-callback': function(){ _captchaToken = null; }
    });
    // 降级超时：10 秒内未完成验证（多半是 Cloudflare 连不上）→ 允许跳过
    _captchaDegradeTimer = setTimeout(function(){
      if(!_captchaToken) _captchaDegraded = true;
    }, 10000);
  }catch(e){
    _captchaDegraded = true; // 渲染异常 → 降级放行
  }
}
function resetTurnstile(){
  if(_turnstileWidget && window.turnstile){ try{ window.turnstile.reset(_turnstileWidget); }catch(e){} }
  _captchaToken = null; _captchaDegraded = false;
  if(_captchaDegradeTimer){ clearTimeout(_captchaDegradeTimer); _captchaDegradeTimer = null; }
}
function destroyTurnstile(){
  if(_turnstileWidget && window.turnstile){ try{ window.turnstile.remove(_turnstileWidget); }catch(e){} }
  _turnstileWidget = null; _captchaToken = null; _captchaDegraded = false;
  if(_captchaDegradeTimer){ clearTimeout(_captchaDegradeTimer); _captchaDegradeTimer = null; }
}
function renderAuthModal(){
  const isLogin = _authMode === 'login';
  destroyTurnstile();
  const m =
    '<button class="modal-close" onclick="closeModal()">✕</button>'+
    '<div style="text-align:center;padding:12px 0 20px">'+
    '<h3 style="font-size:20px;margin:0 0 6px;font-weight:700;color:var(--text)">'+(isLogin?'欢迎回来 👋':'创建你的研学库账号')+'</h3>'+
    '<p style="font-size:13px;color:var(--text-3);margin:0;line-height:1.6">'+(isLogin?'继续你的考研学习之旅，今天也要加油':'开启科学备考新体验，3分钟起步')+'</p></div>'+
    (isLogin?'':'<div class="form-row"><label>昵称（选填）</label><input id="auth-name" placeholder="怎么称呼你？"></div>')+
    '<div class="form-row"><label>邮箱</label><input id="auth-email" type="email" placeholder="you@example.com" value="'+esc(_authTempEmail)+'"></div>'+
    '<div class="form-row"><label>密码（≥8位）</label><div class="pwd-wrap"><input id="auth-password" type="password" placeholder="至少 8 位"><button class="pwd-eye" onclick="togglePwd()" title="显示/隐藏密码">👁</button></div></div>'+
    (isLogin?'':'<div class="form-row"><label>确认密码</label><input id="auth-confirm" type="password" placeholder="再输入一次密码"></div>')+
    (isLogin?'':'<div class="form-row"><div id="auth-captcha"></div></div>')+
    (isLogin?'':'<label style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--text-3);margin:8px 0 16px;line-height:1.5;cursor:pointer"><input type="checkbox" id="auth-agree" style="margin-top:2px;flex-shrink:0"><span>我已阅读并同意 <a href="privacy.html" target="_blank" style="color:var(--primary)">《隐私政策》</a>和 <a href="terms.html" target="_blank" style="color:var(--primary)">《服务条款及免责声明》</a></span></label>')+
    '<div class="modal-actions">'+
    '<button class="btn btn-ghost" onclick="toggleAuthMode()">'+(isLogin?'去注册':'去登录')+'</button>'+
    '<button class="btn btn-primary" id="auth-submit" onclick="'+(isLogin?'doLogin':'doSignUp')+'()">'+(isLogin?'登录':'注册')+'</button>'+
    '</div>';
  openModal(m);
  if(!isLogin && TURNSTILE_SITE_KEY) loadTurnstileSDK(renderTurnstile);
}
let _authTempEmail = ''; // 登录/注册切换时保留已输入邮箱
function toggleAuthMode(){
  const ei = document.getElementById('auth-email');
  if(ei) _authTempEmail = ei.value;
  _authMode = _authMode === 'login' ? 'signup' : 'login';
  renderAuthModal();
}
function togglePwd(){
  const inp = document.getElementById('auth-password');
  if(inp) inp.type = inp.type === 'password' ? 'text' : 'password';
}
function openAuthModal(){
  _authMode = 'login';
  _authSubmitting = false;
  renderAuthModal();
}
function setAuthLoading(on){
  const b = document.getElementById('auth-submit');
  if(!b) return;
  if(on){ b.disabled = true; b.dataset.orig = b.textContent; b.textContent = '处理中…'; }
  else { b.disabled = false; b.textContent = b.dataset.orig || b.textContent; }
}
async function doLogin(){
  const e = cleanEmail(document.getElementById('auth-email').value);
  const p = document.getElementById('auth-password').value;
  if(!validateEmail(e)){ toast('请输入有效的邮箱地址','err'); return; }
  if(!validatePassword(p)){ toast('密码长度至少 8 位','err'); return; }
  if(!sb){ toast(_supabaseFailed ? '云服务加载失败，请检查网络后刷新重试' : '正在连接云服务，请稍后再试','err'); return; }
  if(Date.now() < _loginLockUntil){ toast('尝试过于频繁，请 ' + Math.ceil((_loginLockUntil - Date.now())/1000) + ' 秒后再试','warn'); return; }
  if(_authSubmitting) return;
  _authSubmitting = true; setAuthLoading(true);
  let loginOk = false;
  try{
    const r = await sb.auth.signInWithPassword({email:e, password:p}); // 登录无需验证码
    if(r.error){ resetTurnstile(); _loginFails++; if(_loginFails >= 5){ _loginLockUntil = Date.now() + 30000; _loginFails = 0; toast('失败次数过多，已临时锁定 30 秒','warn'); } else { toast(authErrorMsg(r.error),'err'); } return; }
    loginOk = true; _loginFails = 0;
    _sessionVerified = true;   // 刚用真实凭据登录，无需再验
    toast('登录成功 ✅','ok');
  }catch(err){
    // signInWithPassword 可能已建立 session 但 promise 抛异常（如 session 持久化失败），
    // 此时不能误报"网络错误"——用 _currentUser 兜底判断是否其实已登录
    console.warn('[auth] signInWithPassword threw:', err && err.message);
    if(!_currentUser){ toast('网络错误，请检查网络后重试','err'); return; }
  }
  finally{ _authSubmitting = false; setAuthLoading(false); }
  // 登录成功（或异常但已登录）：主动关弹窗+隐藏登录墙+渲染，不依赖 onAuthStateChange 时序
  if(loginOk || _currentUser){ destroyTurnstile(); closeModal(); hideGate(); render(); }
}
async function doSignUp(){
  const e = cleanEmail(document.getElementById('auth-email').value);
  const p = document.getElementById('auth-password').value;
  const nEl = document.getElementById('auth-name');
  const n = nEl ? nEl.value.trim()||e.split('@')[0] : e.split('@')[0];
  const cpEl = document.getElementById('auth-confirm');
  const cp = cpEl ? cpEl.value : p;
  if(!validateEmail(e)){ toast('请输入有效的邮箱地址','err'); return; }
  if(!validatePassword(p)){ toast('密码长度至少 8 位','err'); return; }
  if(cpEl && p !== cp){ toast('两次输入的密码不一致','err'); return; }
  var agreeEl = document.getElementById('auth-agree');
  if(agreeEl && !agreeEl.checked){ toast('请阅读并同意隐私政策和服务条款','warn'); return; }
  if(!sb){ toast(_supabaseFailed ? '云服务加载失败，请检查网络后刷新重试' : '正在连接云服务，请稍后再试','err'); return; }
  if(TURNSTILE_SITE_KEY && !_captchaToken && !_captchaDegraded){
    // 区分"验证码还在加载"与"加载完成但未验证"：避免用户看不到验证码却被提示"请完成验证"
    if(_turnstileSDKLoading || !_turnstileWidget){ toast('人机验证加载中，请稍候…','info'); return; }
    toast('请先完成人机验证','err'); return;
  }
  if(_authSubmitting) return;
  _authSubmitting = true; setAuthLoading(true);
  let signupOk = false;
  try{
    const r = await sb.auth.signUp({email:e, password:p, options:{data:{display_name:n}, captchaToken:_captchaToken||undefined}});
    if(r.error){ resetTurnstile(); toast(authErrorMsg(r.error),'err'); return; }
    signupOk = true;
    _sessionVerified = true;   // 刚用真实凭据注册，无需再验
    toast(r.data.session?'注册成功 ✅':'注册成功！请到邮箱确认 📧','ok');
  }catch(err){
    console.warn('[auth] signUp threw:', err && err.message);
    if(!_currentUser){ toast('网络错误，请检查网络后重试','err'); return; }
  }
  finally{ _authSubmitting = false; setAuthLoading(false); }
  // 注册成功（或异常但已登录）：主动关弹窗+隐藏登录墙+渲染，注册即进入应用
  if(signupOk || _currentUser){ destroyTurnstile(); closeModal(); hideGate(); render(); }
}
async function signOut(){
  if(!sb) return;
  _currentUser=null; _profile=null; _sessionVerified=false;
  if(_rtChannel){ try{ sb.removeChannel(_rtChannel); }catch(e){} _rtChannel=null; }
  try{ await sb.auth.signOut(); }catch(e){}
  // 清空本机该账号的痕迹（云端副本仍安全保留），防止同浏览器下一个账号注册/登录时被误同步
  try{ localStorage.removeItem(STORAGE_KEY); localStorage.removeItem('yanxueku_v1'); }catch(e){}
  db = blankDb();
  renderSidebarUser(); switchView('dashboard'); toast('已退出','info');
}
function openProfileModal(){
  if(!_profile){ toast('请先登录','err'); return; }
  openModal('<button class="modal-close" onclick="closeModal()">✕</button><h3>👤 个人资料</h3>'+
    '<div class="form-row"><label>显示名称</label><input id="pf-name" value="'+esc(_profile.display_name||'')+'"></div>'+
    '<div class="form-row"><label>头像颜色</label><div class="color-picker" id="pf-colors"></div><input type="hidden" id="pf-color" value="'+(_profile.avatar_color||'#6366f1')+'"></div>'+
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="saveProfile()">保存</button></div>');
  setTimeout(function(){
    var colors=['#6366f1','#e11d48','#0ea5e9','#f59e0b','#10b981','#8b5cf6','#0891b2','#ca8a04'];
    var el=document.getElementById('pf-colors');
    if(el) el.innerHTML=colors.map(function(c){return '<span style="background:'+c+'" data-color="'+c+'" onclick="var p=this.parentElement;p.querySelectorAll(&apos;span&apos;).forEach(function(s){s.classList.remove(&apos;sel&apos;)});this.classList.add(&apos;sel&apos;);document.getElementById(&apos;pf-color&apos;).value=&apos;'+c+'&apos;"></span>';}).join('');
  },10);
}
async function saveProfile(){
  if(!sb||!_currentUser){ toast('未登录','err'); return; }
  var n=(document.getElementById('pf-name').value.trim()||'考研人').slice(0,30); // 昵称限长防滥用
  var c=safeColor(document.getElementById('pf-color').value)||'#6366f1';        // 颜色白名单防 CSS 注入
  try{
    await sb.from('profiles').upsert({user_id:_currentUser.id, display_name:n, avatar_color:c});
    _profile={display_name:n, avatar_color:c}; closeModal(); renderSidebarUser(); toast('资料已更新','ok');
  }catch(e){ toast('保存失败，请重试','err'); }
}

/* ===== 我的（账号 · 偏好 · 数据） ===== */
function renderMine(){
  const el = document.getElementById('view-mine');
  if(!el) return;
  const ac = safeColor(_profile? _profile.avatar_color : '#6366f1');
  const nm = esc(_profile? _profile.display_name : '考研人');
  const em = esc(_currentUser? _currentUser.email : '');
  el.innerHTML = `
    <div class="panel" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <div class="avatar" style="width:56px;height:56px;font-size:22px;background:${ac}">${nm.charAt(0)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:17px;font-weight:700">${nm}</div>
        <div style="font-size:13px;color:var(--text-3)">${em}</div>
      </div>
      <button class="btn btn-ghost" onclick="openProfileModal()">✏️ 编辑资料</button>
    </div>
    <div class="panel">
      <div class="panel-title">🔑 账号安全</div>
      <button class="btn btn-ghost" style="justify-content:flex-start;width:100%" onclick="openAccountModal()">🔒 修改密码 / 修改邮箱</button>
    </div>
    <div class="panel">
      <div class="panel-title">🎛 偏好设置</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">
        <button class="btn btn-ghost" onclick="toggleEngine()" id="engine-btn">🧠 记忆引擎：${engineMode()==='fsrs'?'FSRS 自适应':'经典艾宾浩斯'}</button>
        <button class="btn btn-ghost" onclick="cycleRetention()" id="retention-btn">🎯 记忆目标：${Math.round(fsrsRetention()*100)}%</button>
        <button class="btn btn-ghost" onclick="openAiCardModal()">🤖 AI 建卡</button>
        <button class="btn btn-ghost" onclick="openAiSettings()">⚙️ AI 设置${aiConfigured()?'（已启用）':''}</button>
        <button class="btn btn-ghost" onclick="openGoalSetter()">🎯 每日复习目标</button>
        <button class="btn btn-ghost" onclick="openExamDatePicker()">📅 考研日期</button>
        <button class="btn btn-ghost" onclick="openHotkeyHelp()">⌨️ 快捷键</button>
      </div>
    </div>
    <div class="panel">
      <div class="panel-title">💾 数据管理</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">
        <button class="btn btn-ghost" onclick="exportData()">⬇ 导出数据</button>
        <button class="btn btn-ghost" onclick="document.getElementById('import-file').click()">⬆ 恢复备份</button>
        <button class="btn btn-ghost" onclick="cycleTheme()">🌓 切换主题</button>
      </div>
    </div>
    <div style="text-align:center;margin-top:10px">
      <button class="btn" style="background:rgba(239,68,68,.12);color:var(--danger)" onclick="signOut()">退出登录</button>
    </div>
    <div style="text-align:center;margin-top:12px;font-size:12px;color:var(--text-3)">研学库 <b>${APP_VERSION}</b> · 数据格式 v${DATA_VERSION}</div>`;
}

// Note: boot sequence (applyTheme + load + render) runs from core.js

/* ================= 公共课程库 ================= */
var _pubLib = null, _pubLibLoading = false, _pubLibSubject = null;

/* 加载公共课程库（缓存到内存） */
function loadPublicLibrary(cb){
  if(_pubLib){ cb(_pubLib); return; }
  if(_pubLibLoading) return; // 正在加载中不重复请求
  _pubLibLoading = true;
  var el = document.getElementById('view-public-library');
  el.innerHTML = '<div class="plib-header"><h2>🏛️ 公共课程库</h2></div><div class="plib-subject-grid">' +
    '<div class="skel-card"></div><div class="skel-card"></div><div class="skel-card"></div>' +
    '<div class="skel-card"></div><div class="skel-card"></div><div class="skel-card"></div></div>';

  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'public-library.json?v=3.0.0-beta.7', true);
  xhr.onload = function(){
    _pubLibLoading = false;
    if(xhr.status >= 200 && xhr.status < 300){
      try {
        _pubLib = JSON.parse(xhr.responseText);
        _pubLib._total = _pubLib.subjects.reduce(function(n,s){ return n + (s.cardCount||0); }, 0);
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
    html += '<div style="font-size:13px;color:var(--text-3);margin-bottom:16px">热门考研专业课知识卡 · 共 <b>'+lib.subjects.length+'</b> 科 <b>'+lib._total+'</b> 张 · 点击科目查看详情并导入</div>';
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
        html += '<div class="plib-kw-item" data-preview-title="'+escAttr(c.title)+'" data-preview-content="'+escAttr(c.content)+'" onclick="showPubLibKwPreview(this)">' +
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

function showPubLibKwPreview(el){
  var title = el.getAttribute('data-preview-title') || '';
  var content = el.getAttribute('data-preview-content') || '';
  openModal(
    '<button class="modal-close" onclick="closeModal()">✕</button>' +
    '<div class="plib-kw-preview">' +
      '<h4>'+esc(title)+'</h4>' +
      '<div class="content">'+md(content)+'</div>' +
    '</div>'
  );
}

function importPubLibSubject(subjectId){
  loadPublicLibrary(function(lib){
    var s = (lib.subjects || []).find(function(x){ return x.id === subjectId; });
    if(!s){ toast('科目数据未找到','err'); return; }
    var appSubj = findOrCreateSubject(s.name, s.exam);

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

// ===== Post-boot wrappers（在目标函数定义后执行） =====
// 卡片背面提供"挖空模式"开关按钮（是否自动开启由用户点击决定）
if(typeof renderFlashcard === 'function'){
  const _origRF = renderFlashcard;
  renderFlashcard = function(){
    _origRF();
    blanksMode = false;
    blankAnswers = [];
    _deferRaf(function(){
      var fc = document.getElementById('fcard');
      var back = document.querySelector('.fc-back');
      if(back && !back.querySelector('.blanks-toggle')){
        var btn = document.createElement('div');
        // 类名必须含 blanks-toggle：与下方防重查寻一致，否则每次渲染会插出重复按钮
        btn.className = 'blank-count blanks-toggle';
        btn.style.cssText = 'cursor:pointer;color:var(--primary);font-weight:600;margin-bottom:8px';
        btn.textContent = '🔍 挖空模式（关闭）';
        btn.onclick = function(e){
          e.stopPropagation();
          toggleBlanksMode();
          this.textContent = blanksMode ? '🔍 挖空模式（开启）' : '🔍 挖空模式（关闭）';
        };
        back.insertBefore(btn, back.firstChild);
      }
    });
  };
}

// 知识卡片收藏按钮
if(typeof kwCard === 'function'){
  const _origKC = kwCard;
  kwCard = function(k){
    var on = _starred.has(k.id);
    var star = '<button class="kw-star' + (on?' on':'') + '" onclick="toggleStar(\'' + k.id + '\',event)" title="收藏">' + (on?'⭐':'☆') + '</button>';
    return _origKC(k).replace('>', '>' + star);
  };
}

/* ================= AI 建卡 / AI 设置（能力实现在 ai.js） ================= */
function openAiSettings(){
  var c = aiCfg();
  openModal(
    '<button class="modal-close" onclick="closeModal()">✕</button>'+
    '<h3>⚙️ AI 能力设置</h3>'+
    '<div style="font-size:12px;color:var(--text-3);line-height:1.7;margin-bottom:12px">'+
    '连接任意 OpenAI 兼容接口（DeepSeek / 智谱 / Kimi / OpenAI 等）。密钥仅保存在本机浏览器 localStorage，'+
    '由浏览器直连提供商，研学库服务器不经手密钥与内容。</div>'+
    '<div class="form-row"><label>接口地址（Base URL，https）</label><input id="ai-base" placeholder="如：https://api.deepseek.com" value="'+esc(c.base)+'"></div>'+
    '<div class="form-row"><label>模型</label><input id="ai-model" placeholder="如：deepseek-chat / glm-4-flash" value="'+esc(c.model)+'"></div>'+
    '<div class="form-row"><label>API Key</label><input id="ai-key" type="password" placeholder="sk-…" value="'+esc(c.key)+'"></div>'+
    '<div class="modal-actions">'+
      '<button class="btn btn-ghost" id="ai-test-btn" onclick="aiTestConnectionBtn(this)">测试连接</button>'+
      '<button class="btn btn-ghost" onclick="closeModal()">取消</button>'+
      '<button class="btn btn-primary" onclick="saveAiSettings()">保存</button>'+
    '</div>');
}
function saveAiSettings(){
  var b = sanitizeAiBase(document.getElementById('ai-base').value);
  var m = document.getElementById('ai-model').value.trim();
  var k = document.getElementById('ai-key').value.trim();
  if(b === null){ toast('接口地址必须是 https://（本机自建模型可用 http://localhost），且不能包含用户名密码','err'); return; }
  saveAiCfg(b, m, k);
  toast(aiConfigured() ? 'AI 能力已启用 ✅' : '已保存（信息不完整时 AI 功能停用）','ok');
  closeModal(); render();
}
async function aiTestConnectionBtn(btn){
  var b = document.getElementById('ai-base').value.trim().replace(/\/+$/,'');
  var m = document.getElementById('ai-model').value.trim();
  var k = document.getElementById('ai-key').value.trim();
  if(!b || !m || !k){ toast('请先完整填写三项','warn'); return; }
  saveAiCfg(b, m, k);
  btn.disabled = true; var old = btn.textContent; btn.textContent = '连接中…';
  try{
    var ms = await testAiConnectionReq();
    toast('连接成功，延迟 ' + ms + 'ms ✅','ok');
  }catch(e){ toast('连接失败：' + e.message,'err'); }
  btn.disabled = false; btn.textContent = old;
}
function openAiCardModal(){
  if(!db || !db.subjects || !db.subjects.length){ toast('请先创建至少一个科目','err'); return; }
  if(!aiConfigured()){
    openModal({
      title: '🤖 AI 建卡',
      body: '<div style="color:var(--text-2);line-height:1.9;font-size:13px">AI 建卡需要先配置一个 OpenAI 兼容接口'+
            '（DeepSeek / 智谱 / Kimi / OpenAI 等）。密钥仅保存在本机浏览器，直连提供商。</div>',
      actions: [
        { text:'去配置', class:'btn btn-primary', onclick:'closeModal(); openAiSettings();' },
        { text:'取消', class:'btn btn-ghost', onclick:'closeModal();' }
      ]
    });
    return;
  }
  var opts = db.subjects.map(function(s){ return '<option value="'+s.id+'">'+esc(s.name)+'</option>'; }).join('');
  openModal(
    '<button class="modal-close" onclick="closeModal()">✕</button>'+
    '<h3>🤖 AI 建卡</h3>'+
    '<div class="form-2col">'+
      '<div class="form-row"><label>导入科目</label><select id="ai-subject">'+opts+'</select></div>'+
      '<div class="form-row"><label>生成数量</label><select id="ai-count"><option>3</option><option selected>5</option><option>8</option></select></div>'+
    '</div>'+
    '<div class="form-row"><label>素材（粘贴教材 / 讲义 / 笔记片段，至少 50 字）</label>'+
    '<textarea id="ai-source" rows="9" placeholder="把教材段落粘贴到这里，AI 会整理成结构化知识卡片，预览后可勾选导入…"></textarea></div>'+
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">取消</button>'+
    '<button class="btn btn-primary" id="ai-gen-btn" onclick="aiGenerateCardsBtn(this)">开始生成</button></div>');
}
async function aiGenerateCardsBtn(btn){
  var srcText = document.getElementById('ai-source').value.trim();
  if(srcText.length < 50){ toast('素材太短，至少 50 字','warn'); return; }
  var subjectId = document.getElementById('ai-subject').value;
  var count = parseInt(document.getElementById('ai-count').value, 10) || 5;
  btn.disabled = true; var old = btn.textContent; btn.textContent = 'AI 整理中…（约 10-30 秒）';
  try{
    var subjectName = (getSubject(subjectId) || {}).name || '';
    var cards = await aiGenerateCardsReq(srcText, count, subjectName);
    if(!cards.length) throw new Error('未能解析出有效卡片，请换个素材或稍后再试');
    _aiPendingCards = cards.map(function(c){ c.subjectId = subjectId; return c; });
    renderAiCardPreview(cards);
  }catch(e){
    toast('生成失败：' + e.message, 'err');
    btn.disabled = false; btn.textContent = old;
  }
}
function renderAiCardPreview(cards){
  var list = cards.map(function(c, i){
    return '<label class="ai-pick-row" style="display:flex;gap:10px;align-items:flex-start;cursor:pointer;padding:12px 14px;margin-bottom:8px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2)">'+
      '<input type="checkbox" class="ai-pick" checked style="margin-top:3px">'+
      '<span style="flex:1;min-width:0"><b style="font-size:13.5px">'+esc(c.title)+'</b>'+
      '<span style="font-size:11px;color:var(--text-3);margin-left:8px">'+esc(c.chapter)+'</span>'+
      '<div style="font-size:12px;color:var(--text-2);margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">'+esc(String(c.content).slice(0,150))+'</div></span></label>';
  }).join('');
  openModal(
    '<button class="modal-close" onclick="closeModal()">✕</button>'+
    '<h3>🤖 生成预览（'+cards.length+' 张，勾选后导入）</h3>'+
    '<div style="max-height:46vh;overflow-y:auto">'+list+'</div>'+
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal(); _aiPendingCards=null;">取消</button>'+
    '<button class="btn btn-primary" onclick="aiImportSelected()">导入选中卡片</button></div>');
}
function aiImportSelected(){
  var boxes = document.querySelectorAll('.ai-pick');
  var cards = (_aiPendingCards || []).filter(function(c, i){ return boxes[i] && boxes[i].checked; });
  if(!cards.length){ toast('请至少勾选一张卡片','warn'); return; }
  var t = todayStr(), used = new Set(), added = 0;
  cards.forEach(function(c){
    var title = deduplicateTitle(c.title, used);
    db.knowledge.push({
      id: uid(), subjectId: c.subjectId, chapter: c.chapter || '未分章', title: title,
      content: c.content, tags: c.tags || [], stage: 0,
      nextReview: t, lastReview: null, createdAt: t
    });
    added++;
  });
  _aiPendingCards = null;
  save(); closeModal();
  libFilter.subject = 'all'; libFilter.search = '';
  switchView('library');
  toast('已导入 ' + added + ' 张 AI 卡片，全部进入今日复习队列 ✅', 'ok');
}
