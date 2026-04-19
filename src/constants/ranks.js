export const RANKS = [
  {
    level: 1,
    nameTh: 'เจ้าหน้าที่ฝึกหัด',
    nameEn: 'Trainee Officer',
    dailyScans: 3,
    unlocks: [],
  },
  {
    level: 2,
    nameTh: 'เจ้าหน้าที่ภาคสนาม',
    nameEn: 'Field Officer',
    dailyScans: 3,
    unlocks: [],
  },
  {
    level: 3,
    nameTh: 'นักสืบวิสามัญ',
    nameEn: 'Special Investigator',
    dailyScans: 5,
    unlocks: ['rare_feed', 'extra_scans'],
  },
  {
    level: 4,
    nameTh: 'ผู้เชี่ยวชาญลี้ลับ',
    nameEn: 'Paranormal Specialist',
    dailyScans: 5,
    unlocks: ['energy_hint', 'special_badge'],
  },
  {
    level: 5,
    nameTh: 'หัวหน้าทีมปฏิบัติการ',
    nameEn: 'Operations Team Leader',
    dailyScans: Infinity,
    unlocks: ['opit_seal', 'unlimited_scans'],
  },
  {
    level: 6,
    nameTh: 'ผู้อำนวยการสืบสวน',
    nameEn: 'Director of Investigations',
    dailyScans: Infinity,
    unlocks: ['hall_of_fame'],
  },
  {
    level: 7,
    nameTh: 'อธิบดีกรมลี้ลับ',
    nameEn: 'Director-General of Paranormal Affairs',
    dailyScans: Infinity,
    unlocks: ['hall_of_fame', 'full_id_card'],
  },
]

export const RANK_THRESHOLDS = {
  2: { total_detections: 1 },
  3: { total_detections: 5, unique_provinces: 3 },
  4: { total_detections: 10, has_rare: true },
  5: { unique_classes: 6, unique_provinces: 5 },
  6: { unique_classes: 10, has_legendary: true },
  7: { unique_classes: 7, unique_provinces: 10 },
}

export const RARE_CLASSES = ['อาคม', 'โบราณ', 'ราชสำนัก', 'นรก']
export const LEGENDARY_CLASSES = ['นรก']
