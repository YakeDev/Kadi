import { afterEach, beforeEach, expect, test, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  delete process.env.RESEND_API_KEY
  delete process.env.MAIL_FROM
  delete process.env.SMTP_HOST
  delete process.env.SMTP_USER
  delete process.env.SMTP_PASS
  process.env.MAIL_FROM_NAME = 'Kadi'
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('sends an email using Resend HTTPS when its key and verified sender are configured', async () => {
  process.env.RESEND_API_KEY = 're_test_only'
  process.env.MAIL_FROM = 'noreply@example.org'
  const http = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ id: 'email_123' })
  })
  vi.stubGlobal('fetch', http)
  const { sendMail, isMailConfigured } = await import('../utils/mailer.js')
  expect(isMailConfigured()).toBe(true)
  const result = await sendMail({
    to: 'recipient@example.org',
    subject: 'Vérification',
    html: '<p>Bonjour</p>',
    text: 'Bonjour'
  })
  expect(result).toEqual({ sent: true, messageId: 'email_123' })
  expect(http).toHaveBeenCalledTimes(1)
  const [url, options] = http.mock.calls[0]
  expect(url).toBe('https://api.resend.com/emails')
  expect(options.headers.Authorization).toBe('Bearer re_test_only')
  expect(options.method).toBe('POST')
  expect(JSON.parse(options.body)).toMatchObject({
    from: 'Kadi <noreply@example.org>',
    to: ['recipient@example.org'],
    subject: 'Vérification'
  })
})

test('does not claim delivery when the Resend API rejects a request', async () => {
  process.env.RESEND_API_KEY = 're_test_only'
  process.env.MAIL_FROM = 'noreply@example.org'
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }))
  const { sendMail } = await import('../utils/mailer.js')
  const result = await sendMail({
    to: 'recipient@example.org', subject: 'Test', html: '<p>Hello</p>'
  })
  expect(result).toEqual({ sent: false, reason: 'provider_rejected', status: 403 })
})

test('Resend key without sender cannot claim that email is configured', async () => {
  process.env.RESEND_API_KEY = 're_test_only'
  vi.stubGlobal('fetch', vi.fn())
  const { sendMail, isMailConfigured } = await import('../utils/mailer.js')
  expect(isMailConfigured()).toBe(false)
  const result = await sendMail({ to: 'test@example.org', subject: 'Test', text: 'Test' })
  expect(result).toEqual({ sent: false, reason: 'missing_from_address' })
  expect(fetch).not.toHaveBeenCalled()
})

test('without Resend or SMTP configuration, the sender fails closed', async () => {
  const { sendMail, isMailConfigured } = await import('../utils/mailer.js')
  expect(isMailConfigured()).toBe(false)
  const result = await sendMail({ to: 'test@example.org', subject: 'Test', text: 'Test' })
  expect(result).toEqual({ sent: false, reason: 'transporter_not_configured' })
})

test('Resend network failure never exposes the API key in return data', async () => {
  process.env.RESEND_API_KEY = 're_test_only'
  process.env.MAIL_FROM = 'noreply@example.org'
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network failure')))
  const { sendMail } = await import('../utils/mailer.js')
  const result = await sendMail({ to: 'test@example.org', subject: 'Test', text: 'Test' })
  expect(result).toEqual({ sent: false, reason: 'provider_unavailable' })
  expect(JSON.stringify(result)).not.toContain('re_test_only')
})
