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

    const extendedColumns =
      'tenant_id, company, tagline, logo_url, manager_name, address, city, state, national_id, rccm, nif, phone, website, email'
    let profileResponse = await supabase
      .from('profiles')
      .select(extendedColumns)
      .eq('id', user.id)
      .maybeSingle()

    let profile = profileResponse.data
    let profileError = profileResponse.error

    if (
      profileError &&
      (profileError.code === 'PGRST105' ||
        profileError.code === '42703' ||
        /column.+does not exist/i.test(profileError.message))
    ) {
      const fallbackResponse = await supabase
        .from('profiles')
        .select('tenant_id, company, email')
        .eq('id', user.id)
        .maybeSingle()
      profile = fallbackResponse.data
      profileError = fallbackResponse.error
    }

    if (profileError) {
      throw Object.assign(new Error('Profil temporairement indisponible.'), { status: 503 })
    }
    if (!profile?.tenant_id) {
      return res.status(403).json({ message: 'Profil entreprise introuvable. Contactez le support.' })
    }

    req.accessToken = token
    req.user = user
    req.tenantId = profile.tenant_id
    const fallbackCompany = profile?.company || user.user_metadata?.company || user.email?.split('@')[0] || 'Organisation'

    req.profile = {
      company: profile?.company ?? fallbackCompany,
      tagline: profile?.tagline ?? '',
      logo_url: profile?.logo_url ?? null,
      manager_name: profile?.manager_name ?? '',
      address: profile?.address ?? '',
      city: profile?.city ?? '',
      state: profile?.state ?? '',
      national_id: profile?.national_id ?? '',
      rccm: profile?.rccm ?? '',
      nif: profile?.nif ?? '',
      phone: profile?.phone ?? '',
      website: profile?.website ?? ''
    }
    next()
  } catch (error) {
    next(error)
  }
}
