// sw.js (파일 이름은 반드시 sw.js여야 함)
self.addEventListener('install', (e) => {
 e.waitUntil(
   caches.open('titan-v1').then((cache) => cache.addAll([
     './index.html',
     './192.png'
   ]))
 );
});

self.addEventListener('fetch', (e) => {
 e.respondWith(
   caches.match(e.request).then((response) => response || fetch(e.request))
 );
});
