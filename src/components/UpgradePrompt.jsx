import { useState } from 'react'
import { supabase } from '../lib/supabase'

const DISMISS_KEY = 'stl_upgrade_dismissed'

export function shouldShowUpgrade(profile, session) {
  if (!session?.user?.is_anonymous) return false
  if ((profile?.total_detections || 0) < 1) return false
  const ts = localStorage.getItem(DISMISS_KEY)
  if (ts && Date.now() - Number(ts) < 24 * 3600 * 1000) return false
  return true
}

export default function UpgradePrompt({ onDismiss }) {
  const [loadingProvider, setLoadingProvider] = useState(null)
  const [showEmail, setShowEmail] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
    onDismiss()
  }

  const linkOAuth = async (provider) => {
    setLoadingProvider(provider)
    setError(null)
    try {
      const { error } = await supabase.auth.linkIdentity({ provider })
      if (error) throw error
      // OAuth redirect — browser leaves page, no further action needed here
    } catch (e) {
      setError(e.message)
      setLoadingProvider(null)
    }
  }

  const handleEmailUpgrade = async (e) => {
    e.preventDefault()
    setLoadingProvider('email')
    setError(null)
    try {
      const { error } = await supabase.auth.updateUser({ email, password })
      if (error) throw error
      setDone(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingProvider(null)
    }
  }

  const btnStyle = {
    width: '100%',
    backgroundColor: '#1e1a12',
    border: '1px solid rgba(201,168,76,0.18)',
    borderRadius: 8,
    padding: '11px 0',
    fontFamily: 'sans-serif',
    fontSize: 13,
    color: '#f5ead6',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    opacity: 1,
    transition: 'opacity 0.15s',
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleDismiss}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          zIndex: 50,
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 448,
          minHeight: 280,
          backgroundColor: '#110d07',
          borderTop: '1px solid rgba(201,168,76,0.2)',
          borderRadius: '20px 20px 0 0',
          zIndex: 51,
          padding: '24px 20px 36px',
          boxSizing: 'border-box',
        }}
      >
        {done ? (
          <div style={{ textAlign: 'center', paddingTop: 24 }}>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: '#f5ead6', marginBottom: 8 }}>
              ส่งอีเมลยืนยันแล้ว
            </p>
            <p style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#6b5c4a', marginBottom: 24 }}>
              กรุณาตรวจสอบกล่องจดหมายเพื่อยืนยันบัญชี
            </p>
            <button onClick={handleDismiss} style={{ ...btnStyle, width: 'auto', padding: '8px 24px' }}>
              รับทราบ
            </button>
          </div>
        ) : showEmail ? (
          <form onSubmit={handleEmailUpgrade} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 15, color: '#f5ead6', marginBottom: 4 }}>
              บันทึกด้วยอีเมล
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="อีเมล"
              required
              style={{
                background: '#1e1a12',
                border: '1px solid rgba(201,168,76,0.18)',
                borderRadius: 6,
                padding: '10px 12px',
                fontFamily: 'sans-serif',
                fontSize: 13,
                color: '#f5ead6',
                outline: 'none',
              }}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="ตั้งรหัสผ่าน (อย่างน้อย 6 ตัว)"
              required
              minLength={6}
              style={{
                background: '#1e1a12',
                border: '1px solid rgba(201,168,76,0.18)',
                borderRadius: 6,
                padding: '10px 12px',
                fontFamily: 'sans-serif',
                fontSize: 13,
                color: '#f5ead6',
                outline: 'none',
              }}
            />
            {error && (
              <p style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#f87171' }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={!!loadingProvider}
              style={{ ...btnStyle, backgroundColor: '#8b1a1a', borderColor: 'transparent', opacity: loadingProvider ? 0.5 : 1 }}
            >
              {loadingProvider === 'email' ? 'กำลังบันทึก...' : 'ยืนยัน'}
            </button>
            <p
              onClick={() => setShowEmail(false)}
              style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#6b5c4a', textAlign: 'center', cursor: 'pointer', marginTop: 4 }}
            >
              ← กลับ
            </p>
          </form>
        ) : (
          <>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: '#f5ead6', marginBottom: 6 }}>
              อย่าให้ความคืบหน้าสูญหาย
            </p>
            <p style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#6b5c4a', marginBottom: 20 }}>
              บันทึกบัญชีเพื่อรักษายศและแฟ้มสะสม
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => linkOAuth('google')}
                disabled={!!loadingProvider}
                style={{ ...btnStyle, opacity: loadingProvider === 'google' ? 0.5 : 1 }}
              >
                <GoogleIcon />
                {loadingProvider === 'google' ? 'กำลังเชื่อมต่อ...' : 'ดำเนินการต่อด้วย Google'}
              </button>

              <button
                onClick={() => linkOAuth('facebook')}
                disabled={!!loadingProvider}
                style={{ ...btnStyle, opacity: loadingProvider === 'facebook' ? 0.5 : 1 }}
              >
                <FacebookIcon />
                {loadingProvider === 'facebook' ? 'กำลังเชื่อมต่อ...' : 'ดำเนินการต่อด้วย Facebook'}
              </button>

              <button
                onClick={() => setShowEmail(true)}
                disabled={!!loadingProvider}
                style={btnStyle}
              >
                <EmailIcon />
                ดำเนินการต่อด้วยอีเมล
              </button>

              {error && (
                <p style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#f87171' }}>{error}</p>
              )}
            </div>

            <p
              onClick={handleDismiss}
              style={{
                fontFamily: 'sans-serif',
                fontSize: 11,
                color: '#3a2a18',
                textAlign: 'center',
                marginTop: 20,
                cursor: 'pointer',
              }}
            >
              ภายหลัง
            </p>
          </>
        )}
      </div>
    </>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
    </svg>
  )
}

function EmailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="M2 7l10 7 10-7"/>
    </svg>
  )
}
