export function generateReportNumber(sequence) {
  const yearBE = new Date().getFullYear() + 543
  const padded = String(sequence).padStart(5, '0')
  return `STL-${yearBE}-${padded}`
}

export function getNextSequence() {
  const stored = parseInt(localStorage.getItem('stl_report_sequence') || '0', 10)
  const next = stored + 1
  localStorage.setItem('stl_report_sequence', String(next))
  return next
}

export function formatThaiDate(isoString) {
  const date = new Date(isoString)
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatThaiTime(isoString) {
  const date = new Date(isoString)
  return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

export function getCurrentTimeStr() {
  return new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

export function isNightTime() {
  const hour = new Date().getHours()
  return hour >= 18 || hour < 6
}
