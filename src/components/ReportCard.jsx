import { useRef } from 'react'
import html2canvas from 'html2canvas'
import { GHOST_CLASSES, GHOST_BY_ID, RARITY } from '../constants/ghosts'
import { formatThaiDate } from '../lib/report'
import { DangerDots } from './FeedCard'
import { OPITSeal } from './Header'
import { getRankInfo } from '../lib/rank'

export default function ReportCard({ report, profile, onSave, onRetry }) {
  const cardRef = useRef(null)
  const ghostData = report.ghost_id ? GHOST_BY_ID[report.ghost_id] : null
  const ghostClass = GHOST_CLASSES[report.ghost_class]
  const nameTh = ghostData?.nameTh || report.ghost_name_th || report.ghost_class
  const coexistTip = ghostData?.coexistTip || ghostClass?.coexistTip
  const rarity = ghostData?.rarity || 'Common'
  const rarityInfo = RARITY[rarity]
  const photoMime = report.photo_url?.startsWith('iVBORw') ? 'image/png' : 'image/jpeg'

  const handleShare = async () => {
    if (!cardRef.current) return
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0d0a06',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        imageTimeout: 30000,
      })
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95)
      const link = document.createElement('a')
      link.download = `${report.report_number}.jpg`
      link.href = dataUrl
      link.click()
    } catch (e) {
      console.error('Share failed:', e)
    }
  }

  return (
    <div className="flex flex-col">
      {/* Shareable card */}
      <div ref={cardRef} className="bg-ink" style={{ fontFamily: '"Noto Sans Thai", sans-serif' }}>
        {/* Header strip */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gold/10">
          <div className="flex items-center gap-2">
            <OPITSeal size={26} />
            <div>
              <p className="font-serif text-gold text-[14px] leading-tight">สำนักงานตรวจสอบสิ่งลี้ลับ</p>
              <p className="font-sans text-dim/35 text-[13px] tracking-wider mt-0.5">OPIT</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono text-[15px] text-dim/60 tracking-wider">{report.report_number}</p>
            <p className="font-sans text-[14px] text-dim/35">{formatThaiDate(report.created_at)}</p>
          </div>
        </div>

        {/* Photo */}
        {report.photo_url ? (
          <div className="relative w-full">
            <img
              src={`data:${photoMime};base64,${report.photo_url}`}
              alt=""
              className="w-full object-contain bg-black"
              crossOrigin="anonymous"
              style={{ maxHeight: '65vh', minHeight: '200px' }}
            />
            {/* Name overlay at bottom */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink via-ink/70 to-transparent pt-10 pb-3 px-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="font-serif text-gold text-xl leading-tight">{nameTh}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`font-sans text-[15px] border px-1.5 py-0.5 rounded-sm ${rarityInfo.color}`}>
                      {rarityInfo.label}
                    </span>
                    <span className="font-sans text-[15px] border border-dim/30 px-1.5 py-0.5 rounded-sm text-dim/55">
                      {report.ghost_class}
                    </span>
                  </div>
                </div>
                <DangerDots level={report.danger_level || 3} />
              </div>
            </div>
          </div>
        ) : (
          <div className="h-48 bg-dim/5 flex items-center justify-center border-b border-dim/10">
            <span className="text-5xl opacity-15">{ghostClass?.icon || '👻'}</span>
          </div>
        )}

        {/* Info panel */}
        <div className="px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            <InfoRow label="สถานที่" value={report.location_name} />
            <InfoRow label="จังหวัด" value={report.province} />
            <InfoRow label="เจ้าหน้าที่" value={profile?.username || 'ไม่ระบุ'} />
            <InfoRow label="ยศ" value={getRankInfo(profile?.rank_level || 1)?.nameTh} />
          </div>

          {report.claude_reason && (
            <p className="font-sans text-[15px] text-parchment/45 italic leading-relaxed border-t border-dim/10 pt-2.5">
              "{report.claude_reason}"
            </p>
          )}

          {ghostData?.fieldNote && (
            <div className="rounded-card border border-dim/[0.12] bg-white/[0.02] p-3">
              <p className="font-sans text-[15px] text-dim/45 tracking-widest uppercase mb-1.5">บันทึกสนาม</p>
              <p className="font-sans text-[15px] text-parchment/45 leading-relaxed whitespace-pre-line">
                {ghostData.fieldNote}
              </p>
            </div>
          )}

          {coexistTip && (
            <div className="rounded-card border border-gold/[0.12] bg-gold/[0.03] p-3">
              <p className="font-sans text-[15px] text-gold/45 tracking-widest uppercase mb-1.5">คำแนะนำ</p>
              <p className="font-sans text-[15px] text-parchment/45 leading-relaxed">{coexistTip}</p>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-dim/[0.08] pt-2">
            <span className="font-sans text-[14px] text-dim/20 tracking-widest">
              สำนักงานตรวจสอบสิ่งลี้ลับแห่งประเทศไทย
            </span>
            {report.lat && (
              <span className="font-mono text-[14px] text-dim/20">
                {Number(report.lat).toFixed(4)}, {Number(report.lng).toFixed(4)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-3 gap-2 p-3 border-t border-gold/[0.08]">
        <button
          onClick={onSave}
          className="rounded-card border border-gold/[0.35] text-gold font-sans text-xs py-3 hover:bg-gold/[0.07] transition-colors"
        >
          บันทึก
        </button>
        <button
          onClick={handleShare}
          className="rounded-card border border-dim/[0.2] text-parchment/60 font-sans text-xs py-3 hover:bg-white/[0.03] transition-colors"
        >
          แชร์
        </button>
        <button
          onClick={onRetry}
          className="rounded-card border border-dim/[0.15] text-dim/50 font-sans text-xs py-3 hover:bg-white/[0.02] transition-colors"
        >
          ใหม่
        </button>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div>
      <span className="font-sans text-[15px] text-dim/40 tracking-widest uppercase block">{label}</span>
      <span className="font-sans text-xs text-parchment/65">{value}</span>
    </div>
  )
}
