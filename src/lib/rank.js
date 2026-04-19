import { RANKS, RANK_THRESHOLDS, RARE_CLASSES, LEGENDARY_CLASSES } from '../constants/ranks'

export function calculateRank(profile) {
  const {
    total_detections = 0,
    unique_provinces = [],
    unique_classes = [],
  } = profile

  const has_rare = unique_classes.some((c) => RARE_CLASSES.includes(c))
  const has_legendary = unique_classes.some((c) => LEGENDARY_CLASSES.includes(c))

  let rank = 1

  if (total_detections >= 1) rank = Math.max(rank, 2)

  if (total_detections >= 5 && unique_provinces.length >= 3) rank = Math.max(rank, 3)

  if (total_detections >= 10 && has_rare) rank = Math.max(rank, 4)

  if (unique_classes.length >= 6 && unique_provinces.length >= 5) rank = Math.max(rank, 5)

  if (unique_classes.length >= 10 && has_legendary) rank = Math.max(rank, 6)

  if (unique_classes.length >= 7 && unique_provinces.length >= 10) rank = Math.max(rank, 7)

  return rank
}

export function getRankInfo(level) {
  return RANKS.find((r) => r.level === level) || RANKS[0]
}

export function getDailyLimit(rankLevel) {
  return getRankInfo(rankLevel)?.dailyScans ?? 3
}

export function hasUnlock(rankLevel, unlock) {
  const rank = getRankInfo(rankLevel)
  return rank?.unlocks?.includes(unlock) ?? false
}

export function getProgressToNextRank(profile) {
  const currentRank = profile.rank_level || 1
  if (currentRank >= 7) return null

  const next = currentRank + 1
  const threshold = RANK_THRESHOLDS[next]
  if (!threshold) return null

  const checks = []

  if (threshold.total_detections !== undefined) {
    checks.push({
      label: 'การตรวจพบทั้งหมด',
      current: profile.total_detections || 0,
      required: threshold.total_detections,
    })
  }
  if (threshold.unique_provinces !== undefined) {
    checks.push({
      label: 'จังหวัดที่สำรวจ',
      current: (profile.unique_provinces || []).length,
      required: threshold.unique_provinces,
    })
  }
  if (threshold.unique_classes !== undefined) {
    checks.push({
      label: 'ชนิดผีที่พบ',
      current: (profile.unique_classes || []).length,
      required: threshold.unique_classes,
    })
  }
  if (threshold.has_rare) {
    const hasRare = (profile.unique_classes || []).some((c) => RARE_CLASSES.includes(c))
    checks.push({ label: 'ผีหายาก', current: hasRare ? 1 : 0, required: 1 })
  }
  if (threshold.has_legendary) {
    const hasLeg = (profile.unique_classes || []).some((c) => LEGENDARY_CLASSES.includes(c))
    checks.push({ label: 'ผีในตำนาน', current: hasLeg ? 1 : 0, required: 1 })
  }

  return { nextRank: getRankInfo(next), checks }
}
