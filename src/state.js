/* 研学库 v2.3 — 全局状态模块（唯一可变状态入口） */

export let sb = null;
export let _supabaseFailed = false;
export let _cfg = {};
export let SUPABASE_URL = '';
export let SUPABASE_KEY = '';

export let db = null;
export let _currentUser = null;
export let _profile = null;
export let _loadResolve = null;
export let _dbReady = new Promise(r => { _loadResolve = r; });

export let curView = 'dashboard';
export let libFilter = {};

export let blanksMode = false;
export let blankAnswers = [];
export let _dailyGoal = 20;

export let reviewQueue = [];
export let reviewIdx = 0;
export let reviewDone = false;

/* 分析存根（可被外部 analytics.js 覆盖） */
export let _analytics = {
  page(){}, quizStart(){}, quizComplete(){}, reviewStart(){}, reviewComplete(){},
  kwCreated(){}, kwImported(){}, packExported(){}, packImported(){},
  login(){}, register(){}, dataExport(){}, dataImport(){}
};
