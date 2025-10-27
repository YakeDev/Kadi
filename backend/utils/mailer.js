import nodemailer from 'nodemailer'

let transporter

const logPrefix = '[Mailer]'

const getEnv = (key) => process.env[key]?.trim()

const createTransporter = () => {
  const host = getEnv('SMTP_HOST')
  const port = Number(getEnv('SMTP_PORT') || 587)
  const user = getEnv('SMTP_USER')
  const pass = getEnv('SMTP_PASS')

  if (!host || !user || !pass) {
    console.warn(
      `${logPrefix} Variables SMTP manquantes. Activez l'envoi d'e-mail en définissant SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.`
    )
    return null
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  })
}

const getTransporter = () => {
  if (transporter) return transporter
  transporter = createTransporter()
  return transporter
}

export const sendMail = async ({ to, subject, html, text }) => {
  const mailer = getTransporter()

  if (!mailer) {
    console.warn(`${logPrefix} Aucun transport SMTP configuré. Email destiné à ${to} non envoyé.`)
    return { sent: false, reason: 'transporter_not_configured' }
  }

  const fromEmail = getEnv('MAIL_FROM') || getEnv('SMTP_USER')
  const fromName = getEnv('MAIL_FROM_NAME') || 'Kadi'
  const formattedFrom = fromEmail ? `${fromName} <${fromEmail}>` : undefined

  try {
    const info = await mailer.sendMail({
      from: formattedFrom,
      to,
      subject,
      text,
      html
    })
    return { sent: true, messageId: info.messageId }
  } catch (error) {
    console.error(`${logPrefix} Échec d'envoi`, error)
    return { sent: false, reason: 'smtp_error', error }
  }
}
