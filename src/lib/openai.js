const GHOST_COSTUMES = {
  เร่ร่อน: 'torn white Thai dress, bare feet, straight long hair',
  ป่า: 'wrapped in leaves and vines, wild hair',
  น้ำ: 'soaking wet traditional Thai dress, algae',
  อาคม: 'floating head with entrails, no body',
  โบราณ: 'formal Thai historical dress (Rattanakosin era)',
  ราชสำนัก: 'ancient Thai royal guard uniform, spear',
  นรก: 'distorted tall figure, exposed bones, red eyes',
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
  const costume = GHOST_COSTUMES[ghostClass] || 'traditional Thai ghost figure'
  const SIZE = 1024

  const prompt = ghostPrompt ||
    `A photorealistic dark figure, flat black silhouette with detailed traditional Thai historical costume appropriate for ${ghostClass}: ${costume}, no visible face (hair covering or in shadow), naturally present in the scene doing an everyday activity — sitting, looking around, or occupying a corner — positioned off-center in the background, unaware of the camera, as if accidentally photographed. Preserve the original photo\'s exact colors, white balance, and lighting. Blend seamlessly. Subtle 35mm film grain texture only, no color grading`

  const [squarePng, maskPng] = await Promise.all([
    imageToSquarePng(base64Image, SIZE),
    Promise.resolve(makeMaskPng(placement, SIZE)),
  ])

  const toBlob = async (b64) => {
    const res = await fetch(`data:image/png;base64,${b64}`)
    return res.blob()
  }

  const [imageBlob, maskBlob] = await Promise.all([toBlob(squarePng), toBlob(maskPng)])

  const formData = new FormData()
  formData.append('model', 'gpt-image-1')
  formData.append('image[]', imageBlob, 'image.png')
  formData.append('mask', maskBlob, 'mask.png')
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
  return data.data[0].b64_json
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
