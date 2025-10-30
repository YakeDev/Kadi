import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { supabase, LOGO_BUCKET } from '../services/supabase.js'
import { api } from '../services/api.js'

const AuthContext = createContext()

const LOCAL_SESSION_KEY = 'kadi.session'

const emptyProfile = {
  company: '',
  tagline: '',
  logo_url: null,
  manager_name: '',
  address: '',
  city: '',
  state: '',
  national_id: '',
  rccm: '',
  nif: '',
  phone: '',
  website: ''
}

const OPTIONAL_PROFILE_FIELDS = [
  'logo_url',
  'manager_name',
  'address',
  'city',
  'state',
  'tagline',
  'national_id',
  'rccm',
  'nif',
  'phone',
  'website'
]

const ABSOLUTE_URL_REGEX = /^https?:\/\//i
const DATA_OR_BLOB_REGEX = /^(data:|blob:)/i

const SUPABASE_SIGNED_SEGMENT = '/object/sign/'

const isDirectLogoUrl = (value) => {
  if (!value || typeof value !== 'string') return false
  return ABSOLUTE_URL_REGEX.test(value) || DATA_OR_BLOB_REGEX.test(value)
}

const extractStoragePathFromSignedUrl = (value) => {
  try {
    const url = new URL(value)
    const marker = `${SUPABASE_SIGNED_SEGMENT}${LOGO_BUCKET}/`
    if (!url.pathname.includes(marker)) {
      return null
    }
    const storagePath = url.pathname.split(marker)[1]
    return storagePath ? storagePath.replace(/^\/+/, '') : null
  } catch {
    return null
  }
}

const normalizeStoragePath = (value) => {
  if (!value || typeof value !== 'string') return ''
  return value.replace(/^\/+/, '')
}

const resolveLogoUrl = async (rawValue) => {
  if (!rawValue || typeof rawValue !== 'string') {
    return null
  }

  let sanitizedPath = null

  if (isDirectLogoUrl(rawValue)) {
    const signedPath = extractStoragePathFromSignedUrl(rawValue)
    if (!signedPath) {
      return rawValue.trim()
    }
    sanitizedPath = signedPath
  } else {
    sanitizedPath = normalizeStoragePath(rawValue)
  }

  if (!sanitizedPath || !LOGO_BUCKET) {
    return null
  }

  try {
    const { data: publicData } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(sanitizedPath)
    if (publicData?.publicUrl) {
      return publicData.publicUrl
    }
  } catch (error) {
    console.warn('Impossible de générer une URL publique pour le logo:', error.message)
  }

  try {
    const { data, error } = await supabase.storage
      .from(LOGO_BUCKET)
      .createSignedUrl(sanitizedPath, 60 * 60)
    if (error) {
      console.warn('Impossible de générer une URL signée pour le logo:', error.message)
      return null
    }
    return data?.signedUrl ?? null
  } catch (error) {
    console.warn('Erreur lors de la récupération du logo Supabase:', error.message)
    return null
  }
}

const deriveFallbackProfile = (user) => {
  if (!user) {
    return { ...emptyProfile }
  }
  const company = user.user_metadata?.company || user.email?.split('@')[0] || ''
  return { ...emptyProfile, company }
}

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const hydrateProfile = useCallback(async (user) => {
    if (!user) {
      setProfile(null)
      return
    }
    try {
      const { data } = await api.get('/auth/profile')
      const resolvedLogoUrl = await resolveLogoUrl(data?.logo_url)
      setProfile({
        company: data?.company ?? deriveFallbackProfile(user).company,
        tagline: data?.tagline ?? '',
        logo_url: resolvedLogoUrl ?? null,
        manager_name: data?.manager_name ?? '',
        address: data?.address ?? '',
        city: data?.city ?? '',
        state: data?.state ?? '',
        national_id: data?.national_id ?? '',
        rccm: data?.rccm ?? '',
        nif: data?.nif ?? '',
        phone: data?.phone ?? '',
        website: data?.website ?? ''
      })
    } catch (error) {
      console.warn('Impossible de récupérer le profil:', error.message)
      setProfile((prev) => prev ?? deriveFallbackProfile(user))
    }
  }, [])

  useEffect(() => {
    const initialiseSession = async () => {
      const storedSession = window.localStorage.getItem(LOCAL_SESSION_KEY)
      if (storedSession) {
        const parsed = JSON.parse(storedSession)
        setSession(parsed)
        await hydrateProfile(parsed.user)
      } else {
        const {
          data: { session: currentSession }
        } = await supabase.auth.getSession()
        if (currentSession) {
          setSession(currentSession)
          window.localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(currentSession))
          await hydrateProfile(currentSession.user)
        }
      }
      setIsLoading(false)
    }

    initialiseSession()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      if (newSession) {
        window.localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(newSession))
        await hydrateProfile(newSession.user)
      } else {
        window.localStorage.removeItem(LOCAL_SESSION_KEY)
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [hydrateProfile])

  const login = useCallback(async ({ email, password }) => {
    const {
      data: { session: supabaseSession },
      error
    } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    window.localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(supabaseSession))
    setSession(supabaseSession)
    await hydrateProfile(supabaseSession.user)
    return supabaseSession
  }, [hydrateProfile])

  const signup = useCallback(async ({ email, password, company, ...rest }) => {
    const trimmedEmail = email?.trim()
    if (!trimmedEmail || !password) {
      throw new Error('Email et mot de passe requis.')
    }
    const trimmedCompany = company?.trim?.()
    const payload = {
      email: trimmedEmail,
      password
    }

    if (trimmedCompany) {
      payload.company = trimmedCompany
    }

    for (const field of OPTIONAL_PROFILE_FIELDS) {
      if (rest[field] !== undefined) {
        const value = rest[field]
        if (typeof value === 'string') {
          const trimmed = value.trim()
          payload[field] = trimmed.length ? trimmed : null
        } else {
          payload[field] = value
        }
      }
    }

    const { data } = await api.post('/auth/signup', payload)
    return data
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    window.localStorage.removeItem(LOCAL_SESSION_KEY)
    setSession(null)
    setProfile(null)
  }, [])

  const resendVerificationEmail = useCallback(async (email) => {
    if (!email?.trim()) {
      throw new Error('Adresse email requise.')
    }
    const { data } = await api.post('/auth/resend-verification', { email: email.trim() })
    return data
  }, [])

  const requestPasswordReset = useCallback(async (email) => {
    if (!email?.trim()) {
      throw new Error('Adresse email requise.')
    }
    const { data } = await api.post('/auth/password/forgot', { email: email.trim() })
    return data
  }, [])

  const updateProfile = useCallback(
    async (payload = {}) => {
      const sanitizedPayload = {}
      for (const [key, value] of Object.entries(payload)) {
        if (value === undefined) continue
        if (typeof value === 'string') {
          const trimmed = value.trim()
          sanitizedPayload[key] = trimmed.length ? trimmed : null
        } else {
          sanitizedPayload[key] = value
        }
      }

      const { data } = await api.post('/auth/profile', sanitizedPayload)
      if (!data) {
        if (session?.user) {
          await hydrateProfile(session.user)
        }
        return
      }

      const resolvedLogoUrl = await resolveLogoUrl(
        data?.logo_url ?? sanitizedPayload.logo_url ?? null
      )

      setProfile((prev) => {
        const fallback = prev ?? deriveFallbackProfile(session?.user)
        return {
          company: data.company ?? sanitizedPayload.company ?? fallback.company ?? '',
          tagline: data.tagline ?? sanitizedPayload.tagline ?? fallback.tagline ?? '',
          logo_url: resolvedLogoUrl ?? fallback.logo_url ?? null,
          manager_name:
            data.manager_name ?? sanitizedPayload.manager_name ?? fallback.manager_name ?? '',
          address: data.address ?? sanitizedPayload.address ?? fallback.address ?? '',
          city: data.city ?? sanitizedPayload.city ?? fallback.city ?? '',
          state: data.state ?? sanitizedPayload.state ?? fallback.state ?? '',
          national_id:
            data.national_id ?? sanitizedPayload.national_id ?? fallback.national_id ?? '',
          rccm: data.rccm ?? sanitizedPayload.rccm ?? fallback.rccm ?? '',
          nif: data.nif ?? sanitizedPayload.nif ?? fallback.nif ?? '',
          phone: data.phone ?? sanitizedPayload.phone ?? fallback.phone ?? '',
          website: data.website ?? sanitizedPayload.website ?? fallback.website ?? ''
        }
      })
    },
    [hydrateProfile, session]
  )

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile: profile ?? deriveFallbackProfile(session?.user),
      isLoading,
      login,
      signup,
      logout,
      updateProfile,
      resendVerificationEmail,
      requestPasswordReset
    }),
    [session, profile, isLoading, login, signup, logout, updateProfile, resendVerificationEmail, requestPasswordReset]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth doit être utilisé dans AuthProvider')
  }
  return context
}
