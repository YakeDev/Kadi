import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '../services/supabase.js'
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
      setProfile({
        company: data?.company ?? deriveFallbackProfile(user).company,
        tagline: data?.tagline ?? '',
        logo_url: data?.logo_url ?? null,
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
      setProfile(deriveFallbackProfile(user))
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

      setProfile((prev) => {
        const fallback = prev ?? deriveFallbackProfile(session?.user)
        return {
          company: data.company ?? sanitizedPayload.company ?? fallback.company ?? '',
          tagline: data.tagline ?? sanitizedPayload.tagline ?? fallback.tagline ?? '',
          logo_url: data.logo_url ?? sanitizedPayload.logo_url ?? fallback.logo_url ?? null,
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
      updateProfile
    }),
    [session, profile, isLoading, login, signup, logout, updateProfile]
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
