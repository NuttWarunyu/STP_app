import { useState, useEffect, useRef } from 'react'
import { normalizeImage } from '../lib/imageUtils'
import Header from './Header'
import ReportCard from './ReportCard'
import ScanResult from './ScanResult'
import { analyzeImage, generateIncidentReport } from '../lib/claude'
import { generateGhostOverlay } from '../lib/openai'
import { getNearbyPlaces, reverseGeocode } from '../lib/gmaps'
import { isInRoyalZone } from '../constants/geofences'
import { saveReport, incrementScanCount, getScansToday, upsertProfile } from '../lib/supabase'
import { generateReportNumber, getNextSequence, getCurrentTimeStr, isNightTime } from '../lib/report'
import { calculateRank, getDailyLimit } from '../lib/rank'
import { supabase } from '../lib/supabase'
import { GHOST_CLASSES } from '../constants/ghosts'
import { calculateDetectionProbability, selectDetectedGhost, getWeather, updateMovementHistory } from '../lib/probability'

const ANALYSIS_STATUSES = [
  'กำลังวิเคราะห์คลื่นพลังงาน...',
  'ตรวจสอบฐานข้อมูลสิ่งลี้ลับ...',
  'เชื่อมต่อศูนย์ปฏิบัติการกลาง...',
  'กำลังยืนยันการตรวจพบ...',
]

const RISK_STYLES = {
  high: 'text-red-400/80 border-blood/30',
  medium: 'text-amber-400/80 border-amber-800/30',
  low: 'text-green-400/70 border-green-800/30',
}

export default function Scanner({ profile, onProfileUpdate }) {
  const [step, setStep] = useState('location')
  const [location, setLocation] = useState(null)
  const [geocode, setGeocode] = useState(null)
  const [nearbyPlaces, setNearbyPlaces] = useState([])
  const [weather, setWeather] = useState({ isRainy: false, isOvercast: false })
  const [detectionProb, setDetectionProb] = useState(0.35)
  const [loadingLocation, setLoadingLocation] = useState(false)
  const [locationError, setLocationError] = useState(null)
  const [isRoyalZone, setIsRoyalZone] = useState(false)
  const [capturedImage, setCapturedImage] = useState(null)
  const [analysisStatus, setAnalysisStatus] = useState(0)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [report, setReport] = useState(null)
  const [saving, setSaving] = useState(false)
  const [scansToday, setScansToday] = useState(0)
  const [error, setError] = useState(null)
  const [converting, setConverting] = useState(false)
  const [incidentReport, setIncidentReport] = useState(null)
  const [loadingIncident, setLoadingIncident] = useState(false)
  const [incidentDismissed, setIncidentDismissed] = useState(false)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  const dailyLimit = getDailyLimit(profile?.rank_level || 1)
  const canScan = dailyLimit === Infinity || scansToday < dailyLimit

  useEffect(() => {
    if (profile?.id) {
      getScansToday(profile.id).then(setScansToday)
    }
    detectLocation()
  }, [profile?.id])

  const detectLocation = async () => {
    setLoadingLocation(true)
    setLocationError(null)
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        })
      )
      const { latitude, longitude } = pos.coords
      setLocation({ lat: latitude, lng: longitude })

      const royal = isInRoyalZone(latitude, longitude)
      setIsRoyalZone(royal)

      if (!royal) {
        const [geo, places, wx] = await Promise.all([
          reverseGeocode(latitude, longitude),
          getNearbyPlaces(latitude, longitude),
          getWeather(latitude, longitude),
        ])
        setGeocode(geo)
        setNearbyPlaces(places)
        setWeather(wx)
        updateMovementHistory(latitude, longitude)
        setDetectionProb(
          calculateDetectionProbability({
            nearbyPlaces: places,
            weather: wx,
            rankLevel: profile?.rank_level || 1,
          })
        )
        setLoadingIncident(true)
        generateIncidentReport({
          locationName: geo?.locality || 'ไม่ทราบ',
          province: geo?.province || 'ไม่ทราบ',
          nearbyPlaces: places,
        }).then(setIncidentReport).catch(() => {}).finally(() => setLoadingIncident(false))
      }
    } catch (e) {
      setLocationError('ไม่สามารถระบุตำแหน่งได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง')
    } finally {
      setLoadingLocation(false)
    }
  }

  const handleCapture = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setCapturedImage(null)
    setConverting(true)
    setStep('capture')
    try {
      const base64 = await normalizeImage(file)
      setCapturedImage(base64)
    } catch (err) {
      setError(err.message)
    } finally {
      setConverting(false)
    }
  }

  const handleAnalyze = async () => {
    if (!canScan) return
    setStep('analyzing')
    setError(null)
    let statusIdx = 0
    const interval = setInterval(() => {
      statusIdx = (statusIdx + 1) % ANALYSIS_STATUSES.length
      setAnalysisStatus(statusIdx)
    }, 1200)

    try {
      const result = await analyzeImage({
        base64Image: capturedImage,
        locationName: geocode?.locality || 'ไม่ทราบสถานที่',
        province: geocode?.province || 'ไม่ทราบจังหวัด',
        nearbyPlaces,
        time: getCurrentTimeStr(),
        isNight: isNightTime(),
        detectionProb,
      })

      clearInterval(interval)

      const selectedGhost = result.detected
        ? selectDetectedGhost({ nearbyPlaces, weather })
        : null

      setAnalysisResult({ ...result, selectedGhost })

      if (result.detected && selectedGhost) {
        let finalImageBase64 = capturedImage
        try {
          finalImageBase64 = await generateGhostOverlay({
            base64Image: capturedImage,
            ghostClass: selectedGhost.class,
            placement: result.suggested_placement,
            ghostPrompt: selectedGhost.inpaintingPrompt,
          })
        } catch (e) {
          console.warn('Ghost overlay failed, using original:', e)
        }

        const seq = getNextSequence()
        const reportNum = generateReportNumber(seq)

        setReport({
          report_number: reportNum,
          ghost_class: selectedGhost.class,
          ghost_id: selectedGhost.id,
          ghost_name_th: selectedGhost.nameTh,
          location_name: geocode?.locality || 'ไม่ทราบ',
          province: geocode?.province || 'ไม่ทราบ',
          lat: location?.lat,
          lng: location?.lng,
          photo_url: finalImageBase64,
          danger_level: selectedGhost.dangerLevel || 3,
          claude_reason: result.reason,
          rarity: selectedGhost.rarity,
          created_at: new Date().toISOString(),
        })
        setStep('report')
      } else {
        setStep('result')
      }
    } catch (e) {
      clearInterval(interval)
      setError(`เกิดข้อผิดพลาด: ${e.message}`)
      setStep('capture')
    }
  }

  const handleSaveReport = async () => {
    if (!report || !profile?.id || saving) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('ไม่ได้เข้าสู่ระบบ')

      const { ghost_id, rarity, ...reportToSave } = report
      await saveReport({ ...reportToSave, user_id: profile.id })
      await incrementScanCount(profile.id)

      const newClasses = Array.from(
        new Set([...(profile.unique_classes || []), report.ghost_class])
      )
      const newProvinces = Array.from(
        new Set([...(profile.unique_provinces || []), report.province])
      )
      const newDetections = (profile.total_detections || 0) + 1
      const newRank = calculateRank({
        total_detections: newDetections,
        unique_classes: newClasses,
        unique_provinces: newProvinces,
      })

      const updatedProfile = await upsertProfile({
        id: profile.id,
        total_detections: newDetections,
        unique_classes: newClasses,
        unique_provinces: newProvinces,
        rank_level: newRank,
      })

      onProfileUpdate?.(updatedProfile)
      setScansToday((s) => s + 1)
    } catch (e) {
      setError(`บันทึกไม่สำเร็จ: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleRetry = () => {
    setStep('location')
    setCapturedImage(null)
    setAnalysisResult(null)
    setReport(null)
    setError(null)
  }

  return (
    <div className="flex flex-col h-full">
      {step !== 'report' && <Header title="สแกนภาคสนาม" rankLevel={profile?.rank_level || 1} />}
      {step === 'location' && !incidentDismissed && (loadingIncident || incidentReport) && (
        <EmergencyAlert
          report={incidentReport}
          loading={loadingIncident}
          onDismiss={() => setIncidentDismissed(true)}
        />
      )}

      {step === 'location' && (
        <LocationStep
          location={location}
          geocode={geocode}
          nearbyPlaces={nearbyPlaces}
          weather={weather}
          detectionProb={detectionProb}
          loading={loadingLocation}
          error={locationError}
          isRoyalZone={isRoyalZone}
          scansToday={scansToday}
          dailyLimit={dailyLimit}
          canScan={canScan}
          onRetry={detectLocation}
          onNext={() => setStep('capture')}
          profile={profile}
          incidentReport={incidentReport}
          loadingIncident={loadingIncident}
        />
      )}

      {step === 'capture' && (
        <CaptureStep
          capturedImage={capturedImage}
          cameraInputRef={cameraInputRef}
          fileInputRef={fileInputRef}
          onCapture={handleCapture}
          onAnalyze={handleAnalyze}
          onBack={() => setStep('location')}
          converting={converting}
          error={error}
        />
      )}

      {step === 'analyzing' && (
        <AnalyzingStep status={ANALYSIS_STATUSES[analysisStatus]} />
      )}

      {step === 'result' && analysisResult && (
        <div className="flex flex-col flex-1">
          <ScanResult
            result={analysisResult}
            onViewReport={() => setStep('report')}
            onRetry={handleRetry}
          />
        </div>
      )}

      {step === 'report' && report && (
        <div className="flex-1 overflow-y-auto">
          <ReportCard
            report={report}
            profile={profile}
            onSave={handleSaveReport}
            onRetry={handleRetry}
          />
          {saving && (
            <div className="fixed inset-0 bg-ink/80 flex items-center justify-center z-50">
              <div className="rounded-card border border-gold/[0.15] bg-white/[0.04] px-6 py-4">
                <span className="font-sans text-xs text-gold/60 tracking-wider">กำลังบันทึก...</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function GaugeChart({ prob }) {
  const pct = Math.round(prob * 100)
  const targetAngle = pct * 1.8 - 90

  const [phase, setPhase] = useState('pre')
  const [displayPct, setDisplayPct] = useState(0)
  const [floatOffset, setFloatOffset] = useState(0)
  const [pctOffset, setPctOffset] = useState(0)
  const rafRef = useRef(null)

  function pt(p, r = 74) {
    const deg = 180 - p * 1.8
    const rad = deg * Math.PI / 180
    return [+(100 + r * Math.cos(rad)).toFixed(2), +(100 - r * Math.sin(rad)).toFixed(2)]
  }
  function arc(p1, p2, r = 74) {
    const [x1, y1] = pt(p1, r)
    const [x2, y2] = pt(p2, r)
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`
  }
  function fullArc(r = 74) {
    const [lx, ly] = pt(0, r); const [tx, ty] = pt(50, r); const [rx, ry] = pt(100, r)
    return `M ${lx} ${ly} A ${r} ${r} 0 0 1 ${tx} ${ty} A ${r} ${r} 0 0 1 ${rx} ${ry}`
  }

  useEffect(() => {
    setPhase('pre'); setDisplayPct(0); setFloatOffset(0); setPctOffset(0)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const t1 = setTimeout(() => {
      setPhase('entry')
      const start = Date.now()
      const countUp = () => {
        const p = Math.min((Date.now() - start) / 2000, 1)
        setDisplayPct(Math.round(pct * p))
        if (p < 1) rafRef.current = requestAnimationFrame(countUp)
      }
      rafRef.current = requestAnimationFrame(countUp)
    }, 80)
    const t2 = setTimeout(() => { setPhase('float'); setDisplayPct(pct) }, 2200)
    return () => { clearTimeout(t1); clearTimeout(t2); if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [pct])

  useEffect(() => {
    if (phase !== 'float') return
    const amp = pct >= 60 ? 8 : pct >= 40 ? 5 : 3
    const period = (pct >= 60 ? 2 : pct >= 40 ? 3 : 4) * 1000
    const pctAmp = pct >= 60 ? 2 : 1
    const start = Date.now()
    const animate = () => {
      const wave = Math.sin(2 * Math.PI * (Date.now() - start) / period)
      setFloatOffset(amp * wave); setPctOffset(Math.round(pctAmp * wave))
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [phase, pct])

  const needleRotation = phase === 'float' ? targetAngle + floatOffset : (phase === 'entry' ? targetAngle : -90)
  const needleTransition = phase === 'entry' ? 'transform 2s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none'
  const currentPct = phase === 'float' ? Math.max(0, Math.min(100, pct + pctOffset)) : displayPct
  const fillColor = pct >= 60 ? '#8b1a1a' : pct >= 40 ? '#c9a84c' : '#4ade80'
  const labelTh = pct >= 60 ? 'เสี่ยงสูง' : pct >= 40 ? 'ปานกลาง' : 'ปลอดภัย'
  const pulseSpeed = pct >= 60 ? '2s' : pct >= 40 ? '2.5s' : '3s'

  return (
    <div className="rounded-card bg-white/[0.04] border border-gold/[0.1] py-3 px-2">
      <p className="font-sans text-[11px] text-dim/40 tracking-widest uppercase text-center mb-1">โอกาสพบสิ่งลี้ลับ</p>
      <svg viewBox="0 0 200 110" className="w-full max-w-[260px] mx-auto block">
        <style>{`@keyframes pulseArc{0%,100%{opacity:.9}50%{opacity:.35}}`}</style>
        <path d={fullArc()} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" strokeLinecap="butt" />
        <path d={arc(0, 40)}   fill="none" stroke="#4ade80" strokeWidth="14" strokeLinecap="butt" opacity="0.25" />
        <path d={arc(40, 60)}  fill="none" stroke="#c9a84c" strokeWidth="14" strokeLinecap="butt" opacity="0.25" />
        <path d={arc(60, 100)} fill="none" stroke="#8b1a1a" strokeWidth="14" strokeLinecap="butt" opacity="0.25" />
        {pct > 0 && pct < 100 && (
          <path d={arc(0, pct)} fill="none" stroke={fillColor} strokeWidth="14" strokeLinecap="round"
            style={{ animation: `pulseArc ${pulseSpeed} ease-in-out infinite` }} />
        )}
        {pct >= 100 && (
          <path d={fullArc()} fill="none" stroke={fillColor} strokeWidth="14" strokeLinecap="round"
            style={{ animation: `pulseArc ${pulseSpeed} ease-in-out infinite` }} />
        )}
        <g style={{ transformBox: 'view-box', transformOrigin: '100px 100px', transform: `rotate(${needleRotation}deg)`, transition: needleTransition }}>
          <line x1="100" y1="100" x2="100" y2="32" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
        </g>
        <circle cx="100" cy="100" r="5" fill="#c9a84c" opacity="0.8" />
        <text x="100" y="77" textAnchor="middle" fill="white" fontSize="28" fontWeight="bold" fontFamily="serif" opacity="0.9">{currentPct}%</text>
        <text x="100" y="91" textAnchor="middle" fill="white" fontSize="8" fontFamily="sans-serif" opacity="0.4" letterSpacing="2">{labelTh.toUpperCase()}</text>
        <text x="24"  y="108" textAnchor="middle" fill="#4ade80" fontSize="7" opacity="0.5">ต่ำ</text>
        <text x="100" y="22"  textAnchor="middle" fill="#c9a84c" fontSize="7" opacity="0.5">กลาง</text>
        <text x="176" y="108" textAnchor="middle" fill="#8b1a1a" fontSize="7" opacity="0.6">สูง</text>
      </svg>
    </div>
  )
}

function EmergencyAlert({ report, loading, onDismiss }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVisible(true), 50); return () => clearTimeout(t) }, [])

  const caseRef = report?.case_ref || 'STL-████-█████'

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.92)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: visible ? 1 : 0, transition: 'opacity 0.3s',
    }}>
      <div style={{
        width: '85%', maxWidth: 380, background: '#0f0805',
        border: '2px solid #8b1a1a', borderRadius: 12, overflow: 'hidden',
        transform: visible ? 'scale(1)' : 'scale(0.95)', transition: 'transform 0.3s',
      }}>
        <div style={{ height: 3, background: '#8b1a1a' }} />
        <div style={{ padding: '20px 24px 24px' }}>
          <p style={{ fontFamily: 'monospace', fontSize: 10, color: '#8b1a1a', letterSpacing: '0.2em', margin: 0 }}>
            ⚠ แจ้งเตือนพื้นที่
          </p>
          <p style={{ fontFamily: 'monospace', fontSize: 8, color: '#3a2a18', marginTop: 4, marginBottom: 20 }}>
            รหัสเคส: {caseRef} · ปิดลับ
          </p>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {[['90%'], ['70%'], ['80%']].map(([w], i) => (
                <div key={i} style={{ height: 10, width: w, background: 'rgba(255,255,255,0.04)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : (
            <div style={{ marginBottom: 20 }}>
              {(report?.entries || []).map((entry, i) => (
                <p key={i} style={{ fontFamily: 'monospace', fontSize: 11, color: '#d4c4a8', lineHeight: 1.8, margin: '0 0 4px' }}>
                  · {entry}
                </p>
              ))}
              <span style={{ display: 'inline-block', width: 1, height: '0.9em', background: '#d4c4a8', marginLeft: 4, verticalAlign: 'middle', animation: 'blink 1s step-end infinite' }} />
            </div>
          )}

          <p style={{ fontFamily: 'monospace', fontSize: 7, color: '#2a1a10', textAlign: 'center', marginBottom: 12 }}>
            * เนื้อหาสมมติเพื่อความบันเทิง
          </p>
          <button
            onClick={onDismiss}
            disabled={loading}
            style={{
              width: '100%', background: loading ? '#3a0f0f' : '#8b1a1a', border: 'none',
              borderRadius: 6, padding: '10px 0', fontFamily: 'Georgia, serif',
              fontSize: 12, color: '#f5ead6', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s',
            }}
          >
            {loading ? 'กำลังเข้าถึงฐานข้อมูล...' : 'รับทราบ · ดำเนินการต่อ'}
          </button>
        </div>
      </div>
    </div>
  )
}

function LocationStep({ location, geocode, nearbyPlaces, weather, detectionProb, loading, error, isRoyalZone, scansToday, dailyLimit, canScan, onRetry, onNext, profile }) {
  const yearBE = new Date().getFullYear() + 543

  if (isRoyalZone) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="rounded-card bg-white/[0.04] border border-gold/[0.15] p-6 text-center space-y-3 max-w-xs w-full">
          <p className="font-sans text-[11px] text-gold/40 tracking-widest uppercase">เขตหวงห้าม</p>
          <p className="font-serif text-gold text-sm leading-relaxed">พื้นที่นี้อยู่ภายใต้การคุ้มครองพิเศษ</p>
          <p className="font-sans text-xs text-dim/55 leading-relaxed">
            สำนักงานตรวจสอบสิ่งลี้ลับไม่ดำเนินการในบริเวณดังกล่าว
          </p>
        </div>
      </div>
    )
  }

  const RISK_ORDER = { high: 0, medium: 1, low: 2 }
  const topPlaces = [...nearbyPlaces]
    .sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || a.distanceKm - b.distanceKm)
    .filter((p, _, arr) => {
      const hasHighMed = arr.some(x => x.risk === 'high' || x.risk === 'medium')
      return hasHighMed ? p.risk !== 'low' : true
    })
    .slice(0, 3)

  return (
    <div className="flex-1 overflow-y-auto pt-3 pb-4 px-3 space-y-2.5">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'รายงาน', value: profile?.total_detections || 0 },
          { label: 'จังหวัด', value: (profile?.unique_provinces || []).length },
          { label: 'ชนิดผี', value: (profile?.unique_classes || []).length },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-card bg-white/[0.04] border border-gold/[0.1] py-2.5 text-center">
            <p className="font-serif text-gold text-xl leading-none">{value}</p>
            <p className="font-sans text-[11px] text-dim/45 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Gauge hero */}
      <GaugeChart prob={loading ? 0.35 : detectionProb} />

      {/* Weather notice */}
      {weather.isRainy && (
        <div className="rounded-card border border-blue-800/[0.2] bg-blue-900/[0.05] px-3 py-2 flex items-center gap-2">
          <span className="text-sm">🌧</span>
          <span className="font-sans text-[11px] text-blue-400/60">ฝนตก — โอกาสพบผีน้ำและเร่ร่อนเพิ่มขึ้น</span>
        </div>
      )}

      {/* Location card */}
      <div className="rounded-card bg-white/[0.04] border border-gold/[0.12] p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <p className="font-sans text-[11px] text-dim/40 tracking-widest uppercase">ตำแหน่งปัจจุบัน</p>
            {loading && (
              <div className="flex items-center gap-2 py-1">
                <div className="w-3 h-3 border border-gold/30 border-t-gold animate-spin rounded-full shrink-0" />
                <span className="font-sans text-xs text-dim/55">กำลังระบุตำแหน่ง...</span>
              </div>
            )}
            {error && (
              <div className="space-y-1.5 pt-1">
                <p className="font-sans text-xs text-red-400/65">{error}</p>
                <button onClick={onRetry} className="font-sans text-[11px] text-gold/55 border border-gold/[0.2] rounded-sm px-3 py-1">
                  ลองอีกครั้ง
                </button>
              </div>
            )}
            {location && !loading && (
              <>
                <p className="font-sans text-sm text-parchment/85 pt-0.5">{geocode?.locality || 'ไม่ทราบสถานที่'}</p>
                {geocode?.province && <p className="font-sans text-xs text-dim/55">{geocode.province}</p>}
                <p className="font-mono text-[11px] text-dim/28 tracking-wider pt-0.5">
                  {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                </p>
              </>
            )}
          </div>
          {location && !loading && (
            <div className="w-2.5 h-2.5 rounded-full bg-gold/60 animate-pulse shrink-0 mt-1" />
          )}
        </div>
      </div>

      {/* Nearby places */}
      {topPlaces.length > 0 && (
        <div className="space-y-1.5">
          <p className="font-sans text-[11px] text-dim/40 tracking-widest uppercase px-0.5">สถานที่ใกล้เคียง</p>
          <div className="space-y-1.5">
            {topPlaces.map((place, i) => (
              <div key={i} className="rounded-card bg-white/[0.03] border border-dim/[0.1] flex items-center justify-between px-3 py-2.5 gap-3">
                <div className="min-w-0">
                  <p className="font-sans text-xs text-parchment/75 truncate">{place.name}</p>
                  <p className="font-sans text-[11px] text-dim/45">{place.typeLabel} · {place.distance}</p>
                </div>
                <span className={`font-sans text-[11px] border px-1.5 py-0.5 rounded-sm shrink-0 ${RISK_STYLES[place.risk]}`}>
                  {place.riskLabel}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alert bar */}
      {!canScan ? (
        <div className="rounded-card border border-blood/[0.3] bg-blood/[0.06] px-3 py-2.5">
          <p className="font-sans text-xs text-red-400/75">ใช้ครบโควตาประจำวัน ({dailyLimit} ครั้ง) — กรุณารอวันพรุ่งนี้</p>
        </div>
      ) : dailyLimit !== Infinity ? (
        <div className="rounded-card border border-gold/[0.2] bg-gold/[0.03] px-3 py-2.5">
          <p className="font-sans text-xs text-gold/60">เหลือ {dailyLimit - scansToday} การสแกนวันนี้</p>
        </div>
      ) : null}

      {/* CTA */}
      <div className="space-y-1.5 pb-1">
        <button
          disabled={!location || loading || !canScan}
          onClick={onNext}
          className="w-full rounded-card bg-blood/75 border border-blood/60 text-parchment/90 font-sans text-sm py-3.5 hover:bg-blood/90 transition-colors disabled:opacity-25 disabled:cursor-not-allowed tracking-wide"
        >
          เริ่มการสแกน →
        </button>
        <p className="font-sans text-[11px] text-dim/30 text-center tracking-wider">
          ระบบพร้อมปฏิบัติการ · STL-{yearBE}
        </p>
      </div>
    </div>
  )
}

function CaptureStep({ capturedImage, cameraInputRef, fileInputRef, onCapture, onAnalyze, onBack, converting, error }) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 pt-3 px-3 space-y-3">
        {converting && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="w-5 h-5 border border-gold/30 border-t-gold animate-spin rounded-full" />
            <p className="font-sans text-xs text-dim/50 tracking-wider">กำลังแปลงไฟล์...</p>
          </div>
        )}

        {!capturedImage && !converting && (
          <div className="space-y-3">
            <p className="font-sans text-[12px] text-dim/40 tracking-widest uppercase text-center">
              บันทึกหลักฐานภาคสนาม
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="rounded-card border border-dim/[0.2] bg-white/[0.02] p-6 flex flex-col items-center gap-2.5 hover:border-gold/[0.25] hover:bg-white/[0.04] transition-colors"
              >
                <span className="text-2xl opacity-70">📷</span>
                <span className="font-sans text-xs text-parchment/60">ถ่ายรูปภาคสนาม</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-card border border-dim/[0.2] bg-white/[0.02] p-6 flex flex-col items-center gap-2.5 hover:border-gold/[0.25] hover:bg-white/[0.04] transition-colors"
              >
                <span className="text-2xl opacity-70">📁</span>
                <span className="font-sans text-xs text-parchment/60">อัพโหลดหลักฐาน</span>
              </button>
            </div>

            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onCapture} />
            <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={onCapture} />
          </div>
        )}

        {capturedImage && !converting && (
          <div className="space-y-2.5">
            <p className="font-sans text-[12px] text-dim/40 tracking-widest uppercase text-center">
              ตัวอย่างภาพ
            </p>
            <div className="rounded-card overflow-hidden border border-dim/[0.15]">
              <img
                src={`data:image/jpeg;base64,${capturedImage}`}
                alt="preview"
                className="w-full object-cover max-h-64"
              />
            </div>
            <button
              onClick={() => {
                if (fileInputRef.current) fileInputRef.current.value = ''
                fileInputRef.current?.click()
              }}
              className="w-full rounded-card border border-dim/[0.15] text-dim/50 font-sans text-xs py-2 hover:border-dim/30 transition-colors"
            >
              เปลี่ยนภาพ
            </button>
          </div>
        )}

        {error && (
          <p className="font-sans text-xs text-red-400/65 text-center">{error}</p>
        )}
      </div>

      <div className="p-3 grid grid-cols-2 gap-2.5 border-t border-gold/[0.08]">
        <button
          onClick={onBack}
          className="rounded-card border border-dim/[0.15] text-dim/50 font-sans text-xs py-3 hover:border-dim/30 transition-colors"
        >
          ← ย้อนกลับ
        </button>
        <button
          disabled={!capturedImage}
          onClick={onAnalyze}
          className="rounded-card border border-gold/[0.4] text-gold font-sans text-sm py-3 hover:bg-gold/[0.07] transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
        >
          ส่งตรวจสอบ
        </button>
      </div>
    </div>
  )
}

function AnalyzingStep({ status }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 bg-ink">
      <div className="relative">
        <div className="absolute inset-0 rounded-full border border-gold/10 animate-ping" />
        <div className="relative border border-gold/[0.15] rounded-full p-6">
          <OPITSealAnimated />
        </div>
      </div>

      <div className="text-center space-y-3">
        <p className="font-sans text-xs text-gold/55 tracking-widest animate-pulse">{status}</p>
        <div className="flex gap-1.5 justify-center">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1 h-1 rounded-full bg-gold/35 animate-bounce"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function OPITSealAnimated() {
  return (
    <svg width="80" height="80" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="46" fill="none" stroke="#c9a84c" strokeWidth="1.5" opacity="0.35" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="#c9a84c" strokeWidth="1" opacity="0.25" />
      <text x="50" y="45" textAnchor="middle" fill="#c9a84c" fontSize="8" fontFamily="serif" fontWeight="bold" opacity="0.75">
        สตล.
      </text>
      <text x="50" y="60" textAnchor="middle" fill="#c9a84c" fontSize="6" fontFamily="serif" opacity="0.55">
        OPIT
      </text>
      <text x="50" y="72" textAnchor="middle" fill="#6b5c4a" fontSize="4.5" fontFamily="serif" opacity="0.45">
        กำลังวิเคราะห์
      </text>
    </svg>
  )
}
