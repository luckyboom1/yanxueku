/* 研学库 Service Worker — stale-while-revalidate（优先网络，后台更新缓存） */
const CACHE = 'yanxueku-v3';
const ASSETS = ['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png','./icon-maskable-512.png'];

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
  // 只处理同源 HTML 页面和静态资源；Supabase API 穿透不缓存
  if (e.request.url.includes('supabase.co')) return;
  e.respondWith(
    caches.open(CACHE).then(cache =>
      fetch(e.request).then(netRes => {
        // 网络成功 → 更新缓存并返回
        if (netRes.status === 200) {
          cache.put(e.request, netRes.clone());
        }
        return netRes;
      }).catch(() =>
        // 网络失败 → 返回缓存
        cache.match(e.request).then(hit => hit || cache.match('./index.html'))
      )
    )
  );
});
