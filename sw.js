/* 研学库 Service Worker — network-first with smart fallback
 * v7: 模块化拆分适配 — styles.css / core.js / quiz.js / views.js / public-lib.js
 */
const CACHE = 'yanxueku-v15';
// 预缓存必须完整覆盖 index.html 引用的全部资源：此前缺 src/*.js、gate.css、quiz_analyzer.js，
// 离线时模块加载失败整个应用打不开；法律页一并缓存供离线查看
const ASSETS = ['./','./index.html','./styles.css','./core.js','./quiz.js','./views.js','./public-lib.js',
  './quiz_analyzer.js','./ai.js','./src/main.js','./src/utils.js','./src/constants.js','./src/state.js','./src/gate.css',
  './manifest.json','./icon-192.png','./icon-512.png','./icon-maskable-512.png','./public-library.json',
  './privacy.html','./terms.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('supabase.co')) return;

  // 页面导航：强制走网络拿最新 HTML，避免用户看到旧版；离线才回退缓存
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(netRes => {
        if (netRes && netRes.status === 200) {
          caches.open(CACHE).then(cache => cache.put(e.request, netRes.clone()));
        }
        return netRes;
      }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // 静态资源：network-first
  e.respondWith(
    caches.open(CACHE).then(cache =>
      fetch(e.request).then(netRes => {
        if (netRes && netRes.status === 200) {
          cache.put(e.request, netRes.clone());
        }
        return netRes;
      }).catch(() =>
        cache.match(e.request).then(hit => hit || caches.match('./index.html'))
      )
    )
  );
});
