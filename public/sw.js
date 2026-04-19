const CACHE_NAME = 'stl-scanner-v1'
const APP_SHELL = [
  '/',
  '/index.html',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)

  // Never cache API calls
  if (
    url.hostname.includes('anthropic') ||
    url.hostname.includes('openai') ||
    url.hostname.includes('supabase') ||
    url.hostname.includes('googleapis')
  ) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached

      return fetch(event.request).catch(() => {
        if (event.request.destination === 'document') {
          return new Response(
            `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ส.ต.ล.</title><style>body{background:#0d0a06;color:#f5ead6;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center}p{color:#6b5c4a;font-size:12px;margin-top:8px}</style></head><body><div><div style="color:#c9a84c;font-size:18px;letter-spacing:4px">ส.ต.ล.</div><p>ขาดการเชื่อมต่อ — ไม่สามารถติดต่อศูนย์ปฏิบัติการกลางได้ในขณะนี้</p></div></body></html>`,
            { headers: { 'Content-Type': 'text/html' } }
          )
        }
      })
    })
  )
})
