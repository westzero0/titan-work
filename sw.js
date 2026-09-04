// sw.js - filename must be sw.js
self.addEventListener('install', (e) => {
 e.waitUntil(
  caches.open('titan-v1').then((cache) => cache.addAll([
   './index.html',
   './192.png'
   ]))
  );
});

self.addEventListener('fetch', (e) => {
 const url = new URL(e.request.url);
 const isSameOrigin = url.origin === self.location.origin;
 if (e.request.method !== 'GET' || !isSameOrigin) {
  return;
 }
 e.respondWith(
  caches.match(e.request).then((response) => response || fetch(e.request))
  );
});
