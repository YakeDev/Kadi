import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase n’est pas correctement configuré côté backend.')
}

const options = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
}

// Data/admin queries must always keep the server identity. Never sign in on this client.
export const supabase = createClient(supabaseUrl, supabaseKey, options)

// A fresh client per password check prevents one user's session affecting another request.
export const createAuthClient = () => createClient(
  supabaseUrl,
  process.env.SUPABASE_ANON_KEY || supabaseKey,
  options
)
