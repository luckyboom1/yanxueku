/* 研学库 Service Worker — 导航 network-first，静态资源 stale-while-revalidate
 * v7: 模块化拆分适配 — styles.css / core.js / quiz.js / views.js / public-lib.js
 * v18: 移除 src/ ESM 过渡层（双模块体系已合并，gate.css 提升至根目录）
 * v20: 性能优化——移除 public-library.json（2.2MB）预缓存改运行时缓存；
 *      静态资源 network-first → stale-while-revalidate（资源均带 ?v= 版本戳，URL 变即缓存失效）
 * v24: 公共库数据拆分——索引（6KB）进预缓存，卡片按科目 plib/<id>.json 走运行时缓存
 */
const CACHE = 'yanxueku-v25';
// 预缓存只放首屏关键资源 + 公共库索引（6KB）。卡片按科目拆分在 plib/<id>.json，
// 单个最大 745KB，只在用户下钻该科目时才由 fetch handler 运行时缓存。
const ASSETS = ['./','./index.html','./styles.css','./gate.css','./core.js','./quiz.js','./views.js','./public-lib.js',
  './quiz_analyzer.js','./ai.js','./public-library-index.json',
  './manifest.json','./icon-192.png','./icon-512.png','./icon-maskable-512.png',
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

  // 同源静态资源：stale-while-revalidate —— 缓存命中立即返回（零网络等待），
  // 后台静默拉新版本更新缓存；未命中才等网络。
  // 正确性依据：所有静态资源引用都带 ?v= 版本查询串，发版后 URL 变化，
  // 旧缓存键自然失效，不会用旧资源渲染新页面；离线时命中缓存照常工作。
  if (new URL(e.request.url).origin === self.location.origin) {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(e.request).then(hit => {
          const net = fetch(e.request).then(netRes => {
            if (netRes && netRes.status === 200) {
              cache.put(e.request, netRes.clone());
            }
            return netRes;
          }).catch(() => hit);
          return hit || net;
        })
      )
    );
    return;
  }
  // 跨域请求（CDN SDK 等）：不拦截，走浏览器默认缓存行为
});
