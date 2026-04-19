async function compressImage(base64, maxSizeKB = 150, maxDim = 720) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height)
        width = Math.floor(width * ratio)
        height = Math.floor(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)

      let quality = 0.82
      let result = canvas.toDataURL('image/jpeg', quality).split(',')[1]
      while (result.length * 0.75 > maxSizeKB * 1024 && quality > 0.2) {
        quality -= 0.08
        result = canvas.toDataURL('image/jpeg', quality).split(',')[1]
      }
      console.log(`Claude image: ${(result.length * 0.75 / 1024).toFixed(0)} KB @ ${width}x${height}`)
      resolve(result)
    }
    img.onerror = () => reject(new Error('compressImage failed to load image'))
    const mime = base64.startsWith('iVBORw') ? 'image/png' : 'image/jpeg'
    img.src = `data:${mime};base64,${base64}`
  })
}

function detectMediaType(base64) {
  const sig = base64.substring(0, 8)
  if (sig.startsWith('iVBORw')) return 'image/png'
  if (sig.startsWith('/9j/')) return 'image/jpeg'
  if (sig.startsWith('R0lGOD')) return 'image/gif'
  if (sig.startsWith('UklGRi') || sig.startsWith('AAABAA')) return 'image/webp'
  return 'image/jpeg'
}

function buildSystemPrompt(detectionProb) {
  const pct = Math.round(detectionProb * 100)
  return `You are ส.ต.ล. field analysis AI. Analyze this image and location context. The pre-calculated detection probability for this scan is ${pct}%. Use this as your base — adjust ±10% based on visual evidence in the image.

Respond with JSON only:
{
  "detected": boolean,
  "confidence": number (0-100),
  "reason": string (Thai, 1 sentence, dry government report tone, no humor),
  "scene_type": string,
  "suggested_placement": {
    "x": number (0-100 percent from left),
    "y": number (0-100 percent from top),
    "width": number (10-30 percent),
    "height": number (20-50 percent)
  }
}

Visual adjustment rules (apply to base ${pct}%):
- Darkness, corners, doorways, mirrors: +5-10%
- Bright outdoor daytime: -10-15%
- Water/rain visible: +5%
- Old buildings, ruins: +5%
- suggested_placement: choose a plausible location in the scene (doorway, corner, shadow, near tree/water)
- If detected=false: still provide placement for potential future use
- Never exceed 85% total probability`
}

export async function analyzeImage({ base64Image, locationName, province, nearbyPlaces, time, isNight, detectionProb = 0.35 }) {

  const compressed = await compressImage(base64Image)

  const nearbyStr = nearbyPlaces
    .slice(0, 3)
    .map((p) => `${p.name} (${p.typeLabel || p.type}, ${p.distance})`)
    .join(', ')

  const userMessage = `Image: [attached]
Location: ${locationName}, ${province}
Nearby: ${nearbyStr || 'ไม่ทราบ'}
Time: ${time}, ${isNight ? 'กลางคืน' : 'กลางวัน'}
Analyze.`

  const body = JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: buildSystemPrompt(detectionProb),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: compressed },
          },
          { type: 'text', text: userMessage },
        ],
      },
    ],
  })

  const fetchOpts = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  }

  let response
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000 * attempt))
    response = await fetch('/api/anthropic/v1/messages', fetchOpts)
    if (response.status !== 502) break
  }

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API error: ${err}`)
  }

  const data = await response.json()
  const text = data.content[0].text.trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Invalid JSON response from Claude')
  return JSON.parse(jsonMatch[0])
}
