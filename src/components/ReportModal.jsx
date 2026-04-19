import { GHOST_CLASSES } from '../constants/ghosts'
import { formatThaiDate } from '../lib/report'
import { DangerDots } from './FeedCard'

export default function ReportModal({ report, onClose }) {
  const ghost = GHOST_CLASSES[report.ghost_class]

  return (
    <div className="fixed inset-0 z-50 bg-ink/95 overflow-y-auto" onClick={onClose}>
      <div className="min-h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Sticky header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gold/10 sticky top-0 bg-ink z-10">
          <span className="font-mono text-[15px] text-dim/50 tracking-widest">{report.report_number}</span>
          <button
            onClick={onClose}
            className="font-sans text-dim/50 text-xs border border-dim/[0.15] rounded-sm px-2.5 py-1 hover:border-dim/30 transition-colors"
          >
            ปิด
          </button>
        </div>

        <div className="p-3 space-y-2.5">
          {/* Date */}
          <p className="font-sans text-[15px] text-dim/35 tracking-widest text-center pt-1">
            {formatThaiDate(report.created_at)}
          </p>

          {/* Photo */}
          {report.photo_url && (
            <div className="rounded-card overflow-hidden border border-dim/[0.1]">
              <img
                src={`data:image/jpeg;base64,${report.photo_url}`}
                alt=""
                className="w-full object-cover max-h-72"
              />
            </div>
          )}

          {/* Ghost info */}
          <div className="rounded-card bg-white/[0.04] border border-gold/[0.12] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg shrink-0">{ghost?.icon || '👻'}</span>
                <span className="font-serif text-parchment text-base leading-tight truncate">
                  {ghost?.nameTh || report.ghost_class}
                </span>
              </div>
              <DangerDots level={report.danger_level || ghost?.dangerLevel || 1} />
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-gold/[0.08] pt-3">
              <InfoRow label="ชนิด" value={report.ghost_class} />
              <InfoRow label="สถานที่" value={report.location_name} />
              <InfoRow label="จังหวัด" value={report.province} />
              <InfoRow label="เจ้าหน้าที่" value={report.profiles?.username || 'ไม่ระบุ'} />
            </div>

            {report.claude_reason && (
              <div className="border-t border-gold/[0.08] pt-3 space-y-1">
                <span className="font-sans text-[15px] text-dim/45 tracking-widest uppercase">
                  บันทึกการวิเคราะห์
                </span>
                <p className="font-sans text-xs text-parchment/55 italic leading-relaxed">
                  "{report.claude_reason}"
                </p>
              </div>
            )}
          </div>

          {/* Coexist tip */}
          {ghost?.coexistTip && (
            <div className="rounded-card border border-gold/[0.12] bg-gold/[0.03] p-4 space-y-1.5">
              <span className="font-sans text-[15px] text-gold/50 tracking-widest uppercase">คำแนะนำ</span>
              <p className="font-sans text-xs text-parchment/55 leading-relaxed">{ghost.coexistTip}</p>
            </div>
          )}

          {/* Coordinates */}
          {report.lat && report.lng && (
            <p className="font-mono text-[14px] text-dim/25 text-center tracking-widest pb-2">
              {Number(report.lat).toFixed(6)}, {Number(report.lng).toFixed(6)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div>
      <span className="font-sans text-[15px] text-dim/40 tracking-widest uppercase block">{label}</span>
      <span className="font-sans text-xs text-parchment/70">{value}</span>
    </div>
  )
}
