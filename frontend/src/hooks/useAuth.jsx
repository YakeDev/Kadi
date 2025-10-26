import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../services/supabase.js'
import { api } from '../services/api.js'

const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initialiseSession = async () => {
      const storedSession = window.localStorage.getItem('kadi.session')
      if (storedSession) {
        setSession(JSON.parse(storedSession))
      } else {
        const {
          data: { session: currentSession }
        } = await supabase.auth.getSession()
        if (currentSession) {
          setSession(currentSession)
          window.localStorage.setItem('kadi.session', JSON.stringify(currentSession))
        }
      }
      setIsLoading(false)
    }

    initialiseSession()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession) {
        window.localStorage.setItem('kadi.session', JSON.stringify(newSession))
      } else {
        window.localStorage.removeItem('kadi.session')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const login = async ({ email, password }) => {
    const {
      data: { session: supabaseSession },
      error
    } = await supabase.auth.signInWithPassword({ email, password })

    if (error) throw error

    window.localStorage.setItem('kadi.session', JSON.stringify(supabaseSession))
    setSession(supabaseSession)

    return supabaseSession
  }

  const signup = async ({ email, password, company }) => {
    const {
      data: { user },
      error
    } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { company }
      }
    })

    if (error) throw error

    await api.post('/auth/profile', { email, company })

    return user
  }

  const logout = async () => {
    await supabase.auth.signOut()
    window.localStorage.removeItem('kadi.session')
    setSession(null)
  }

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      login,
      signup,
      logout
    }),
    [session, isLoading]
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
