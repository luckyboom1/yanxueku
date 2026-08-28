/* 研学库 Quiz v2.4 — Quiz engine + adaptive analysis */

// === 测验状态 ===
let quiz = null;
let quizCfg = {subject:'all', count:10, mode:'smart'}; // mode: random | smart | weak

// 题型元数据（单一数据源，消除重复 map）
const QUESTION_TYPE_META = {
  single: {label:'单选题', icon:'📝'},
  judge:  {label:'判断题', icon:'⚖️'},
  fill:   {label:'填空题', icon:'✏️'},
  short:  {label:'简答题', icon:'💬'}
};
const QUIZ_LETTERS = 'ABCDEFGHIJ'; // 卡包导入允许最多 10 个选项，'ABCD' 会取到 undefined
function typeLabel(q){ return (QUESTION_TYPE_META[q.type] || QUESTION_TYPE_META.single).label; }
function typeIcon(q) { return (QUESTION_TYPE_META[q.type] || QUESTION_TYPE_META.single).icon; }

// 输入题评分（消除 answerInputQ 与 redoWrongInput 中的重复逻辑）
function scoreUserAnswer(userAnswer, q) {
  var std = String(q.answer || '');
  if (q.type === 'fill') {
    return userAnswer.replace(/\s+/g,'').toLowerCase() === std.replace(/\s+/g,'').toLowerCase();
  }
  var keywords = std.split(';').filter(function(k){ return k.trim(); });
  if (!keywords.length) return userAnswer.length >= 5;
  var lower = userAnswer.toLowerCase();
  var matched = keywords.filter(function(kw){ return lower.indexOf(kw.trim().toLowerCase()) !== -1; }).length;
  return matched / keywords.length >= 0.5;
}

function renderQuizHome(){
  if(!db||!db.questions) return;
  const el = document.getElementById('view-quiz');
  if(quiz && quiz.idx < quiz.list.length){ renderQuestion(); return; }
  el.innerHTML = `
    <div class="quiz-setup panel">
      <div class="panel-title">📝 组卷设置</div>
      <div style="font-size:13px;font-weight:600;color:var(--text-2);margin-bottom:4px">选择科目</div>
      <div class="opt-grid">
        <div class="opt-card ${quizCfg.subject==='all'?'sel':''}" onclick="quizCfg.subject='all';renderQuizHome()">全部科目</div>
        ${db.subjects.map(s=>`<div class="opt-card ${quizCfg.subject===s.id?'sel':''}" onclick="quizCfg.subject='${s.id}';renderQuizHome()">${esc(s.name)}（${db.questions.filter(q=>q.subjectId===s.id).length}题）</div>`).join('')}
      </div>
      <div style="font-size:13px;font-weight:600;color:var(--text-2);margin-bottom:4px">选题模式</div>
      <div class="opt-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="opt-card ${quizCfg.mode==='smart'?'sel':''}" onclick="quizCfg.mode='smart';renderQuizHome()">🧠 智能</div>
        <div class="opt-card ${quizCfg.mode==='weak'?'sel':''}" onclick="quizCfg.mode='weak';renderQuizHome()">🎯 弱项</div>
        <div class="opt-card ${quizCfg.mode==='random'?'sel':''}" onclick="quizCfg.mode='random';renderQuizHome()">🎲 随机</div>
      </div>
      <div style="font-size:13px;font-weight:600;color:var(--text-2);margin-bottom:4px">题目数量</div>
      <div class="opt-grid">
        ${[5,10,20].map(n=>`<div class="opt-card ${quizCfg.count===n?'sel':''}" onclick="quizCfg.count=${n};renderQuizHome()">${n} 题</div>`).join('')}
      </div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;padding:14px;font-size:14px" onclick="startQuiz()">🚀 开始自测</button>
      ${renderQuizAnalysis()}
      <div style="text-align:center;font-size:12px;color:var(--text-3);margin-top:12px">答错的题目会自动进入错题本</div>
    </div>`;
}
function startQuiz(){
  let pool = db.questions.slice();
  if(quizCfg.subject!=='all') pool = pool.filter(q=>q.subjectId===quizCfg.subject);
  if(!pool.length){ toast('该科目暂无题目','err'); return; }
  // 智能 / 弱项 / 随机 三种模式
  if(quizCfg.mode==='smart'){
    pool = selectSmartQuiz(pool, Math.min(quizCfg.count, pool.length));
  }else if(quizCfg.mode==='weak'){
    pool = selectWeakFocusQuiz(pool, Math.min(quizCfg.count, pool.length), quizCfg.subject==='all'?null:quizCfg.subject);
  }else{
    // Fisher-Yates 洗牌：sort(random) 的偏差会让题目分布不均
    for(var i = pool.length - 1; i > 0; i--){
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    pool = pool.slice(0, Math.min(quizCfg.count, pool.length));
  }
  quiz = {list:pool, idx:0, right:0};
  _analytics.quizStart(quizCfg.subject, pool.length);
  renderQuestion();
}
function renderQuestion(){
  const el = document.getElementById('view-quiz');
  const q = quiz.list[quiz.idx];
  const s = getSubject(q.subjectId);
  var typeLabelText = typeLabel(q);
  var typeIconText = typeIcon(q);
  const isInput = q.type === 'fill' || q.type === 'short';

  var answerArea = '';
  if (q.type === 'single' || q.type === 'judge') {
    const opts = q.type==='judge' ? ['正确','错误'] : q.options;
    answerArea = `<div id="q-opts">
      ${opts.map((o,i)=>`<div class="q-opt" onclick="answerQ(${i})"><span class="key">${q.type==='judge'?(i===0?'✓':'✗'):(QUIZ_LETTERS[i]||String(i+1))}</span><span>${esc(o)}</span></div>`).join('')}
    </div>`;
  } else if (q.type === 'fill') {
    answerArea = `
      <div id="q-opts">
        <input type="text" class="q-input" id="q-fill-input" placeholder="请输入答案…" autocomplete="off" onkeydown="if(event.key==='Enter')answerInputQ()">
        <button class="q-submit-btn" onclick="answerInputQ()">✓ 提交答案</button>
      </div>`;
  } else if (q.type === 'short') {
    answerArea = `
      <div id="q-opts">
        <textarea class="q-input" id="q-short-input" style="min-height:80px;resize:vertical" placeholder="请输入你的回答…" onkeydown="if(event.key==='Enter'&&event.ctrlKey)answerInputQ()"></textarea>
        <button class="q-submit-btn" onclick="answerInputQ()">✓ 提交答案</button>
        <div style="font-size:11px;color:var(--text-3);margin-top:4px">Ctrl+Enter 提交</div>
      </div>`;
  }

  el.innerHTML = `
    <div class="review-wrap" style="max-width:720px">
      <div class="review-progress">
        <span class="rp-text">第 ${quiz.idx+1} / ${quiz.list.length} 题</span>
        <div class="rp-bar"><div class="rp-fill" style="width:${Math.round(quiz.idx/quiz.list.length*100)}%"></div></div>
        <span class="rp-text" style="color:var(--success)">答对 ${quiz.right}</span>
      </div>
      <div class="q-card">
        <div class="q-meta">
          <span class="q-type ${q.type}">${typeIconText} ${typeLabelText}</span>
          <span class="kw-chapter">${esc(s?s.name:'')} · ${esc(q.chapter)}</span>
        </div>
        <div class="q-text">${esc(q.question)}</div>
        ${answerArea}
        <div id="q-feedback"></div>
      </div>
    </div>`;
}
function answerQ(i){
  const q = quiz.list[quiz.idx];
  const optEls = document.querySelectorAll('#q-opts .q-opt');
  if(optEls[0].classList.contains('locked')) return;
  const correct = i === q.answer;
  optEls.forEach((el,j)=>{
    el.classList.add('locked');
    if(j===q.answer) el.classList.add('correct');
    else if(j===i) el.classList.add('wrong');
  });
  db.quizRecords.push({qid:q.id, correct, date:todayStr()});
  recordAnswer(q.id, correct);
  addStudy(1);
  save();
  if(correct) quiz.right++;
  const isLast = quiz.idx+1 >= quiz.list.length;
  document.getElementById('q-feedback').innerHTML = `
    <div class="q-explain"><b>📖 解析：</b>${md(q.explanation)}</div>
    <div class="q-foot">
      <span class="q-result-badge ${correct?'ok':'no'}">${correct?'✅ 回答正确':'❌ 回答错误，已加入错题本'}</span>
      <button class="btn btn-primary" onclick="nextQ()">${isLast?'查看成绩 🏁':'下一题 →'}</button>
    </div>`;
  renderBadges();
}

/* 填空/简答题：输入文本后提交判分 */
function answerInputQ(){
  const q = quiz.list[quiz.idx];
  const inputId = q.type === 'fill' ? 'q-fill-input' : 'q-short-input';
  const inputEl = document.getElementById(inputId);
  const btnEl = document.querySelector('#q-opts .q-submit-btn');
  if (!inputEl || inputEl.classList.contains('locked') || inputEl.classList.contains('wrong-locked')) return;

  var userAnswer = inputEl.value.trim();
  if (!userAnswer) { toast('请输入答案再提交','warn'); return; }
  var correct = scoreUserAnswer(userAnswer, q);
  var stdAnswer = String(q.answer || '');

  // 锁定输入
  inputEl.classList.add(correct ? 'locked' : 'wrong-locked');
  if(btnEl) btnEl.disabled = true;

  db.quizRecords.push({qid:q.id, correct, date:todayStr()});
  recordAnswer(q.id, correct);
  addStudy(2);
  save();
  if(correct) quiz.right++;
  var isLast = quiz.idx+1 >= quiz.list.length;

  var feedbackHtml = '<div class="q-explain"><b>📖 解析：</b>' + md(q.explanation) + '</div>';
  if (q.type === 'short') {
    feedbackHtml += '<div class="q-explain" style="margin-top:8px;background:rgba(99,102,241,.04);border-color:rgba(99,102,241,.15)"><b>📋 参考答案：</b>' + esc(stdAnswer.replace(/;/g,'；')) + '</div>';
  } else if (q.type === 'fill') {
    feedbackHtml += '<div class="q-explain" style="margin-top:8px;background:rgba(99,102,241,.04);border-color:rgba(99,102,241,.15)"><b>📋 正确答案：</b>' + esc(stdAnswer) + '</div>';
  }

  document.getElementById('q-feedback').innerHTML = feedbackHtml +
    '<div class="q-foot">' +
      '<span class="q-result-badge ' + (correct?'ok':'no') + '">' + (correct?'✅ 回答正确':'❌ 回答错误，已加入错题本') + '</span>' +
      '<button class="btn btn-primary" onclick="nextQ()">'+(isLast?'查看成绩 🏁':'下一题 →')+'</button>' +
    '</div>';
  renderBadges();
}

function nextQ(){
  quiz.idx++;
  if(quiz.idx >= quiz.list.length){ renderQuizResult(); return; }
  renderQuestion();
}
function renderQuizResult(){
  const total = quiz.list.length, right = quiz.right;
  const pct = Math.round(right/total*100);
  _analytics.quizComplete(right, total, pct);
  const wrongs = quiz.list.filter(q=>{
    const recs = db.quizRecords.filter(r=>r.qid===q.id);
    return recs.length && !recs[recs.length-1].correct;
  });
  const C = 2*Math.PI*52;
  const gradId = uniqueSvgId('score-grad');
  document.getElementById('view-quiz').innerHTML = `
    <div class="review-wrap" style="max-width:560px">
      <div class="q-card" style="text-align:center">
        <h3 style="font-size:18px;margin-bottom:4px">🏁 本次自测成绩</h3>
        <div class="score-ring">
          <svg width="150" height="150" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" stroke-width="10"/>
            <circle cx="60" cy="60" r="52" fill="none" stroke="url(#${gradId})" stroke-width="10" stroke-linecap="round"
              stroke-dasharray="${C}" stroke-dashoffset="${C*(1-pct/100)}" style="transition:stroke-dashoffset 1s cubic-bezier(.16,1,.3,1)"/>
            <defs><linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs>
          </svg>
          <div class="val"><b>${pct}</b><span>正确率 %</span></div>
        </div>
        <p style="color:var(--text-2)">${total} 题答对 ${right} 题${wrongs.length?`，${wrongs.length} 道错题已收入错题本`:'，全部答对，太稳了！'}</p>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:20px">
          <button class="btn btn-ghost" onclick="quiz=null;renderQuizHome()">再来一组</button>
          ${wrongs.length?`<button class="btn btn-primary" onclick="quiz=null;switchView('wrong')">去攻克错题</button>`:`<button class="btn btn-primary" onclick="quiz=null;switchView('dashboard')">回到仪表盘</button>`}
        </div>
      </div>
    </div>`;
  renderBadges();
}

/* ================= 错题本 ================= */
function renderWrong(){
  if(!db||!db.questions) return;
  const el = document.getElementById('view-wrong');
  const list = wrongList();
  if(!list.length){
    el.innerHTML = `<div class="empty-state"><div class="big">✨</div><h3>错题本空空如也</h3><p>去「刷题自测」练练手，答错的题会自动收录到这里</p>
      <button class="btn btn-primary" style="margin-top:18px" onclick="switchView('quiz')">去刷题</button></div>`;
    return;
  }
  el.innerHTML = `
    <div class="panel" style="display:flex;align-items:center;gap:12px;padding:16px 22px">
      <span style="font-size:22px">📕</span>
      <div><b>${list.length} 道错题待攻克</b><div style="font-size:12px;color:var(--text-3)">重做正确后将自动移出错题本</div></div>
    </div>
    ${list.map(q=>{
      const s = getSubject(q.subjectId);
      var answerArea = '';
      if (q.type === 'single' || q.type === 'judge') {
        const opts = q.type==='judge'? ['正确','错误'] : q.options;
        answerArea = opts.map((o,i)=>`<div class="q-opt" onclick="redoWrong('${q.id}',${i})"><span class="key">${q.type==='judge'?(i===0?'✓':'✗'):(QUIZ_LETTERS[i]||String(i+1))}</span><span>${esc(o)}</span></div>`).join('');
      } else {
        answerArea = `<div style="display:flex;gap:8px;align-items:stretch">
          <input type="text" class="q-input" id="wq-input-${q.id}" placeholder="${q.type==='fill'?'请输入答案…':'请输入你的回答…'}" style="flex:1;margin-bottom:0">
          <button class="q-submit-btn" onclick="redoWrongInput('${q.id}')" style="margin-top:0;white-space:nowrap">✓ 提交</button>
        </div>`;
      }
      return `<div class="row-item" id="wq-${q.id}">
        <div class="q-meta">
          <span class="q-type ${q.type}">${typeIcon(q)} ${typeLabel(q)}</span>
          <span class="kw-chapter">${esc(s?s.name:'')} · ${esc(q.chapter)}</span>
        </div>
        <div class="q-text">${esc(q.question)}</div>
        <div>${answerArea}</div>
        <div class="wq-feedback"></div>
      </div>`;
    }).join('')}`;
}
function redoWrong(qid, i){
  const q = db.questions.find(x=>x.id===qid);
  const box = document.getElementById('wq-'+qid);
  const optEls = box.querySelectorAll('.q-opt');
  if(optEls[0].classList.contains('locked')) return;
  const correct = i === q.answer;
  optEls.forEach((el,j)=>{
    el.classList.add('locked');
    if(j===q.answer) el.classList.add('correct');
    else if(j===i) el.classList.add('wrong');
  });
  db.quizRecords.push({qid, correct, date:todayStr()});
  recordAnswer(qid, correct);
  addStudy(1);
  save();
  const fb = box.querySelector('.wq-feedback');
  if(correct){
    fb.innerHTML = `<div class="q-explain" style="border-color:rgba(16,185,129,.35);background:rgba(16,185,129,.06)"><b>🎉 答对了！</b>本题已移出错题本。<br><b>📖 解析：</b>${md(q.explanation)}</div>`;
    toast('错题攻克成功，已移出 🎉','ok');
    _defer(()=>{ box.style.transition='all .4s'; box.style.opacity='0'; box.style.transform='translateX(30px)';
      _defer(()=>renderWrong(), 400); }, 1200);
  }else{
    fb.innerHTML = `<div class="q-explain"><b>💪 再想想！</b>仍留在错题本中。<br><b>📖 解析：</b>${md(q.explanation)}</div>`;
  }
  renderBadges();
}

/* 错题本中填空/简答题的输入提交判分 */
function redoWrongInput(qid) {
  const q = db.questions.find(function(x){ return x.id === qid; });
  const box = document.getElementById('wq-' + qid);
  const inputEl = document.getElementById('wq-input-' + qid);
  if (!inputEl || inputEl.classList.contains('locked') || inputEl.classList.contains('wrong-locked')) return;
  var userAnswer = inputEl.value.trim();
  if (!userAnswer) { toast('请输入答案再提交','warn'); return; }
  var correct = scoreUserAnswer(userAnswer, q);
  var stdAnswer = String(q.answer || '');

  inputEl.classList.add(correct ? 'locked' : 'wrong-locked');

  db.quizRecords.push({qid: qid, correct: correct, date: todayStr()});
  recordAnswer(qid, correct);
  addStudy(1);
  save();

  var fb = box.querySelector('.wq-feedback');
  var extraHtml = '';
  if (q.type === 'short') {
    extraHtml = '<div class="q-explain" style="margin-top:8px;background:rgba(99,102,241,.04);border-color:rgba(99,102,241,.15)"><b>📋 参考答案：</b>' + esc(stdAnswer.replace(/;/g,'；')) + '</div>';
  } else if (q.type === 'fill') {
    extraHtml = '<div class="q-explain" style="margin-top:8px;background:rgba(99,102,241,.04);border-color:rgba(99,102,241,.15)"><b>📋 正确答案：</b>' + esc(stdAnswer) + '</div>';
  }

  if (correct) {
    fb.innerHTML = '<div class="q-explain" style="border-color:rgba(16,185,129,.35);background:rgba(16,185,129,.06)"><b>🎉 答对了！</b>本题已移出错题本。<br><b>📖 解析：</b>' + md(q.explanation) + '</div>' + extraHtml;
    toast('错题攻克成功，已移出 🎉','ok');
    _defer(function(){
      box.style.transition = 'all .4s'; box.style.opacity = '0'; box.style.transform = 'translateX(30px)';
      _defer(function(){ renderWrong(); }, 400);
    }, 1200);
  } else {
    fb.innerHTML = '<div class="q-explain"><b>💪 再想想！</b>仍留在错题本中。<br><b>📖 解析：</b>' + md(q.explanation) + '</div>' + extraHtml;
  }
  renderBadges();
}

// ========== 题库分析面板 ==========
function renderQuizAnalysis(){
  if(!db||!db.quizStats) return '';
  var answeredCount = Object.keys(db.quizStats).length;
  if(answeredCount < 3) return '';

  var subjectId = quizCfg.subject==='all'?null:quizCfg.subject;
  var chapters = getWeakChapters(subjectId);
  var health = getQuizHealthReport(subjectId);

  if(!chapters.length) return '';

  var topWeak = chapters.slice(0, 3);
  var weakHtml = topWeak.map(function(c){
    var level = c.difficulty > 0.7 ? '\uD83D\uDD34' : c.difficulty > 0.4 ? '\uD83D\uDFE1' : '\uD83D\uDFE2';
    var w = Math.min(Math.round(c.difficulty * 100), 100);
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:12px;color:var(--text-2)">'+
      '<span style="width:80px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(c.chapter)+'</span>'+
      '<div style="flex:1;height:6px;background:var(--surface);border-radius:3px;overflow:hidden">'+
      '<div style="width:'+w+'%;height:100%;background:linear-gradient(90deg,#6366f1,#ef4444);border-radius:3px"></div></div>'+
      '<span style="color:var(--text-3);min-width:36px">'+level+' '+(c.difficulty*100|0)+'%</span></div>';
  }).join('');

  var healthHtml = '';
  if(health.totalAnswered >= 3){
    healthHtml = '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px;font-size:11px">'+
      '<span style="color:var(--text-2)">答题 <b>'+health.totalAnswered+'</b>/'+health.totalQuestions+'</span>'+
      (health.avgDifficulty!==null?'<span style="color:var(--text-2)">难度 <b>'+(health.avgDifficulty*100|0)+'%</b></span>':'')+
      (health.unusedCount>0?'<span style="color:var(--warn)">待选 <b>'+health.unusedCount+'</b></span>':'')+
      (health.flaggedTooHard.length>0?'<span style="color:var(--danger)">偏难 <b>'+health.flaggedTooHard.length+'</b></span>':'')+
      '</div>';
  }

  return '<div style="margin-top:24px;padding:16px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2)">'+
    '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">题库智能分析</div>'+
    healthHtml+
    '<div style="font-size:11px;color:var(--text-2);margin-bottom:6px">弱项章节 TOP3</div>'+
    weakHtml+
    '<div style="margin-top:8px;font-size:10px;color:var(--text-3)">选择弱项模式可集中突击薄弱章节</div>'+
    '</div>';
}
