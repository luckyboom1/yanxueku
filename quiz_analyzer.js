/* 研学库 Quiz Analyzer v1.0 — 题库分析优化算法
 * 提供：难度评分、弱项检测、智能选题、题库健康报告
 * 数据存储于 db.quizStats = { [questionId]: { times_asked, times_correct, last_asked_at, streak_wrong } }
 */

// ========== 核心算法 ==========

/** 初始化题目统计记录（如果不存在则创建） */
function _ensureStats(qid) {
  if (!db.quizStats) db.quizStats = {};
  // 原型链污染防护：__proto__ 等键不从原型链读取
  if (!Object.prototype.hasOwnProperty.call(db.quizStats, qid)) {
    db.quizStats[qid] = { times_asked: 0, times_correct: 0, last_asked_at: null, streak_wrong: 0 };
  }
  return db.quizStats[qid];
}

/** 记录一次答题结果 */
function recordAnswer(qid, isCorrect) {
  const s = _ensureStats(qid);
  s.times_asked++;
  if (isCorrect) { s.times_correct++; s.streak_wrong = 0; }
  else { s.streak_wrong++; }
  s.last_asked_at = todayStr();
  // 不自动 save 以免频繁写入，由调用方决定何时持久化
}

/** 题目难度评分：0 = 简单，1 = 困难
 *  从未做过的题目默认为中性 0.5 */
function getDifficulty(qid) {
  const s = _ensureStats(qid);
  if (s.times_asked < 1) return 0.5;
  return 1 - (s.times_correct / s.times_asked);
}

/** 获取题目统计 */
function getQuestionStats(qid) {
  return _ensureStats(qid);
}

// ========== 智能选题算法 ==========

/** 计算题目的选拔优先级得分
 *  得分越高 → 越应该出现在下一轮测验中
 *  公式：priority = difficulty_weight * 0.5 + recency_bonus * 0.3 + streak_boost * 0.2
 *  - difficulty_weight: 难度越高的题越需要练习
 *  - recency_bonus: 越久没做越需要复习（0-7天线性衰减）
 *  - streak_boost: 连续答错的题紧急需要加固 */
function _calcPriority(qid) {
  const s = _ensureStats(qid);
  const d = getDifficulty(qid);

  // 首次做的题：中性优先级
  if (s.times_asked === 0) return 0.5;

  // 间隔天数越久 recency_bonus 越高（max 7 days → 1.0）
  var daysSince = s.last_asked_at ? diffDays(todayStr(), s.last_asked_at) : 7;
  var recency = Math.min(daysSince / 7, 1.0);

  // 连续错误惩罚 boost
  var streakBoost = Math.min(s.streak_wrong / 3, 1.0);

  return d * 0.5 + recency * 0.3 + streakBoost * 0.2;
}

/** 加权随机选择：从候选池中按优先级权重抽取 count 道题
 *  使用累积权重法确保高优先级题目有更高被选概率，同时保留随机性 */
function selectSmartQuiz(pool, count) {
  if (pool.length <= count) return pool.slice();

  // 计算每道题的优先级权重
  var items = pool.map(function(q) {
    return { q: q, weight: _calcPriority(q.id) };
  });

  // 按权重排序，取 top 60% 的题目作为高优先级池
  items.sort(function(a, b) { return b.weight - a.weight; });
  var cutoff = Math.max(count, Math.floor(pool.length * 0.6));
  var candidatePool = items.slice(0, cutoff);

  // 在高优先级池中加权随机抽取（使用累积权重法）
  var selected = [];
  var remaining = candidatePool.slice();

  while (selected.length < count && remaining.length > 0) {
    var totalWeight = remaining.reduce(function(sum, item) { return sum + Math.max(item.weight, 0.01); }, 0);
    var rand = Math.random() * totalWeight;
    var cumWeight = 0;
    for (var i = 0; i < remaining.length; i++) {
      cumWeight += Math.max(remaining[i].weight, 0.01);
      if (rand <= cumWeight) {
        selected.push(remaining[i].q);
        remaining.splice(i, 1);
        break;
      }
    }
  }

  // 如果还没满额，从低优先级池补齐
  if (selected.length < count) {
    var lowPool = items.slice(cutoff).map(function(x) { return x.q; });
    lowPool.sort(function() { return Math.random() - 0.5; });
    while (selected.length < count && lowPool.length > 0) {
      selected.push(lowPool.shift());
    }
  }

  return selected;
}

// ========== 弱项检测 ==========

/** 按章节聚合难度，返回从最弱到最强的排序
 *  返回 [{chapter, difficulty, questionCount, avgStreak}] */
function getWeakChapters(subjectId) {
  var chapterMap = {};
  var questions = subjectId
    ? db.questions.filter(function(q) { return q.subjectId === subjectId; })
    : db.questions;

  questions.forEach(function(q) {
    var ch = q.chapter || '未分类';
    if (!chapterMap[ch]) chapterMap[ch] = { chapter: ch, totalDiff: 0, count: 0, totalStreak: 0 };
    var d = getDifficulty(q.id);
    var s = getQuestionStats(q.id);
    chapterMap[ch].totalDiff += d;
    chapterMap[ch].count++;
    chapterMap[ch].totalStreak += s.streak_wrong;
  });

  return Object.values(chapterMap)
    .filter(function(c) { return c.count > 0; })
    .map(function(c) {
      return {
        chapter: c.chapter,
        difficulty: Math.round(c.totalDiff / c.count * 100) / 100,
        questionCount: c.count,
        avgStreak: Math.round(c.totalStreak / c.count * 10) / 10
      };
    })
    .sort(function(a, b) { return b.difficulty - a.difficulty; }); // 最难在 top
}

// ========== 题库健康报告 ==========

/** 题库健康状态：整体统计 + 异常题目检测
 *  返回 { totalQuestions, totalAnswered, avgDifficulty, flaggedTooHard, flaggedTooEasy, unusedQuestions } */
function getQuizHealthReport(subjectId) {
  var questions = subjectId
    ? db.questions.filter(function(q) { return q.subjectId === subjectId; })
    : db.questions;

  var total = questions.length;
  var totalDiff = 0;
  var answered = 0;
  var flaggedTooHard = [];  // difficulty > 0.85 — 几乎没人答对
  var flaggedTooEasy = [];  // difficulty < 0.1 且 times_asked >= 3 — 太简单无价值
  var unusedQuestions = []; // times_asked === 0 — 从未被选中

  questions.forEach(function(q) {
    var d = getDifficulty(q.id);
    var s = getQuestionStats(q.id);
    if (s.times_asked > 0) {
      answered++;
      totalDiff += d;
    }
    if (s.times_asked >= 3) {
      if (d >= 0.85) flaggedTooHard.push({ id: q.id, title: q.question || q.id, difficulty: Math.round(d * 100), asked: s.times_asked });
      if (d <= 0.1) flaggedTooEasy.push({ id: q.id, title: q.question || q.id, difficulty: Math.round(d * 100), asked: s.times_asked });
    }
    if (s.times_asked === 0) unusedQuestions.push({ id: q.id, title: q.question || q.id });
  });

  return {
    totalQuestions: total,
    totalAnswered: answered,
    unusedCount: unusedQuestions.length,
    avgDifficulty: answered > 0 ? Math.round(totalDiff / answered * 100) / 100 : null,
    flaggedTooHard: flaggedTooHard,
    flaggedTooEasy: flaggedTooEasy,
    unusedQuestions: unusedQuestions.slice(0, 10) // 只展示前10道未用题
  };
}

/** 弱项集中突击：专挑薄弱章节的题目
 *  先按章节难度排序，从最难章节取题 */
function selectWeakFocusQuiz(pool, count, subjectId) {
  var weakChapters = getWeakChapters(subjectId);
  if (!weakChapters.length) return pool.slice(0, count);

  // 取前3个最弱章节
  var topChapters = weakChapters.slice(0, 3).map(function(c) { return c.chapter; });
  var weakPool = pool.filter(function(q) { return topChapters.indexOf(q.chapter || '未分类') !== -1; });

  // 弱章节题目不够则混合全题库
  if (weakPool.length < count) {
    var restPool = pool.filter(function(q) { return topChapters.indexOf(q.chapter || '未分类') === -1; });
    restPool.sort(function() { return Math.random() - 0.5; });
    weakPool = weakPool.concat(restPool).slice(0, count * 2); // 扩大候选池
  }

  return selectSmartQuiz(weakPool.length > count ? weakPool : pool, count);
}

// ========== 章节难度热力图数据 ==========

/** 生成章节难度分布数据（供前端可视化）
 *  返回适合渲染热力图的数据结构 */
function getDifficultyHeatmap(subjectId) {
  var chapters = getWeakChapters(subjectId);
  var maxDifficulty = chapters.length > 0 ? chapters[0].difficulty : 1;

  return chapters.map(function(c) {
    return {
      chapter: c.chapter,
      difficulty: c.difficulty,
      questionCount: c.questionCount,
      level: c.difficulty > 0.7 ? 'hard' : c.difficulty > 0.4 ? 'medium' : 'easy',
      barPercent: Math.round(c.difficulty / Math.max(maxDifficulty, 0.01) * 100)
    };
  });
}
