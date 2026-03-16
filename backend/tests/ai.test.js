import { jest } from '@jest/globals'
import request from 'supertest'

describe('AI invoice generation', () => {
  let app
  let supabaseMock
  let mockCreate

  beforeEach(async () => {
    jest.resetModules()

    process.env.OPENAI_API_KEY = 'test-key'
    process.env.OPENAI_PROMPT_MAX_CHARS = '20'
    process.env.AI_RATE_LIMIT_MAX = '10'
    process.env.AI_RATE_LIMIT_WINDOW_MS = '60000'

    mockCreate = jest.fn()

    await jest.unstable_mockModule('openai', () => ({
      default: class OpenAI {
        constructor() {
          this.chat = {
            completions: {
              create: mockCreate
            }
          }
        }
      }
    }))

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
      })
    }

    supabaseMock = {
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
        signInWithPassword: jest.fn(),
        signOut: jest.fn(),
        admin: {
          generateLink: jest.fn(),
          getUserById: jest.fn()
        }
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
      })
    }

    await jest.unstable_mockModule('../models/supabaseClient.js', () => ({
      supabase: supabaseMock
    }))

    const module = await import('../app.js')
    app = module.default
  })

  test('rejects prompts that exceed configured max length', async () => {
    const response = await request(app)
      .post('/api/ai/facture')
      .set('Authorization', 'Bearer token')
      .send({
        texte: 'Ce prompt est volontairement bien trop long.'
      })

    expect(response.status).toBe(400)
    expect(response.body.message).toContain('limite autorisée')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  test('returns a normalized invoice payload from OpenAI response', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              clientId: 'client-1',
              status: 'draft',
              notes: 'Merci',
              currency: 'usd',
              items: [{ name: 'Audit', qty: 2, unit_price: 50 }]
            })
          }
        }
      ]
    })

    const response = await request(app)
      .post('/api/ai/facture')
      .set('Authorization', 'Bearer token')
      .send({
        texte: 'Audit x2'
      })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      client_id: 'client-1',
      issue_date: null,
      due_date: null,
      status: 'draft',
      notes: 'Merci',
      items: [
        {
          description: 'Audit',
          quantity: 2,
          unitPrice: 50,
          currency: 'usd'
        }
      ],
      currency: 'usd'
    })
  })
})
