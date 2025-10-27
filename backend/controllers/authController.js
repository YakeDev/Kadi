import { supabase } from '../models/supabaseClient.js'

const PROFILE_OPTIONAL_FIELDS = [
  'logo_url',
  'manager_name',
  'address',
  'city',
  'state',
  'tagline',
  'national_id',
  'rccm',
  'nif'
]

export const signup = async (req, res, next) => {
  try {
    const { email, password, company, ...rest } = req.body
    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis.' })
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { company }
    })

    if (error) {
      if (error.message?.toLowerCase().includes('already been registered')) {
        error.status = 409
      }
      throw error
    }

    const profilePayload = { email, company, userId: data.user.id }
    for (const field of PROFILE_OPTIONAL_FIELDS) {
      if (rest[field] !== undefined) {
        profilePayload[field] = rest[field]
      }
    }

    await createProfileInternal(profilePayload)

    res.status(201).json({ user: data.user })
  } catch (error) {
    next(error)
  }
}

const createProfileInternal = async ({ email, company, userId, ...rest }) => {
  if (!userId) {
    throw Object.assign(new Error('userId requis pour créer le profil'), {
      status: 400
    })
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.admin.getUserById(userId)

  if (userError) throw userError
  if (!user) {
    throw Object.assign(new Error('Utilisateur Supabase introuvable.'), {
      status: 404
    })
  }

  const companyName = company || user.user_metadata?.company || email.split('@')[0]

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', userId)
    .maybeSingle()

  let tenantId = existingProfile?.tenant_id

  if (!tenantId) {
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({ name: companyName })
      .select()
      .single()
    if (tenantError) throw tenantError
    tenantId = tenant.id
  }

  const profileRecord = {
    id: userId,
    tenant_id: tenantId,
    email,
    company: companyName
  }

  for (const field of PROFILE_OPTIONAL_FIELDS) {
    if (field in rest) {
      profileRecord[field] = rest[field]
    }
  }

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .upsert(profileRecord, { onConflict: 'id' })
    .select(
      'company, tagline, logo_url, manager_name, address, city, state, national_id, rccm, nif'
    )
    .single()

  if (profileError) throw profileError

  return profileData
}

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis.' })
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) throw error
    res.json(data)
  } catch (error) {
    next(error)
  }
}

export const logout = async (req, res, next) => {
  try {
    await supabase.auth.signOut()
    res.status(200).json({ message: 'Déconnecté' })
  } catch (error) {
    next(error)
  }
}

export const createProfile = async (req, res, next) => {
  try {
    const userId = req.user?.id
    const email = req.user?.email
    if (!userId || !email) {
      return res.status(401).json({ message: 'Authentification requise.' })
    }

    const { company, ...rest } = req.body || {}
    const payload = { email, company: company?.trim?.() || undefined, userId }
    for (const field of PROFILE_OPTIONAL_FIELDS) {
      if (rest[field] !== undefined) {
        payload[field] = rest[field]
      }
    }

    await createProfileInternal(payload)

    const { data, error } = await supabase
      .from('profiles')
      .select(
        'company, tagline, logo_url, manager_name, address, city, state, national_id, rccm, nif'
      )
      .eq('id', userId)
      .single()

    if (error) throw error
    res.status(200).json(data)
  } catch (error) {
    next(error)
  }
}

export const getProfile = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ message: 'Authentification requise.' })
    }

    let hasExtendedColumns = true
    let response = await supabase
      .from('profiles')
      .select(
        'company, tagline, logo_url, manager_name, address, city, state, national_id, rccm, nif'
      )
      .eq('id', userId)
      .single()
    let { data, error } = response

    if (
      error &&
      (error.code === 'PGRST105' ||
        error.code === '42703' ||
        /column.+does not exist/i.test(error.message))
    ) {
      hasExtendedColumns = false
      const fallback = await supabase
        .from('profiles')
        .select('company')
        .eq('id', userId)
        .single()
      data = fallback.data
      error = fallback.error
    }

    if (error && error.code !== 'PGRST116') throw error

    const fallbackCompany = req.user?.user_metadata?.company || req.user?.email?.split('@')[0] || ''

    res.json({
      company: data?.company ?? fallbackCompany,
      tagline: hasExtendedColumns ? data?.tagline ?? '' : '',
      logo_url: hasExtendedColumns ? data?.logo_url ?? null : null,
      manager_name: hasExtendedColumns ? data?.manager_name ?? '' : '',
      address: hasExtendedColumns ? data?.address ?? '' : '',
      city: hasExtendedColumns ? data?.city ?? '' : '',
      state: hasExtendedColumns ? data?.state ?? '' : '',
      national_id: hasExtendedColumns ? data?.national_id ?? '' : '',
      rccm: hasExtendedColumns ? data?.rccm ?? '' : '',
      nif: hasExtendedColumns ? data?.nif ?? '' : ''
    })
  } catch (error) {
    next(error)
  }
}
