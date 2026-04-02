// sw.js — Service Worker for Spearfishing FUNdamentals PWA
const CACHE = 'fundees-v3';
const STATIC = [
  '/',
  '/index.html',
  '/auth.html',
  '/portal.html',
  '/sessions.html',
  '/admin.html',
  '/manifest.json',
  '/logo-white.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install: cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network first, fall back to cache for HTML pages
self.addEventListener('fetch', e => {
  // Skip non-GET and Supabase/Stripe/Netlify function requests — always go live
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.hostname !== location.hostname) return;
  if (url.pathname.startsWith('/.netlify/')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache successful HTML/asset responses
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
