import { randomBytes } from 'crypto'
import { supabase } from '../models/supabaseClient.js'
import { sendMail } from '../utils/mailer.js'
import { emailVerificationTemplate } from '../utils/templates.js'

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

    const triggerSupabaseResend = async () => {
      const { error: resendError } = await supabase.auth.admin.resend({
        type: 'signup',
        email,
        options: { redirectTo }
      })
      if (resendError) {
        console.warn('Impossible de déclencher l’email de confirmation via Supabase', resendError)
        return { sent: false, reason: resendError.message || 'supabase_resend_failed' }
      }
      return { sent: true }
    }

    let verificationUrl = null
    let emailSent = false
    let emailSendIssue = null
    const redirectTo =
      process.env.EMAIL_REDIRECT_URL ||
      process.env.APP_URL ||
      'http://localhost:5173/auth/callback'

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: { redirectTo }
    })

    if (linkError) {
      console.error('Impossible de générer le lien de confirmation Supabase', linkError)
      const resendResult = await triggerSupabaseResend()
      emailSent = resendResult.sent
      emailSendIssue = resendResult.reason || linkError.message || 'generate_link_failed'
    } else {
      verificationUrl = linkData?.action_link ?? null
      if (verificationUrl) {
        const emailPayload = emailVerificationTemplate({
          verificationUrl,
          companyName: company || profileData?.company || ''
        })
        const sendResult = await sendMail({
          to: email,
          subject: emailPayload.subject,
          html: emailPayload.html,
          text: emailPayload.text
        })
        emailSent = sendResult.sent
        if (!emailSent) {
          const resendResult = await triggerSupabaseResend()
          emailSent = resendResult.sent
          emailSendIssue = resendResult.reason || sendResult.reason || 'smtp_failed'
        }
      } else {
        const resendResult = await triggerSupabaseResend()
        emailSent = resendResult.sent
        emailSendIssue = resendResult.reason || 'missing_action_link'
      }
    }

    const confirmationMessage = emailSent
      ? 'Compte créé. Un email de confirmation vient de vous être envoyé.'
      : "Compte créé. Impossible d’envoyer automatiquement l’email de confirmation. Vérifiez la configuration Supabase (Email confirmations activées, Redirect URL autorisée) puis renvoyez l’email depuis l’écran de connexion."

    res.status(201).json({
      user: {
        id: data.user.id,
        email: data.user.email
      },
      profile: profileData,
      emailConfirmationRequired: true,
      emailVerificationSent: emailSent,
      logoUploaded: Boolean(uploadedLogoUrl),
      emailSendIssue,
      message: confirmationMessage
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

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .upsert(profileRecord, { onConflict: 'id' })
    .select(
      'company, tagline, logo_url, manager_name, address, city, state, national_id, rccm, nif, phone, website'
    )
    .single()

  if (profileError) throw profileError

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
    res.status(200).json({ message: 'Déconnecté' })
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

    let hasExtendedColumns = true
    let response = await supabase
      .from('profiles')
      .select(
        'company, tagline, logo_url, manager_name, address, city, state, national_id, rccm, nif'
      )
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
        .select('company')
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
      nif: hasExtendedColumns ? data?.nif ?? '' : ''
    })
  } catch (error) {
    next(error)
  }
}
