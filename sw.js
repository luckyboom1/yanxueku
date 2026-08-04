/* 研学库 Service Worker — network-first with smart fallback */
const CACHE = 'yanxueku-v4';
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
  if (e.request.url.includes('supabase.co')) return;

  e.respondWith(
    caches.open(CACHE).then(cache =>
      fetch(e.request).then(netRes => {
        if (netRes && netRes.status === 200) {
          cache.put(e.request, netRes.clone());
        }
        return netRes;
      }).catch(() =>
        // 离线回退：优先精准匹配，其次返回首页
        cache.match(e.request).then(hit => hit || caches.match('./index.html'))
      )
    )
  );
});
