import { jest } from '@jest/globals'
import request from 'supertest'

describe('Backend security hardening', () => {
  let app
  let supabaseMock

  beforeEach(async () => {
    jest.resetModules()

    process.env.ALLOWED_ORIGINS = 'https://app.example.com'
    process.env.AUTH_RATE_LIMIT_MAX = '2'
    process.env.AUTH_RATE_LIMIT_WINDOW_MS = '60000'
    process.env.JSON_BODY_LIMIT = '2mb'
    process.env.NODE_ENV = 'test'

    supabaseMock = {
      auth: {
        getUser: jest.fn(),
        signInWithPassword: jest.fn().mockResolvedValue({
          data: { session: { access_token: 'token' } },
          error: null
        }),
        signOut: jest.fn(),
        admin: {
          generateLink: jest.fn(),
          getUserById: jest.fn()
        }
      },
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      }))
    }

    await jest.unstable_mockModule('../models/supabaseClient.js', () => ({
      supabase: supabaseMock
    }))

    const module = await import('../app.js')
    app = module.default
  })

  test('adds helmet security headers on health endpoint', async () => {
    const response = await request(app).get('/api/health').expect(200)

    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN')
  })

  test('returns 403 for cross-origin browser requests not allowlisted in production', async () => {
    jest.resetModules()
    process.env.NODE_ENV = 'production'
    process.env.ALLOWED_ORIGINS = ''

    await jest.unstable_mockModule('../models/supabaseClient.js', () => ({
      supabase: supabaseMock
    }))

    const module = await import('../app.js')
    const productionApp = module.default

    const response = await request(productionApp)
      .get('/api/health')
      .set('Origin', 'https://evil.example')

    expect(response.status).toBe(403)
    expect(response.body.message).toContain('CORS')
  })

  test('rate limits repeated login attempts', async () => {
    await request(app).post('/api/auth/login').send({
      email: 'user@example.com',
      password: 'password123'
    })

    await request(app).post('/api/auth/login').send({
      email: 'user@example.com',
      password: 'password123'
    })

    const response = await request(app).post('/api/auth/login').send({
      email: 'user@example.com',
      password: 'password123'
    })

    expect(response.status).toBe(429)
    expect(response.body.message).toContain('tentatives')
    expect(response.headers['retry-after']).toBeDefined()
  })
})
