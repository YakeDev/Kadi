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

const normalizeStoragePathForDeletion = (value, userId) => {
  const sanitizedUser = sanitizePathSegment(userId || '')
  if (!value) return null
  const sanitizedValue = value.replace(/^\/+/, '')
  if (!sanitizedValue) return null
  if (sanitizedValue.startsWith(`${sanitizedUser}/`)) {
    return sanitizedValue
  }
  return `${sanitizedUser}/${sanitizedValue}`
}

const extractStoragePathFromUrl = (value) => {
  try {
    const url = new URL(value)
    const publicMarker = `/object/public/${logoBucket}/`
    const signedMarker = `/object/sign/${logoBucket}/`

    let storagePath = null
    if (url.pathname.includes(publicMarker)) {
      storagePath = url.pathname.split(publicMarker)[1]
    } else if (url.pathname.includes(signedMarker)) {
      storagePath = url.pathname.split(signedMarker)[1]
    }

    if (!storagePath) return null
    return storagePath.replace(/^\/+/, '')
  } catch {
    return null
  }
}

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

  const storagePath = filePath
  let previewUrl = null

  const { data: publicData } = supabase.storage.from(logoBucket).getPublicUrl(filePath)
  if (publicData?.publicUrl) {
    previewUrl = publicData.publicUrl
  } else {
    const { data: signedData, error: signedError } = await supabase
      .storage.from(logoBucket)
      .createSignedUrl(filePath, 60 * 60)

    if (signedError || !signedData?.signedUrl) {
      throw new Error("Impossible de récupérer l'URL du logo uploadé.")
    }
    previewUrl = signedData.signedUrl
  }

  return {
    storagePath,
    previewUrl
  }
}

export const deleteCompanyLogo = async (logoUrl, userId) => {
  if (!logoUrl || !userId) return
  try {
    const isPath = !logoUrl.includes('://')
    const storagePath = isPath
      ? normalizeStoragePathForDeletion(logoUrl, userId)
      : extractStoragePathFromUrl(logoUrl)

    if (storagePath) {
      await supabase.storage.from(logoBucket).remove([storagePath])
    }
  } catch (error) {
    console.warn('Suppression du logo ignorée:', error.message)
  }
}

export const LOGO_BUCKET = logoBucket
