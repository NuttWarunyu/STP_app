const MAX_DIM = 960
const TARGET_KB = 300

export async function normalizeImage(file) {
  const name = file.name?.toLowerCase() || ''
  const type = file.type?.toLowerCase() || ''
  const isHeic = type.includes('heic') || type.includes('heif') ||
                 name.endsWith('.heic') || name.endsWith('.heif')

  if (isHeic) {
    try {
      return await nativeCanvasConvert(file, MAX_DIM, TARGET_KB)
    } catch (_) {}

    try {
      const heic2any = (await import('heic2any')).default
      const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.82 })
      const blob = Array.isArray(converted) ? converted[0] : converted
      return await blobToCompressed(blob, MAX_DIM, TARGET_KB)
    } catch (_) {
      throw new Error('ไม่สามารถแปลงไฟล์ HEIC ได้ กรุณาถ่ายรูปแล้วแชร์เป็นไฟล์ JPEG แทน')
    }
  }

  return blobToCompressed(file, MAX_DIM, TARGET_KB)
}

function nativeCanvasConvert(file, maxDim, targetKB) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        let w = img.naturalWidth || img.width
        let h = img.naturalHeight || img.height
        // Resize immediately at this stage — never produce a huge intermediate base64
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h)
          w = Math.floor(w * ratio)
          h = Math.floor(h * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)

        let quality = 0.82
        let result = canvas.toDataURL('image/jpeg', quality).split(',')[1]
        while (result.length * 0.75 > targetKB * 1024 && quality > 0.25) {
          quality = Math.round((quality - 0.08) * 100) / 100
          result = canvas.toDataURL('image/jpeg', quality).split(',')[1]
        }

        URL.revokeObjectURL(url)
        if (!result || result.length < 100) { reject(new Error('empty output')); return }
        resolve(result)
      } catch (e) {
        URL.revokeObjectURL(url)
        reject(e)
      }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load failed')) }
    img.src = url
  })
}

async function blobToCompressed(blob, maxDim, targetKB) {
  const base64raw = await blobToBase64(blob)
  return resizeAndCompress(base64raw, maxDim, targetKB)
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function resizeAndCompress(base64, maxDim, targetKB) {
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
      while (result.length * 0.75 > targetKB * 1024 && quality > 0.25) {
        quality = Math.round((quality - 0.08) * 100) / 100
        result = canvas.toDataURL('image/jpeg', quality).split(',')[1]
      }

      resolve(result)
    }
    img.onerror = () => reject(new Error('ไม่สามารถโหลดภาพได้ กรุณาลองภาพอื่น'))

    const sig = base64.substring(0, 8)
    const mime = sig.startsWith('iVBORw') ? 'image/png'
               : sig.startsWith('/9j/')   ? 'image/jpeg'
               : 'image/jpeg'
    img.src = `data:${mime};base64,${base64}`
  })
}
