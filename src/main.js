/* 研学库 v2.3 — ES Modules 入口 */

import * as U from './utils.js';
import * as C from './constants.js';
import * as S from './state.js';

/* 挂载到 window 保持 onclick 兼容（过渡期） */
window.esc = U.esc;
window.escAttr = U.escAttr;
window.md = U.md;
window.safeColor = U.safeColor;
window.uid = U.uid;
window.todayStr = U.todayStr;
window.addDays = U.addDays;
window.diffDays = U.diffDays;
window.calcStreak = U.calcStreak;
window._defer = U._defer;
window._deferRaf = U._deferRaf;

window.THEME_KEY = C.THEME_KEY;
window.STORAGE_KEY = C.STORAGE_KEY;
window.DATA_VERSION = C.DATA_VERSION;
window.EBB = C.EBB;
window.EBB_LABEL = C.EBB_LABEL;
window.MASTERY_NAMES = C.MASTERY_NAMES;
window.MASTERY_COLORS = C.MASTERY_COLORS;
window.APP_VERSION = C.APP_VERSION;
window.VIEW_META = C.VIEW_META;

window.sb = S.sb;
window.db = S.db;
window._currentUser = S._currentUser;
window._profile = S._profile;
window._supabaseFailed = S._supabaseFailed;
window.curView = S.curView;
window.libFilter = S.libFilter;
window.blanksMode = S.blanksMode;
window.blankAnswers = S.blankAnswers;
window._dailyGoal = S._dailyGoal;
window.reviewQueue = S.reviewQueue;
window.reviewIdx = S.reviewIdx;
window.reviewDone = S.reviewDone;
window._analytics = S._analytics;
window._cfg = S._cfg;

console.log('[yanxueku] ES Modules loaded — v' + C.APP_VERSION);
