/* 研学库 Core v2.1.1 — Data, Auth, Theme, Nav, Utils, Analytics, Init */
/* ================= 数据层（Supabase 共享数据库） ================= */
// 从外部配置读取 Supabase 凭据；config.js 被 .gitignore 忽略，避免敏感信息进入版本控制
/* ========================================
 * 研学库 — 代码组织分区
 * 数据层 | 定时器 | DOM缓存 | 配置 | 工具函数 | 数据查询 | 视图 | 认证
 * ======================================== */
const _cfg = window.__YANXUEKU_CONFIG__ || {};
const SUPABASE_URL = _cfg.SUPABASE_URL || '';
const SUPABASE_KEY = _cfg.SUPABASE_KEY || '';
let sb = null;

// === 数据层（Supabase SDK 初始化） ===
let _supabaseFailed = false;   // SDK 加载超时/失败标记（供提示区分"连接中"与"失败"）

// === 定时器管理 ===
// ===== 定时器管理：统一注册/清理，防止组件"卸载"后定时器在已销毁 DOM 上操作 =====
let _timers = []; // setTimeout 清理队列（视图级定时器）
let _rafIds = []; // requestAnimationFrame 清理队列
const _defer = function(fn, ms){
  const id = setTimeout(function(){ _timers = _timers.filter(function(t){ return t !== id; }); fn(); }, ms);
  _timers.push(id); return id;
};
const _deferRaf = function(fn){
  const id = requestAnimationFrame(function(){ _rafIds = _rafIds.filter(function(r){ return r !== id; }); fn(); });
  _rafIds.push(id); return id;
};
function _flushTimers(){
  _timers.forEach(function(id){ clearTimeout(id); }); _timers = [];
  _rafIds.forEach(function(id){ cancelAnimationFrame(id); }); _rafIds = [];
}


// === DOM 缓存 ===
// ===== DOM 节点缓存（高频静态节点，避免重复 getElementById） =====
const _el = {};
function _initElCache(){
  _el.sidebar = document.getElementById("sidebar");
  _el.modalRoot = document.getElementById("modal-root");
  _el.content = document.getElementById("content");
  _el.loginGate = document.getElementById("login-gate");
  _el.toastRoot = document.getElementById("toast-root");
}
function tryInitSupabase(){
  // 幂等：sb 已就绪直接返回；SDK 动态加载完成后可反复调用直到成功（不设一次性短路）
  if(sb) return true;
  if(!SUPABASE_URL || !SUPABASE_KEY){
    console.warn('[yanxueku] Supabase 配置缺失，将使用本地模式运行。请复制 config.template.js 为 config.js 并填入真实配置。');
    _supabaseFailed = true;
    return false;
  }
  if(window.supabase && window.supabase.createClient){
    try{ sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); }catch(e){ console.warn('Supabase init failed:', e && e.message); }
  }
  return !!sb;
}
tryInitSupabase();
if(!sb){
  // 动态异步加载 SDK（不阻塞首屏）：jsdelivr 优先，失败换 unpkg 兜底
  var _s = document.createElement('script');
  _s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  _s.crossOrigin = 'anonymous';
  _s.onload = function(){ tryInitSupabase(); setupAuthListener(); };
  _s.onerror = function(){
    var _s2 = document.createElement('script');
    _s2.src = 'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    _s2.onload = function(){ tryInitSupabase(); setupAuthListener(); };
    document.head.appendChild(_s2);
  };

  document.head.appendChild(_s);
  // 8 秒仍未就绪 → 标记失败（登录/注册提示可区分"连接中"与"加载失败"）
  setTimeout(function(){ if(!sb) _supabaseFailed = true; }, 8000);
}

// === 数据模型（EBB 遗忘曲线、主题、日期工具） ===
const THEME_KEY = 'yanxueku_theme';
const STORAGE_KEY = 'yanxueku_v2';               // v2: schema 版本化 + 多题型支持
const DATA_VERSION = 2;
const APP_VERSION = 'v2.2.0';   // v2.2: 模块化拆分
const EBB = [1, 2, 4, 7, 15, 30, 60];            // 艾宾浩斯间隔（天），stage 0..6
const EBB_LABEL = ['新学', '第2天', '第4天', '第7天', '第15天', '第30天', '长期记忆'];

// === 分析埋点：防崩溃存根 ===
var _analytics = _analytics || { page:function(){}, quizStart:function(){}, quizComplete:function(){}, reviewStart:function(){}, reviewComplete:function(){}, kwCreated:function(){}, kwImported:function(){}, packExported:function(){}, packImported:function(){}, login:function(){}, register:function(){}, dataExport:function(){}, dataImport:function(){} };

// 计算连续学习天数：今天尚未学习时不计入中断，从最近一个有学习记录的日期开始向前统计
function calcStreak(today, studyLog){
  let startOffset = 0;
  const todayRec = studyLog.find(r => r.date === today);
  if(!todayRec || todayRec.minutes === 0) startOffset = 1;
  let streak = 0;
  const MAX_DAYS = 365;
  for(let i = startOffset; i < MAX_DAYS; i++){
    const d = addDays(today, -i);
    const rec = studyLog.find(r => r.date === d);
    if(rec && rec.minutes > 0) streak++;
    else break;
  }
  return streak;
}


// === 日期工具函数 ===
function todayStr(){ return dayStr(new Date()); }
function dayStr(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function addDays(str, n){ const d = new Date(str+'T00:00:00'); d.setDate(d.getDate()+n); return dayStr(d); }
function diffDays(a, b){ return Math.round((new Date(a+'T00:00:00') - new Date(b+'T00:00:00'))/86400000); }
function uid(){ return 'k'+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
let _svgIdCounter = 0;
function uniqueSvgId(prefix){ return (prefix||'sg') + '-' + (++_svgIdCounter) + '-' + Date.now().toString(36); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
// HTML 属性值安全转义：用于 data-* 属性，防止属性值中引号撕裂属性边界
function escAttr(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;'); }
// 安全色值校验：仅允许 #hex，防止颜色字段被注入恶意 CSS（存储型 CSS 注入防护）
function safeColor(c){ var s = String(c==null?'':c); return /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(s) ? s : '#6366f1'; }
function md(s){
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\n/g,'<br>');
}

/* ---------- 内置示例数据 ---------- */
function seedData(){
  const t = todayStr();
  const K = (id, subjectId, chapter, title, content, tags, stage, dueIn) => ({
    id, subjectId, chapter, title, content, tags,
    stage, nextReview: addDays(t, dueIn), lastReview: stage>0 ? addDays(t, dueIn-EBB[Math.min(stage,6)]) : null,
    createdAt: addDays(t, -20)
  });

  const subjects = [
    {id:'xwcbx', name:'新闻传播学', color:'#6366f1', exam:'新闻传播学考研'},
    {id:'jyx', name:'教育学', color:'#10b981', exam:'教育学311/333'},
    {id:'ds', name:'数据结构', color:'#f59e0b', exam:'考研 408'},
  ];

  const Q = (id, subjectId, chapter, type, q, options, answer, explain) => ({id, subjectId, chapter, type, q, options, answer, explain});

  /* ======== 新闻传播学 卡片 ======== */
  const knowledge = [
    K('xw1','xwcbx','传播学基础','传播的5W模式',
      '拉斯韦尔1948年提出传播过程五要素：\n**Who（谁）→ Says What（说什么）→ In Which Channel（渠道）→ To Whom（对谁）→ With What Effect（效果）**\n对应五大研究领域：控制分析、内容分析、媒介分析、受众分析、效果分析。\n**局限**：线性单向，忽略了反馈和噪音。',
      ['传播模式','拉斯韦尔'], 0, 0),
    K('xw2','xwcbx','传播学基础','把关人理论',
      '**卢因（Lewin）1947年**提出"把关人"概念，怀特（White）1950年引入新闻传播。\n核心观点：信息在传播渠道中流动时，存在"把关人"对信息进行筛选。\n把关标准：个人因素（价值观、经验）、组织因素（媒介方针、截稿时间）、社会因素（法律、文化）。\n**新媒体时代**：把关权力从专业媒体扩散到平台算法和用户个体。',
      ['把关人','卢因','怀特'], 0, 1),
    K('xw3','xwcbx','传播效果','议程设置理论',
      '**麦库姆斯和肖（McCombs & Shaw）1972年**通过教堂山镇研究提出。\n核心：大众媒介也许不能决定人们**怎么想**，但可以决定人们**想什么**。\n三个层面：①议题议程设置 ②属性议程设置 ③网络议程设置。\n**新媒体环境**：传统媒体的议程设置能力被社交媒体碎片化，但出现了反向议程设置（公众议题→媒介议题）。',
      ['议程设置','麦库姆斯','效果研究'], 0, 2),
    K('xw4','xwcbx','传播效果','沉默的螺旋',
      '**诺依曼（Noelle-Neumann）1974年**提出。\n核心假说：个人因害怕孤立，在感知到自己的意见属于少数时会保持沉默，导致优势意见大声疾呼而劣势意见沉默的螺旋过程。\n成立条件：①议题具有道德负载 ②媒体的共鸣性和累积性报道 ③个体有孤立恐惧。\n**互联网时代适用性**：匿名性是否削弱了孤立恐惧？存在争议。',
      ['沉默的螺旋','诺依曼'], 0, 3),
    K('xw5','xwcbx','新闻学理论','新闻价值要素',
      '判断事实能否成为新闻的五要素：\n**①时新性**：时间近、内容新\n**②重要性**：对受众影响程度\n**③显著性**：人物/地点/事件的知名度\n**④接近性**：地理/心理/利益接近\n**⑤趣味性**：人情味、反常性、冲突性\n**记忆口诀**：时重显接趣（时钟显接趣）',
      ['新闻价值','新闻学'], 0, 0),
    K('xw6','xwcbx','新闻学理论','新闻真实性原则',
      '**核心**：新闻必须是对客观事实的如实反映。\n三层含义：①具体真实（报道要素准确）②总体真实（全面反映，不片面）③本质真实（揭示事物内在联系）。\n**与真实相关概念**：客观性（态度中立）、平衡报道（多方呈现）、核实（信源交叉验证）。\n**假新闻类型**：捏造、歪曲、策划事件、AI 深度伪造。',
      ['新闻真实','客观性'], 0, 1),

    /* ======== 教育学 卡片 ======== */
    K('jy1','jyx','教育学原理','教育的本质',
      '教育的本质是有目的地**培养人的社会活动**。\n广义教育：一切增进人的知识技能、影响思想品德的活动（社会教育、家庭教育）。\n狭义教育：主要指**学校教育**，即教育者根据社会要求，有目的、有计划、有组织地对受教育者施加影响。\n**教育的三要素**：教育者、受教育者（学习者）、教育影响（教育内容和手段）。',
      ['教育本质','教育学原理'], 0, 0),
    K('jy2','jyx','教育学原理','个体身心发展规律',
      '个体身心发展的五大规律：\n①**顺序性**：由低级到高级、由量变到质变 → 循序渐进\n②**阶段性**：不同年龄阶段有不同特征 → 有针对性\n③**不平衡性**：同一方面在不同年龄发展速度不同 → 抓关键期\n④**互补性**：某方面受损可由其他方面补偿 → 长善救失\n⑤**个别差异性**：个体间发展有差异 → 因材施教',
      ['身心发展','规律'], 0, 1),
    K('jy3','jyx','课程与教学','课程类型',
      '**学科课程**：以学科为中心，逻辑性强（如语数外）。\n**活动课程**：以儿童经验和兴趣为中心（杜威倡导）。\n**综合课程**：打破学科界限整合内容（如科学=物+化+生）。\n**分科课程**：各科独立设置（当前主流）。\n**显性课程与隐性课程**：隐性课程指校园文化、师生关系等非计划的潜移默化影响。\n**必修课程与选修课程**。',
      ['课程类型','课程论'], 0, 2),
    K('jy4','jyx','课程与教学','教学原则',
      '中小学八大教学原则（记忆口诀：**"冯巩找阴凉，寻思理直发"**）：\n①科学性与思想性统一 ②理论联系实际 ③直观性\n④启发性 ⑤循序渐进（系统性） ⑥巩固性\n⑦量力性（可接受性） ⑧因材施教\n**启发性原则**是核心：孔子"不愤不启，不悱不发"；苏格拉底"产婆术"。',
      ['教学原则','启发性'], 0, 3),
    K('jy5','jyx','教育心理学','皮亚杰认知发展阶段',
      '皮亚杰将认知发展分为四个阶段：\n①**感知运动阶段**（0-2岁）：客体永久性\n②**前运算阶段**（2-7岁）：自我中心、泛灵论、不可逆\n③**具体运算阶段**（7-11岁）：守恒、可逆、去自我中心\n④**形式运算阶段**（11岁+）：抽象逻辑思维、假设推理\n**教育启示**：教学内容要符合认知发展阶段。',
      ['皮亚杰','认知发展'], 0, 0),
    K('jy6','jyx','教育心理学','维果茨基最近发展区',
      '**最近发展区（ZPD）**：学生独立解决问题的实际发展水平与在成人指导或同伴合作下解决问题的潜在发展水平之间的差距。\n**教学启示**：教学应走在发展前面，设置"跳一跳够得着"的目标。\n**支架式教学**：提供暂时性支持，能力增强后逐步撤除。\n与皮亚杰的差异：皮强调"成熟准备"，维强调"教学引领发展"。',
      ['维果茨基','最近发展区'], 0, 1),

    /* ======== 数据结构 卡片 ======== */
    K('ds1','ds','绪论','时间复杂度与渐进记号',
      '**大O记号**：表示算法运行时间的上界。\n常见复杂度排序：O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(2ⁿ)。\n**易错点**：最好/最坏/平均时间复杂度要分清，考研常考"最坏情况"。',
      ['复杂度','408'], 0, 0),
    K('ds2','ds','线性表','栈与队列的区别',
      '**栈**：后进先出（LIFO），仅允许在栈顶插入删除。\n应用：函数调用、表达式求值、括号匹配。\n**队列**：先进先出（FIFO），队尾入、队头出。\n应用：层次遍历、缓冲区、BFS。',
      ['栈','队列'], 0, 1),
    K('ds3','ds','树与二叉树','二叉树的三种遍历',
      '前序：**根 → 左 → 右**；中序：左 → 根 → 右；后序：左 → 右 → 根。\n**考点**：已知前序+中序 或 后序+中序 可唯一重建二叉树；前序+后序 **不能**唯一确定。',
      ['二叉树'], 0, 2),
    K('ds4','ds','查找','哈希表与冲突解决',
      '**哈希表**：通过哈希函数将键映射到表位置，平均查找 O(1)。\n**冲突解决方法**：\n①开放定址法（线性探测、平方探测、双散列）\n②链地址法（拉链法，桶内用链表）\n③再哈希法\n**装填因子 α** = 记录数/表长，α越大冲突越多。考研常考**散列查找的平均查找长度(ASL)**计算。',
      ['哈希','查找'], 0, 0),
    K('ds5','ds','排序','各类排序算法对比',
      '**稳定的排序**：冒泡、插入、归并、基数。\n**不稳定**：选择、快速、希尔、堆（口诀"快选希堆"）。\n**时间复杂度**：O(n²)：冒泡/插入/选择；O(n log n)：快排/归并/堆排。\n**空间复杂度**：归并 O(n)，快排 O(log n)，其余 O(1)。\n**快排最坏 O(n²)**（序列有序时），但平均最优。',
      ['排序','算法对比'], 0, 1),
    K('ds6','ds','图','图的两种遍历',
      '**深度优先搜索（DFS）**：类似树的先序，用栈（递归）。\n**广度优先搜索（BFS）**：类似层次遍历，用队列。\n**时间复杂度**：邻接矩阵 O(n²)；邻接表 O(n+e)。\nDFS 应用：拓扑排序、强连通分量。\nBFS 应用：最短路径（无权图）**记忆**：DFS 一条路走到黑，BFS 层层扩散。',
      ['图','DFS','BFS'], 0, 2),
  ];

  /* ======== 题目库 ======== */
  const questions = [
    // --- 新闻传播学 ---
    Q('q_xw1','xwcbx','传播学基础','single','拉斯韦尔 5W 模式中，"In Which Channel"对应哪个研究领域？',
      ['控制分析','内容分析','媒介分析','受众分析'], 2,
      'In Which Channel（通过什么渠道）对应**媒介分析**。Who→控制分析，Says What→内容分析，To Whom→受众分析，With What Effect→效果分析。'),
    Q('q_xw2','xwcbx','传播效果','single','议程设置理论的提出者是？',
      ['拉斯韦尔','拉扎斯菲尔德','麦库姆斯和肖','诺依曼'], 2,
      '议程设置理论由**麦库姆斯和肖（McCombs & Shaw）**于1972年通过教堂山镇研究提出。拉扎斯菲尔德提出二级传播，诺依曼提出沉默的螺旋。'),
    Q('q_xw3','xwcbx','传播学基础','judge','把关人理论最初由卢因在1947年提出，研究的是家庭食物购买决策中的把关行为。',
      null, 1,
      '正确。卢因1947年在《群体生活的渠道》中研究家庭主妇购买食物时首次提出"把关人"概念，怀特1950年将其引入传播学。'),
    Q('q_xw4','xwcbx','新闻学理论','fill','判断新闻价值的五要素是时新性、重要性、显著性、接近性和_____。',
      null, '趣味性',
      '新闻价值五要素：时新性、重要性、显著性、接近性、趣味性（记忆口诀：时重显接趣）。'),
    Q('q_xw5','xwcbx','传播效果','short','简述沉默的螺旋理论的三个核心假说。',
      null, '孤立恐惧;优势意见;劣势沉默;准感官统计',
      '三个核心假说：①社会运用孤立恐惧威胁偏离社会共识的个人；②个人能通过**准感官统计**感知意见气候；③个人因害怕孤立，在感知自己的意见属少数时保持沉默，形成螺旋效应。'),
    Q('q_xw6','xwcbx','新闻学理论','single','新闻真实性不包含以下哪个层面？',
      ['具体真实','总体真实','本质真实','艺术真实'], 3,
      '新闻真实包含具体真实、总体真实和本质真实三个层面。**艺术真实**是文学艺术领域的范畴，不属于新闻真实性。'),

    // --- 教育学 ---
    Q('q_jy1','jyx','教育学原理','single','教育区别于其他社会活动的根本特征是？',
      ['传递知识','培养人的社会活动','有教师参与','发生在学校中'], 1,
      '教育的本质是有目的地**培养人的社会活动**，这是教育区别于政治、经济、文化等其他社会活动的根本特征。'),
    Q('q_jy2','jyx','教育学原理','single','"拔苗助长"违背了个体身心发展的哪一规律？',
      ['顺序性','阶段性','不平衡性','互补性'], 0,
      '"拔苗助长"违背了**顺序性**规律——身心发展由低级到高级、由量变到质变，要循序渐进，不能跨越发展阶段。'),
    Q('q_jy3','jyx','课程与教学','single','孔子"不愤不启，不悱不发"体现的教学原则是？',
      ['直观性原则','启发性原则','巩固性原则','循序渐进原则'], 1,
      '"不愤不启，不悱不发"是孔子关于**启发性教学**的经典论述：不到学生努力想却想不通时不引导，不到学生想说却说不出时不启发。'),
    Q('q_jy4','jyx','教育心理学','judge','皮亚杰认为，处于具体运算阶段（7-11岁）的儿童已经可以进行抽象逻辑推理。',
      null, 0,
      '错误。**形式运算阶段**（11岁以后）的儿童才具备抽象逻辑推理能力。具体运算阶段的儿童思维需要具体事物的支持，但已发展了守恒和可逆性。'),
    Q('q_jy5','jyx','教育心理学','fill','维果茨基提出的_____是指学生独立解决问题的水平与在成人指导下能达到的水平之间的差距。',
      null, '最近发展区',
      '最近发展区（ZPD）是维果茨基的核心概念，强调教学应走在发展前面，为学生设置"跳一跳够得着"的学习目标。'),
    Q('q_jy6','jyx','教育学原理','short','简述启发性教学原则的基本要求。',
      null, '主动性;独立思考;动手能力;民主氛围',
      '启发性原则的基本要求：①调动学生学习的**主动性**；②启发学生**独立思考**，发展逻辑思维；③让学生**动手**，培养独立解决问题的能力；④发扬教学**民主**，建立良好的师生关系。'),

    // --- 数据结构 ---
    Q('q_ds1','ds','绪论','single','下列排序算法中，属于不稳定排序的是（ ）',
      ['冒泡排序','直接插入排序','快速排序','归并排序'], 2,
      '口诀"快选希堆"不稳定：快速排序、简单选择、希尔排序、堆排序均为不稳定排序。'),
    Q('q_ds2','ds','线性表','single','栈的操作特点是（ ）',
      ['先进先出','后进先出','随机存取','只能插入不能删除'], 1,
      '栈是限定仅在栈顶进行插入和删除的线性表，特点是后进先出（LIFO）。'),
    Q('q_ds3','ds','树与二叉树','judge','已知前序和中序序列可唯一确定一棵二叉树。',
      null, 1,
      '正确。前序+中序、后序+中序都可唯一确定一棵二叉树。但前序+后序不能唯一确定。'),
    Q('q_ds4','ds','查找','single','哈希表查找的平均时间复杂度是（ ）',
      ['O(n)','O(n log n)','O(1)','O(log n)'], 2,
      '哈希表通过哈希函数直接定位，平均查找时间复杂度为**O(1)**。但在最坏情况下（全部冲突）为O(n)。'),
    Q('q_ds5','ds','排序','fill','快速排序在序列初始_____时退化为 O(n²)，此时可通过随机选取枢轴优化。',
      null, '有序',
      '当序列已经有序（正序或逆序）时，若枢轴选在端点，每次划分极不平衡，快排退化至O(n²)。优化方法：随机选取枢轴或三数取中。'),
    Q('q_ds6','ds','图','short','简述图的深度优先遍历（DFS）和广度优先遍历（BFS）的核心区别。',
      null, '递归;栈;队列;一条路;层层扩散',
      '核心区别：①DFS用**栈**（递归实现），沿一条路径走到底再回溯；②BFS用**队列**，按距离层层扩散访问；③时间复杂度相同（O(n+e)邻接表），但应用场景不同：DFS用于拓扑排序/连通分量，BFS用于无权图最短路径。'),
  ];

  const studyLog = [];
  const quizRecords = [];
  return {_schemaVersion: DATA_VERSION, subjects, knowledge, questions, quizRecords, studyLog};
}


let db;
let _loadResolve = null;
let _currentUser = null, _profile = null;   // 提前声明，避免 load() 中访问触发 TDZ
const _dbReady = new Promise(r => { _loadResolve = r; });

/* 数据迁移：确保数据格式与当前版本兼容 */
function migrateData(data) {
  const ver = data._schemaVersion || 0;
  if (ver >= DATA_VERSION) return data;

  // v0 → v1：确保基础结构存在
  if (!Array.isArray(data.quizRecords)) data.quizRecords = [];
  if (!Array.isArray(data.studyLog)) data.studyLog = [];
  if (!Array.isArray(data.questions)) data.questions = [];
  if (!Array.isArray(data.knowledge)) data.knowledge = [];
  if (!Array.isArray(data.subjects)) data.subjects = [];

  // v1 → v2：确保题目有 explain 字段、类型字段标准化
  if (ver < 2) {
    data.questions.forEach(function(q) {
      if (!q.explanation) q.explanation = '';
      if (!q.type || ['single','judge','fill','short'].indexOf(q.type) === -1) {
        q.type = q.options === null ? 'judge' : 'single';
      }
      // fill/short 类型将 answer 转为字符串
      if (q.type === 'fill' || q.type === 'short') {
        if (typeof q.answer !== 'string') q.answer = String(q.answer || '');
      }
    });
    data.knowledge.forEach(function(k) {
      if (!k.tags) k.tags = [];
      if (!k.lastReview) k.lastReview = null;
      if (!k.createdAt) k.createdAt = todayStr();
    });
  }

  data._schemaVersion = DATA_VERSION;
  return data;
}

async function load(){
  // SDK 就绪前用登录墙预覆盖，防止旧 DOM 短暂可见。Loading 屏在上层遮挡，
  // hideLoading() 由 onAuthStateChange 确认 session 后统一触发，避免 SDK 未就绪
  // 时 loading 先消失 → 露出 gate → SDK 就绪后才 hideGate → 登录墙闪现
  renderGate();
  if(sb){
    try{
      const uid = _currentUser ? _currentUser.id : null;
      const { data } = uid ? await sb.from('app_state').select('data').eq('user_id', uid).maybeSingle() : {data: null};
      if(data && data.data && data.data.subjects){
        db = migrateData(data.data);
        _loadResolve(db);
        setupRealtimeSync();
        return;
      }
    }catch(e){ console.warn('Supabase load failed:', e.message); _currentUser = null; }
  }
  try{ var lr = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('yanxueku_v1'); if(lr){ db = migrateData(JSON.parse(lr)); _loadResolve(db); setupRealtimeSync(); return; } }catch(e){}
  db = seedData();
  try{ await save(); }catch(e){ console.warn('save failed:', e.message); }
  _loadResolve(db);
  setupRealtimeSync();
}
function hideLoading(){
  // 120ms 延迟确保 DOM 渲染完成再隐藏加载屏
  setTimeout(function(){
    var s = document.getElementById('loading-screen');
    if(s && !s.classList.contains('done')) s.classList.add('done');
  }, 120);
}
// save 防抖合并：连续操作（复习/答题/编辑）只做一次持久化，避免全量 upsert 刷爆带宽与 API 配额
let _saveTimer = null, _savePending = false;
function _setSync(t, warn){
  const el = document.getElementById('sync-status');
  if(el){ el.textContent = t; el.style.color = warn ? 'var(--warn)' : ''; }
}
function doSave(){
  _savePending = false;
  db._schemaVersion = DATA_VERSION;
  // localStorage 始终写入作为降级备份（无 UI 提示，用户无感知）
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }catch(e){}
  if(sb && _currentUser){
    _setSync('同步中…');
    try{
      sb.from('app_state').upsert({ user_id: _currentUser.id, data: db, updated_at: new Date().toISOString() })
        .then(()=> _setSync('已保存'))
        .catch(()=> _setSync('保存失败，请检查网络', true));
    }catch(e){ _setSync('保存失败，请检查网络', true); }
  } else {
    _setSync('未登录，无法云端保存', true);
  }
}
function save(){
  if(_saveTimer) clearTimeout(_saveTimer);
  _savePending = true;
  _saveTimer = setTimeout(doSave, 400); // 400ms 窗口合并连续操作
}
function flushSave(){
  if(_savePending){ clearTimeout(_saveTimer); _saveTimer = null; doSave(); }
}
window.addEventListener('pagehide', flushSave);
document.addEventListener('visibilitychange', function(){ if(document.visibilityState==='hidden') flushSave(); });
function setupRealtimeSync(){
  if(!sb) return;
  sb.channel('app_state_changes')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_state', filter: 'user_id=eq.'+(_currentUser?_currentUser.id:'') },
      payload => {
        if(payload.new && payload.new.data && payload.new.data.subjects){
          const oldUpdated = new Date(db.updated_at||0).getTime();
          const newUpdated = new Date(payload.new.data.updated_at||0).getTime();
          if(newUpdated > oldUpdated){
            db = payload.new.data;
            if(curView) render();
            _defer(function(){ updateSidebarTimer(); }, 50);
            _defer(function(){ updateDashboardHeader(); }, 80);
          }
        }
      }
    ).subscribe();
}


function getSubject(id){ return db.subjects.find(s=>s.id===id); }
function addStudy(min){
  const t = todayStr();
  let rec = db.studyLog.find(r=>r.date===t);
  if(!rec){ rec = {date:t, minutes:0}; db.studyLog.push(rec); }
  rec.minutes += min;
  save();
}
function isDue(k){ return k.nextReview <= todayStr(); }
function dueList(){ return db.knowledge.filter(isDue).sort((a,b)=> a.nextReview < b.nextReview ? -1 : 1); }
function masteryLevel(k){ if(k.stage<=0) return 0; if(k.stage<=2) return 1; if(k.stage<=4) return 2; return 3; }
const MASTERY_NAMES = ['未掌握','初学','熟练','掌握'];
const MASTERY_COLORS = ['#94a3b8','#f59e0b','#0ea5e9','#10b981'];
function wrongList(){
  const latest = {};
  db.quizRecords.forEach(r=>{ latest[r.qid] = r; });
  return db.questions.filter(q=> latest[q.id] && !latest[q.id].correct);
}

/* ================= 主题 ================= */
function applyTheme(mode){
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = mode==='system' ? (prefersDark?'dark':'light') : mode;
  document.documentElement.setAttribute('data-theme', theme);
  const icons = {light:'☀️ 浅色', dark:'🌙 深色', system:'🌓 跟随系统'};
  const btn = document.getElementById('theme-btn');
  if(btn) btn.textContent = icons[mode] || mode;
  localStorage.setItem(THEME_KEY, mode);
  themeMode = mode;
}
let themeMode = localStorage.getItem(THEME_KEY) || 'system';
function cycleTheme(){
  const order = ['light','dark','system'];
  themeMode = order[(order.indexOf(themeMode)+1)%order.length];
  applyTheme(themeMode);
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ()=>{ if(themeMode==='system') applyTheme('system'); });

/* ================= 导航 ================= */
const VIEW_META = {
  dashboard:{title:'学习仪表盘', sub:''},
  library:{title:'知识库', sub:'按科目与章节组织你的专业课笔记'},
  review:{title:'记忆复习', sub:'基于艾宾浩斯遗忘曲线智能排期'},
  quiz:{title:'刷题自测', sub:'随机组卷 · 即时判分 · 解析回顾'},
  wrong:{title:'错题本', sub:'答错自动收录，重做正确后移除'},
  stats:{title:'学习统计', sub:'用数据看见自己的进步'},
  mine:{title:'我的', sub:'账号信息 · 偏好设置 · 数据管理'},
  'public-library':{title:'公共课程库', sub:'十大热门考研专业课 · 一键导入到个人科目'},
};

// === 视图状态管理 ===
let curView = 'dashboard';
let libFilter = {subject:'all', tag:'', search:''};

function switchView(name){
  _flushTimers(); // 清理前一个视图的挂起定时器/动画帧，防止在已销毁 DOM 上操作
  curView = name;
  document.querySelectorAll('.nav-item').forEach(n=> n.classList.toggle('active', n.dataset.view===name));
  document.querySelectorAll('.view').forEach(v=> v.classList.toggle('active', v.id==='view-'+name));
  const meta = VIEW_META[name];
  document.getElementById('page-title').textContent = meta.title;
  document.getElementById('page-sub').textContent = meta.sub;
  render();
  document.getElementById('content').scrollTop = 0;
  _analytics.page(name);
}
function toggleSidebar(){
  if(window.innerWidth<=767){
    const s=document.getElementById('sidebar');
    s.classList.toggle('open');
    let ov=document.getElementById('sidebar-overlay');
    if(!ov&&s.classList.contains('open')){
      ov=document.createElement('div');ov.id='sidebar-overlay';
      ov.onclick=()=>{s.classList.remove('open');ov.remove();};
      document.body.appendChild(ov);
    }
    if(ov){if(s.classList.contains('open')) ov.classList.add('open');else{ov.remove();}}
  } else {
    document.getElementById('sidebar').classList.toggle('collapsed');
  }
}
var _resizeTimer = 0;
window.addEventListener('resize', ()=>{
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(function(){
    if(window.innerWidth>767){
      var sb = document.getElementById('sidebar');
      if(sb) sb.classList.remove('open');
      var ov = document.getElementById('sidebar-overlay'); if(ov) ov.remove();
    }
  }, 200);
});

function render(){
  if(!_currentUser){ renderGate(); return; }
  hideGate();
  renderSidebar(); renderBadges();
  ({dashboard:renderDashboard, library:renderLibrary, review:renderReviewHome, quiz:renderQuizHome, wrong:renderWrong, stats:renderStats, mine:renderMine, 'public-library':renderPublicLibrary})[curView]();
}
function renderSidebar(){
  if(!db||!db.subjects) return;
  const el = document.getElementById('subj-list');
  if(!el) return;
  el.innerHTML = db.subjects.map(s=>{
    const cnt = db.knowledge.filter(k=>k.subjectId===s.id).length;
    const due = db.knowledge.filter(k=>k.subjectId===s.id && isDue(k)).length;
    return `<div class="subj-item" role="button" tabindex="0" onclick="switchView('library');setLibSubject('${s.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();switchView('library');setLibSubject('${s.id}')}">
      <span class="subj-dot" style="background:${safeColor(s.color)}"></span>${esc(s.name)}
      <span class="subj-count">${due>0? due+' 待复习 · ' : ''}${cnt}</span>
      <button class="subj-del" title="删除科目" onclick="delSubject('${s.id}',event)">✕</button></div>`;
  }).join('');
}
function renderBadges(){
  if(!db||!db.knowledge) return;
  const due = dueList().length;
  const b1 = document.getElementById('badge-due');
  if(b1){ b1.style.display = due? 'flex':'none'; b1.textContent = due; }
  const wn = wrongList().length;
  const b2 = document.getElementById('badge-wrong');
  if(b2){ b2.style.display = wn? 'flex':'none'; b2.textContent = wn; }
}

/* ================= 仪表盘 ================= */
function renderDashboard(){
  if(!db||!db.studyLog) return;
  const el = document.getElementById('view-dashboard');
  const t = todayStr();
  const due = dueList();
  const todayMin = (db.studyLog.find(r=>r.date===t)||{minutes:0}).minutes;
  const streak = calcStreak(t, db.studyLog);
  const mastered = db.knowledge.filter(k=>masteryLevel(k)===3).length;
  const totalQ = db.questions.length;
  const doneQ = new Set(db.quizRecords.map(r=>r.qid)).size;
  const correctQ = db.quizRecords.filter(r=>r.correct).length;
  const acc = db.quizRecords.length? Math.round(correctQ/db.quizRecords.length*100) : 0;
  const hour = new Date().getHours();
  const greet = hour<6?'夜深了':hour<12?'早上好':hour<14?'中午好':hour<18?'下午好':'晚上好';
  const dateStr = new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});

  // 未来7天复习计划
  const plan = [];
  for(let i=0;i<7;i++){
    const d = addDays(t,i);
    const n = db.knowledge.filter(k=>k.nextReview===d).length;
    const over = i===0 ? db.knowledge.filter(k=>k.nextReview<d).length : 0;
    plan.push({d, n: n+over, label: i===0?'今天': i===1?'明天': (d.slice(5).replace('-','/'))});
  }
  const maxPlan = Math.max(1, ...plan.map(p=>p.n));

  el.innerHTML = `
    
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:18px">
      <div>
        <h2 style="font-size:22px;font-weight:800">${greet}，考研人 💪</h2>
        <div style="color:var(--text-3);font-size:13px">${dateStr} · 今天的每一点积累，都是上岸的底气</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap" id="dash-header-right"></div>
    </div>
    <div class="grid-stats">
      <div class="stat-card" style="--sc:#ef4444">
        <div class="stat-ico">⏰</div>
        <div class="stat-num">${due.length}<small> 个</small></div>
        <div class="stat-label">今日待复习知识点</div>
      </div>
      <div class="stat-card" style="--sc:#6366f1">
        <div class="stat-ico">🔥</div>
        <div class="stat-num">${streak}<small> 天</small></div>
        <div class="stat-label">连续学习</div>
      </div>
      <div class="stat-card" style="--sc:#0ea5e9">
        <div class="stat-ico">⏱️</div>
        <div class="stat-num">${todayMin}<small> 分钟</small></div>
        <div class="stat-label">今日学习时长</div>
      </div>
      <div class="stat-card" style="--sc:#10b981">
        <div class="stat-ico">🏆</div>
        <div class="stat-num">${mastered}<small> / ${db.knowledge.length}</small></div>
        <div class="stat-label">已掌握知识点</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-title">📅 未来 7 天复习计划 <span class="sub">逾期任务已并入今天</span></div>
      <div style="display:flex;align-items:flex-end;gap:10px;height:110px;padding-top:6px">
        ${plan.map(p=>`
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end">
            <span style="font-size:12px;font-weight:700;color:${p.n?'var(--primary)':'var(--text-3)'}">${p.n||''}</span>
            <div style="width:100%;max-width:44px;height:${Math.round(p.n/maxPlan*72)}px;min-height:${p.n?6:2}px;border-radius:7px;background:${p.n?'var(--grad)':'var(--border)'};opacity:${p.n?1:.5};transition:height .5s"></div>
            <span style="font-size:11px;color:var(--text-3)">${p.label}</span>
          </div>`).join('')}
      </div>
    </div>

    ${!db.knowledge.length?`
    <div class="panel" style="border-color:rgba(99,102,241,.3);background:rgba(99,102,241,.05)">
      <div class="panel-title">🚀 三步开始你的考研学习</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
        <div style="padding:14px;border-radius:12px;background:var(--surface);border:1px solid var(--border)">
          <div style="font-size:20px">①</div>
          <div style="font-weight:700;margin:6px 0 2px">新建科目</div>
          <div style="font-size:12px;color:var(--text-3)">比如：专业课一、英语</div>
          <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:10px;padding:8px" onclick="openNewSubjectModal(event)">＋ 新建科目</button>
        </div>
        <div style="padding:14px;border-radius:12px;background:var(--surface);border:1px solid var(--border)">
          <div style="font-size:20px">②</div>
          <div style="font-weight:700;margin:6px 0 2px">记录知识点</div>
          <div style="font-size:12px;color:var(--text-3)">标题 + 内容，支持 Markdown</div>
          <button class="btn btn-ghost" style="width:100%;justify-content:center;margin-top:10px;padding:8px" onclick="openKwModal()">＋ 记知识点</button>
        </div>
        <div style="padding:14px;border-radius:12px;background:var(--surface);border:1px solid var(--border)">
          <div style="font-size:20px">③</div>
          <div style="font-weight:700;margin:6px 0 2px">开始复习</div>
          <div style="font-size:12px;color:var(--text-3)">按艾宾浩斯节奏巩固</div>
          <button class="btn btn-ghost" style="width:100%;justify-content:center;margin-top:10px;padding:8px" onclick="switchView('library')">去知识库看看</button>
        </div>
      </div>
    </div>`:''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px" class="dash-2col">
      <div class="panel">
        <div class="panel-title">⚡ 快捷操作</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <button class="btn btn-primary" style="justify-content:center;padding:15px" onclick="startReview()">🧠 开始复习</button>
          <button class="btn btn-ghost" style="justify-content:center;padding:15px" onclick="switchView('quiz')">✍️ 随机自测</button>
          <button class="btn btn-ghost" style="justify-content:center;padding:15px" onclick="openKwModal()">＋ 记知识点</button>
          <button class="btn btn-ghost" style="justify-content:center;padding:15px" onclick="switchView('stats')">📊 学习统计</button>
        </div>
      </div>
      <div class="panel">
        <div class="panel-title">🎯 刷题概况</div>
        <div style="display:flex;gap:22px;align-items:center;flex-wrap:wrap">
          <div>
            <div style="font-size:26px;font-weight:800">${acc}%</div>
            <div style="font-size:12px;color:var(--text-3)">答题正确率</div>
          </div>
          <div>
            <div style="font-size:26px;font-weight:800">${doneQ}<span style="font-size:13px;color:var(--text-3)"> / ${totalQ}</span></div>
            <div style="font-size:12px;color:var(--text-3)">已练习题目</div>
          </div>
          <div>
            <div style="font-size:26px;font-weight:800;color:var(--danger)">${wrongList().length}</div>
            <div style="font-size:12px;color:var(--text-3)">待攻克错题</div>
          </div>
        </div>
      </div>
    </div>

    <div class="panel" id="dash-leader-wrap" style="margin-top:20px;display:none">
      <div class="panel-title">🏅 学习排行榜 <span class="sub" style="cursor:pointer;color:var(--primary)" onclick="switchView('stats')">查看完整排行 →</span></div>
      <div id="dash-leader-panel" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px"></div>
    </div>`;
  _defer(loadDashLeader, 120);
}

/* ================= 科目删除 ================= */
function delSubject(id, ev){
  if(ev) ev.stopPropagation();
  const s = getSubject(id);
  if(!s) return;
  const kwN = db.knowledge.filter(k=>k.subjectId===id).length;
  const qN = db.questions.filter(q=>q.subjectId===id).length;
  openModal(`
    <button class="modal-close" onclick="closeModal()">✕</button>
    <h3>⚠️ 删除科目「${esc(s.name)}」</h3>
    <p style="color:var(--text-2);line-height:1.9">该科目下的以下内容将被一并删除，且不可恢复：</p>
    <div class="review-info" style="margin:12px 0">
      <span>📚 <b>${kwN}</b> 个知识点（含复习进度）</span>
      <span>✍️ <b>${qN}</b> 道题目（含答题记录）</span>
    </div>
    <p style="color:var(--text-3);font-size:12px">建议先通过侧栏「⬇ 导出」备份全部数据。</p>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" style="background:#ef4444" onclick="doDelSubject('${id}')">确认删除</button>
    </div>`);
}
function doDelSubject(id){
  const s = getSubject(id);
  const qids = new Set(db.questions.filter(q=>q.subjectId===id).map(q=>q.id));
  db.subjects = db.subjects.filter(x=>x.id!==id);
  db.knowledge = db.knowledge.filter(k=>k.subjectId!==id);
  db.questions = db.questions.filter(q=>q.subjectId!==id);
  db.quizRecords = db.quizRecords.filter(r=>!qids.has(r.qid));
  if(libFilter.subject===id) libFilter.subject = 'all';
  save(); closeModal(); render();
  toast(`科目「${esc(s.name)}」已删除`,'info');
}

/* ================= 新建科目 ================= */
function openNewSubjectModal(ev){
  if(ev) ev.stopPropagation();
  openModal(
    '<button class="modal-close" onclick="closeModal()">✕</button>'+
    '<h3>＋ 新建专业科目</h3>'+
    '<div class="form-row"><label>科目名称 *</label><input id="ns-name" placeholder="如：传播学教程"></div>'+
    '<div class="form-row"><label>考试名称</label><input id="ns-exam" placeholder="如：新闻与传播 440"></div>'+
    '<div class="form-row"><label>科目颜色</label><div class="color-picker" id="ns-colors"></div><input type="hidden" id="ns-hidden-color" value="#6366f1"></div>'+
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="confirmNewSubject()">创建科目</button></div>');
  var colors = ['#6366f1','#e11d48','#0ea5e9','#f59e0b','#10b981','#8b5cf6','#0891b2','#ca8a04','#dc2626','#16a34a'];
  function fillColorPicker(){
    var el = document.getElementById('ns-colors');
    if(!el){ requestAnimationFrame(fillColorPicker); return; }
    el.innerHTML = colors.map(function(c){
      return '<span style="background:'+c+'" data-color="'+c+'" onclick="var p=this.parentElement;p.querySelectorAll(\'span\').forEach(function(s){s.classList.remove(\'sel\')});this.classList.add(\'sel\');document.getElementById(\'ns-hidden-color\').value=\''+c+'\'"></span>';
    }).join('');
  }
  fillColorPicker();
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

/* ================= 数据重置 ================= */
function resetStats(){
  openModal(`
    <button class="modal-close" onclick="closeModal()">✕</button>
    <h3>🔄 重置学习数据</h3>
    <p style="color:var(--text-2);line-height:1.9">此操作将清空以下数据：</p>
    <div class="review-info" style="margin:12px 0">
      <span>⏱️ 学习时长与打卡记录</span>
      <span>✍️ 刷题答题记录与错题本</span>
      <span>🧠 所有知识点的复习进度（回到初始状态）</span>
    </div>
    <p style="color:var(--text-3);font-size:12px">知识点本身（标题/内容）不会删除。此操作不可恢复，建议先导出备份。</p>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" style="background:#f59e0b" onclick="doResetStats()">确认重置</button>
    </div>`);
}
function doResetStats(){
  const t = todayStr();
  db.studyLog = [{date: t, minutes: 0}]; _activeSeconds = 0;
  db.quizRecords = [];
  db.knowledge.forEach(k => { k.stage = 0; k.nextReview = t; k.lastReview = null; });
  save(); closeModal(); render();
  toast('学习数据已重置 ✅','info');
}

/* ================= 导入导出 ================= */
function exportData(){
  const blob = new Blob([JSON.stringify(db, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '研学库备份_'+todayStr()+'.json';
  a.click();
  URL.revokeObjectURL(a.href);
  _analytics.dataExport(db.knowledge.length);
  toast('数据已导出 📦','ok');
}
// 导入数据消毒：结构校验 + 字段限长/类型清洗，防恶意 JSON（超长字段撑爆 localStorage、非法结构导致应用崩溃）

// === 数据安全（导入消毒） ===
function sanitizeImport(d){
  if(!d || typeof d !== 'object') return null;
  if(!Array.isArray(d.subjects) || !Array.isArray(d.knowledge)) return null;
  var out = {subjects:[], knowledge:[], questions:[], quizRecords:[], studyLog:[]};
  out.subjects = d.subjects.slice(0,200).map(function(s){
    return {id:String(s&&s.id||'').slice(0,40), name:String(s&&s.name||'未命名').slice(0,50),
            color:safeColor(s&&s.color), exam:String(s&&s.exam||'').slice(0,100)};
  });
  out.knowledge = d.knowledge.slice(0,20000).map(function(k){
    return {id:String(k&&k.id||'').slice(0,40), subjectId:String(k&&k.subjectId||'').slice(0,40),
            chapter:String(k&&k.chapter||'未分章').slice(0,100), title:String(k&&k.title||'').slice(0,200),
            content:String(k&&k.content||'').slice(0,20000),
            tags:(Array.isArray(k&&k.tags)?k.tags:[]).slice(0,50).map(function(t){return String(t||'').slice(0,50);}),
            stage:Math.max(0,Math.min(6,parseInt(k&&k.stage)||0)),
            nextReview:String(k&&k.nextReview||'').slice(0,10),
            lastReview:k&&k.lastReview?String(k.lastReview).slice(0,10):null,
            createdAt:String(k&&k.createdAt||'').slice(0,10)};
  });
  out.questions = (Array.isArray(d.questions)?d.questions:[]).slice(0,10000).map(function(q){
    var qType = q&&q.type ? q.type : (q&&q.options===null?'judge':'single');
    if (['single','judge','fill','short'].indexOf(qType) === -1) qType = 'single';
    var answer = q&&q.answer;
    if (qType === 'fill' || qType === 'short') {
      answer = String(answer != null ? answer : '');
    } else {
      answer = parseInt(answer) || 0;
    }
    return {id:String(q&&q.id||'').slice(0,40), subjectId:String(q&&q.subjectId||'').slice(0,40),
            chapter:String(q&&q.chapter||'').slice(0,100), type: qType,
            question:String(q&&q.question||'').slice(0,2000),
            options:(Array.isArray(q&&q.options)?q.options:[]).slice(0,10).map(function(o){return String(o||'').slice(0,1000);}),
            answer: answer, explanation:String(q&&q.explanation||'').slice(0,5000)};
  });
  out.quizRecords = (Array.isArray(d.quizRecords)?d.quizRecords:[]).slice(0,100000).map(function(r){
    return {qid:String(r&&r.qid||'').slice(0,40), correct:!!(r&&r.correct), date:String(r&&r.date||'').slice(0,10)};
  });
  out.studyLog = (Array.isArray(d.studyLog)?d.studyLog:[]).slice(0,5000).map(function(r){
    return {date:String(r&&r.date||'').slice(0,10), minutes:Math.max(0,parseInt(r&&r.minutes)||0)};
  });
  return out;
}
let _pendingImportData = null;
function importData(ev){
  const f = ev.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = e=>{
    try{
      const data = JSON.parse(e.target.result);
      const clean = sanitizeImport(data);
      if(!clean) throw new Error('格式不正确');
      _pendingImportData = clean;
      showImportConfirm(f.name, clean);
    }catch(err){ toast('导入失败：文件格式不正确','err'); }
  };
  reader.readAsText(f);
  ev.target.value = '';
}
function showImportConfirm(fname, data){
  // 导入前自动导出当前数据作为备份
  try{
    const backupBlob = new Blob([JSON.stringify(db, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(backupBlob);
    a.download = '研学库备份_导入前_'+todayStr()+'.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }catch(e){ console.warn('自动备份失败:', e.message); }

  openModal({
    title: '⬆ 确认恢复备份',
    body: `<div style="color:var(--text-2);line-height:1.8;margin-bottom:12px">
      即将从 <b>${esc(fname)}</b> 恢复数据，当前数据将被覆盖。<br>
      已自动下载当前数据备份到本地。
    </div>
    <div class="review-info" style="margin:12px 0">
      <span>📚 <b>${data.subjects.length}</b> 个科目</span>
      <span>🧠 <b>${data.knowledge.length}</b> 个知识点</span>
      <span>✍️ <b>${data.questions.length}</b> 道题目</span>
      <span>📝 <b>${data.quizRecords.length}</b> 条答题记录</span>
    </div>
    <div style="font-size:12px;color:var(--warn)">⚠️ 此操作不可恢复，请确认后继续。</div>`,
    actions: [
      {text: '取消', class: 'btn btn-ghost', onclick: 'closeModal(); _pendingImportData=null;'},
      {text: '确认恢复', class: 'btn btn-primary', onclick: 'confirmImportData()'}
    ]
  });
}
function confirmImportData(){
  if(!_pendingImportData) return;
  db = _pendingImportData;
  _pendingImportData = null;
  save(); closeModal(); render();
  _analytics.dataImport(data.knowledge.length);
  toast('导入成功，数据已恢复 ✅','ok');
}

/* ================= 卡包导出/导入（分享生态） ================= */
/* 导出卡包：将当前筛选/选中科目的知识点与题目打包为 .json 文件 */
function exportCardPack(){
  var selectedSubjects = libFilter.subject !== 'all' ? [libFilter.subject] : null;
  var packKw = db.knowledge.slice();
  var packQ = db.questions.slice();

  if (selectedSubjects) {
    packKw = packKw.filter(function(k){ return selectedSubjects.indexOf(k.subjectId) !== -1; });
    packQ = packQ.filter(function(q){ return selectedSubjects.indexOf(q.subjectId) !== -1; });
  }

  if (!packKw.length && !packQ.length) {
    toast('当前没有可导出的内容，请先创建知识点或题目','err');
    return;
  }

  var subjectMap = {};
  db.subjects.forEach(function(s){ subjectMap[s.id] = s; });

  var pack = {
    _packVersion: 1,
    _packName: '研学库卡包',
    _exportedAt: todayStr(),
    _subjectCount: Object.keys(
      packKw.reduce(function(acc, k){ acc[k.subjectId]=1; return acc; },
      packQ.reduce(function(acc, q){ acc[q.subjectId]=1; return acc; }, {}))
    ).length,
    _kwCount: packKw.length,
    _qCount: packQ.length,
    subjects: (selectedSubjects || Object.keys(subjectMap)).map(function(sid){
      var s = subjectMap[sid];
      return s ? {id: s.id, name: s.name, color: s.color, exam: s.exam} : null;
    }).filter(Boolean),
    knowledge: packKw,
    questions: packQ
  };

  var blob = new Blob([JSON.stringify(pack, null, 2)], {type: 'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '研学库卡包_' + todayStr() + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  _analytics.packExported(pack._kwCount, pack._qCount);
  toast('卡包已导出 📦（' + pack._kwCount + ' 个知识点 + ' + pack._qCount + ' 道题目）', 'ok');
}

/* 导入卡包文件 */
function importCardPackFile(ev){
  var f = ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  var reader = new FileReader();
  reader.onload = function(e){
    try {
      var pack = JSON.parse(e.target.result);
      if (!pack.knowledge || !Array.isArray(pack.knowledge)) {
        toast('卡包格式不正确，缺少知识点数据','err'); return;
      }
      _pendingPackData = pack;
      showPackImportPreview(f.name, pack);
    } catch(err) { toast('导入失败：文件格式不正确','err'); }
  };
  reader.readAsText(f);
}

var _pendingPackData = null;

function showPackImportPreview(fname, pack){
  var kwCount = (pack.knowledge || []).length;
  var qCount = (pack.questions || []).length;
  var subjNames = (pack.subjects || []).map(function(s){ return esc(s.name); }).join('、') || '未指定';
  var dupCheck = 0;
  (pack.knowledge || []).forEach(function(k){
    if (db.knowledge.some(function(ex){ return ex.title === k.title; })) dupCheck++;
  });

  // 去掉卡包自身的 subjects 字段来匹配导入
  openModal({
    title: '📦 导入卡包',
    body: '<div style="color:var(--text-2);line-height:1.8;margin-bottom:12px">' +
      '即将从 <b>' + esc(fname) + '</b> 导入卡包数据。<br>' +
      '新科目将自动创建，同名卡片将自动加编号区分。' +
      '</div>' +
      '<div class="review-info" style="margin:12px 0">' +
        '<span>📚 科目：<b>' + subjNames + '</b></span>' +
        '<span>🧠 <b>' + kwCount + '</b> 个知识点</span>' +
        '<span>✍️ <b>' + qCount + '</b> 道题目</span>' +
        (dupCheck ? '<span style="color:var(--warn)">⚠️ ' + dupCheck + ' 张同名卡片</span>' : '') +
      '</div>' +
      '<div style="font-size:12px;color:var(--text-3)">导入后可在知识库中筛选、编辑和删除。</div>',
    actions: [
      {text: '取消', class: 'btn btn-ghost', onclick: 'closeModal(); _pendingPackData=null;'},
      {text: '确认导入', class: 'btn btn-primary', onclick: 'confirmPackImport()'}
    ]
  });
}

function confirmPackImport(){
  if (!_pendingPackData) return;
  var pack = _pendingPackData;
  _pendingPackData = null;

  // 合并科目（按名称查重，不存在则新建）
  var subjIdMap = {};
  (pack.subjects || []).forEach(function(s){
    var exist = db.subjects.find(function(x){ return x.name === s.name; });
    if (exist) { subjIdMap[s.id] = exist.id; }
    else {
      var palette = ['#e11d48','#7c3aed','#0891b2','#ca8a04','#16a34a','#dc2626','#2563eb','#6366f1','#10b981','#f59e0b','#ec4899','#14b8a6'];
      var newId = uid();
      db.subjects.push({id: newId, name: s.name, color: s.color || palette[db.subjects.length % palette.length], exam: s.exam || ''});
      subjIdMap[s.id] = newId;
    }
  });

  // 导入知识点
  var addedKw = 0, addedQ = 0;
  var titleCount = {};
  (pack.knowledge || []).forEach(function(k){
    titleCount[k.title] = (titleCount[k.title] || 0) + 1;
    var newTitle = titleCount[k.title] > 1 ? k.title + ' (' + titleCount[k.title] + ')' : k.title;
    var existsInDb = db.knowledge.some(function(ex){ return ex.title === newTitle; });
    if (existsInDb) return;

    db.knowledge.push({
      id: uid(), subjectId: subjIdMap[k.subjectId] || db.subjects[0].id,
      chapter: k.chapter || '导入', title: newTitle,
      content: k.content || '', tags: (k.tags || []).slice(0,20),
      stage: 0, nextReview: todayStr(), lastReview: null,
      createdAt: todayStr()
    });
    addedKw++;
  });

  // 导入题目
  (pack.questions || []).forEach(function(q){
    var qType = q.type;
    if (['single','judge','fill','short'].indexOf(qType) === -1) qType = 'single';
    db.questions.push({
      id: uid(), subjectId: subjIdMap[q.subjectId] || db.subjects[0].id,
      chapter: q.chapter || '导入', type: qType,
      question: q.question || '', options: q.options || null,
      answer: qType === 'fill' || qType === 'short' ? String(q.answer || '') : (parseInt(q.answer) || 0),
      explanation: q.explanation || ''
    });
    addedQ++;
  });

  save(); closeModal(); render();
  _analytics.packImported(addedKw, addedQ);
  toast('卡包导入完成 ✅（+' + addedKw + ' 知识点，+' + addedQ + ' 题）','ok');
}

/* ================= 弹窗 & 提示 ================= */
// 安全弹窗构建：接收对象 {title, body, actions} 时自动转义所有文本，避免 XSS
function buildSafeModal(opts){
  const title = opts.title ? `<h3>${esc(opts.title)}</h3>` : '';
  const body = opts.body || '';
  const actions = (opts.actions || []).map(a => {
    const cls = a.class || 'btn btn-ghost';
    if(a.onclick) return `<button class="${esc(cls)}" onclick="${a.onclick}">${esc(a.text)}</button>`;
    return `<button class="${esc(cls)}" onclick="closeModal()">${esc(a.text)}</button>`;
  }).join('');
  return (opts.close !== false ? '<button class="modal-close" onclick="closeModal()">✕</button>' : '') +
    title + body +
    (actions ? `<div class="modal-actions">${actions}</div>` : '');
}
function openModal(html){
  const root = document.getElementById('modal-root');
  // 支持对象式安全调用：openModal({title, body, actions})
  const content = typeof html === 'object' && html !== null ? buildSafeModal(html) : html;
  root.innerHTML = `<div class="modal-mask" onclick="closeModal()"></div><div class="modal">${content}</div>`;
  root.classList.add('open');
  document.body.classList.add('modal-open'); // 锁背景滚动
}
function closeModal(){
  const root = document.getElementById('modal-root');
  const modal = root.querySelector('.modal');
  if(modal && !modal.classList.contains('closing')){
    modal.classList.add('closing');
    _defer(function(){ root.classList.remove('open'); root.innerHTML = ''; document.body.classList.remove('modal-open'); }, 180);
    return;
  }
  root.classList.remove('open'); root.innerHTML = '';
  document.body.classList.remove('modal-open');
}
function toast(msg, type){
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast '+(type||'info');
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>el.remove(), 300); }, 2600);
}
document.addEventListener('keydown', e=>{
  if(e.key==='Escape') closeModal();
  if(e.key===' ' && curView==='review' && reviewQueue.length && !e.target.matches('input,textarea')){
    const fc = document.getElementById('fcard');
    if(fc){ e.preventDefault(); fc.classList.toggle('flipped'); }
  }
});

/* ================= 启动 ================= */
applyTheme(themeMode);
load();
render();

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
    b2.id = 'guide-bubble';
    b2.innerHTML = '<b>📖 从新建知识点开始</b><br>点击右上角「＋ 记知识点」创建专属知识库。<br>支持批量导入真经笔记文本、手动逐条录入。<br><button class="guide-next" onclick="closeGuide()">明白了</button>';
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

/* ====== 登录首页：暗色渐变 + 毛玻璃 + 极光特效 ====== */
function renderGate(){
  let g = document.getElementById('login-gate');
  if(!g){
    g = document.createElement('div');
    g.id = 'login-gate';
    g.innerHTML =
      '<div class="gate-geo gate-geo-ring" style="left:8%;top:18%"></div>'+
      '<div class="gate-geo gate-geo-square" style="right:12%;top:25%"></div>'+
      '<div class="gate-geo gate-geo-triangle" style="left:15%;bottom:22%"></div>'+
      '<div class="gate-geo gate-geo-ring" style="right:10%;bottom:30%;width:60px;height:60px"></div>'+
      '<div class="gate-particle" style="left:25%;top:15%;width:4px;height:4px;animation-delay:0s"></div>'+
      '<div class="gate-particle" style="left:70%;top:30%;width:3px;height:3px;animation-delay:1.2s"></div>'+
      '<div class="gate-particle" style="left:40%;top:70%;width:5px;height:5px;animation-delay:2.5s"></div>'+
      '<div class="gate-particle" style="right:20%;top:60%;width:3px;height:3px;animation-delay:0.7s"></div>'+
      '<div class="gate-particle" style="left:60%;top:80%;width:4px;height:4px;animation-delay:1.8s"></div>'+
      '<div class="gate-particle" style="right:30%;top:12%;width:5px;height:5px;animation-delay:3.1s"></div>'+
      // 首屏：Hero 卡片 + 滚动箭头（占满一整屏）
      '<div class="gate-hero">'+
      '<div class="gate-card">'+
        '<div class="gate-logo">研</div>'+
        '<h2>研学库 · 考研专业课学习系统</h2>'+
        '<div class="gate-subtitle">基于艾宾浩斯遗忘曲线的智能复习工具<br>一人一号 · 云端同步 · 知识库 + 刷题 + 错题</div>'+
        '<div class="gate-features">'+
          '<div class="gate-feat" data-tip="基于艾宾浩斯遗忘曲线\n智能排期，在遗忘临界点\n精准推送复习卡片">'+
            '<div class="gf-icon">🧠</div><span>科学记忆</span></div>'+
          '<div class="gate-feat" data-tip="10大热门考研专业课\n505张真实知识点卡片\n打开即用，无需手动录入">'+
            '<div class="gf-icon">📚</div><span>10科505卡片</span></div>'+
          '<div class="gate-feat" data-tip="单选·判断·填空·简答\n四种题型随机组卷\n答错自动收录错题本">'+
            '<div class="gf-icon">✍️</div><span>智能刷题</span></div>'+
          '<div class="gate-feat" data-tip="一人一号专属存储\n手机电脑数据实时同步\n登录即可跨设备访问">'+
            '<div class="gf-icon">☁️</div><span>云端同步</span></div>'+
        '</div>'+
        '<div class="gate-legal">'+
          '<label><input type="checkbox" id="gate-agree" style="margin-right:6px">'+
          '我已阅读并同意 <a href="terms.html" target="_blank" onclick="event.stopPropagation()">服务条款</a> 和 <a href="privacy.html" target="_blank" onclick="event.stopPropagation()">隐私政策</a></label>'+
        '</div>'+
        '<button class="gate-btn" onclick="gateLogin()">👤 登录 / 注册</button>'+
      '</div>'+
      '<div class="gate-scroll-indicator" onclick="document.querySelector(\'.gate-features-section\').scrollIntoView({behavior:\'smooth\'})" title="向下滚动"></div>'+
      '</div>'+ // 关闭 gate-hero
      // 功能展示区（第二屏）
      '<div class="gate-features-section">'+
        '<h2 class="gate-section-title">为什么选择研学库？</h2>'+
        '<div class="gate-section-divider"></div>'+
        '<div class="gate-showcase">'+
          // 功能1: 科学记忆
          '<div class="gate-showcase-card" style="--i:0">'+
            '<div class="gate-sc-icon" style="background:linear-gradient(135deg,#6366f1,#8b5cf6)">🧠</div>'+
            '<h3>艾宾浩斯智能复习</h3>'+
            '<p>基于遗忘曲线科学排期，在记忆临界点精准推送复习。1-2-4-7-15-30-60天七轮强化，从短期记忆到长期掌握。</p>'+
            '<ul><li>自动计算每张卡片的复习时间</li><li>翻卡评分：难/一般/简单，动态调整间隔</li><li>可视化今日待复习数量</li></ul>'+
          '</div>'+
          // 功能2: 知识库
          '<div class="gate-showcase-card" style="--i:1">'+
            '<div class="gate-sc-icon" style="background:linear-gradient(135deg,#10b981,#14b8a6)">📚</div>'+
            '<h3>结构化知识库</h3>'+
            '<p>按科目 → 章节 → 标签三层组织专业课笔记。支持 Markdown 排版、代码高亮、挖空记忆。</p>'+
            '<ul><li>10大热门考研专业 · 505张预置卡片</li><li>公共课程库一键导入到个人科目</li><li>单张创建 / 文本批量导入 / 卡包分享</li></ul>'+
          '</div>'+
          // 功能3: 刷题自测
          '<div class="gate-showcase-card" style="--i:2">'+
            '<div class="gate-sc-icon" style="background:linear-gradient(135deg,#f59e0b,#ec4899)">✍️</div>'+
            '<h3>多题型智能刷题</h3>'+
            '<p>单选、判断、填空、简答四种题型随机组卷，即时判分，答错自动收录错题本。</p>'+
            '<ul><li>填空精确匹配 / 简答关键词评分</li><li>错题本支持原题型重做</li><li>每题附详细解析 + 参考答案</li></ul>'+
          '</div>'+
          // 功能4: 学习统计
          '<div class="gate-showcase-card" style="--i:3">'+
            '<div class="gate-sc-icon" style="background:linear-gradient(135deg,#3b82f6,#0ea5e9)">📊</div>'+
            '<h3>数据驱动的学习追踪</h3>'+
            '<p>连续学习天数、每日学习时长、考研倒计时、各科掌握度分布一目了然。</p>'+
            '<ul><li>日/周学习日历热力图</li><li>四阶段掌握度：初学→熟悉→熟练→精通</li><li>自定义每日目标 + 考研日倒计时</li></ul>'+
          '</div>'+
          // 功能5: 云端同步
          '<div class="gate-showcase-card" style="--i:4">'+
            '<div class="gate-sc-icon" style="background:linear-gradient(135deg,#6366f1,#ec4899)">☁️</div>'+
            '<h3>云端安全同步</h3>'+
            '<p>一人一号专属存储，手机电脑浏览器数据实时同步。登录即可随时随地继续学习。</p>'+
            '<ul><li>Supabase 托管 · 端到端加密传输</li><li>数据导出 / 卡包分享 / 备份恢复</li><li>支持学习小组成员实时同步进度</li></ul>'+
          '</div>'+
          // 功能6: 学习计时
          '<div class="gate-showcase-card" style="--i:5">'+
            '<div class="gate-sc-icon" style="background:linear-gradient(135deg,#8b5cf6,#6366f1)">⏱</div>'+
            '<h3>沉浸式学习计时器</h3>'+
            '<p>侧栏实时显示今日学习时长，复习和刷题自动计入。累计统计帮你看见自己的成长。</p>'+
            '<ul><li>60秒无操作自动暂停计分</li><li>番茄钟模式（后续版本支持）</li><li>排行榜与同学互相激励</li></ul>'+
          '</div>'+
        '</div>'+
        // 页脚
        '<div class="gate-footer">'+
          '<div class="gate-footer-grid">'+
            '<div class="gate-footer-col">'+
              '<div class="gate-footer-title">研学库</div>'+
              '<p>考研专业课高效学习系统。基于艾宾浩斯遗忘曲线的智能复习工具，让记忆更科学。</p>'+
            '</div>'+
            '<div class="gate-footer-col">'+
              '<div class="gate-footer-title">功能</div>'+
              '<a href="javascript:void(0)">知识库管理</a>'+
              '<a href="javascript:void(0)">智能复习</a>'+
              '<a href="javascript:void(0)">刷题自测</a>'+
              '<a href="javascript:void(0)">错题本</a>'+
            '</div>'+
            '<div class="gate-footer-col">'+
              '<div class="gate-footer-title">资源</div>'+
              '<a href="public-library.json" target="_blank">公共课程库 JSON</a>'+
              '<a href="javascript:void(0)">导出数据备份</a>'+
              '<a href="javascript:void(0)">卡包分享</a>'+
              '<a href="README.md" target="_blank">项目文档</a>'+
            '</div>'+
            '<div class="gate-footer-col">'+
              '<div class="gate-footer-title">联系我们</div>'+
              '<a href="https://github.com/luckyboom1/yanxueku/issues" target="_blank">GitHub Issues · 反馈</a>'+
              '<a href="https://github.com/luckyboom1/yanxueku" target="_blank">GitHub 仓库 · 开源</a>'+
              '<a href="privacy.html" target="_blank">隐私政策</a>'+
              '<a href="terms.html" target="_blank">服务条款</a>'+
            '</div>'+
          '</div>'+
          '<div class="gate-footer-bottom">'+
            '<span>研学库 v2.3 · MIT License</span>'+
            '<span>Powered by <b>GitHub Pages</b> · <b>Supabase</b> · <b>Cloudflare</b></span>'+
            '<span>© 2026 研学库 · 仅供学习交流使用</span>'+
          '</div>'+
        '</div>'+
      '</div>';
    document.body.appendChild(g);
  }
  g.style.display = 'block';
  g.style.overflowY = 'auto';
}
function hideGate(){
  const g = document.getElementById('login-gate');
  if(g) g.style.display = 'none';
}
function gateLogin(){
  var cb = document.getElementById('gate-agree');
  if(!cb || !cb.checked){ toast('请先阅读并勾选同意服务条款和隐私政策','warn'); return; }
  openAuthModal();
}

/* ====== 学习计时器 ====== */
let _timerInterval = null;
function updateSidebarTimer(){
  if(!db||!db.studyLog) return;
  const t = todayStr();
  const todayRec = db.studyLog.find(r=>r.date===t);
  const m = todayRec ? todayRec.minutes : 0;
  const el = document.getElementById('sidebar-timer');
  if(el) el.textContent = String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
  const totalMin = db.studyLog.reduce((s,r)=>s+r.minutes,0);
  const totalEl = document.getElementById('sidebar-total');
  if(totalEl) totalEl.textContent = Math.floor(totalMin/60)+'时'+totalMin%60+'分';
}
function startTimer(){
  if(_timerInterval) clearInterval(_timerInterval);
  _timerInterval = setInterval(updateSidebarTimer, 1000);
  updateSidebarTimer();
}
// save hook: 每次保存后刷新 UI
const _origSaveFunc = save;
save = function(){
  const r = _origSaveFunc.apply(this, arguments);
  if(r && r.then) r.then(updateSidebarTimer); else updateSidebarTimer();
  return r;
};

// 学习时自动 +1 分钟（每 60 秒检测活跃状态）
let _activeSeconds = 0;
let _activeTimer = null;
/* 页面卸载时清理定时器 */
window.addEventListener('pagehide', function(){ if(_activeTimer){ clearInterval(_activeTimer); _activeTimer = null; } });
function startActivityTracking(){
  if(_activeTimer) return;
  _activeTimer = setInterval(()=>{
    if(document.visibilityState === 'visible'){
      _activeSeconds++;
      if(!db||!db.studyLog){ _activeSeconds=0; return; }
      if(_activeSeconds >= 60){
        _activeSeconds = 0;
        const t = todayStr();
        let rec = db.studyLog.find(r=>r.date===t);
        if(!rec){ rec = {date:t, minutes:0}; db.studyLog.push(rec); }
        rec.minutes++;
        save();
        updateSidebarTimer();
      }
    }
  }, 1000);
}

// Deferred start after DB loads
_dbReady.then(function(){
  try{ startTimer(); }catch(e){}
  try{ startActivityTracking(); }catch(e){}
  // 首次使用引导
  if(!localStorage.getItem('yanxueku_guided')){
    setTimeout(showFirstGuide, 800);
  }
});


/* ====== v3.1: 挖空模式 + 倒计时 + 每日目标 ====== */

// --- 挖空模式 ---

// === 挖空模式 ===
let blanksMode = false;
let blankAnswers = [];
function toggleBlanksMode(){
  blanksMode = !blanksMode;
  const el = document.querySelector('.fc-back');
  if(!el) return;
  if(blanksMode){
    el.classList.add('blanks-mode');
    // 解析当前背面内容，隐藏 <b> 和 <code> 标签，替换为可点击的填空
    const original = el.innerHTML;
    if(!el.dataset.blanksOriginal) el.dataset.blanksOriginal = original;
    const bolds = el.querySelectorAll('b');
    const codes = el.querySelectorAll('code');
    blankAnswers = [];
    bolds.forEach(b => {
      const txt = b.textContent.trim();
      if(txt.length < 2 || txt.length > 25) return;
      const span = document.createElement('span');
      span.className = 'blank-reveal'; span.textContent = txt;
      span.dataset.answer = txt;
      span.onclick = function(){ this.classList.add('revealed'); this.textContent = this.dataset.answer; };
      b.replaceWith(span);
      blankAnswers.push({el: span, txt: txt});
    });
    codes.forEach(c => {
      const txt = c.textContent.trim();
      if(txt.length < 2 || txt.length > 20) return;
      const span = document.createElement('span');
      span.className = 'blank-reveal'; span.textContent = txt;
      span.dataset.answer = txt;
      span.onclick = function(){ this.classList.add('revealed'); this.textContent = this.dataset.answer; };
      c.replaceWith(span);
      blankAnswers.push({el: span, txt: txt});
    });
    // 添加计数提示
    if(blankAnswers.length > 0){
      const hint = document.createElement('div');
      hint.className = 'blank-count';
      hint.id = 'blank-hint';
      hint.textContent = '🔍 '+blankAnswers.length+' 个挖空 · 点击依次揭示';
      el.appendChild(hint);
    }
  }else{
    el.classList.remove('blanks-mode');
    el.innerHTML = el.dataset.blanksOriginal || el.innerHTML;
    el.dataset.blanksOriginal = '';
    blankAnswers = [];
  }
}

// --- 考研倒计时 ---
function getDecemberThirdSaturday(year){
  // 12月第三个周六：12月15日 + (6 - 12月1日星期几 + 7) % 7
  const dec1Day = new Date(year, 11, 1).getDay();
  return new Date(year, 11, 15 + (6 - dec1Day + 7) % 7);
}
function getCountdownDate(){
  const saved = localStorage.getItem('yanxueku_exam_date');
  if(saved) return new Date(saved);
  // 默认：当前年份12月第三个周六；若已过则用明年
  const now = new Date();
  let exam = getDecemberThirdSaturday(now.getFullYear());
  if(now > exam) exam = getDecemberThirdSaturday(now.getFullYear() + 1);
  return exam;
}
function setExamDate(d){
  localStorage.setItem('yanxueku_exam_date', d.toISOString().slice(0,10));
  if(localStorage.getItem('yanxueku_exam_date_set') !== '1'){
    localStorage.setItem('yanxueku_exam_date_set', '1');
  }
  updateDashboardHeader();
}
let _dailyGoal = parseInt(localStorage.getItem('yanxueku_daily_goal') || '20');
function setDailyGoal(n){
  _dailyGoal = n;
  localStorage.setItem('yanxueku_daily_goal', n);
  updateDashboardHeader();
}
function updateDashboardHeader(){
  if(!db||!db.knowledge) return;
  const el = document.getElementById('dash-header-right');
  if(!el) return;
  const examDate = getCountdownDate();
  const now = new Date();
  const diff = Math.ceil((examDate - now) / 86400000);
  const dueList = db.knowledge.filter(k => k.nextReview <= todayStr());
  const todayDone = db.knowledge.filter(k => k.lastReview === todayStr()).length;
  el.innerHTML = `
    <div class="countdown-badge" onclick="openExamDatePicker()" title="点击设置考研日期">
      <div style="text-align:center"><div class="num">${Math.max(0, diff)}</div><div class="unit">天</div></div>
      <div style="line-height:1.3"><div style="font-size:12px">距考研</div><div style="font-size:10px;opacity:.7">${examDate.toLocaleDateString('zh-CN',{month:'long',day:'numeric'})}</div></div>
    </div>
    <div style="font-size:12px;line-height:1.5">
      <div>📋 今日目标 <b>${todayDone}</b> / <b onclick="openGoalSetter()" style="cursor:pointer;color:var(--primary)" title="点击设置目标">${_dailyGoal}</b> 个</div>
      <div class="goal-bar" style="width:80px"><div class="goal-fill" style="width:${Math.min(100, Math.round(todayDone/_dailyGoal*100))}%"></div></div>
    </div>`;
}
function openExamDatePicker(){
  const d = getCountdownDate();
  openModal(
    '<div style="position:absolute;top:16px;right:16px"><button class="modal-close" onclick="closeModal()">✕</button></div>'+
    '<h3>📅 设定考研日期</h3>'+
    '<div class="form-row"><label>考试日期</label><input id="exam-date-input" type="date" value="'+d.toISOString().slice(0,10)+'"></div>'+
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="setExamDate(new Date(document.getElementById(\'exam-date-input\').value));closeModal()">确定</button></div>');
}
function openGoalSetter(){
  openModal(
    '<div style="position:absolute;top:16px;right:16px"><button class="modal-close" onclick="closeModal()">✕</button></div>'+
    '<h3>🎯 每日复习目标</h3>'+
    '<div class="form-row"><label>每天想复习多少个知识点？</label><input id="goal-input" type="number" value="'+_dailyGoal+'" min="1" max="200"></div>'+
    '<div style="font-size:12px;color:var(--text-3)">建议从 15~30 开始，根据实际节奏调整</div>'+
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">取消</button><button class="btn btn-primary" onclick="setDailyGoal(parseInt(document.getElementById(\'goal-input\').value)||20);closeModal()">确定</button></div>');
}
// 在 renderDashboard 和 renderBadges 后更新头部
const _origRD = renderDashboard;
const _origRB = renderBadges;
renderDashboard = function(){
  _origRD();
  requestAnimationFrame(updateDashboardHeader);
};
renderBadges = function(){
  _origRB();
  requestAnimationFrame(updateDashboardHeader);
};


if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  navigator.serviceWorker.register('sw.js').then(function(reg){
    // 每次加载主动检查 SW 更新（发布新版后尽快接管，绕过浏览器 24h 检查周期）
    reg.update();
    // 新 SW 接管页面时自动刷新，保证用户看到最新版（配合 sw.js v5 导航强制网络）
    navigator.serviceWorker.addEventListener('controllerchange', function(){
      window.location.reload();
    });
  }).catch(()=>{});
}

/* ===== 账号安全：修改密码 / 修改邮箱 ===== */
function openAccountModal(){
  if(!sb||!_currentUser){ toast('请先登录','err'); return; }
  openModal(
    '<button class="modal-close" onclick="closeModal()">✕</button>'+
    '<h3>🔑 账号安全</h3>'+
    '<div class="panel" style="box-shadow:none;padding:14px;margin-bottom:14px">'+
      '<div class="panel-title" style="font-size:13px;margin-bottom:8px">修改密码</div>'+
      '<div class="form-row"><label>当前密码</label><input id="ac-old" type="password" placeholder="输入当前密码"></div>'+
      '<div class="form-row"><label>新密码（≥8位）</label><input id="ac-new" type="password" placeholder="至少 8 位"></div>'+
      '<div class="form-row"><label>确认新密码</label><input id="ac-new2" type="password" placeholder="再输入一次"></div>'+
      '<button class="btn btn-primary" style="width:100%;justify-content:center" onclick="changePassword()">确认修改密码</button>'+
    '</div>'+
    '<div class="panel" style="box-shadow:none;padding:14px">'+
      '<div class="panel-title" style="font-size:13px;margin-bottom:8px">修改邮箱</div>'+
      '<div style="font-size:12px;color:var(--warn);margin-bottom:8px">⚠️ 为安全起见，修改邮箱前需验证当前密码。若服务端开启邮件确认，修改后需到新邮箱点击确认链接方可生效。</div>'+
      '<div class="form-row"><label>当前密码</label><input id="ac-mail-pwd" type="password" placeholder="输入当前密码"></div>'+
      '<div class="form-row"><label>新邮箱</label><input id="ac-mail" type="email" placeholder="you@example.com"></div>'+
      '<div class="form-row"><label>确认新邮箱</label><input id="ac-mail2" type="email" placeholder="再输入一次"></div>'+
      '<button class="btn btn-ghost" style="width:100%;justify-content:center;border-color:var(--warn);color:var(--warn)" onclick="changeEmail()">确认修改邮箱</button>'+
    '</div>'+
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">关闭</button></div>');
}
async function changePassword(){
  if(!sb||!_currentUser){ toast('请先登录','err'); return; }
  const old = document.getElementById('ac-old').value;
  const n1 = document.getElementById('ac-new').value;
  const n2 = document.getElementById('ac-new2').value;
  if(!old){ toast('请输入当前密码','err'); return; }
  if(!validatePassword(n1)){ toast('新密码长度至少 8 位','err'); return; }
  if(n1 !== n2){ toast('两次输入的新密码不一致','err'); return; }
  try{
    // 先验证旧密码（防会话劫持），再改密
    const v = await sb.auth.signInWithPassword({email:_currentUser.email, password:old});
    if(v.error){ toast('当前密码不正确','err'); return; }
    const r = await sb.auth.updateUser({password:n1});
    if(r.error){ toast(authErrorMsg(r.error),'err'); return; }
    closeModal(); toast('密码已修改 ✅','ok');
  }catch(e){ toast('网络错误，请稍后重试','err'); }
}
async function changeEmail(){
  if(!sb||!_currentUser){ toast('请先登录','err'); return; }
  const pwd = document.getElementById('ac-mail-pwd').value;
  const e1 = document.getElementById('ac-mail').value.trim();
  const e2 = document.getElementById('ac-mail2').value.trim();
  if(!pwd){ toast('请输入当前密码','err'); return; }
  if(!validateEmail(e1)){ toast('请输入有效的新邮箱','err'); return; }
  if(e1 !== e2){ toast('两次输入的新邮箱不一致','err'); return; }
  if(e1.toLowerCase() === _currentUser.email.toLowerCase()){ toast('新邮箱与当前相同','err'); return; }
  if(!confirm('修改邮箱后，若服务端开启邮件确认需到新邮箱点击链接确认。确认继续？')) return;
  try{
    // 先验证当前密码，防止会话被劫持后恶意改邮箱
    const v = await sb.auth.signInWithPassword({email:_currentUser.email, password:pwd});
    if(v.error){ toast('当前密码不正确','err'); return; }
    const r = await sb.auth.updateUser({email:e1});
    if(r.error){ toast(authErrorMsg(r.error),'err'); return; }
    // 本项目为 autoconfirm（未开启邮件确认）：改邮箱立即生效，本地同步 email 保持显示一致；
    // 若未来服务端开启邮件确认，此处应改为等待确认后再同步（依赖 onAuthStateChange）
    _currentUser.email = e1;
    closeModal();
    renderSidebarUser();
    toast('邮箱已修改 ✅','ok');
  }catch(e){ toast('网络错误，请稍后重试','err'); }
}
let _authListenerReady = false;
let _renderPending = false; // onAuthStateChange 多次事件的 render 合并防抖
function _scheduleRender(){
  if(_renderPending) return;
  _renderPending = true;
  setTimeout(function(){ _renderPending = false; renderSidebarUser(); if(curView) render(); }, 10);
}
function setupAuthListener(){
  if(!sb || _authListenerReady) return;
  _authListenerReady = true;
  sb.auth.onAuthStateChange(async function(ev,session){
    if(session && session.user){
      _currentUser = session.user;
      var r=await sb.from('profiles').select('*').eq('user_id', _currentUser.id).single();
      _profile = r.data || {display_name:'考研人', avatar_color:'#6366f1'};
      var rd = await sb.from('app_state').select('data').eq('user_id', _currentUser.id).maybeSingle();
      if(rd && rd.data && rd.data.data && rd.data.data.subjects){
        db = rd.data.data;                                  // 云端有数据 → 用云端
      }else if(db && db.subjects && db.subjects.length){
        try{ await sb.from('app_state').upsert({ user_id: _currentUser.id, data: db, updated_at: new Date().toISOString() }); }catch(e){} // 云端无数据 → 上传本地（首次同步）
      }
      hideGate();
      setupRealtimeSync();
    }else{ _currentUser=null; _profile=null; renderGate(); }
    _scheduleRender();
    hideLoading(); // SDK 确认 session 后统一隐藏 loading，避免 SDK 加载慢时 loading 先消失露出 gate
  });
}
setupAuthListener();
async function renderLeaderboard(){
  var panel=document.getElementById('leaderboard-panel'); if(!panel) return;
  panel.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-3)">加载中…</div>';
  if(!sb||!_currentUser){ panel.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-3)">登录后可见</div>'; return; }
  try{
    var x=await sb.from('leaderboard').select('*').limit(20);
    var data=x.data||[], rows='';
    data.forEach(function(r,i){
      // 兼容新旧 view：新 view 返回 total_minutes；SQL 未执行前旧 view 只有 study_log
      var m = r.total_minutes != null ? (parseInt(r.total_minutes, 10) || 0) : (function(){ var n=0; try{ JSON.parse(r.study_log||'[]').forEach(function(x){n+=x.minutes||0}); }catch(e){} return n; })();
      rows+='<div class="leader-row"><div class="rank '+(i<3?'t'+(i+1):'t')+'">'+(i+1)+'</div><div class="avatar" style="width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;background:'+safeColor(r.avatar_color)+'">'+(r.display_name||'?').charAt(0)+'</div><div class="ld-name">'+esc(r.display_name||'考研人')+'</div><div class="ld-time">'+Math.floor(m/60)+'h '+m%60+'m</div></div>';
    });
    panel.innerHTML=rows||'<div style="text-align:center;padding:20px;color:var(--text-3)">暂无数据</div>';
  }catch(e){ panel.innerHTML='<div style="text-align:center;padding:20px;color:var(--text-3)">加载失败</div>'; }
}
function toggleStar(kwId, ev){ if(ev)ev.stopPropagation(); if(_starred.has(kwId))_starred.delete(kwId); else _starred.add(kwId); localStorage.setItem('yanxueku_stars', JSON.stringify([..._starred])); renderLibrary(); }
// 仪表盘 Top3 排行榜（异步加载，复用 leaderboard view）
async function loadDashLeader(){
  if(!sb||!_currentUser) return;
  try{
    const x = await sb.from('leaderboard').select('*').limit(3);
    const data = x.data||[];
    const wrap = document.getElementById('dash-leader-wrap');
    const panel = document.getElementById('dash-leader-panel');
    if(!wrap||!panel) return;
    if(!data.length){ wrap.style.display='none'; return; }
    wrap.style.display='';
    const medals=['🥇','🥈','🥉'];
    panel.innerHTML = data.map(function(r,i){
      // 兼容新旧 view：新 view 返回 total_minutes；SQL 未执行前旧 view 只有 study_log
      var m = r.total_minutes != null ? (parseInt(r.total_minutes, 10) || 0) : (function(){ var n=0; try{ JSON.parse(r.study_log||'[]').forEach(function(x){n+=x.minutes||0}); }catch(e){} return n; })();
      return `<div style="padding:12px;border-radius:12px;background:var(--surface-2);border:1px solid var(--border);display:flex;align-items:center;gap:10px">
        <span style="font-size:18px">${medals[i]||(i+1)}</span>
        <div class="avatar" style="width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;background:${safeColor(r.avatar_color)}">${esc((r.display_name||'?').charAt(0))}</div>
        <div style="min-width:0">
          <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.display_name||'考研人')}</div>
          <div style="font-size:11px;color:var(--text-3)">${Math.floor(m/60)}h ${m%60}m</div>
        </div>
      </div>`;
    }).join('');
  }catch(e){}
}

// 安全兜底：3秒后强制隐藏加载屏
