import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { OPITSeal } from './Header'

export default function Auth() {
  const [mode, setMode] = useState('login') // login | register
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    if (!username.trim()) {
      setError('กรุณาระบุชื่อเจ้าหน้าที่')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          username: username.trim(),
          rank_level: 1,
          total_detections: 0,
          unique_provinces: [],
          unique_classes: [],
          daily_scans_count: 0,
        })
      }
      setMessage('ลงทะเบียนสำเร็จ กรุณายืนยันอีเมล')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <OPITSeal size={72} />
          <div className="text-center">
            <h1 className="font-serif text-gold text-lg leading-snug">สำนักงานตรวจสอบสิ่งลี้ลับ</h1>
            <p className="font-sans text-xs text-dim mt-0.5">แห่งประเทศไทย · OPIT</p>
            <p className="font-sans text-[13px] text-dim/50">Field Scanner · v1.0</p>
          </div>
        </div>

        <div className="border border-dim/30 p-5 space-y-4">
          <div className="flex border-b border-dim/20">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 font-sans text-xs py-2 transition-colors ${
                mode === 'login' ? 'text-gold border-b border-gold -mb-px' : 'text-dim/50'
              }`}
            >
              เข้าสู่ระบบ
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 font-sans text-xs py-2 transition-colors ${
                mode === 'register' ? 'text-gold border-b border-gold -mb-px' : 'text-dim/50'
              }`}
            >
              ลงทะเบียน
            </button>
          </div>

          <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-3">
            {mode === 'register' && (
              <div>
                <label className="font-sans text-[13px] text-dim/50 tracking-wider block mb-1">
                  ชื่อเจ้าหน้าที่
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-transparent border border-dim/30 px-3 py-2 font-sans text-xs text-parchment focus:border-gold/50 focus:outline-none"
                  placeholder="ระบุชื่อ"
                  required
                />
              </div>
            )}

            <div>
              <label className="font-sans text-[13px] text-dim/50 tracking-wider block mb-1">
                อีเมล
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent border border-dim/30 px-3 py-2 font-sans text-xs text-parchment focus:border-gold/50 focus:outline-none"
                placeholder="officer@stl.go.th"
                required
              />
            </div>

            <div>
              <label className="font-sans text-[13px] text-dim/50 tracking-wider block mb-1">
                รหัสผ่าน
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border border-dim/30 px-3 py-2 font-sans text-xs text-parchment focus:border-gold/50 focus:outline-none"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            {error && (
              <p className="font-sans text-xs text-red-400/70">{error}</p>
            )}
            {message && (
              <p className="font-sans text-xs text-green-400/70">{message}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full border border-gold/50 text-gold font-sans text-sm py-2.5 hover:bg-gold/10 transition-colors disabled:opacity-40"
            >
              {loading ? 'กำลังดำเนินการ...' : mode === 'login' ? 'เข้าสู่ระบบ' : 'ลงทะเบียน'}
            </button>
          </form>
        </div>

        <p className="font-sans text-[13px] text-dim/30 text-center">
          เอกสารลับ — ห้ามเผยแพร่
        </p>
      </div>
    </div>
  )
}
