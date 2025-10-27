import { jest } from '@jest/globals'
import request from 'supertest'

describe('Auth login', () => {
  let app
  let supabaseMock

  beforeEach(async () => {
    jest.resetModules()
    supabaseMock = {
      auth: {
        signInWithPassword: jest.fn()
      }
    }

    await jest.unstable_mockModule('../models/supabaseClient.js', () => ({
      supabase: supabaseMock
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
})
