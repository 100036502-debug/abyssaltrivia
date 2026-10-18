const CACHE_NAME = 'abyssal-trivia-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/')) return; // Let backend API calls pass straight through
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
