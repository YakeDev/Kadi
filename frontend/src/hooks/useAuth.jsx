import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../services/supabase.js'
import { api } from '../services/api.js'

const AuthContext = createContext()

const LOCAL_SESSION_KEY = 'kadi.session'

const deriveFallbackProfile = (user) => {
  if (!user) {
    return { company: '', tagline: '' }
  }
  const company = user.user_metadata?.company || user.email?.split('@')[0] || ''
  return { company, tagline: '' }
}

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

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
  }, [])

  const hydrateProfile = async (user) => {
    if (!user) {
      setProfile(null)
      return
    }
    try {
      const { data } = await api.get('/auth/profile')
      setProfile({
        company: data?.company ?? deriveFallbackProfile(user).company,
        tagline: data?.tagline ?? ''
      })
    } catch (error) {
      console.warn('Impossible de récupérer le profil:', error.message)
      setProfile(deriveFallbackProfile(user))
    }
  }

  const login = async ({ email, password }) => {
    const {
      data: { session: supabaseSession },
      error
    } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    window.localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(supabaseSession))
    setSession(supabaseSession)
    await hydrateProfile(supabaseSession.user)
    return supabaseSession
  }

  const signup = async ({ email, password, company }) => {
    await api.post('/auth/signup', { email, password, company })
    const newSession = await login({ email, password })
    return newSession?.user
  }

  const logout = async () => {
    await supabase.auth.signOut()
    window.localStorage.removeItem(LOCAL_SESSION_KEY)
    setSession(null)
    setProfile(null)
  }

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile: profile ?? deriveFallbackProfile(session?.user),
      isLoading,
      login,
      signup,
      logout
    }),
    [session, profile, isLoading]
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
