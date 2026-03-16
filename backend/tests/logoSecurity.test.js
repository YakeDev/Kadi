import { jest } from '@jest/globals'
import request from 'supertest'

import { downloadStoredLogoBuffer, normalizeLogoStoragePath } from '../utils/logoStorage.js'

describe('Sécurité des logos', () => {
  test("rejects external logo urls for profile updates", async () => {
    jest.resetModules()

    const profilesQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          tenant_id: 'tenant-1',
          company: 'Acme',
          email: 'user@example.com'
        },
        error: null
      }),
      upsert: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          company: 'Acme',
          logo_url: null
        },
        error: null
      })
    }

    const supabaseMock = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: 'user-1',
              email: 'user@example.com',
              user_metadata: { company: 'Acme' }
            }
          },
          error: null
        }),
        admin: {
          getUserById: jest.fn().mockResolvedValue({
            data: {
              user: {
                id: 'user-1',
                email: 'user@example.com',
                user_metadata: { company: 'Acme' }
              }
            },
            error: null
          }),
          generateLink: jest.fn()
        },
        signInWithPassword: jest.fn(),
        signOut: jest.fn()
      },
      from: jest.fn((table) => {
        if (table === 'profiles') {
          return profilesQuery
        }

        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          single: jest.fn().mockResolvedValue({ data: null, error: null })
        }
      }),
      storage: {
        from: jest.fn()
      }
    }

    await jest.unstable_mockModule('../models/supabaseClient.js', () => ({
      supabase: supabaseMock
    }))

    const module = await import('../app.js')
    const app = module.default

    const response = await request(app)
      .post('/api/auth/profile')
      .set('Authorization', 'Bearer token')
      .send({
        company: 'Acme',
        logo_url: 'https://evil.example/logo.png'
      })

    expect(response.status).toBe(400)
    expect(response.body.message).toContain('stockage sécurisé')
    expect(profilesQuery.upsert).not.toHaveBeenCalled()
  })

  test('normalizes only private storage paths for the current user', () => {
    expect(() => normalizeLogoStoragePath('https://evil.example/logo.png', 'user-1')).toThrow(
      'stockage sécurisé'
    )
    expect(() => normalizeLogoStoragePath('user-2/logo.png', 'user-1')).toThrow(
      'appartenir à votre espace'
    )
    expect(normalizeLogoStoragePath('user-1/logo.png', 'user-1')).toBe('user-1/logo.png')
  })

  test('does not download external logo references', async () => {
    const from = jest.fn(() => ({
      download: jest.fn()
    }))
    const supabaseMock = {
      storage: { from }
    }

    const buffer = await downloadStoredLogoBuffer(supabaseMock, 'https://evil.example/logo.png')

    expect(buffer).toBeNull()
    expect(from).not.toHaveBeenCalled()
  })

  test("does not download another user's logo path", async () => {
    const from = jest.fn(() => ({
      download: jest.fn()
    }))
    const supabaseMock = {
      storage: { from }
    }

    const buffer = await downloadStoredLogoBuffer(supabaseMock, 'user-2/logo.png', {
      userId: 'user-1'
    })

    expect(buffer).toBeNull()
    expect(from).not.toHaveBeenCalled()
  })

  test('downloads logo bytes from storage without fetch', async () => {
    const download = jest.fn().mockResolvedValue({
      data: {
        arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer
      },
      error: null
    })
    const from = jest.fn(() => ({ download }))
    const supabaseMock = {
      storage: { from }
    }

    const buffer = await downloadStoredLogoBuffer(supabaseMock, 'user-1/logo.png')

    expect(from).toHaveBeenCalled()
    expect(download).toHaveBeenCalledWith('user-1/logo.png')
    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(Array.from(buffer)).toEqual([1, 2, 3, 4])
  })
})
