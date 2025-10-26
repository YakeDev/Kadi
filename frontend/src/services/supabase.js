import { createClient } from '@supabase/supabase-js'

function import_meta_env(key) {
  const value = import.meta.env[key]
  if (!value) {
    console.warn(`⚠️ ${key} est manquant dans les variables d'environnement frontend.`)
  }
  return value
}

const supabaseUrl = import_meta_env('VITE_SUPABASE_URL')
const supabaseAnonKey = import_meta_env('VITE_SUPABASE_ANON_KEY')

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
