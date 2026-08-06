/* 研学库 v2.3 — 工具函数模块 */

export function todayStr(){ return dayStr(new Date()); }
export function dayStr(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
export function addDays(str, n){ const d = new Date(str+'T00:00:00'); d.setDate(d.getDate()+n); return dayStr(d); }
export function diffDays(a, b){ return Math.round((new Date(a+'T00:00:00') - new Date(b+'T00:00:00'))/86400000); }

export function uid(){ return 'k'+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
let _svgIdCounter = 0;
export function uniqueSvgId(prefix){ return (prefix||'sg')+'-'+(++_svgIdCounter)+'-'+Date.now().toString(36); }

export function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
export function escAttr(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;'); }
export function safeColor(c){ var s=String(c==null?'':c); return /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(s)?s:'#6366f1'; }

export function md(s){
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\n/g,'<br>');
}

export function calcStreak(today, studyLog){
  let startOffset = 0;
  const todayRec = studyLog.find(r=>r.date===today);
  if(!todayRec||todayRec.minutes===0) startOffset=1;
  let streak=0;
  for(let i=startOffset;i<365;i++){
    const d=addDays(today,-i);
    const rec=studyLog.find(r=>r.date===d);
    if(rec&&rec.minutes>0) streak++; else break;
  }
  return streak;
}

export function _defer(fn, ms){ return setTimeout(fn, ms||0); }
export function _deferRaf(fn){ return requestAnimationFrame(fn); }
