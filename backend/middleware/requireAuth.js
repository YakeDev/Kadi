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

    const extendedColumns = 'tenant_id, company, tagline, logo_url, email'
    let hasExtendedProfileColumns = true
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
      hasExtendedProfileColumns = false
      const fallbackResponse = await supabase
        .from('profiles')
        .select('tenant_id, company, email')
        .eq('id', user.id)
        .maybeSingle()
      profile = fallbackResponse.data
      profileError = fallbackResponse.error
    }

    if (profileError || !profile?.tenant_id) {
      const companyName = user.user_metadata?.company || user.email?.split('@')[0] || 'Organisation'

     const { data: tenant, error: tenantError } = await supabase
       .from('tenants')
       .insert({ name: companyName })
       .select()
       .single()

      if (tenantError) {
        return res.status(403).json({ message: 'Profil ou tenant introuvable.' })
      }

      const { data: newProfile, error: newProfileError } = await supabase
        .from('profiles')
        .upsert(
          hasExtendedProfileColumns
            ? {
                id: user.id,
                tenant_id: tenant.id,
                email: user.email,
                company: companyName,
                tagline: profile?.tagline ?? null,
                logo_url: profile?.logo_url ?? null
              }
            : {
                id: user.id,
                tenant_id: tenant.id,
                email: user.email,
                company: companyName
              },
          { onConflict: 'id' }
        )
        .select(
          hasExtendedProfileColumns
            ? 'tenant_id, company, tagline, logo_url'
            : 'tenant_id, company'
        )
        .single()

      if (newProfileError) {
        return res.status(403).json({ message: 'Profil ou tenant introuvable.' })
      }

      profile = newProfile
    }

    req.user = user
    req.tenantId = profile.tenant_id
    req.profile = {
      ...profile,
      tagline: profile?.tagline ?? null,
      logo_url: profile?.logo_url ?? null
    }
    next()
  } catch (error) {
    next(error)
  }
}
