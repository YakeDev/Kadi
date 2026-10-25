import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { supabase, resolveCompanyLogo } from '../services/supabase.js'
import { api } from '../services/api.js'
import { getCurrentSession } from '../services/session.js'

const AuthContext = createContext()
const emptyProfile = {
  company: '', tagline: '', logo_url: null, manager_name: '', address: '', city: '',
  state: '', national_id: '', rccm: '', nif: '', phone: '', website: ''
}
const fallbackProfile = (user) => ({
  ...emptyProfile, company: user?.user_metadata?.company || user?.email?.split('@')[0] || ''
})
const recoveryLocation = () => window.location.pathname === '/reset-password' ||
  new URLSearchParams(window.location.search).get('reset') === '1'

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(recoveryLocation)
  const [platformAccess, setPlatformAccess] = useState({ status: 'loading', isSuperAdmin: false })
  const platformGeneration = useRef(0)
  const activeUser = useRef(null)
  const generation = useRef(0)

  useEffect(() => {
    let mounted = true
    let receivedEvent = false
    const accept = (newSession) => {
      if (!mounted) return
      if (activeUser.current !== newSession?.user?.id) {
        generation.current += 1
        platformGeneration.current += 1
        setPlatformAccess({ status: newSession?.user ? 'loading' : 'ready', isSuperAdmin: false })
        setProfile(null)
      }
      activeUser.current = newSession?.user?.id ?? null
      setSession(newSession)
      setIsLoading(false)
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      // Keep this callback synchronous: Supabase holds its session lock here.
      receivedEvent = true
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true)
      if (event === 'SIGNED_OUT') setIsPasswordRecovery(false)
      accept(newSession)
    })
    getCurrentSession().then((current) => {
      if (!receivedEvent) accept(current)
    }).catch(() => {
      if (!receivedEvent) accept(null)
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  const hydrateProfile = useCallback(async (user) => {
    const request = ++generation.current
    try {
      const { data } = await api.get('/auth/profile')
      const logo_url = await resolveCompanyLogo(data?.logo_url)
      if (generation.current === request && activeUser.current === user.id) {
        setProfile({ ...emptyProfile, ...data, logo_url })
      }
    } catch (error) {
      if (generation.current === request && activeUser.current === user.id) {
        setProfile(fallbackProfile(user))
      }
      console.warn('Impossible de récupérer le profil:', error.message)
    }
  }, [])

  useEffect(() => {
    if (session?.user && !isPasswordRecovery) hydrateProfile(session.user)
    return () => { generation.current += 1 }
  }, [session, isPasswordRecovery, hydrateProfile])

  const refreshPlatformAccess = useCallback(async () => {
    const userId = activeUser.current
    if (!userId || isPasswordRecovery) return
    const request = ++platformGeneration.current
    try {
      const { data } = await api.post('/platform/session')
      if (typeof data?.is_super_admin !== 'boolean') throw new Error('Réponse invalide')
      if (platformGeneration.current === request && activeUser.current === userId) {
        setPlatformAccess({ status: 'ready', isSuperAdmin: data.is_super_admin })
      }
    } catch {
      if (platformGeneration.current === request && activeUser.current === userId) {
        setPlatformAccess({ status: 'error', isSuperAdmin: false })
      }
    }
  }, [isPasswordRecovery])

  const platformUserId = session?.user?.id
  useEffect(() => {
    if (!platformUserId || isPasswordRecovery) return
    const refreshVisibleSession = () => { if (document.visibilityState !== 'hidden') refreshPlatformAccess() }
    refreshVisibleSession()
    const timer = setInterval(refreshVisibleSession, 15 * 60 * 1000)
    document.addEventListener('visibilitychange', refreshVisibleSession)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshVisibleSession)
      platformGeneration.current += 1
    }
  }, [platformUserId, isPasswordRecovery, refreshPlatformAccess])

  const login = useCallback(async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    if (!data?.session) throw new Error('Session Supabase manquante.')
    return data.session
  }, [])

  const signup = useCallback(async (payload) => {
    const { data } = await api.post('/auth/signup', payload)
    return data
  }, [])

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    generation.current += 1
    platformGeneration.current += 1
    activeUser.current = null
    setSession(null)
    setProfile(null)
    setPlatformAccess({ status: 'ready', isSuperAdmin: false })
    setIsPasswordRecovery(false)
  }, [])

  const updateProfile = useCallback(async (payload) => {
    const userId = activeUser.current
    const { data } = await api.post('/auth/profile', payload)
    const logo_url = await resolveCompanyLogo(data?.logo_url)
    if (activeUser.current === userId) setProfile({ ...emptyProfile, ...data, logo_url })
  }, [])

  const resendVerificationEmail = useCallback(async (email) => {
    const { data } = await api.post('/auth/resend-verification', { email: email.trim() })
    return data
  }, [])
  const requestPasswordReset = useCallback(async (email) => {
    const { data } = await api.post('/auth/password/forgot', { email: email.trim() })
    return data
  }, [])
  const resetPassword = useCallback(async (password) => {
    if (password.length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères.')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    await logout()
  }, [logout])

  const value = useMemo(() => ({
    session, user: session?.user ?? null, profile: profile ?? fallbackProfile(session?.user),
    isLoading, isPasswordRecovery, login, signup, logout, updateProfile,
    isSuperAdmin: platformAccess.isSuperAdmin, platformAccessStatus: platformAccess.status, refreshPlatformAccess,
    resendVerificationEmail, requestPasswordReset, resetPassword
  }), [session, profile, isLoading, isPasswordRecovery, login, signup, logout,
    updateProfile, resendVerificationEmail, requestPasswordReset, resetPassword, platformAccess, refreshPlatformAccess])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return context
}
