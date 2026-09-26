const CACHE_NAME = 'cdz-production-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Por ahora no cacheamos llamadas API.
  // El service worker existe para habilitar instalación PWA
  // sin interferir con Render ni Firebase.
});