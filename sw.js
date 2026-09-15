// sw.js - filename must be sw.js
const CACHE_NAME = 'titan-v2';

self.addEventListener('install', (e) => {
 self.skipWaiting(); // 새 서비스워커를 바로 활성화 (탭을 다 닫을 때까지 기다리지 않음)
 e.waitUntil(
  caches.open(CACHE_NAME).then((cache) => cache.addAll([
   './index.html',
   './192.png'
   ]))
  );
});

self.addEventListener('activate', (e) => {
 e.waitUntil(
  caches.keys().then((keys) => Promise.all(
   keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
  )).then(() => self.clients.claim()) // 열려있는 탭도 새 서비스워커가 바로 제어
 );
});

self.addEventListener('fetch', (e) => {
 const url = new URL(e.request.url);
 const isSameOrigin = url.origin === self.location.origin;
 if (e.request.method !== 'GET' || !isSameOrigin) {
  return;
 }
 // 네트워크 우선: 온라인이면 항상 최신 파일을 받아오고, 인터넷이 불안정할 때만 캐시로 대체
 e.respondWith(
  fetch(e.request).then((res) => {
   const resClone = res.clone();
   caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
   return res;
  }).catch(() => caches.match(e.request))
  );
});
