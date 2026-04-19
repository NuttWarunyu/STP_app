import { useState } from 'react'
import Header from './Header'
import RankBadge from './RankBadge'
import IDCard from './IDCard'
import { getRankInfo, getProgressToNextRank } from '../lib/rank'
import { supabase } from '../lib/supabase'

export default function Profile({ profile, onProfileUpdate }) {
  const [showIDCard, setShowIDCard] = useState(false)
  const rank = getRankInfo(profile?.rank_level || 1)
  const progress = getProgressToNextRank(profile || {})

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="โปรไฟล์เจ้าหน้าที่" rankLevel={profile?.rank_level || 1} />

      <div className="flex-1 overflow-y-auto pt-3 pb-4 space-y-2.5 px-3">
        {/* Officer identity card */}
        <div className="rounded-card bg-white/[0.04] border border-gold/[0.12] p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-serif text-parchment text-base leading-tight truncate">
                {profile?.username || 'เจ้าหน้าที่'}
              </p>
              <p className="font-sans text-xs text-dim/60 mt-0.5">{rank.nameTh}</p>
              <p className="font-sans text-[12px] text-dim/35 tracking-wider">{rank.nameEn}</p>
            </div>
            <RankBadge level={profile?.rank_level || 1} />
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-gold/[0.08] pt-3">
            <Stat label="รายงาน" value={profile?.total_detections || 0} />
            <Stat label="จังหวัด" value={(profile?.unique_provinces || []).length} />
            <Stat label="ชนิดผี" value={(profile?.unique_classes || []).length} />
          </div>
        </div>

        {/* Promotion progress */}
        {progress && (
          <div className="rounded-card bg-white/[0.04] border border-gold/[0.12] p-4 space-y-2.5">
            <p className="font-sans text-[12px] text-dim/50 tracking-widest uppercase">
              เงื่อนไขเลื่อนขั้น → {progress.nextRank.nameTh}
            </p>
            <div className="space-y-2.5">
              {progress.checks.map((check, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between font-sans text-[12px]">
                    <span className="text-dim/60">{check.label}</span>
                    <span className={check.current >= check.required ? 'text-gold/80' : 'text-dim/50'}>
                      {check.current}/{check.required}
                    </span>
                  </div>
                  <div className="h-px bg-dim/10">
                    <div
                      className="h-px bg-gold/50 transition-all"
                      style={{ width: `${Math.min((check.current / check.required) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ghost classes encountered */}
        {(profile?.unique_classes || []).length > 0 && (
          <div className="rounded-card bg-white/[0.04] border border-gold/[0.12] p-4 space-y-2.5">
            <p className="font-sans text-[12px] text-dim/50 tracking-widest uppercase">ชนิดผีที่พบ</p>
            <div className="flex flex-wrap gap-1.5">
              {(profile.unique_classes || []).map((c) => (
                <span key={c} className="font-sans text-[12px] border border-gold/[0.15] px-2 py-0.5 rounded-sm text-parchment/60">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Provinces surveyed */}
        {(profile?.unique_provinces || []).length > 0 && (
          <div className="rounded-card bg-white/[0.04] border border-gold/[0.12] p-4 space-y-2.5">
            <p className="font-sans text-[12px] text-dim/50 tracking-widest uppercase">จังหวัดที่สำรวจ</p>
            <div className="flex flex-wrap gap-1.5">
              {(profile.unique_provinces || []).map((p) => (
                <span key={p} className="font-sans text-[12px] border border-dim/[0.15] px-1.5 py-0.5 rounded-sm text-dim/50">
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ID card toggle */}
        <button
          onClick={() => setShowIDCard(!showIDCard)}
          className="w-full rounded-card border border-gold/[0.2] text-gold/70 font-sans text-xs py-2.5 hover:bg-gold/[0.05] transition-colors tracking-wide"
        >
          {showIDCard ? 'ซ่อนบัตรประจำตัว' : 'แสดงบัตรประจำตัว'}
        </button>

        {showIDCard && profile && <IDCard profile={profile} />}

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="w-full rounded-card border border-dim/[0.12] text-dim/40 font-sans text-xs py-2.5 hover:border-blood/20 hover:text-blood/50 transition-colors tracking-wide"
        >
          ออกจากระบบ
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="text-center">
      <p className="font-sans text-xl text-gold">{value}</p>
      <p className="font-sans text-[12px] text-dim/45 mt-0.5">{label}</p>
    </div>
  )
}
