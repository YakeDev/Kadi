import { supabase } from './supabase.js'

export const getCurrentSession = async () => {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession()

  if (error) {
    throw error
  }

  return session ?? null
}

export const getAccessToken = async () => {
  const session = await getCurrentSession()
  return session?.access_token ?? null
}
