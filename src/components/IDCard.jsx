import { useRef } from 'react'
import html2canvas from 'html2canvas'
import { OPITSeal } from './Header'
import { getRankInfo } from '../lib/rank'

export default function IDCard({ profile }) {
  const cardRef = useRef(null)
  const rank = getRankInfo(profile?.rank_level || 1)
  const yearBE = new Date().getFullYear() + 543
  const idNumber = `STL-${yearBE}-${String(profile?.sequence || 1).padStart(6, '0')}`

  const handleDownload = async () => {
    if (!cardRef.current) return
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0d0a06',
        scale: 2,
        useCORS: true,
      })
      const link = document.createElement('a')
      link.download = `STL-ID-${profile?.username || 'officer'}.jpg`
      link.href = canvas.toDataURL('image/jpeg', 0.95)
      link.click()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="space-y-2.5">
      <div
        ref={cardRef}
        className="rounded-card border border-gold/[0.2] p-4 space-y-4 bg-ink"
        style={{ fontFamily: '"Noto Sans Thai", sans-serif' }}
      >
        <div className="flex items-center justify-between border-b border-gold/[0.1] pb-3">
          <OPITSeal size={38} />
          <div className="text-right">
            <p className="font-sans text-[12px] text-dim/40 tracking-widest">บัตรประจำตัว</p>
            <p className="font-sans text-[11px] text-dim/30 tracking-widest">OFFICIAL ID · OPIT</p>
          </div>
        </div>

        <div className="space-y-0.5">
          <p className="font-serif text-gold text-lg leading-tight">{profile?.username || 'เจ้าหน้าที่'}</p>
          <p className="font-sans text-xs text-parchment/65 mt-0.5">{rank.nameTh}</p>
          <p className="font-sans text-[12px] text-dim/40 tracking-wider">{rank.nameEn}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 border-t border-dim/[0.1] pt-3">
          <div className="text-center">
            <p className="font-sans text-lg text-gold">{profile?.total_detections || 0}</p>
            <p className="font-sans text-[12px] text-dim/45">รายงาน</p>
          </div>
          <div className="text-center">
            <p className="font-sans text-lg text-gold">{(profile?.unique_provinces || []).length}</p>
            <p className="font-sans text-[12px] text-dim/45">จังหวัด</p>
          </div>
          <div className="text-center">
            <p className="font-sans text-lg text-gold">{(profile?.unique_classes || []).length}</p>
            <p className="font-sans text-[12px] text-dim/45">ชนิดผี</p>
          </div>
        </div>

        <div className="border-t border-dim/[0.08] pt-2 flex items-center justify-between">
          <p className="font-mono text-[11px] text-dim/35 tracking-widest">{idNumber}</p>
          <p className="font-sans text-[11px] text-dim/25">ระดับ {profile?.rank_level || 1}</p>
        </div>
      </div>

      <button
        onClick={handleDownload}
        className="w-full rounded-card border border-dim/[0.15] text-dim/45 font-sans text-xs py-2.5 hover:border-dim/30 transition-colors tracking-wide"
      >
        บันทึกบัตรประจำตัว
      </button>
    </div>
  )
}
