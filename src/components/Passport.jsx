import { useState, useEffect } from 'react'
import Header from './Header'
import GhostSlot from './GhostSlot'
import ReportModal from './ReportModal'
import { getUserReports } from '../lib/supabase'
import { INITIAL_PASSPORT_CLASSES } from '../constants/ghosts'

export default function Passport({ profile }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState(null)

  useEffect(() => {
    if (profile?.id) {
      getUserReports(profile.id)
        .then(setReports)
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [profile?.id])

  const collectedClasses = {}
  for (const r of reports) {
    if (!collectedClasses[r.ghost_class]) {
      collectedClasses[r.ghost_class] = r
    }
  }

  const collected = INITIAL_PASSPORT_CLASSES.filter((c) => collectedClasses[c]).length
  const total = INITIAL_PASSPORT_CLASSES.length
  const specialClasses = (profile?.unique_classes || []).filter(
    (c) => !INITIAL_PASSPORT_CLASSES.includes(c)
  )

  return (
    <div className="flex flex-col h-full">
      <Header title="แฟ้มสะสม" rankLevel={profile?.rank_level || 1} />

      <div className="flex-1 overflow-y-auto pt-3 pb-4 px-3 space-y-2.5">
        {/* Collection status */}
        <div className="rounded-card bg-white/[0.04] border border-gold/[0.12] p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-sans text-[12px] text-dim/50 tracking-widest uppercase">สถานะการสะสม</span>
            <span className="font-serif text-gold text-sm">
              {collected}/{total} ชนิด
            </span>
          </div>
          <div className="w-full bg-dim/10 h-px">
            <div
              className="bg-gold/60 h-px transition-all duration-500"
              style={{ width: `${(collected / total) * 100}%` }}
            />
          </div>
          <p className="font-sans text-[12px] text-dim/35">
            {total - collected > 0
              ? `ยังไม่พบ ${total - collected} ชนิด`
              : 'สะสมครบทุกชนิดแล้ว'}
          </p>
        </div>

        {/* Ghost grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="w-5 h-5 border border-gold/30 border-t-gold animate-spin rounded-full" />
            <span className="font-sans text-xs text-dim/40 tracking-wider">กำลังโหลด</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {INITIAL_PASSPORT_CLASSES.map((ghostClass) => (
                <GhostSlot
                  key={ghostClass}
                  ghostClass={ghostClass}
                  report={collectedClasses[ghostClass] || null}
                  onClick={setSelectedReport}
                />
              ))}
            </div>

            {specialClasses.length > 0 && (
              <div className="space-y-2">
                <p className="font-sans text-[12px] text-dim/50 tracking-widest uppercase px-0.5">ชนิดพิเศษ</p>
                <div className="grid grid-cols-3 gap-2">
                  {specialClasses.map((ghostClass) => (
                    <GhostSlot
                      key={ghostClass}
                      ghostClass={ghostClass}
                      report={collectedClasses[ghostClass] || null}
                      onClick={setSelectedReport}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedReport && (
        <ReportModal report={selectedReport} onClose={() => setSelectedReport(null)} />
      )}
    </div>
  )
}
