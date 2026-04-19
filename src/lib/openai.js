const GHOST_COSTUMES = {
  เร่ร่อน: 'torn white Thai traditional dress, bare feet, long straight black hair obscuring face',
  ป่า: 'wrapped in leaves and vines, wild tangled hair, shadowy outline',
  น้ำ: 'soaking wet dark traditional Thai dress, dripping, surrounded by mist',
  อาคม: 'glowing spectral orb with a faint ethereal face, hovering in mid-air, trailing wisps of light',
  โบราณ: 'formal Thai historical dress from the Rattanakosin era, translucent, standing still',
  ราชสำนัก: 'ancient Thai royal court uniform, shadowy figure holding a ceremonial staff',
  นรก: 'tall dark silhouette with unnatural proportions, glowing red eyes, shadowy aura',
}

function imageToSquarePng(base64, size = 1024) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, size, size)
      resolve(canvas.toDataURL('image/png').split(',')[1])
    }
    const mime = base64.startsWith('iVBORw') ? 'image/png' : 'image/jpeg'
    img.src = `data:${mime};base64,${base64}`
  })
}

function makeMaskPng(placement, size = 1024) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  // fully opaque black = keep, fully transparent = edit here
  ctx.fillStyle = 'rgba(0,0,0,255)'
  ctx.fillRect(0, 0, size, size)

  const x = (placement.x / 100) * size
  const y = (placement.y / 100) * size
  const w = (placement.width / 100) * size
  const h = (placement.height / 100) * size

  ctx.clearRect(x, y, w, h)
  return canvas.toDataURL('image/png').split(',')[1]
}

export async function generateGhostOverlay({ base64Image, ghostClass, placement, ghostPrompt }) {
  const costume = GHOST_COSTUMES[ghostClass] || 'translucent Thai ghost figure in traditional dress'
  const SIZE = 512

  const placementDesc = placement
    ? `Place the figure in the ${placement.y < 40 ? 'upper' : placement.y > 60 ? 'lower' : 'middle'} ${placement.x < 40 ? 'left' : placement.x > 60 ? 'right' : 'center'} area of the image.`
    : 'Place the figure off-center in the background.'

  const prompt = ghostPrompt ||
    `Add a single subtle supernatural figure to this photo: ${costume}. The figure should appear naturally present in the scene, as if accidentally photographed. ${placementDesc} Preserve the original photo's exact lighting and colors. Blend the figure seamlessly into the environment. Do not alter the rest of the image.`

  const squarePng = await imageToSquarePng(base64Image, SIZE)
  const imageBlob = await fetch(`data:image/png;base64,${squarePng}`).then((r) => r.blob())

  const formData = new FormData()
  formData.append('model', 'gpt-image-1')
  formData.append('image', imageBlob, 'image.png')
  formData.append('prompt', prompt)
  formData.append('n', '1')
  formData.append('size', '1024x1024')
  formData.append('quality', 'medium')

  const response = await fetch('/api/openai/v1/images/edits', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const err = await response.text()
    console.error('OpenAI 400 body:', err)
    throw new Error(`OpenAI ${response.status}: ${err.slice(0, 200)}`)
  }

  const data = await response.json()
  const b64 = data.data?.[0]?.b64_json
  if (!b64) throw new Error('No image data in OpenAI response')
  return b64
}

export async function compositeImages(originalBase64, overlayBase64, placement, origWidth, origHeight) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = origWidth
    canvas.height = origHeight
    const ctx = canvas.getContext('2d')

    const origImg = new Image()
    origImg.onload = () => {
      ctx.drawImage(origImg, 0, 0, origWidth, origHeight)

      const overlayImg = new Image()
      overlayImg.onload = () => {
        const x = (placement.x / 100) * origWidth
        const y = (placement.y / 100) * origHeight
        const w = (placement.width / 100) * origWidth
        const h = (placement.height / 100) * origHeight

        ctx.globalAlpha = 0.85
        ctx.drawImage(overlayImg, x, y, w, h)
        ctx.globalAlpha = 1

        resolve(canvas.toDataURL('image/jpeg', 0.9).split(',')[1])
      }
      overlayImg.src = `data:image/png;base64,${overlayBase64}`
    }
    const origMime = originalBase64.startsWith('iVBORw') ? 'image/png' : 'image/jpeg'
    origImg.src = `data:${origMime};base64,${originalBase64}`
  })
}
