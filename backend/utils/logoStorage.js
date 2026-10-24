const LOGO_BUCKET = process.env.SUPABASE_LOGO_BUCKET || 'company-logos'

const ABSOLUTE_URL_REGEX = /^https?:\/\//i
const DATA_URL_REGEX = /^data:/i

const createValidationError = (message) =>
  Object.assign(new Error(message), {
    status: 400
  })

export const sanitizePathSegment = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')

export const sanitizeStoragePath = (value = '') => value.toString().trim().replace(/^\/+/, '')

const isExternalLogoReference = (value = '') =>
  ABSOLUTE_URL_REGEX.test(value) || DATA_URL_REGEX.test(value)

export const normalizeLogoStoragePath = (value, userId) => {
  if (value == null || value === '') return null
  if (typeof value !== 'string') {
    throw createValidationError('Le logo doit être fourni sous forme de chemin de stockage valide.')
  }

  let trimmed = value.trim()
  if (!trimmed) return null

  if (ABSOLUTE_URL_REGEX.test(trimmed)) {
    try {
      const url = new URL(trimmed)
      const expected = new URL(process.env.SUPABASE_URL)
      const prefix = `/storage/v1/object/`
      const objectPath = url.pathname.slice(prefix.length)
      const [access, bucket, ...segments] = objectPath.split('/')
      if (url.origin !== expected.origin || !url.pathname.startsWith(prefix) ||
          !['public', 'sign', 'authenticated'].includes(access) || decodeURIComponent(bucket) !== LOGO_BUCKET) {
        throw new Error('untrusted')
      }
      trimmed = decodeURIComponent(segments.join('/'))
    } catch {
      throw createValidationError("Le logo doit provenir du stockage sécurisé de l'application.")
    }
  }
  if (isExternalLogoReference(trimmed)) {
    throw createValidationError(
      "Le logo doit provenir du stockage sécurisé de l'application, pas d'une URL externe."
    )
  }

  const storagePath = sanitizeStoragePath(trimmed)
  if (!storagePath || storagePath.includes('..') || /[%\\\u0000-\u001f?#]/.test(storagePath)) {
    throw createValidationError('Chemin de logo invalide.')
  }

  if (userId) {
    const expectedPrefix = `${sanitizePathSegment(userId)}/`
    if (!storagePath.startsWith(expectedPrefix)) {
      throw createValidationError('Le logo doit appartenir à votre espace de stockage.')
    }
  }

  return storagePath
}

export const resolveStoredLogoUrl = async (
  supabase,
  value,
  { userId, signedUrlTtl = 60 * 60 * 24, logPrefix = '[Logo]' } = {}
) => {
  if (!value || typeof value !== 'string') return null

  let storagePath
  try {
    storagePath = userId ? normalizeLogoStoragePath(value, userId) : normalizeLogoStoragePath(value)
  } catch (error) {
    console.warn(`${logPrefix} Référence logo ignorée:`, error.message)
    return null
  }

  if (!storagePath) return null

  try {
    const { data, error } = await supabase.storage
      .from(LOGO_BUCKET)
      .createSignedUrl(storagePath, signedUrlTtl)

    if (error) {
      console.warn(`${logPrefix} createSignedUrl error:`, error.message)
    } else if (data?.signedUrl) {
      return data.signedUrl
    }
  } catch (error) {
    console.warn(`${logPrefix} createSignedUrl exception:`, error.message)
  }

  return null
}

export const downloadStoredLogoBuffer = async (
  supabase,
  value,
  { userId, logPrefix = '[Logo]' } = {}
) => {
  if (!value || typeof value !== 'string') return null

  let storagePath
  try {
    storagePath = userId ? normalizeLogoStoragePath(value, userId) : normalizeLogoStoragePath(value)
  } catch (error) {
    console.warn(`${logPrefix} Référence logo ignorée:`, error.message)
    return null
  }

  if (!storagePath) return null

  try {
    const { data, error } = await supabase.storage.from(LOGO_BUCKET).download(storagePath)
    if (error) {
      console.warn(`${logPrefix} download error:`, error.message)
      return null
    }

    if (!data || data.size > 1024 * 1024) return null

    const arrayBuffer = await data.arrayBuffer()
    if (!arrayBuffer?.byteLength || arrayBuffer.byteLength > 1024 * 1024) {
      return null
    }

    return Buffer.from(arrayBuffer)
  } catch (error) {
    console.warn(`${logPrefix} download exception:`, error.message)
    return null
  }
}

export { LOGO_BUCKET }
