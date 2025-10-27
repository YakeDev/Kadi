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
const logoBucket = import_meta_env('VITE_SUPABASE_LOGO_BUCKET') || 'company-logos'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

const sanitizePathSegment = (value) =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')

export const uploadCompanyLogo = async (file, userId) => {
  if (!file || !userId) {
    throw new Error("Fichier ou identifiant utilisateur manquant pour l'upload du logo.")
  }

  const extension = (file.name.split('.').pop() || 'png').toLowerCase()
  const safeExt = sanitizePathSegment(extension)
  const safeName = sanitizePathSegment(file.name.replace(/\.[^/.]+$/, '')) || 'logo'
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const filePath = `${sanitizePathSegment(userId)}/${safeName}-${uniqueSuffix}.${safeExt}`

  const { error: uploadError } = await supabase.storage.from(logoBucket).upload(filePath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/png'
  })

  if (uploadError) {
    throw uploadError
  }

  const { data } = supabase.storage.from(logoBucket).getPublicUrl(filePath)
  if (!data?.publicUrl) {
    throw new Error('Impossible de récupérer l\'URL publique du logo uploadé.')
  }

  return data.publicUrl
}

export const deleteCompanyLogo = async (logoUrl, userId) => {
  if (!logoUrl || !userId) return
  try {
    const url = new URL(logoUrl)
    const parts = url.pathname.split(`/object/public/${logoBucket}/`)
    const storagePath = parts[1]
    if (storagePath && storagePath.startsWith(`${sanitizePathSegment(userId)}/`)) {
      await supabase.storage.from(logoBucket).remove([storagePath])
    }
  } catch (error) {
    console.warn('Suppression du logo ignorée:', error.message)
  }
}

export const LOGO_BUCKET = logoBucket
