import { useState, useEffect, useCallback } from 'react'
import Header from './Header'
import FeedCard from './FeedCard'
import ReportModal from './ReportModal'
import { getFeedReports } from '../lib/supabase'

export default function Feed({ profile }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [touchStart, setTouchStart] = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await getFeedReports(20, profile?.rank_level || 1)
      setReports(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [profile?.rank_level])

  useEffect(() => { load() }, [load])

  const handleTouchStart = (e) => setTouchStart(e.touches[0].clientY)
  const handleTouchEnd = (e) => {
    if (touchStart === null) return
    if (e.changedTouches[0].clientY - touchStart > 80 && window.scrollY === 0) {
      setRefreshing(true)
      load()
    }
    setTouchStart(null)
  }

  return (
    <div className="flex flex-col h-full" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <Header title="บันทึกภาคสนาม" rankLevel={profile?.rank_level || 1} />

      {refreshing && (
        <div className="text-center py-2">
          <span className="font-sans text-[15px] text-gold/50 tracking-widest">กำลังโหลด...</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pt-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="w-6 h-6 border border-gold/30 border-t-gold animate-spin rounded-full" />
            <span className="font-sans text-xs text-dim/50 tracking-wider">กำลังโหลดรายงาน</span>
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 px-8 text-center">
            <div className="w-16 h-16 rounded-card bg-white/[0.04] border border-gold/10 flex items-center justify-center">
              <span className="text-2xl opacity-30">📋</span>
            </div>
            <p className="font-sans text-dim/60 text-sm">ยังไม่มีรายงานในฐานข้อมูล</p>
            <p className="font-sans text-dim/35 text-xs">เริ่มสแกนภาคสนามเพื่อบันทึกรายงานแรก</p>
          </div>
        ) : (
          <div className="pb-2">
            {reports.map((r) => (
              <FeedCard key={r.id} report={r} onClick={setSelectedReport} />
            ))}
          </div>
        )}
      </div>

      {selectedReport && (
        <ReportModal report={selectedReport} onClose={() => setSelectedReport(null)} />
      )}
    </div>
  )
}
