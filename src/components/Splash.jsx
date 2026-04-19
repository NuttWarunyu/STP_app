import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Splash() {
  const [loading, setLoading] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  const handleAnonymous = async () => {
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInAnonymously()
      if (error) throw error
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between px-6"
      style={{ backgroundColor: '#0a0704' }}
    >
      {/* Center: logo + title */}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
        <p
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 48,
            color: '#c9a84c',
            letterSpacing: '0.2em',
            lineHeight: 1,
          }}
        >
          ส.ต.ล.
        </p>

        <div
          style={{
            width: 80,
            height: 1,
            backgroundColor: 'rgba(201,168,76,0.2)',
          }}
        />

        <div>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: '#f5ead6', margin: 0 }}>
            สำนักงานตรวจสอบสิ่งลี้ลับ
          </p>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: 14, color: '#f5ead6', margin: '2px 0 0' }}>
            แห่งประเทศไทย
          </p>
          <p
            style={{
              fontFamily: 'monospace',
              fontSize: 8,
              color: '#3a2a18',
              letterSpacing: '0.15em',
              marginTop: 8,
            }}
          >
            OFFICE OF PARANORMAL INVESTIGATION THAILAND
          </p>
        </div>
      </div>

      {/* Bottom: CTA */}
      <div className="w-full max-w-sm pb-12 space-y-4">
        {!showLogin ? (
          <>
            {error && (
              <p style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#f87171', textAlign: 'center' }}>
                {error}
              </p>
            )}
            <button
              onClick={handleAnonymous}
              disabled={loading}
              style={{
                width: '100%',
                backgroundColor: loading ? '#5a1010' : '#8b1a1a',
                borderRadius: 10,
                padding: '14px 0',
                fontFamily: 'Georgia, serif',
                fontSize: 16,
                color: '#f5ead6',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {loading ? 'กำลังเชื่อมต่อ...' : 'เริ่มปฏิบัติการ'}
            </button>

            <p
              onClick={() => setShowLogin(true)}
              style={{
                fontFamily: 'sans-serif',
                fontSize: 11,
                color: '#3a2a18',
                textAlign: 'center',
                marginTop: 16,
                cursor: 'pointer',
              }}
            >
              มีบัญชีอยู่แล้ว · เข้าสู่ระบบ
            </p>
          </>
        ) : (
          <form onSubmit={handleLogin} className="space-y-3">
            <p
              onClick={() => setShowLogin(false)}
              style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#6b5c4a', cursor: 'pointer', marginBottom: 4 }}
            >
              ← กลับ
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="อีเมล"
              required
              style={{
                width: '100%',
                background: 'transparent',
                border: '1px solid rgba(107,92,74,0.4)',
                borderRadius: 6,
                padding: '10px 12px',
                fontFamily: 'sans-serif',
                fontSize: 13,
                color: '#f5ead6',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="รหัสผ่าน"
              required
              minLength={6}
              style={{
                width: '100%',
                background: 'transparent',
                border: '1px solid rgba(107,92,74,0.4)',
                borderRadius: 6,
                padding: '10px 12px',
                fontFamily: 'sans-serif',
                fontSize: 13,
                color: '#f5ead6',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {error && (
              <p style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#f87171' }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                backgroundColor: loading ? '#5a1010' : '#8b1a1a',
                borderRadius: 10,
                padding: '12px 0',
                fontFamily: 'Georgia, serif',
                fontSize: 15,
                color: '#f5ead6',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
