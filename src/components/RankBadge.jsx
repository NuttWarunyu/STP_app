import { getRankInfo } from '../lib/rank'

const RANK_COLORS = {
  1: 'text-dim border-dim/50',
  2: 'text-parchment/70 border-parchment/30',
  3: 'text-gold/80 border-gold/40',
  4: 'text-gold border-gold/60',
  5: 'text-amber-300 border-amber-300/60',
  6: 'text-orange-300 border-orange-300/60',
  7: 'text-red-400 border-red-400/60',
}

export default function RankBadge({ level = 1, compact = false }) {
  const rank = getRankInfo(level)
  const colors = RANK_COLORS[level] || RANK_COLORS[1]

  if (compact) {
    return (
      <span
        className={`font-sans text-xs border px-1.5 py-0.5 tracking-wide shrink-0 ${colors}`}
      >
        ระดับ {level}
      </span>
    )
  }

  return (
    <div className={`font-sans text-xs border px-2 py-1 inline-block ${colors}`}>
      <div className="text-[15px] tracking-widest opacity-60">ยศ · RANK</div>
      <div className="font-medium">{rank.nameTh}</div>
    </div>
  )
}
