import { useState, useEffect } from 'react'
import { supabase, getProfile, upsertProfile } from './lib/supabase'
import Splash from './components/Splash'
import UpgradePrompt, { shouldShowUpgrade } from './components/UpgradePrompt'
import Feed from './components/Feed'
import Scanner from './components/Scanner'
import Passport from './components/Passport'
import Profile from './components/Profile'

function IconFeed({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="3" y="12" width="7" height="9" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
    </svg>
  )
}

function IconScan() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8V6a2 2 0 012-2h2" />
      <path d="M4 16v2a2 2 0 002 2h2" />
      <path d="M16 4h2a2 2 0 012 2v2" />
      <path d="M16 20h2a2 2 0 002-2v-2" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="12" y1="8" x2="12" y2="16" />
    </svg>
  )
}

function IconPassport({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v16H4z" rx="2" />
      <path d="M4 9h16" />
      <path d="M9 4v5" />
      <circle cx="12" cy="15" r="2" />
    </svg>
  )
}

function IconProfile({ active }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <circle cx="9" cy="14" r="2.5" />
      <path d="M14 12h5" />
      <path d="M14 16h4" />
      <path d="M7 7V5a5 5 0 0110 0v2" />
    </svg>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [activeTab, setActiveTab] = useState('scan')
  const [loading, setLoading] = useState(true)
  const [showUpgrade, setShowUpgrade] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadProfile = async (userId) => {
    try {
      let p = await getProfile(userId)
      if (!p) {
        p = await upsertProfile({
          id: userId,
          username: 'เจ้าหน้าที่',
          rank_level: 1,
          total_detections: 0,
          unique_provinces: [],
          unique_classes: [],
          daily_scans_count: 0,
        })
      }
      setProfile(p)
    } catch (e) {
      console.error('Profile load error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (profile && session && shouldShowUpgrade(profile, session)) {
      setShowUpgrade(true)
    }
  }, [profile?.total_detections])

  if (loading) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border border-gold/30 border-t-gold animate-spin rounded-full" />
          <span className="font-sans text-xs text-dim/60 tracking-wider">กำลังเชื่อมต่อระบบ</span>
        </div>
      </div>
    )
  }

  if (!session) return <Splash />

  return (
    <div className="min-h-screen bg-ink flex flex-col max-w-md mx-auto relative">
      <div className="flex-1 overflow-hidden flex flex-col pb-20">
        {activeTab === 'feed' && <Feed profile={profile} />}
        {activeTab === 'scan' && <Scanner profile={profile} onProfileUpdate={setProfile} />}
        {activeTab === 'passport' && <Passport profile={profile} />}
        {activeTab === 'profile' && <Profile profile={profile} onProfileUpdate={setProfile} />}
      </div>

      {showUpgrade && (
        <UpgradePrompt onDismiss={() => setShowUpgrade(false)} />
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 bg-ink border-t border-gold/10">
        <div className="grid grid-cols-4 items-end">
          <NavBtn id="feed" active={activeTab === 'feed'} label="บันทึก" onPress={setActiveTab}>
            <IconFeed active={activeTab === 'feed'} />
          </NavBtn>

          <NavBtn id="passport" active={activeTab === 'passport'} label="แฟ้มสะสม" onPress={setActiveTab}>
            <IconPassport active={activeTab === 'passport'} />
          </NavBtn>

          {/* Scan — raised center button */}
          <button
            onClick={() => setActiveTab('scan')}
            className="flex flex-col items-center gap-1 pb-3 -mt-4"
          >
            <div className={`w-14 h-14 rounded-card flex items-center justify-center border transition-colors ${
              activeTab === 'scan'
                ? 'bg-gold/15 border-gold/50 text-gold'
                : 'bg-white/[0.04] border-gold/20 text-dim/60 hover:border-gold/30 hover:text-dim'
            }`}>
              <IconScan />
            </div>
            <span className={`font-sans text-[13px] tracking-wide transition-colors ${
              activeTab === 'scan' ? 'text-gold' : 'text-dim/40'
            }`}>สแกน</span>
          </button>

          <NavBtn id="profile" active={activeTab === 'profile'} label="โปรไฟล์" onPress={setActiveTab}>
            <IconProfile active={activeTab === 'profile'} />
          </NavBtn>
        </div>
      </nav>
    </div>
  )
}

function NavBtn({ id, active, label, onPress, children }) {
  return (
    <button
      onClick={() => onPress(id)}
      className={`flex flex-col items-center gap-1.5 py-3 transition-colors ${
        active ? 'text-gold' : 'text-dim/40 hover:text-dim/70'
      }`}
    >
      {children}
      <span className="font-sans text-[13px] tracking-wide">{label}</span>
    </button>
  )
}
