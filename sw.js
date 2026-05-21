const CACHE='orientation-v3';
const SHELL=['./index.html','./manifest.json','./icon-192.png','./icon-512.png'];
const CDN=['cdn.tailwindcss.com','cdnjs.cloudflare.com','cdn.jsdelivr.net','unpkg.com','fonts.googleapis.com','fonts.gstatic.com'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const isCDN=CDN.some(d=>e.request.url.includes(d));
  e.respondWith(caches.match(e.request).then(c=>{
    if(c){if(!isCDN)fetch(e.request).then(r=>{if(r&&r.status===200)caches.open(CACHE).then(ca=>ca.put(e.request,r.clone()))}).catch(()=>{});return c;}
    return fetch(e.request).then(r=>{if(r&&r.status===200&&r.type!=='opaque')caches.open(CACHE).then(ca=>ca.put(e.request,r.clone()));return r;})
      .catch(()=>e.request.headers.get('accept')?.includes('text/html')?caches.match('./index.html'):new Response('Offline',{status:503}));
  }));
});
