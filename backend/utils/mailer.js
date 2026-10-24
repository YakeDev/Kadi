import nodemailer from 'nodemailer'

// Render Free blocks outbound SMTP on ports 25/465/587.
// Resend's HTTPS API is the preferred delivery path; SMTP remains a fallback.
let transporter
const logPrefix = '[Mailer]'
const getEnv = (key) => process.env[key]?.trim()
const hasSmtpCredentials = () =>
  Boolean(getEnv('SMTP_HOST') && getEnv('SMTP_USER') && getEnv('SMTP_PASS'))

export const isMailConfigured = () => {
  if (getEnv('RESEND_API_KEY')) return Boolean(getEnv('MAIL_FROM'))
  return hasSmtpCredentials()
}

const createTransporter = () => {
  if (!hasSmtpCredentials()) return null
  const port = Number(getEnv('SMTP_PORT') || 587)
  return nodemailer.createTransport({
    host: getEnv('SMTP_HOST'),
    port,
    secure: port === 465 || port === 2465,
    auth: { user: getEnv('SMTP_USER'), pass: getEnv('SMTP_PASS') }
  })
}
const getTransporter = () => (transporter ||= createTransporter())

const sender = () => {
  const fromEmail = getEnv('MAIL_FROM') || getEnv('SMTP_USER')
  const name = (getEnv('MAIL_FROM_NAME') || 'Kadi').replace(/[\r\n<>]/g, '').slice(0, 80)
  return fromEmail ? name + ' <' + fromEmail + '>' : null
}

const sendViaResend = async ({ to, subject, html, text }) => {
  const key = getEnv('RESEND_API_KEY')
  if (!getEnv('MAIL_FROM')) return { sent: false, reason: 'missing_from_address' }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from: sender(), to: [to], subject, html, text }),
      signal: AbortSignal.timeout(12000)
    })
    if (!response.ok) {
      // Never log the response body: it can contain recipient or message details.
      console.warn(logPrefix + ' Resend rejected the request (HTTP ' + response.status + ')')
      return { sent: false, reason: 'provider_rejected', status: response.status }
    }
    const result = await response.json().catch(() => null)
    if (!result?.id) return { sent: false, reason: 'provider_invalid_response' }
    return { sent: true, messageId: result.id }
  } catch (error) {
    console.warn(logPrefix + ' Resend HTTPS error: ' + (error?.name || 'network_failure'))
    return { sent: false, reason: 'provider_unavailable' }
  }
}

export const sendMail = async ({ to, subject, html, text }) => {
  // If a Resend key is set, never silently downgrade to an unrelated SMTP service.
  if (getEnv('RESEND_API_KEY')) return sendViaResend({ to, subject, html, text })

  const mailer = getTransporter()
  if (!mailer) return { sent: false, reason: 'transporter_not_configured' }

  try {
    const info = await mailer.sendMail({ from: sender(), to, subject, text, html })
    return { sent: true, messageId: info.messageId }
  } catch (error) {
    console.warn(logPrefix + ' SMTP failed: ' + (error?.code || 'unknown'))
    return { sent: false, reason: 'smtp_error' }
  }
}
