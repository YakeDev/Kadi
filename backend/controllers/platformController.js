import { supabase } from '../models/supabaseClient.js'
import { adminPeriod } from '../utils/adminPeriod.js'

const unavailable = () => Object.assign(new Error('L’administration est temporairement indisponible. Réessayez.'), { status: 503 })
const noCache = (res) => { res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('Vary', 'Authorization') }

export const platformSession = async (req, res, next) => {
  try {
    const { data, error } = await supabase.rpc('kadi_platform_session', { p_actor_id: req.user.id })
    if (error || typeof data?.is_super_admin !== 'boolean') throw unavailable()
    noCache(res)
    res.json({ is_super_admin: data.is_super_admin && Boolean(req.user.email_confirmed_at) })
  } catch (error) { next(error) }
}

export const requirePlatformAdmin = async (req, res, next) => {
  try {
    noCache(res)
    if (!req.user.email_confirmed_at) return res.status(403).json({ message: 'Accès réservé au Super administrateur.' })
    const { data, error } = await supabase.rpc('kadi_platform_admin_status', { p_actor_id: req.user.id })
    if (error || typeof data !== 'boolean') throw unavailable()
    if (!data) return res.status(403).json({ message: 'Accès réservé au Super administrateur.' })
    next()
  } catch (error) { next(error) }
}

export const platformOverview = async (req, res, next) => {
  try {
    const { from, to } = adminPeriod(req.query)
    const { data, error } = await supabase.rpc('kadi_platform_overview', { p_actor_id: req.user.id, p_from: from, p_to: to })
    if (error) throw error
    if (!data?.totals || !Array.isArray(data.daily)) throw unavailable()
    noCache(res)
    res.json(data)
  } catch (error) { next(error) }
}
