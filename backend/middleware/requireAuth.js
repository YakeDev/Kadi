import { supabase } from '../models/supabaseClient.js'

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return res.status(401).json({ message: 'Authentification requise.' })
    }

    const {
      data: { user },
      error
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      return res.status(401).json({ message: 'Session invalide.' })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.tenant_id) {
      return res.status(403).json({ message: 'Profil ou tenant introuvable.' })
    }

    req.user = user
    req.tenantId = profile.tenant_id
    next()
  } catch (error) {
    next(error)
  }
}
