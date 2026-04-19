export const ROYAL_GEOFENCES = [
  { name: 'พระบรมมหาราชวัง', lat: 13.7500, lng: 100.4913 },
  { name: 'วัดพระแก้ว', lat: 13.7516, lng: 100.4928 },
  { name: 'วังจิตรลดา', lat: 13.7650, lng: 100.5136 },
  { name: 'พระราชวังบางปะอิน', lat: 14.2351, lng: 100.5734 },
  { name: 'พระราชวังดุสิต', lat: 13.7712, lng: 100.5117 },
  { name: 'วัดราชบพิธ', lat: 13.7490, lng: 100.4985 },
  { name: 'วัดพระเชตุพน (วัดโพธิ์)', lat: 13.7465, lng: 100.4928 },
  { name: 'สวนจิตรลดา', lat: 13.7654, lng: 100.5121 },
  { name: 'พระที่นั่งอนันตสมาคม', lat: 13.7706, lng: 100.5134 },
  { name: 'พระราชวังสนามจันทร์', lat: 13.8198, lng: 100.0567 },
  { name: 'พระราชวังพญาไท', lat: 13.7650, lng: 100.5298 },
  { name: 'พระราชนิเวศน์มฤคทายวัน', lat: 12.6142, lng: 99.9623 },
]

export const ROYAL_RADIUS_METERS = 500

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function isInRoyalZone(lat, lng) {
  return ROYAL_GEOFENCES.some(
    (p) => haversineDistance(lat, lng, p.lat, p.lng) <= ROYAL_RADIUS_METERS
  )
}
