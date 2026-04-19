import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function getProfile(userId) {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return data
}

export async function upsertProfile(profile) {
  const { data, error } = await supabase.from('profiles').upsert(profile).select().single()
  if (error) throw error
  return data
}

const RESTRICTED_CLASSES = ['อาคม', 'โบราณ', 'ราชสำนัก', 'นรก']

export async function getFeedReports(limit = 20, rankLevel = 1) {
  const fetchLimit = rankLevel < 3 ? limit * 3 : limit
  const { data, error } = await supabase
    .from('reports')
    .select('id, report_number, ghost_class, ghost_name_th, location_name, province, lat, lng, danger_level, claude_reason, created_at, profiles(username, rank_level)')
    .order('created_at', { ascending: false })
    .limit(fetchLimit)

  if (error) throw error
  const results = data || []
  if (rankLevel < 3) {
    return results.filter((r) => !RESTRICTED_CLASSES.includes(r.ghost_class)).slice(0, limit)
  }
  return results.slice(0, limit)
}

export async function saveReport(report) {
  const { data, error } = await supabase.from('reports').insert(report).select().single()
  if (error) throw error
  return data
}

export async function getUserReports(userId) {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function incrementScanCount(userId) {
  const today = new Date().toISOString().split('T')[0]
  const { data: profile } = await supabase
    .from('profiles')
    .select('daily_scans_count, last_scan_date')
    .eq('id', userId)
    .single()

  const count = profile?.last_scan_date === today ? (profile.daily_scans_count || 0) : 0
  await supabase
    .from('profiles')
    .update({ daily_scans_count: count + 1, last_scan_date: today })
    .eq('id', userId)
  return count + 1
}

export async function getScansToday(userId) {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('profiles')
    .select('daily_scans_count, last_scan_date')
    .eq('id', userId)
    .single()
  if (!data || data.last_scan_date !== today) return 0
  return data.daily_scans_count || 0
}
