import { jest } from '@jest/globals'
import request from 'supertest'

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key'

describe('Auth login', () => {
  let app
  let supabaseMock
  let sendMailMock
  let profilesQuery

  beforeEach(async () => {
    jest.resetModules()
    process.env.SMTP_HOST = 'smtp.test'
    process.env.SMTP_USER = 'user@test'
    process.env.SMTP_PASS = 'secret'

    supabaseMock = {
      auth: {
        signInWithPassword: jest.fn(),
        signOut: jest.fn(),
        admin: {
          generateLink: jest.fn(),
          getUserById: jest.fn()
        }
      },
      from: jest.fn()
    }

    profilesQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn()
    }

    supabaseMock.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return profilesQuery
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn()
      }
    })

    sendMailMock = jest.fn().mockResolvedValue({ sent: true })

    await jest.unstable_mockModule('../models/supabaseClient.js', () => ({
      supabase: supabaseMock
    }))

    await jest.unstable_mockModule('../utils/mailer.js', () => ({
      sendMail: sendMailMock
    }))

    await jest.unstable_mockModule('../utils/templates.js', () => ({
      emailVerificationTemplate: ({ verificationUrl }) => ({
        subject: 'Verify',
        html: `<a href="${verificationUrl}">verify</a>`,
        text: verificationUrl
      }),
      passwordResetTemplate: ({ resetUrl }) => ({
        subject: 'Reset',
        html: `<a href="${resetUrl}">reset</a>`,
        text: resetUrl
      })
    }))

    const module = await import('../app.js')
    app = module.default
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('returns session data when credentials are valid', async () => {
    const fakeSession = {
      session: { access_token: 'token', user: { id: 'user-1' } }
    }
    supabaseMock.auth.signInWithPassword.mockResolvedValue({
      data: fakeSession,
      error: null
    })

    const response = await request(app).post('/api/auth/login').send({
      email: 'test@example.com',
      password: 'password123!'
    })

    expect(response.status).toBe(200)
    expect(response.body).toEqual(fakeSession)
    expect(supabaseMock.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123!'
    })
  })

  test('returns 400 when Supabase rejects credentials', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials', status: 400 }
    })

    const response = await request(app).post('/api/auth/login').send({
      email: 'bad@example.com',
      password: 'wrong'
    })

    expect(response.status).toBe(400)
    expect(response.body).toEqual({
      message: 'Invalid login credentials'
    })
  })

  test('resend verification returns success even when user missing', async () => {
    profilesQuery.maybeSingle.mockResolvedValue({ data: null, error: null })

    const response = await request(app).post('/api/auth/resend-verification').send({
      email: 'unknown@example.com'
    })

    expect(response.status).toBe(200)
    expect(sendMailMock).not.toHaveBeenCalled()
    expect(response.body).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('Si un compte existe'),
        emailVerificationSent: false
      })
    )
    expect(response.body.verificationUrl).toBeUndefined()
  })

  test("resend verification n'expose jamais le lien quand SMTP absent", async () => {
    profilesQuery.maybeSingle.mockResolvedValue({
      data: { email: 'user@example.com', company: 'Acme' },
      error: null
    })

    supabaseMock.auth.admin.generateLink.mockResolvedValue({
      data: { properties: { action_link: 'https://example.com/confirm' } },
      error: null
    })

    process.env.SMTP_HOST = ''
    process.env.SMTP_USER = ''
    process.env.SMTP_PASS = ''

    const response = await request(app).post('/api/auth/resend-verification').send({
      email: 'user@example.com'
    })

    expect(response.status).toBe(200)
    expect(sendMailMock).not.toHaveBeenCalled()
    expect(response.body).toEqual(
      expect.objectContaining({
        emailVerificationSent: false,
        message: expect.stringContaining('temporairement indisponible')
      })
    )
    expect(response.body.verificationUrl).toBeUndefined()
  })

  test('resend verification sends email when profile found', async () => {
    profilesQuery.maybeSingle.mockResolvedValue({
      data: { email: 'user@example.com', company: 'Acme' },
      error: null
    })

    supabaseMock.auth.admin.generateLink.mockResolvedValue({
      data: { properties: { action_link: 'https://example.com/confirm' } },
      error: null
    })

    const response = await request(app).post('/api/auth/resend-verification').send({
      email: 'user@example.com'
    })

    expect(response.status).toBe(200)
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com'
      })
    )
    expect(response.body).toEqual(
      expect.objectContaining({
        emailVerificationSent: true
      })
    )
    expect(response.body.verificationUrl).toBeUndefined()
  })

  test('password reset sends email when profile found', async () => {
    profilesQuery.maybeSingle.mockResolvedValue({
      data: { email: 'user@example.com', company: 'Acme' },
      error: null
    })

    supabaseMock.auth.admin.generateLink.mockResolvedValue({
      data: { properties: { action_link: 'https://example.com/reset' } },
      error: null
    })

    const response = await request(app).post('/api/auth/password/forgot').send({
      email: 'user@example.com'
    })

    expect(response.status).toBe(200)
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com'
      })
    )
    expect(response.body).toEqual(
      expect.objectContaining({
        resetEmailSent: true
      })
    )
  })

  test("signup n'expose jamais de lien de confirmation", async () => {
    const tenantInsert = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'tenant-1' },
        error: null
      })
    }
    const profileQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      upsert: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { company: 'Acme', tagline: null, logo_url: null },
        error: null
      })
    }

    supabaseMock.auth.admin.createUser = jest.fn().mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'user@example.com' }
      },
      error: null
    })
    supabaseMock.auth.admin.getUserById.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'user@example.com',
          user_metadata: { company: 'Acme' }
        }
      },
      error: null
    })
    supabaseMock.auth.admin.generateLink.mockResolvedValue({
      data: { properties: { action_link: 'https://example.com/confirm' } },
      error: null
    })

    supabaseMock.from.mockImplementation((table) => {
      if (table === 'profiles') return profileQuery
      if (table === 'tenants') return tenantInsert
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      }
    })

    const response = await request(app).post('/api/auth/signup').send({
      email: 'user@example.com',
      password: 'Password123!',
      company: 'Acme'
    })

    expect(response.status).toBe(201)
    expect(response.body.emailVerificationSent).toBe(true)
    expect(response.body.verificationUrl).toBeUndefined()
  })
})
