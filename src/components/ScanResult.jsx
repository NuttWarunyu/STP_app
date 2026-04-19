export default function ScanResult({ result, onViewReport, onRetry }) {
  if (!result.detected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5">
        <div className="rounded-card bg-white/[0.04] border border-gold/[0.08] w-full p-6 space-y-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500/80" />
            <span className="font-sans text-[15px] text-green-400/70 tracking-widest uppercase">
              ไม่พบสิ่งผิดปกติ
            </span>
          </div>

          <div className="space-y-1.5">
            <p className="font-serif text-parchment text-base">ผลการตรวจสอบ: ปกติ</p>
            <p className="font-sans text-xs text-dim/60 leading-relaxed">
              ไม่พบพลังงานผิดปกติในรัศมีที่กำหนด
            </p>
          </div>

          {result.reason && (
            <p className="font-sans text-[15px] text-dim/40 italic leading-relaxed border-t border-dim/10 pt-3">
              "{result.reason}"
            </p>
          )}

          <div className="border-t border-dim/10 pt-3">
            <p className="font-sans text-[15px] text-dim/35 tracking-widest">
              ความเชื่อมั่น {result.confidence}%
            </p>
          </div>
        </div>

        <button
          onClick={onRetry}
          className="w-full rounded-card border border-dim/[0.2] text-dim/60 font-sans text-xs py-3 hover:border-dim/40 transition-colors tracking-wide"
        >
          ตรวจสอบใหม่
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5">
      <div className="rounded-card bg-white/[0.04] border border-blood/[0.2] w-full p-6 space-y-4 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blood animate-pulse" />
          <span className="font-sans text-[15px] text-blood/70 tracking-widest uppercase">
            ตรวจพบสิ่งผิดปกติ
          </span>
        </div>

        <div className="space-y-1.5">
          <p className="font-serif text-gold text-base">ยืนยันการตรวจพบ</p>
          <p className="font-sans text-xs text-dim/60 leading-relaxed">
            ชนิด: <span className="text-parchment/80">{result.ghost_class}</span>
          </p>
        </div>

        {result.reason && (
          <p className="font-sans text-[15px] text-dim/40 italic leading-relaxed border-t border-dim/10 pt-3">
            "{result.reason}"
          </p>
        )}

        <div className="border-t border-dim/10 pt-3">
          <p className="font-sans text-[15px] text-dim/35 tracking-widest">
            ความเชื่อมั่น {result.confidence}%
          </p>
        </div>
      </div>

      <button
        onClick={onViewReport}
        className="w-full rounded-card border border-gold/[0.4] text-gold font-sans text-sm py-3 hover:bg-gold/[0.07] transition-colors tracking-wide"
      >
        ดูรายงาน
      </button>
    </div>
  )
}
