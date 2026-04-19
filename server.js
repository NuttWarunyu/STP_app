import express from 'express'
import https from 'node:https'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

function proxy(req, res, hostname, stripPrefix, injectHeaders = {}) {
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    const body = Buffer.concat(chunks)
    const path = req.url.replace(stripPrefix, '') || '/'

    const reqHeaders = { ...req.headers, host: hostname }
    delete reqHeaders['origin']
    delete reqHeaders['referer']
    Object.assign(reqHeaders, injectHeaders)
    if (body.length) reqHeaders['content-length'] = body.length

    const proxyReq = https.request(
      { hostname, path, method: req.method, headers: reqHeaders, timeout: 120000 },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers)
        proxyRes.pipe(res)
      }
    )
    proxyReq.on('error', (e) => {
      if (!res.headersSent) res.status(502).json({ error: e.message })
    })
    proxyReq.on('timeout', () => {
      proxyReq.destroy()
      if (!res.headersSent) res.status(504).json({ error: 'upstream timeout' })
    })
    if (body.length) proxyReq.write(body)
    proxyReq.end()
  })
}

// Anthropic — server injects API key, client doesn't need it
app.use('/api/anthropic', (req, res) => {
  proxy(req, res, 'api.anthropic.com', /^\/api\/anthropic/, {
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
  })
})

// OpenAI — server injects API key
app.use('/api/openai', (req, res) => {
  proxy(req, res, 'api.openai.com', /^\/api\/openai/, {
    authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  })
})

// Google Maps — key is already in the URL query from frontend
app.use('/api/gmaps', (req, res) => {
  proxy(req, res, 'maps.googleapis.com', /^\/api\/gmaps/)
})

// Serve React app
app.use(express.static(join(__dirname, 'dist')))
app.get('*', (_req, res) => res.sendFile(join(__dirname, 'dist/index.html')))

app.listen(PORT, () => console.log(`STL server on :${PORT}`))
