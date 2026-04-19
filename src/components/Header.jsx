import RankBadge from './RankBadge'

export default function Header({ title, rankLevel = 1 }) {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-gold/10 bg-ink sticky top-0 z-40">
      <div className="flex items-center gap-2.5">
        <OPITSeal size={26} />
        <div>
          <p className="font-serif text-gold text-xs tracking-widest leading-none">ส.ต.ล.</p>
          <p className="font-sans text-dim/40 text-[11px] tracking-wider leading-none mt-0.5">OPIT</p>
        </div>
      </div>
      <h1 className="font-sans text-parchment/80 text-sm font-normal tracking-wide text-center flex-1 px-3">
        {title}
      </h1>
      <RankBadge level={rankLevel} compact />
    </header>
  )
}

export function OPITSeal({ size = 40, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="46" fill="none" stroke="#c9a84c" strokeWidth="2" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="#c9a84c" strokeWidth="0.8" />
      <text x="50" y="45" textAnchor="middle" fill="#c9a84c" fontSize="14" fontFamily="serif" fontWeight="bold">ส.ต.ล.</text>
      <text x="50" y="60" textAnchor="middle" fill="#c9a84c" fontSize="6" fontFamily="serif">OPIT</text>
      <text x="50" y="72" textAnchor="middle" fill="#6b5c4a" fontSize="4.5" fontFamily="serif">สำนักงานตรวจสอบสิ่งลี้ลับ</text>
    </svg>
  )
}
