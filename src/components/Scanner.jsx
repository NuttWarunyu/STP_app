import { useState, useEffect, useRef } from 'react'
import { normalizeImage } from '../lib/imageUtils'
import Header from './Header'
import ReportCard from './ReportCard'
import ScanResult from './ScanResult'
import { analyzeImage } from '../lib/claude'
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
      <Header title="สแกนภาคสนาม" rankLevel={profile?.rank_level || 1} />

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

function ProbabilityBar({ prob }) {
  const pct = Math.round(prob * 100)
  const barColor = pct >= 60 ? 'bg-blood/70' : pct >= 40 ? 'bg-gold/60' : 'bg-green-700/60'
  const textColor = pct >= 60 ? 'text-red-400/80' : pct >= 40 ? 'text-gold/80' : 'text-green-400/70'
  const label = pct >= 60 ? 'สูง' : pct >= 40 ? 'ปานกลาง' : 'ต่ำ'

  return (
    <div className="rounded-card bg-white/[0.04] border border-gold/[0.1] p-3.5 space-y-2">
      <div className="flex justify-between font-sans text-[12px]">
        <span className="text-dim/50 tracking-widest uppercase">โอกาสพบสิ่งลี้ลับ</span>
        <span className={textColor}>{label} {pct}%</span>
      </div>
      <div className="h-px bg-dim/10">
        <div className={`h-px transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function LocationStep({ location, geocode, nearbyPlaces, weather, detectionProb, loading, error, isRoyalZone, scansToday, dailyLimit, canScan, onRetry, onNext }) {
  if (isRoyalZone) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="rounded-card bg-white/[0.04] border border-gold/[0.15] p-6 text-center space-y-3 max-w-xs w-full">
          <p className="font-sans text-[12px] text-gold/40 tracking-widest uppercase">เขตหวงห้าม</p>
          <p className="font-serif text-gold text-sm leading-relaxed">
            พื้นที่นี้อยู่ภายใต้การคุ้มครองพิเศษ
          </p>
          <p className="font-sans text-xs text-dim/55 leading-relaxed">
            ส.ต.ล. ไม่ดำเนินการตรวจสอบในบริเวณดังกล่าว
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto pt-3 pb-4 px-3 space-y-2.5">
      {/* Quota warning */}
      {!canScan && (
        <div className="rounded-card border border-blood/[0.25] bg-blood/[0.06] p-3">
          <p className="font-sans text-xs text-red-400/75">
            ใช้ครบโควตาประจำวัน ({dailyLimit} ครั้ง) — กรุณารอวันพรุ่งนี้
          </p>
        </div>
      )}

      {canScan && dailyLimit !== Infinity && (
        <p className="font-sans text-[12px] text-dim/35 text-right tracking-wider">
          เหลือ {dailyLimit - scansToday} การสแกนวันนี้
        </p>
      )}

      {/* Detection probability */}
      {location && !loading && <ProbabilityBar prob={detectionProb} />}

      {/* Weather notice */}
      {weather.isRainy && (
        <div className="rounded-card border border-blue-800/[0.2] bg-blue-900/[0.06] px-3 py-2 flex items-center gap-2">
          <span className="text-sm">🌧</span>
          <span className="font-sans text-[12px] text-blue-400/60">
            ตรวจพบสภาพอากาศฝนตก — โอกาสพบผีน้ำและเร่ร่อนเพิ่มขึ้น
          </span>
        </div>
      )}

      {/* Location card */}
      <div className="rounded-card bg-white/[0.04] border border-gold/[0.12] p-4 space-y-2.5">
        <p className="font-sans text-[12px] text-dim/45 tracking-widest uppercase">ตำแหน่งปัจจุบัน</p>

        {loading && (
          <div className="flex items-center gap-2.5 py-1">
            <div className="w-3 h-3 border border-gold/30 border-t-gold animate-spin rounded-full shrink-0" />
            <span className="font-sans text-xs text-dim/60">กำลังระบุตำแหน่ง...</span>
          </div>
        )}

        {error && (
          <div className="space-y-2">
            <p className="font-sans text-xs text-red-400/65">{error}</p>
            <button
              onClick={onRetry}
              className="font-sans text-[12px] text-gold/55 border border-gold/[0.2] rounded-sm px-3 py-1 hover:border-gold/35 transition-colors"
            >
              ลองอีกครั้ง
            </button>
          </div>
        )}

        {location && !loading && (
          <div className="space-y-0.5">
            <p className="font-sans text-sm text-parchment/85">
              {geocode?.locality || 'ไม่ทราบสถานที่'}
            </p>
            {geocode?.province && (
              <p className="font-sans text-xs text-dim/60">{geocode.province}</p>
            )}
            <p className="font-mono text-[11px] text-dim/30 tracking-wider mt-1">
              {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </p>
          </div>
        )}
      </div>

      {/* Nearby places — top 3 by risk priority */}
      {nearbyPlaces.length > 0 && (() => {
        const RISK_ORDER = { high: 0, medium: 1, low: 2 }
        const topPlaces = [...nearbyPlaces]
          .sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || a.distanceKm - b.distanceKm)
          .filter((p, i, arr) => {
            const hasHighMed = arr.some(x => x.risk === 'high' || x.risk === 'medium')
            return hasHighMed ? p.risk !== 'low' : true
          })
          .slice(0, 3)
        return (
          <div className="space-y-1.5">
            <p className="font-sans text-[12px] text-dim/45 tracking-widest uppercase px-0.5">
              สถานที่ใกล้เคียง
            </p>
            <div className="space-y-1.5">
              {topPlaces.map((place, i) => (
                <div
                  key={i}
                  className="rounded-card bg-white/[0.03] border border-dim/[0.1] flex items-center justify-between px-3 py-2.5 gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-sans text-xs text-parchment/75 truncate">{place.name}</p>
                    <p className="font-sans text-[12px] text-dim/45">
                      {place.typeLabel} · {place.distance}
                    </p>
                  </div>
                  <span className={`font-sans text-[11px] border px-1.5 py-0.5 rounded-sm shrink-0 ${RISK_STYLES[place.risk]}`}>
                    {place.riskLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      <button
        disabled={!location || loading || !canScan}
        onClick={onNext}
        className="w-full rounded-card border border-gold/[0.4] text-gold font-sans text-sm py-3 hover:bg-gold/[0.07] transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
      >
        ดำเนินการต่อ →
      </button>
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
      <text x="50" y="45" textAnchor="middle" fill="#c9a84c" fontSize="14" fontFamily="serif" fontWeight="bold" opacity="0.75">
        ส.ต.ล.
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
