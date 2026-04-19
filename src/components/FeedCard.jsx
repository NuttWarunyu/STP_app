import { GHOST_CLASSES } from '../constants/ghosts'
import { formatThaiDate } from '../lib/report'

const CLASS_PILL = {
  เร่ร่อน: 'text-parchment/50 border-dim/30',
  ป่า:     'text-green-400/70 border-green-800/40',
  น้ำ:     'text-blue-400/70 border-blue-800/40',
  อาคม:    'text-purple-300/70 border-purple-800/40',
  โบราณ:   'text-amber-300/70 border-amber-800/40',
  ราชสำนัก: 'text-yellow-300/70 border-yellow-800/40',
  นรก:     'text-red-400/70 border-blood/40',
}

export default function FeedCard({ report, onClick }) {
  const ghost = GHOST_CLASSES[report.ghost_class]
  const pillColor = CLASS_PILL[report.ghost_class] || CLASS_PILL.เร่ร่อน

  return (
    <div
      onClick={() => onClick?.(report)}
      className="mx-3 mb-2.5 rounded-card bg-white/[0.04] border border-gold/[0.12] hover:border-gold/25 transition-colors cursor-pointer overflow-hidden"
    >
      <div className="p-3.5 space-y-2.5">
        {/* Row 1: ghost name + class pill */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base leading-none shrink-0">{ghost?.icon || '👻'}</span>
            <span className="font-serif text-parchment text-sm leading-tight truncate">
              {report.ghost_name_th || report.ghost_class}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`font-sans text-[11px] border px-1.5 py-0.5 rounded-sm ${pillColor}`}>
              {report.ghost_class}
            </span>
            <DangerDots level={report.danger_level || ghost?.dangerLevel || 1} />
          </div>
        </div>

        {/* Row 2: location */}
        <p className="font-sans text-xs text-dim/70 leading-snug">
          {[report.location_name, report.province].filter(Boolean).join(' · ')}
        </p>

        {/* Row 3: officer + report number + date */}
        <div className="flex items-center justify-between border-t border-gold/[0.08] pt-2">
          <div className="flex items-center gap-1.5">
            <span className="font-sans text-[12px] text-dim/50">
              {report.profiles?.username || 'เจ้าหน้าที่'}
            </span>
            {report.profiles?.rank_level && (
              <span className="font-sans text-[11px] border border-dim/20 px-1 py-px text-dim/40 rounded-sm">
                ระดับ {report.profiles.rank_level}
              </span>
            )}
          </div>
          <div className="text-right">
            <p className="font-mono text-[11px] text-dim/35 tracking-wider">{report.report_number}</p>
            <p className="font-sans text-[11px] text-dim/35">{formatThaiDate(report.created_at)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function DangerDots({ level = 1 }) {
  return (
    <div className="flex gap-0.5 shrink-0 items-center">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < level ? 'bg-blood' : 'bg-dim/15'}`} />
      ))}
    </div>
  )
}
