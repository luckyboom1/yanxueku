/* 研学库 AI 能力层 v3.0-beta — OpenAI 兼容接口
 * 设计原则：
 * - 用户自备 Key（DeepSeek / 智谱 / Kimi / OpenAI 等），仅存本机 localStorage，
 *   浏览器直连提供商，研学库服务器不经手任何密钥与内容
 * - 所有生成/批改结果经严格清洗（长度上限、类型白名单）后才入库
 */

var AI_CFG_KEY = 'yanxueku_ai_cfg';
var _aiPendingCards = null;   // AI 建卡的待导入预览数据

function aiCfg(){
  try{
    var c = JSON.parse(localStorage.getItem(AI_CFG_KEY) || '{}');
    return { base: String(c.base||'').replace(/\/+$/,''), model: String(c.model||''), key: String(c.key||'') };
  }catch(e){ return { base:'', model:'', key:'' }; }
}
function aiConfigured(){ var c = aiCfg(); return !!(c.base && c.model && c.key); }
function saveAiCfg(base, model, key){
  try{ localStorage.setItem(AI_CFG_KEY, JSON.stringify({ base: base, model: model, key: key })); }catch(e){}
}

/* 核心调用：OpenAI 兼容 /chat/completions，返回首个 message.content */
async function aiChat(messages, opts){
  opts = opts || {};
  var c = aiCfg();
  if(!c.base || !c.model || !c.key) throw new Error('AI 未配置');
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, opts.timeoutMs || 60000);
  var res;
  try{
    res = await fetch(c.base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + c.key },
      body: JSON.stringify({ model: c.model, messages: messages, temperature: opts.temperature != null ? opts.temperature : 0.4 }),
      signal: ctrl.signal
    });
  }catch(e){
    throw new Error(e.name === 'AbortError' ? '请求超时' : '网络请求失败（检查地址与跨域设置）');
  } finally {
    clearTimeout(timer);
  }
  if(!res.ok){
    var body = '';
    try{ body = (await res.text()).slice(0, 140); }catch(e){}
    throw new Error('HTTP ' + res.status + (body ? ' · ' + body : ''));
  }
  var j = await res.json();
  var content = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  if(!content) throw new Error('AI 响应缺少内容');
  return content;
}

/* 从 AI 回复中稳健地提取 JSON 对象（容忍 ``` 围栏与前后缀文字） */
function aiParseJson(content){
  var s = String(content || '').replace(/```json|```/gi, '').trim();
  var i = s.indexOf('{'), j = s.lastIndexOf('}');
  if(i === -1 || j <= i) throw new Error('AI 返回内容无法解析');
  var obj = JSON.parse(s.slice(i, j + 1));
  if(!obj || typeof obj !== 'object') throw new Error('AI 返回结构异常');
  return obj;
}

/* 连接测试：返回延迟 ms */
async function testAiConnectionReq(){
  var t0 = Date.now();
  await aiChat([{ role:'user', content:'回复 OK 两个字母即可' }], { temperature:0, timeoutMs:15000 });
  return Date.now() - t0;
}

/* ============ AI 建卡：素材 → 结构化知识卡片 ============ */
async function aiGenerateCardsReq(source, count, subjectName){
  var content = await aiChat([
    { role:'system', content:'你是考研专业课辅导老师，把素材整理成便于记忆的知识卡片。content 用**加粗**突出关键点，200-400字。只输出严格 JSON，不要任何多余文字：{"cards":[{"chapter":"章节名","title":"标题(不超过20字)","content":"正文","tags":["标签1","标签2"]}]}' },
    { role:'user', content:'科目：' + (subjectName||'考研专业课') + '\n生成数量：' + count + '\n素材：\n' + String(source).slice(0, 6000) }
  ], { temperature:0.4, timeoutMs:90000 });
  var j = aiParseJson(content);
  var arr = j.cards || j.knowledge || [];
  if(!Array.isArray(arr)) throw new Error('AI 返回结构异常');
  return arr.slice(0, count).map(function(c){
    return {
      chapter: String(c.chapter || '未分章').slice(0, 100),
      title: String(c.title || '').slice(0, 200),
      content: String(c.content || '').slice(0, 20000),
      tags: (Array.isArray(c.tags) ? c.tags : []).slice(0, 20).map(function(t){ return String(t || '').slice(0, 50); })
    };
  }).filter(function(c){ return c.title && c.content; });
}

/* ============ AI 阅卷：简答题语义评分 ============ */
async function gradeShortWithAi(q, userAnswer){
  var content = await aiChat([
    { role:'system', content:'你是考研专业课阅卷老师。对比学生答案与参考答案，按要点覆盖度打分。只输出严格 JSON，不要多余文字：{"score":0到100的整数,"comment":"一句话点评，先说答对的要点，再指出遗漏"}' },
    { role:'user', content:'题目：' + (q.question || '') + '\n参考答案：' + String(q.answer || '') + '\n学生答案：' + userAnswer }
  ], { temperature:0.2, timeoutMs:45000 });
  var j = aiParseJson(content);
  return {
    score: Math.max(0, Math.min(100, parseInt(j.score, 10) || 0)),
    comment: String(j.comment || '').slice(0, 200) || '完成批改'
  };
}