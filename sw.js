'use strict';

// Incrementar VERSION cuando cambien los archivos de la app.
const VERSION = 'v1';
const ROOT = new URL('./', self.location.href);
const PREFIX = 'piano-pequeno:' + ROOT.pathname + ':';
const CACHE = PREFIX + VERSION;
const ASSETS = ['index.html', 'manifest.webmanifest', 'icon.svg']
  .map(path => new URL(path, ROOT).href);
const INDEX = new URL('index.html', ROOT).href;

self.addEventListener('install', event => {
  // No se activa la nueva versión si falta algún archivo obligatorio.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  // Una actualización esperará a que se cierren las ventanas anteriores.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith(PREFIX) && name !== CACHE)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== ROOT.origin ||
      !url.pathname.startsWith(ROOT.pathname)) return;

  // La navegación usa el HTML precargado, sin depender de la red.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const page = await cache.match(INDEX);
      return page || fetch(request);
    })());
    return;
  }

  // Solo se sirven desde caché los recursos explícitos de esta app.
  url.search = '';
  if (!ASSETS.includes(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(url.href);
    return cached || fetch(request);
  })());
});

// Permite al HTML consultar si terminó la descarga offline.
self.addEventListener('message', event => {
  if (event.data?.type !== 'CHECK_OFFLINE' || !event.ports[0]) return;
  const port = event.ports[0];
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      const resources = await Promise.all(ASSETS.map(url => cache.match(url)));
      port.postMessage({ type: 'OFFLINE_STATUS', ready: resources.every(Boolean), version: VERSION });
    } catch (error) {
      port.postMessage({ type: 'OFFLINE_STATUS', ready: false, version: VERSION });
    }
  })());
});
