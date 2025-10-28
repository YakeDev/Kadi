import { randomBytes } from 'crypto'
import { supabase } from '../models/supabaseClient.js'
import { sendMail } from '../utils/mailer.js'
import { emailVerificationTemplate, passwordResetTemplate } from '../utils/templates.js'

const PROFILE_OPTIONAL_FIELDS = [
  'logo_url',
  'manager_name',
  'address',
  'city',
  'state',
  'tagline',
  'national_id',
  'rccm',
  'nif',
  'phone',
  'website'
]

const LOGO_BUCKET = process.env.SUPABASE_LOGO_BUCKET || 'company-logos'
const APP_NAME = process.env.APP_NAME || 'Kadi'

const sanitizeUrl = (value, fallback) => {
  if (!value) return fallback
  const trimmed = value.trim()
  if (!trimmed) return fallback
  return trimmed
}

const DEFAULT_APP_URL = process.env.APP_URL || 'http://localhost:5173'
const EMAIL_REDIRECT_URL = sanitizeUrl(process.env.EMAIL_REDIRECT_URL, `${DEFAULT_APP_URL}/login?confirmed=1`)
const PASSWORD_RESET_REDIRECT_URL = sanitizeUrl(
  process.env.PASSWORD_RESET_REDIRECT_URL,
  `${DEFAULT_APP_URL}/login?reset=1`
)

const sanitizePathSegment = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')

const inferMimeFromExtension = (extension = '') => {
  switch (extension.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'svg':
      return 'image/svg+xml'
    default:
      return 'application/octet-stream'
  }
}

const inferExtensionFromMime = (mime = '') => {
  switch (mime.toLowerCase()) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/svg+xml':
      return 'svg'
    default:
      return 'png'
  }
}

const decodeBase64Logo = (value, fallbackExtension = '') => {
  if (!value || typeof value !== 'string') {
    throw Object.assign(new Error('Logo invalide.'), { status: 400 })
  }

  const dataUrlMatch = value.match(/^data:(.*?);base64,(.*)$/)
  const base64Payload = dataUrlMatch ? dataUrlMatch[2] : value
  const mimeType = dataUrlMatch ? dataUrlMatch[1] : inferMimeFromExtension(fallbackExtension)

  const buffer = Buffer.from(base64Payload, 'base64')
  if (!buffer || buffer.length === 0) {
    throw Object.assign(new Error('Logo vide ou corrompu.'), { status: 400 })
  }

  const maxSizeBytes = 1 * 1024 * 1024
  if (buffer.length > maxSizeBytes) {
    throw Object.assign(new Error('Logo trop volumineux (1 Mo max).'), { status: 400 })
  }

  let extension = fallbackExtension?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
  if (!extension) {
    extension = inferExtensionFromMime(mimeType)
  }

  return {
    buffer,
    mimeType: mimeType || inferMimeFromExtension(extension),
    extension: extension || 'png'
  }
}

const uploadLogoForUser = async (userId, base64Content, originalFilename = '') => {
  const hasExtension = originalFilename.includes('.')
  const filenameWithoutExt = hasExtension ? originalFilename.replace(/\.[^/.]+$/, '') : originalFilename
  const providedExtension = hasExtension ? originalFilename.split('.').pop() : ''
  const safeName = sanitizePathSegment(filenameWithoutExt) || 'logo'
  const { buffer, mimeType, extension } = decodeBase64Logo(base64Content, providedExtension)

  const uniqueSuffix = `${Date.now()}-${randomBytes(4).toString('hex')}`
  const filePath = `${sanitizePathSegment(userId)}/${safeName}-${uniqueSuffix}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(filePath, buffer, {
      cacheControl: '3600',
      upsert: false,
      contentType: mimeType || 'image/png'
    })

  if (uploadError) {
    throw Object.assign(new Error("Le logo n'a pas pu être enregistré. Veuillez vérifier le format et réessayer."), {
      status: 400,
      cause: uploadError
    })
  }

  const { data: publicUrlData, error: publicUrlError } = supabase.storage
    .from(LOGO_BUCKET)
    .getPublicUrl(filePath)

  if (publicUrlError) {
    throw Object.assign(new Error("Impossible de générer l'URL publique du logo."), {
      status: 500,
      cause: publicUrlError
    })
  }

  return publicUrlData?.publicUrl || null
}

const dispatchVerificationEmail = async ({ email, companyName }) => {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'signup',
    email,
    options: {
      redirectTo: EMAIL_REDIRECT_URL
    }
  })

  if (error) {
    throw Object.assign(new Error("Impossible de générer le lien de confirmation d'email."), {
      status: 500,
      cause: error
    })
  }

  const verificationUrl = data?.properties?.action_link
  if (!verificationUrl) {
    return { sent: false, reason: 'missing_action_link' }
  }

  const smtpHost = process.env.SMTP_HOST?.trim()
  const smtpUser = process.env.SMTP_USER?.trim()
  const smtpPass = process.env.SMTP_PASS?.trim()
  const hasSmtp = Boolean(smtpHost && smtpUser && smtpPass)

  if (!hasSmtp) {
    return { sent: false, reason: 'transporter_not_configured', verificationUrl }
  }

  const template = emailVerificationTemplate({ verificationUrl, companyName })
  const result = await sendMail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text
  })

  return { sent: Boolean(result?.sent), verificationUrl, mailer: result }
}

const dispatchPasswordResetEmail = async ({ email, companyName }) => {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: {
      redirectTo: PASSWORD_RESET_REDIRECT_URL
    }
  })

  if (error) {
    throw Object.assign(new Error('Impossible de générer le lien de réinitialisation du mot de passe.'), {
      status: 500,
      cause: error
    })
  }

  const resetUrl = data?.properties?.action_link
  if (!resetUrl) {
    return { sent: false, reason: 'missing_action_link' }
  }

  const template = passwordResetTemplate({ resetUrl, companyName })
  const result = await sendMail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text
  })

  return { sent: Boolean(result?.sent), resetUrl, mailer: result }
}

export const signup = async (req, res, next) => {
  try {
    const { email, password, company, logo_file: logoFile, logo_filename: logoFilename, ...rest } = req.body
    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis.' })
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { company }
    })

    if (error) {
      if (error.message?.toLowerCase().includes('already been registered')) {
        error.status = 409
      }
      throw error
    }

    const sanitizedRest = {}
    for (const [key, value] of Object.entries(rest)) {
      if (value === undefined) continue
      sanitizedRest[key] = typeof value === 'string' ? value.trim() : value
    }

    let uploadedLogoUrl = null
    if (logoFile) {
      uploadedLogoUrl = await uploadLogoForUser(data.user.id, logoFile, logoFilename || 'logo.png')
      sanitizedRest.logo_url = uploadedLogoUrl
    }

    const profilePayload = { email, company, userId: data.user.id }
    for (const field of PROFILE_OPTIONAL_FIELDS) {
      if (sanitizedRest[field] !== undefined) {
        profilePayload[field] = sanitizedRest[field]
      }
    }

    const profileData = await createProfileInternal(profilePayload)
    let verificationStatus = { sent: false }
    try {
      verificationStatus = await dispatchVerificationEmail({
        email,
        companyName: profileData?.company || company || APP_NAME
      })
    } catch (mailError) {
      const reason = mailError?.reason || mailError?.cause?.reason
      if (reason !== 'transporter_not_configured') {
        console.warn('[Auth] Échec de l’envoi du mail de confirmation', mailError)
      }
    }

    const verificationMessage = verificationStatus?.sent
      ? 'Compte créé. Un email de confirmation vous a été envoyé.'
      : verificationStatus?.reason === 'transporter_not_configured'
        ? "Compte créé. SMTP non configuré : utilisez le lien ci-dessous pour confirmer votre adresse."
        : 'Compte créé. Vérifiez votre adresse email avant de vous connecter.'

    res.status(201).json({
      user: {
        id: data.user.id,
        email: data.user.email
      },
      profile: profileData,
      emailConfirmationRequired: true,
      emailVerificationSent: Boolean(verificationStatus?.sent),
      verificationUrl: verificationStatus?.verificationUrl ?? null,
      logoUploaded: Boolean(uploadedLogoUrl),
      message: verificationMessage
    })
  } catch (error) {
    next(error)
  }
}

const createProfileInternal = async ({ email, company, userId, ...rest }) => {
  if (!userId) {
    throw Object.assign(new Error('userId requis pour créer le profil'), {
      status: 400
    })
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.admin.getUserById(userId)

  if (userError) throw userError
  if (!user) {
    throw Object.assign(new Error('Utilisateur Supabase introuvable.'), {
      status: 404
    })
  }

  const companyName = company || user.user_metadata?.company || email.split('@')[0]

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', userId)
    .maybeSingle()

  let tenantId = existingProfile?.tenant_id

  if (!tenantId) {
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({ name: companyName })
      .select()
      .single()
    if (tenantError) throw tenantError
    tenantId = tenant.id
  }

  const profileRecord = {
    id: userId,
    tenant_id: tenantId,
    email,
    company: companyName
  }

  for (const field of PROFILE_OPTIONAL_FIELDS) {
    if (field in rest) {
      profileRecord[field] = rest[field]
    }
  }

  const profileColumns =
    'company, tagline, logo_url, manager_name, address, city, state, national_id, rccm, nif, phone, website'

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .upsert(profileRecord, { onConflict: 'id' })
    .select(profileColumns)
    .single()

  if (profileError) {
    const isMissingColumn =
      profileError.code === '42703' ||
      /column.+does not exist/i.test(profileError.message || '')

    if (isMissingColumn) {
      const fallbackColumns =
        'company, tagline, logo_url, manager_name, address, city, state, national_id, rccm, nif'
      const { data: fallbackProfile, error: fallbackError } = await supabase
        .from('profiles')
        .select(fallbackColumns)
        .eq('id', userId)
        .single()

      if (fallbackError) throw fallbackError
      return fallbackProfile
    }

    throw profileError
  }

  return profileData
}

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis.' })
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) throw error
    res.json(data)
  } catch (error) {
    next(error)
  }
}

export const logout = async (req, res, next) => {
  try {
    await supabase.auth.signOut()
    res.status(204).send()
  } catch (error) {
    next(error)
  }
}

export const createProfile = async (req, res, next) => {
  try {
    const userId = req.user?.id
    const email = req.user?.email
    if (!userId || !email) {
      return res.status(401).json({ message: 'Authentification requise.' })
    }

    const { company, ...rest } = req.body || {}
    const payload = { email, company: company?.trim?.() || undefined, userId }
    for (const field of PROFILE_OPTIONAL_FIELDS) {
      if (rest[field] !== undefined) {
        payload[field] = rest[field]
      }
    }

    await createProfileInternal(payload)

    const { data, error } = await supabase
      .from('profiles')
      .select(
        'company, tagline, logo_url, manager_name, address, city, state, national_id, rccm, nif, phone, website'
      )
      .eq('id', userId)
      .single()

    if (error) throw error
    res.status(200).json(data)
  } catch (error) {
    next(error)
  }
}

export const getProfile = async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ message: 'Authentification requise.' })
    }

    const profileColumns =
      'company, tagline, logo_url, manager_name, address, city, state, national_id, rccm, nif, phone, website'
    let hasExtendedColumns = true
    let response = await supabase
      .from('profiles')
      .select(profileColumns)
      .eq('id', userId)
      .single()
    let { data, error } = response

    if (
      error &&
      (error.code === 'PGRST105' ||
        error.code === '42703' ||
        /column.+does not exist/i.test(error.message))
    ) {
      hasExtendedColumns = false
      const fallback = await supabase
        .from('profiles')
        .select('company, tagline, logo_url, manager_name, address, city, state, national_id, rccm, nif')
        .eq('id', userId)
        .single()
      data = fallback.data
      error = fallback.error
    }

    if (error && error.code !== 'PGRST116') throw error

    const fallbackCompany = req.user?.user_metadata?.company || req.user?.email?.split('@')[0] || ''

    res.json({
      company: data?.company ?? fallbackCompany,
      tagline: hasExtendedColumns ? data?.tagline ?? '' : '',
      logo_url: hasExtendedColumns ? data?.logo_url ?? null : null,
      manager_name: hasExtendedColumns ? data?.manager_name ?? '' : '',
      address: hasExtendedColumns ? data?.address ?? '' : '',
      city: hasExtendedColumns ? data?.city ?? '' : '',
      state: hasExtendedColumns ? data?.state ?? '' : '',
      national_id: hasExtendedColumns ? data?.national_id ?? '' : '',
      rccm: hasExtendedColumns ? data?.rccm ?? '' : '',
      nif: hasExtendedColumns ? data?.nif ?? '' : '',
      phone: hasExtendedColumns ? data?.phone ?? '' : '',
      website: hasExtendedColumns ? data?.website ?? '' : ''
    })
  } catch (error) {
    next(error)
  }
}

export const resendVerificationEmail = async (req, res, next) => {
  try {
    const email = req.body?.email?.trim()?.toLowerCase()
    if (!email) {
      return res.status(400).json({ message: 'Adresse email requise.' })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company, email')
      .eq('email', email)
      .maybeSingle()

    if (profileError) throw profileError

    if (!profile) {
      return res.status(200).json({
        emailVerificationSent: false,
        verificationUrl: null,
        message: 'Si un compte existe pour cette adresse, un email vient de vous être envoyé.'
      })
    }

    const result = await dispatchVerificationEmail({
      email,
      companyName: profile.company || APP_NAME
    })

    const verificationMessage = result.sent
      ? 'Un nouvel email de confirmation vous a été envoyé.'
      : result.reason === 'transporter_not_configured'
        ? 'SMTP non configuré : utilisez le lien ci-dessous pour confirmer votre adresse.'
        : "Impossible d'envoyer l'email de confirmation pour le moment."

    res.json({
      emailVerificationSent: Boolean(result.sent),
      verificationUrl: result.verificationUrl ?? null,
      message: verificationMessage
    })
  } catch (error) {
    next(error)
  }
}

export const requestPasswordReset = async (req, res, next) => {
  try {
    const email = req.body?.email?.trim()?.toLowerCase()
    if (!email) {
      return res.status(400).json({ message: 'Adresse email requise.' })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company, email')
      .eq('email', email)
      .maybeSingle()

    if (profileError) throw profileError

    if (!profile) {
      return res.status(200).json({
        resetEmailSent: false,
        message: 'Si un compte existe pour cette adresse, un email de réinitialisation vient de vous être envoyé.'
      })
    }

    const result = await dispatchPasswordResetEmail({
      email,
      companyName: profile.company || APP_NAME
    })

    res.json({
      resetEmailSent: Boolean(result.sent),
      message: result.sent
        ? 'Un email de réinitialisation vient de vous être envoyé.'
        : "Impossible d'envoyer le lien de réinitialisation pour le moment."
    })
  } catch (error) {
    next(error)
  }
}
