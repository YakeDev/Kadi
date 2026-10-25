import { vi as jest } from 'vitest'
import request from 'supertest'
import { gzipSync } from 'node:zlib'

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

    await jest.doMock('../models/supabaseClient.js', () => ({
      supabase: supabaseMock,
      createAuthClient: () => supabaseMock
    }))

    const module = await import('../app.js')
    app = module.default
  })

  test('rejects compressed JSON before parsing (body-parser decompression mitigation)', async () => {
    const body = gzipSync(Buffer.from(JSON.stringify({
      email: 'test@example.com',
      password: 'password123'
    })))
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'gzip')
      .send(body)

    expect(response.status).toBe(415)
    expect(supabaseMock.auth.signInWithPassword).not.toHaveBeenCalled()
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

    await jest.doMock('../models/supabaseClient.js', () => ({
      supabase: supabaseMock,
      createAuthClient: () => supabaseMock
    }))

    const module = await import('../app.js')
    const productionApp = module.default

    const response = await request(productionApp)
      .get('/api/health')
      .set('Origin', 'https://evil.example')

    expect(response.status).toBe(403)
    expect(response.body.message).toContain('CORS')
  })

  test('Android HTTPS loopback allows transport but never bypasses authentication', async () => {
    const preflight = await request(app).options('/api/auth/profile')
      .set('Origin', 'https://localhost').set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'Authorization')
    expect(preflight.status).toBe(204)
    expect(preflight.headers['access-control-allow-origin']).toBe('https://localhost')
    const anonymous = await request(app).get('/api/auth/profile').set('Origin', 'https://localhost')
    expect(anonymous.status).toBe(401)
    expect(supabaseMock.auth.getUser).not.toHaveBeenCalled()
    for (const origin of ['http://localhost', 'https://localhost.evil.example', 'https://evil.example']) {
      expect((await request(app).get('/api/health').set('Origin', origin)).status).toBe(403)
    }
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
  test('spoofed X-Forwarded-For headers cannot reset the login rate limit', async () => {
    for (const suffix of [1, 2]) {
      await request(app).post('/api/auth/login').set('X-Forwarded-For', `198.51.100.${suffix}`)
        .send({ email: 'user@example.com', password: 'password123' }).expect(200)
    }
    await request(app).post('/api/auth/login').set('X-Forwarded-For', '198.51.100.3')
      .send({ email: 'user@example.com', password: 'password123' }).expect(429)
  })

})
