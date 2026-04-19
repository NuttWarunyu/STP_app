import { GHOSTS, RARITY } from '../constants/ghosts'

export async function getWeather(lat, lng) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=weather_code,precipitation&timezone=auto`
    )
    const data = await res.json()
    const code = data.current?.weather_code ?? 0
    const precip = data.current?.precipitation ?? 0
    return {
      isRainy: precip > 0.5 || (code >= 51 && code <= 99),
      isOvercast: code >= 2 && code <= 49,
      raw: code,
    }
  } catch (_) {
    return { isRainy: false, isOvercast: false, raw: 0 }
  }
}

function isNight() {
  const h = new Date().getHours()
  return h >= 18 || h < 6
}

function isDeepNight() {
  const h = new Date().getHours()
  return h >= 0 && h < 5
}

function isFullMoon() {
  const date = new Date()
  const lunarCycle = 29.53058867
  const knownFullMoon = new Date('2024-01-25').getTime()
  const diff = (date.getTime() - knownFullMoon) / (1000 * 60 * 60 * 24)
  const phase = ((diff % lunarCycle) + lunarCycle) % lunarCycle
  return phase >= 13.5 && phase <= 15.5
}

function getMovementBonus() {
  try {
    const stored = localStorage.getItem('stl_movement')
    if (!stored) return 0
    const { dist, ts } = JSON.parse(stored)
    const age = (Date.now() - ts) / 1000 / 60
    if (age > 30) return 0
    return dist > 500 ? 0.1 : 0
  } catch (_) { return 0 }
}

function getRankBonus(rankLevel = 1) {
  return Math.min((rankLevel - 1) * 0.04, 0.2)
}

function classifyNearbyTypes(nearbyPlaces) {
  const types = nearbyPlaces.flatMap((p) => p.types || []).join(' ')
  return {
    hasWater: /river|lake|water/.test(types),
    hasCemetery: /cemetery/.test(types),
    hasForest: /park|natural_feature/.test(types),
    hasTemple: /place_of_worship/.test(types),
    hasHospital: /hospital/.test(types),
    hasHistoric: /museum|university/.test(types),
  }
}

function selectGhostPool(nearbyTypes, weather, hour) {
  const candidates = GHOSTS.filter((g) => {
    if (g.rarity === 'Legendary' && Math.random() > 0.15) return false
    if (g.rarity === 'Rare' && Math.random() > 0.3) return false
    if (g.spawnConditions?.nightOnly && !isNight()) return false
    if (g.spawnConditions?.fullMoon && !isFullMoon()) return false
    return true
  })

  const scored = candidates.map((g) => {
    let w = RARITY[g.rarity]?.weight ?? 20
    const cond = g.spawnConditions || {}
    if (g.class === 'เร่ร่อน') w += 35
    if (nearbyTypes.hasWater && g.class === 'น้ำ') w += 20
    if (nearbyTypes.hasCemetery && ['อาคม', 'นรก'].includes(g.class)) w += 15
    if (nearbyTypes.hasForest && g.class === 'ป่า') w += 20
    if (nearbyTypes.hasTemple && ['อาคม', 'โบราณ'].includes(g.class)) w += 10
    if (nearbyTypes.hasHistoric && ['โบราณ', 'ราชสำนัก'].includes(g.class)) w += 10
    if (weather.isRainy && ['น้ำ', 'เร่ร่อน'].includes(g.class)) w += 10
    if (isDeepNight()) w += (cond.timeBonus || 0) * 80
    else if (isNight()) w += (cond.timeBonus || 0) * 40
    return { ghost: g, weight: w }
  })

  return scored
}

function weightedPick(scored) {
  const total = scored.reduce((s, x) => s + x.weight, 0)
  let r = Math.random() * total
  for (const { ghost, weight } of scored) {
    r -= weight
    if (r <= 0) return ghost
  }
  return scored[0].ghost
}

export function calculateDetectionProbability({ nearbyPlaces = [], weather = {}, rankLevel = 1 }) {
  const nearbyTypes = classifyNearbyTypes(nearbyPlaces)
  let prob = 0.35

  if (isDeepNight()) prob += 0.25
  else if (isNight()) prob += 0.15

  if (nearbyTypes.hasCemetery) prob += 0.25
  if (nearbyTypes.hasWater) prob += 0.10
  if (nearbyTypes.hasForest) prob += 0.10
  if (nearbyTypes.hasTemple) prob += 0.10
  if (nearbyTypes.hasHospital) prob += 0.10
  if (weather.isRainy) prob += 0.10
  if (weather.isOvercast) prob += 0.05
  if (isFullMoon()) prob += 0.10

  prob += getMovementBonus()
  prob += getRankBonus(rankLevel)

  return Math.min(prob, 0.85)
}

export function selectDetectedGhost({ nearbyPlaces = [], weather = {} }) {
  const nearbyTypes = classifyNearbyTypes(nearbyPlaces)
  const scored = selectGhostPool(nearbyTypes, weather, new Date().getHours())
  return weightedPick(scored)
}

export function updateMovementHistory(lat, lng) {
  try {
    const stored = localStorage.getItem('stl_last_pos')
    if (stored) {
      const { lat: lat0, lng: lng0 } = JSON.parse(stored)
      const dist = haversineM(lat0, lng0, lat, lng)
      localStorage.setItem('stl_movement', JSON.stringify({ dist, ts: Date.now() }))
    }
    localStorage.setItem('stl_last_pos', JSON.stringify({ lat, lng }))
  } catch (_) {}
}

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
