const TYPE_LABELS = {
  cemetery: 'สุสาน',
  place_of_worship: 'ศาสนสถาน',
  natural_feature: 'พื้นที่ธรรมชาติ',
  park: 'สวนสาธารณะ',
  university: 'มหาวิทยาลัย',
  hospital: 'โรงพยาบาล',
  shrine: 'ศาลเจ้า',
  church: 'โบสถ์',
  mosque: 'มัสยิด',
  hindu_temple: 'วัดฮินดู',
  river: 'แม่น้ำ',
  school: 'โรงเรียน',
  lodging: 'ที่พัก',
}

export function getRiskLevel(types) {
  const t = types.join(',').toLowerCase()
  if (t.includes('cemetery') || t.includes('shrine')) return 'high'
  if (
    t.includes('place_of_worship') ||
    t.includes('hospital') ||
    t.includes('river') ||
    t.includes('church') ||
    t.includes('mosque')
  )
    return 'medium'
  return 'low'
}

export function getRiskLabel(level) {
  if (level === 'high') return 'เสี่ยงสูง'
  if (level === 'medium') return 'เสี่ยงกลาง'
  return 'เสี่ยงต่ำ'
}

export function getTypeLabel(types) {
  for (const t of types) {
    if (TYPE_LABELS[t]) return TYPE_LABELS[t]
  }
  return 'สถานที่'
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDist(km) {
  return km < 1 ? `${Math.round(km * 1000)} ม.` : `${km.toFixed(1)} กม.`
}

function mapPlace(p, lat, lng) {
  const dist = haversineKm(lat, lng, p.geometry.location.lat, p.geometry.location.lng)
  const risk = getRiskLevel(p.types || [])
  return {
    name: p.name,
    types: p.types || [],
    typeLabel: getTypeLabel(p.types || []),
    distance: formatDist(dist),
    distanceKm: dist,
    risk,
    riskLabel: getRiskLabel(risk),
    lat: p.geometry.location.lat,
    lng: p.geometry.location.lng,
  }
}

// Google Places Nearby Search only accepts one `type` per request
const SEARCH_TYPES = ['hospital', 'cemetery', 'place_of_worship', 'park', 'university']

export async function getNearbyPlaces(lat, lng) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY
  if (!apiKey) return getMockPlaces(lat, lng)

  const radius = 5000
  const results = []
  const seen = new Set()

  await Promise.allSettled(
    SEARCH_TYPES.map(async (type) => {
      try {
        const res = await fetch(
          `/api/gmaps/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${apiKey}&language=th`
        )
        if (!res.ok) return
        const data = await res.json()
        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') return
        for (const p of (data.results || []).slice(0, 3)) {
          if (!seen.has(p.place_id)) {
            seen.add(p.place_id)
            results.push(mapPlace(p, lat, lng))
          }
        }
      } catch (_) {}
    })
  )

  if (results.length === 0) return getMockPlaces(lat, lng)
  return results.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 10)
}

function getMockPlaces(lat, lng) {
  // Approximate offsets: ~0.009° ≈ 1km
  return [
    {
      name: 'โรงพยาบาลในบริเวณใกล้เคียง',
      types: ['hospital'],
      typeLabel: 'โรงพยาบาล',
      distance: '0.8 กม.',
      distanceKm: 0.8,
      risk: 'medium',
      riskLabel: 'เสี่ยงกลาง',
      lat: lat + 0.007,
      lng: lng + 0.003,
    },
    {
      name: 'วัดในบริเวณใกล้เคียง',
      types: ['place_of_worship'],
      typeLabel: 'ศาสนสถาน',
      distance: '1.2 กม.',
      distanceKm: 1.2,
      risk: 'medium',
      riskLabel: 'เสี่ยงกลาง',
      lat: lat - 0.006,
      lng: lng + 0.008,
    },
    {
      name: 'สวนสาธารณะท้องถิ่น',
      types: ['park'],
      typeLabel: 'สวนสาธารณะ',
      distance: '2.4 กม.',
      distanceKm: 2.4,
      risk: 'low',
      riskLabel: 'เสี่ยงต่ำ',
      lat: lat + 0.02,
      lng: lng - 0.005,
    },
  ]
}

export async function reverseGeocode(lat, lng) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY
  try {
    const response = await fetch(
      `/api/gmaps/maps/api/geocode/json?latlng=${lat},${lng}&language=th&key=${apiKey}`
    )
    const data = await response.json()
    if (data.results && data.results.length > 0) {
      const result = data.results[0]
      const components = result.address_components || []
      let province = ''
      let locality = ''
      for (const comp of components) {
        if (comp.types.includes('administrative_area_level_1')) province = comp.long_name
        if (comp.types.includes('locality') || comp.types.includes('sublocality_level_1'))
          locality = comp.long_name
      }
      return {
        province: province || 'ไม่ทราบจังหวัด',
        locality: locality || result.formatted_address?.split(',')[0] || 'ไม่ทราบสถานที่',
        formatted: result.formatted_address || '',
      }
    }
  } catch (_) {}
  return { province: 'ไม่ทราบจังหวัด', locality: 'ไม่ทราบสถานที่', formatted: '' }
}
