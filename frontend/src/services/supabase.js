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

const ownedPath = (value, userId) => {
  if (!value || typeof value !== 'string') return null
  let path = value.trim()
  if (/^https?:/i.test(path)) {
    try {
      const url = new URL(path)
      if (url.origin !== new URL(supabaseUrl).origin) return null
      const markers = ['public', 'sign', 'authenticated'].map((access) => `/storage/v1/object/${access}/${logoBucket}/`)
      const marker = markers.find((prefix) => url.pathname.startsWith(prefix))
      if (!marker) return null
      path = decodeURIComponent(url.pathname.slice(marker.length))
    } catch { return null }
  }
  if (!path.startsWith(`${sanitizePathSegment(userId)}/`) || /[%\\?#]/.test(path) || path.includes('..')) return null
  return path
}

export const resolveCompanyLogo = async (value) => {
  if (!value) return null
  if (/^https?:/i.test(value)) {
    // Preserve the token on a signed URL supplied by the backend.
    try {
      const url = new URL(value)
      if (url.origin === new URL(supabaseUrl).origin &&
          ['sign', 'public', 'authenticated'].some((access) =>
            url.pathname.startsWith(`/storage/v1/object/${access}/${logoBucket}/`))) return value
    } catch { return null }
    return null
  }
  const { data, error } = await supabase.storage.from(logoBucket).createSignedUrl(value, 3600)
  if (error) throw new Error('Impossible de charger le logo. Vérifiez le stockage de votre entreprise.')
  return data?.signedUrl ?? null
}

export const uploadCompanyLogo = async (file, userId) => {
  if (!file || !userId) {
    throw new Error("Fichier ou identifiant utilisateur manquant pour l'upload du logo.")
  }

  // Private Storage bucket accepts PNG/JPEG/WebP; keep client validation aligned.
  // Legacy SVG references can still be read/normalized by the backend for PDFs.
  if (file.size > 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Choisissez un logo PNG, JPEG ou WebP de 1 Mo maximum.')
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

  const storagePath = filePath
  const previewUrl = await resolveCompanyLogo(filePath)
  if (!previewUrl) throw new Error('Impossible de charger le logo importé.')

  return {
    storagePath,
    previewUrl
  }
}

export const deleteCompanyLogo = async (logoUrl, userId) => {
  if (!logoUrl || !userId) return
  try {
    const storagePath = ownedPath(logoUrl, userId)

    if (storagePath) {
      await supabase.storage.from(logoBucket).remove([storagePath])
    }
  } catch (error) {
    console.warn('Suppression du logo ignorée:', error.message)
  }
}

export const LOGO_BUCKET = logoBucket
