/* 研学库 Views v2.1.1 — All render functions: Library, Review, Stats, Mine, Auth */
/* ================= 知识库 ================= */
let _searchTimer = null;
function debounceSearch(v){ // 搜索防抖：连续输入只触发一次全量渲染
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(function(){ libFilter.search = v; renderLibrary(); }, 250);
}
function setLibSubject(id){ libFilter.subject = id; renderLibrary(); }
function renderLibrary(){
  if(!db||!db.knowledge) return;
  const el = document.getElementById('view-library');
  const tags = [...new Set(db.knowledge.flatMap(k=>k.tags))];
  let list = db.knowledge.slice();
  if(libFilter.subject!=='all') list = list.filter(k=>k.subjectId===libFilter.subject);
  if(libFilter.tag) list = list.filter(k=>k.tags.includes(libFilter.tag));
  if(libFilter.search){
    const q = libFilter.search.toLowerCase();
    list = list.filter(k=> (k.title+k.content+k.chapter+k.tags.join('')).toLowerCase().includes(q));
  }
  list.sort((a,b)=> (isDue(a)?0:1)-(isDue(b)?0:1) || a.nextReview.localeCompare(b.nextReview));

  el.innerHTML = `
    <div class="filter-bar">
      <div class="search-box">
        <span class="s-ico">🔍</span>
        <input placeholder="搜索标题 / 内容 / 标签…" value="${esc(libFilter.search)}" oninput="debounceSearch(this.value)">
      </div>
      <div class="chip ${libFilter.subject==='all'?'active':''}" onclick="setLibSubject('all')">全部科目</div>
      ${db.subjects.map(s=>`<div class="chip ${libFilter.subject===s.id?'active':''}" onclick="setLibSubject('${s.id}')">${esc(s.name)}</div>`).join('')}
      <button class="btn btn-ghost" style="padding:9px 14px" onclick="document.getElementById('import-cards-file').click()">📥 导入卡片</button>
      <button class="btn btn-ghost" style="padding:9px 14px" onclick="exportCardPack()">📦 导出卡包</button>
      <button class="btn btn-ghost" style="padding:9px 14px" onclick="document.getElementById('import-pack-file').click()">📥 导入卡包</button>
      <button class="btn btn-primary" onclick="openKwModal()">＋ 新建知识点</button>
    </div>
    ${tags.length?`<div class="filter-bar" style="margin-top:-6px">
      <span style="font-size:12px;color:var(--text-3)">标签：</span>
      ${tags.map(t=>`<div class="chip ${libFilter.tag===t?'active':''}" style="padding:5px 12px;font-size:12px" data-tag="${esc(t)}" onclick="libFilter.tag = libFilter.tag===this.dataset.tag ? '' : this.dataset.tag; renderLibrary()">${esc(t)}</div>`).join('')}
    </div>`:''}
    ${list.length? `<div class="kw-grid">${list.map(kwCard).join('')}</div>`
      : `<div class="empty-state"><div class="big">🗂️</div><h3>没有找到相关知识点</h3><p>换个关键词试试，或者新建一个知识点</p></div>`}`;
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
    <div class="kw-preview">${esc(k.content).slice(0,120)}</div>
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
      <span>🧠 记忆阶段：${EBB_LABEL[Math.min(k.stage,6)]}</span>
      <span>📅 下次复习：${k.nextReview}</span>
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
  openModal(`
    <button class="modal-close" onclick="closeModal()">✕</button>
    <h3>${k?'✏️ 编辑知识点':'＋ 新建知识点'}</h3>
    <div class="form-2col">
      <div class="form-row"><label>所属科目</label>
        <select id="f-subject">${db.subjects.map(s=>`<option value="${s.id}" ${k&&k.subjectId===s.id?'selected':''}>${esc(s.name)}（${esc(s.exam)}）</option>`).join('')}</select>
      </div>
      <div class="form-row"><label>章节</label>
        <input id="f-chapter" placeholder="如：树与二叉树" value="${k?esc(k.chapter):''}">
      </div>
    </div>
    <div class="form-row"><label>标题</label><input id="f-title" placeholder="一句话概括这个知识点" value="${k?esc(k.title):''}"></div>
    <div class="form-row"><label>内容（支持 **加粗** 和 \`代码\`）</label><textarea id="f-content" rows="7" placeholder="用自己的话记录考点，记得更牢…">${k?esc(k.content):''}</textarea></div>
    <div class="form-row"><label>标签（用逗号分隔）</label><input id="f-tags" placeholder="如：高频考点, 计算题" value="${k?esc(k.tags.join(', ')):''}"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="saveKw('${k?k.id:''}')">${k?'保存修改':'创建并加入复习计划'}</button>
    </div>`);
}
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
    Object.assign(k, {subjectId, chapter, title, content, tags});
    toast('知识点已更新','ok');
  }else{
    db.knowledge.push({id:uid(), subjectId, chapter, title, content, tags, stage:0, nextReview:todayStr(), lastReview:null, createdAt:todayStr()});
    _analytics.kwCreated(subjectId, tags.length > 0);
    toast('已创建并加入今日复习 🎉','ok');
  }
  save(); closeModal(); render();
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
            <span class="fc-chapter">${esc(s?s.name:'')} · ${esc(k.chapter)} · ${EBB_LABEL[Math.min(k.stage,6)]}</span>
            <div class="fc-title">${esc(k.title)}</div>
            <div class="fc-hint">👆 点击卡片查看答案</div>
          </div>
          <div class="fc-face fc-back">
            <span class="fc-chapter" style="align-self:center">${esc(k.title)}</span>
            <div class="fc-content">${md(k.content)}</div>
          </div>
        </div>
      </div>
      <div class="grade-row">
        <button class="grade-btn g-forgot" onclick="grade(0,event)">😵 忘记了<small>明天重新复习</small></button>
        <button class="grade-btn g-blur" onclick="grade(1,event)">🤔 有点模糊<small>缩短间隔再巩固</small></button>
        <button class="grade-btn g-good" onclick="grade(2,event)">😎 记得牢固<small>进入下一记忆阶段</small></button>
      </div>
    </div>`;
}
function grade(g, ev){
  ev.stopPropagation();
  const k = reviewQueue[reviewIdx];
  const t = todayStr();
  if(g===0){ k.stage = 0; k.nextReview = addDays(t, 1); }
  else if(g===1){ const iv = Math.max(1, Math.round(EBB[Math.min(k.stage,6)]/2)); k.nextReview = addDays(t, iv); }
  else { k.stage = Math.min(k.stage+1, EBB.length-1); k.nextReview = addDays(t, EBB[k.stage]); }
  k.lastReview = t;
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
    </div>`;
  drawBarChart(days);
  // 完整排行榜（仪表盘 Top3 的"查看完整排行"入口指向这里）
  _defer(function(){
    const el = document.getElementById('view-stats');
    if(el && !el.querySelector('#leaderboard-panel')){
      const div = document.createElement('div');
      div.innerHTML = '<div class="panel" style="margin-top:20px"><div class="panel-title">🏅 学习排行榜 <span class="sub" onclick="renderLeaderboard()" style="cursor:pointer;color:var(--primary)">刷新</span></div><div id="leaderboard-panel"></div></div>';
      el.appendChild(div); renderLeaderboard();
    }
  }, 60);
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
  const cv = document.getElementById('chart-days');
  if(!cv) return;
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = 260;
  cv.width = W*dpr; cv.height = H*dpr;
  const ctx = cv.getContext('2d');
  ctx.scale(dpr,dpr);
  const dark = document.documentElement.getAttribute('data-theme')==='dark';
  const cText = dark? '#a3a9c9' : '#5a5f7a';
  const cGrid = dark? '#272b47' : '#e6e8f2';
  const max = Math.max(10, ...days.map(d=>d.m));
  const padL = 34, padB = 26, padT = 14, padR = 8;
  const cw = (W-padL-padR)/days.length;
  // 网格线
  ctx.strokeStyle = cGrid; ctx.fillStyle = cText; ctx.lineWidth = 1;
  ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
  for(let g=0; g<=4; g++){
    const y = padT + (H-padT-padB)*g/4;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W-padR, y); ctx.stroke();
    ctx.fillText(Math.round(max*(4-g)/4), padL-6, y+3);
  }
  // 柱子
  const grad = ctx.createLinearGradient(0,padT,0,H-padB);
  grad.addColorStop(0,'#6366f1'); grad.addColorStop(1,'#8b5cf6');
  days.forEach((d,i)=>{
    const bh = d.m/max*(H-padT-padB);
    const x = padL + i*cw + cw*0.2, w = cw*0.6;
    const y = H-padB-bh;
    ctx.fillStyle = d.m? grad : cGrid;
    ctx.beginPath();
    const r = Math.min(5, w/2);
    if(bh>0){
      ctx.moveTo(x, y+r); ctx.arcTo(x, y, x+r, y, r); ctx.arcTo(x+w, y, x+w, y+r, r);
      ctx.lineTo(x+w, H-padB); ctx.lineTo(x, H-padB); ctx.closePath(); ctx.fill();
    }else{
      ctx.fillRect(x, H-padB-2, w, 2);
    }
    ctx.fillStyle = cText; ctx.textAlign = 'center'; ctx.font = '9.5px sans-serif';
    ctx.fillText(d.d.slice(5).replace('-','/'), padL+i*cw+cw/2, H-padB+14);
    if(d.m>0){ ctx.font = 'bold 9.5px sans-serif'; ctx.fillText(d.m, padL+i*cw+cw/2, y-4); }
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
  let subj = db.subjects.find(s=>s.name===name);
  if(!subj){
    const palette = ['#e11d48','#7c3aed','#0891b2','#ca8a04','#16a34a','#dc2626','#2563eb'];
    subj = {id: uid(), name, color: palette[db.subjects.length % palette.length], exam:'新闻与传播'};
    db.subjects.push(subj);
  }
  let added = 0;
  const t = todayStr();
  const usedTitles = new Set(db.knowledge.filter(k=>k.subjectId===subj.id).map(k=>k.title));
  pendingCards.forEach(c=>{
    let title = c.title, n = 2;
    while(usedTitles.has(title)){ title = c.title + '（' + n + '）'; n++; }
    usedTitles.add(title);
    const tags = ['真经笔记'];
    if(c.star) tags.push(c.star);
    db.knowledge.push({
      id: uid(), subjectId: subj.id, chapter: c.chapter, title, content: c.content,
      tags, stage: 0, nextReview: t, lastReview: null, createdAt: t
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
let _starred = new Set(JSON.parse(localStorage.getItem('yanxueku_stars')||'[]'));

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
    '<div style="text-align:center;margin-bottom:16px">'+
    '<div class="gate-logo-sm">研</div>'+
    '<h3 style="font-size:18px;margin:0">'+(isLogin?'欢迎回来':'创建你的研学库账号')+'</h3>'+
    '<div style="font-size:12px;color:var(--text-3);margin-top:4px">'+(isLogin?'继续你的考研学习之旅':'开启科学备考新体验')+'</div></div>'+
    (isLogin?'':'<div class="form-row"><label>昵称（选填）</label><input id="auth-name" placeholder="怎么称呼你？"></div>')+
    '<div class="form-row"><label>邮箱</label><input id="auth-email" type="email" placeholder="you@example.com" value="'+esc(_authTempEmail)+'"></div>'+
    '<div class="form-row"><label>密码（≥8位）</label><div class="pwd-wrap"><input id="auth-password" type="password" placeholder="至少 8 位"><button class="pwd-eye" onclick="togglePwd()" title="显示/隐藏密码">👁</button></div></div>'+
    (isLogin?'':'<div class="form-row"><label>确认密码</label><input id="auth-confirm" type="password" placeholder="再输入一次密码"></div>')+
    (isLogin?'':'<div class="form-row"><div id="auth-captcha"></div></div>')+
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
  if(_authSubmitting) return;
  _authSubmitting = true; setAuthLoading(true);
  let loginOk = false;
  try{
    const r = await sb.auth.signInWithPassword({email:e, password:p}); // 登录无需验证码
    if(r.error){ resetTurnstile(); toast(authErrorMsg(r.error),'err'); return; }
    loginOk = true;
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
  _currentUser=null; _profile=null;
  try{ await sb.auth.signOut(); }catch(e){}
  // 登出保留本地数据：把当前 db 写回 localStorage（不重置为示例数据，避免数据丢失）
  try{ localStorage.setItem('yanxueku_v1', JSON.stringify(db)); }catch(e){}
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
        <button class="btn btn-ghost" onclick="openGoalSetter()">🎯 每日复习目标</button>
        <button class="btn btn-ghost" onclick="openExamDatePicker()">📅 考研日期</button>
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

/* ====== 按钮波纹 ====== */
document.addEventListener('click', function(e){
  var el = e.target.closest('.btn,.grade-btn,.mini-btn,.chip,.nav-item,.q-opt,.opt-card');
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

// ===== Post-boot wrappers（在目标函数定义后执行） =====
// 翻卡后默认开启挖空模式
if(typeof renderFlashcard === 'function'){
  var _origRF = renderFlashcard;
  renderFlashcard = function(){
    _origRF();
    blanksMode = false;
    blankAnswers = [];
    _deferRaf(function(){
      var fc = document.getElementById('fcard');
      var back = document.querySelector('.fc-back');
      if(fc){
        fc.addEventListener('click', function autoBlanks(){
          if(fc.classList.contains('flipped')){
            toggleBlanksMode();
            fc.removeEventListener('click', autoBlanks);
          }
        }, {once: false});
      }
      if(back && !back.querySelector('.blanks-toggle')){
        var btn = document.createElement('div');
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
  };
}

// 知识卡片收藏按钮
if(typeof kwCard === 'function'){
  var _origKC = kwCard;
  kwCard = function(k){
    var on = _starred.has(k.id);
    var star = '<button class="kw-star' + (on?' on':'') + '" onclick="toggleStar(\'' + k.id + '\',event)" title="收藏">' + (on?'⭐':'☆') + '</button>';
    return _origKC(k).replace('>', '>' + star);
  };
}
