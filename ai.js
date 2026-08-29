/* 研学库 AI 能力层 v3.0-beta — OpenAI 兼容接口
 * 设计原则：
 * - 用户自备 Key（DeepSeek / 智谱 / Kimi / OpenAI 等），仅存本机 localStorage，
 *   浏览器直连提供商，研学库服务器不经手任何密钥与内容
 * - 所有生成/批改结果经严格清洗（长度上限、类型白名单）后才入库
 */

var AI_CFG_KEY = 'yanxueku_ai_cfg';
var _aiPendingCards = null;   // AI 建卡的待导入预览数据
var _aiCfgCache = null;       // aiCfg() 内存缓存，saveAiCfg 时失效（避免每次调用同步读 localStorage + JSON.parse）

function aiCfg(){
  if(_aiCfgCache) return _aiCfgCache;
  var out = { base:'', model:'', key:'' };
  try{
    var c = JSON.parse(localStorage.getItem(AI_CFG_KEY) || '{}');
    out = { base: String(c.base||'').replace(/\/+$/,''), model: String(c.model||''), key: String(c.key||'') };
  }catch(e){}
  _aiCfgCache = out;
  return out;
}
function aiConfigured(){ var c = aiCfg(); return !!(c.base && c.model && c.key); }
function saveAiCfg(base, model, key){
  _aiCfgCache = null;   // 配置变更立即使缓存失效，否则保存后仍读到旧配置
  try{ localStorage.setItem(AI_CFG_KEY, JSON.stringify({ base: base, model: model, key: key })); }catch(e){}
}

/* 端点加固：必须 https（本机自建模型允许 http://localhost / 127.0.0.1），拒绝 user:pass@ 形式 */
function sanitizeAiBase(b){
  b = String(b || '').trim().replace(/\/+$/, '');
  if(!b) return '';
  var localOk = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(b);
  if(!/^https:\/\//i.test(b) && !localOk) return null;
  if(/^[a-z]+:\/\/[^\/]*@/i.test(b)) return null;
  return b;
}

/* 核心调用：OpenAI 兼容 /chat/completions，返回首个 message.content */
async function aiChat(messages, opts){
  opts = opts || {};
  var c = aiCfg();
  c.base = sanitizeAiBase(c.base);
  if(!c.base || !c.model || !c.key) throw new Error('AI 未配置或接口地址不安全');
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
    // AbortError 只可能是超时；TypeError 通常是 CSP/CORS 拦截，与真实网络故障分开提示，减少误判排查
    if(e.name === 'AbortError') throw new Error('请求超时');
    if(e instanceof TypeError) throw new Error('请求被拦截，检查跨域(CORS)或本机网络策略');
    throw new Error('网络请求失败（检查地址与网络连接）');
  } finally {
    clearTimeout(timer);
  }
  if(!res.ok){
    var body = '';
    try{ body = (await res.text()).slice(0, 140); }catch(e){}
    throw new Error('HTTP ' + res.status + (body ? ' · ' + body : ''));
  }
  // 响应体读取同样受超时控制：此前仅 fetch 阶段有超时，慢速滴流的响应体会让调用方远超预期时限。
  // 超时时复用同一个 controller 真正中止底层连接（而不是"放弃等待但连接仍在读"），
  // 且无论成功与超时都清理该定时器，避免悬挂 15 秒。
  var bodyTimer = null;
  var payload;
  try{
    payload = await Promise.race([
      res.json(),
      new Promise(function(_, rej){
        bodyTimer = setTimeout(function(){ ctrl.abort(); rej(new Error('timeout')); }, 15000);
      })
    ]);
  }catch(e){
    throw new Error('AI 响应读取失败（非 JSON 响应或连接中断）');
  } finally {
    if(bodyTimer){ clearTimeout(bodyTimer); bodyTimer = null; }
  }
  var content = payload && payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content;
  if(!content) throw new Error('AI 响应缺少内容');
  return content;
}

/* 从 AI 回复中稳健地提取 JSON 对象（容忍 ``` 围栏与前后缀文字） */
function aiParseJson(content){
  var s = String(content || '').replace(/```json|```/gi, '').trim();
  var i = s.indexOf('{'), j = s.lastIndexOf('}');
  if(i === -1 || j <= i) throw new Error('AI 返回内容无法解析');
  var obj;
  try{
    obj = JSON.parse(s.slice(i, j + 1));
  }catch(e){
    // AI 输出不受控：解析失败必须转成中文提示，否则用户看到的是英文 SyntaxError
    throw new Error('AI 返回内容不是合法 JSON，请重试或换个素材');
  }
  if(!obj || typeof obj !== 'object') throw new Error('AI 返回结构异常');
  return obj;
}

/* 组合调用：发消息 → 解析 JSON（内部复用，不新增对外接口） */
async function aiChatJson(messages, opts){
  return aiParseJson(await aiChat(messages, opts));
}

/* 连接测试：返回延迟 ms */
async function testAiConnectionReq(){
  var t0 = Date.now();
  await aiChat([{ role:'user', content:'回复 OK 两个字母即可' }], { temperature:0, timeoutMs:15000 });
  return Date.now() - t0;
}

/* ============ AI 建卡：素材 → 结构化知识卡片 ============ */
async function aiGenerateCardsReq(source, count, subjectName){
  var parsed = await aiChatJson([
    { role:'system', content:'你是考研专业课辅导老师，把素材整理成便于记忆的知识卡片。content 用**加粗**突出关键点，200-400字。只输出严格 JSON，不要任何多余文字：{"cards":[{"chapter":"章节名","title":"标题(不超过20字)","content":"正文","tags":["标签1","标签2"]}]}' },
    { role:'user', content:'科目：' + (subjectName||'考研专业课') + '\n生成数量：' + count + '\n素材：\n' + String(source).slice(0, 6000) }
  ], { temperature:0.4, timeoutMs:90000 });
  var arr = parsed.cards || parsed.knowledge || [];
  if(!Array.isArray(arr)) throw new Error('AI 返回结构异常');
  // count 收敛：slice(0, NaN) 与 slice(0,0) 等价（故此处不改变既有行为），显式化意图并补上界
  var limit = (count > 0) ? Math.min(Math.floor(count), 50) : 0;
  return arr.slice(0, limit).map(function(c){
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
  var parsed = await aiChatJson([
    { role:'system', content:'你是考研专业课阅卷老师。对比学生答案与参考答案，按要点覆盖度打分。只输出严格 JSON，不要多余文字：{"score":0到100的整数,"comment":"一句话点评，先说答对的要点，再指出遗漏"}' },
    { role:'user', content:'题目：' + ((q && q.question) || '') + '\n参考答案：' + String((q && q.answer) || '') + '\n学生答案：' + userAnswer }
  ], { temperature:0.2, timeoutMs:45000 });
  return {
    score: Math.max(0, Math.min(100, parseInt(parsed.score, 10) || 0)),
    comment: String(parsed.comment || '').slice(0, 200) || '完成批改'
  };
}
