import { jest } from '@jest/globals'
import request from 'supertest'

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key'

describe('Validation des payloads métier', () => {
  let app
  let supabaseMock
  let profilesQuery

  beforeEach(async () => {
    jest.resetModules()

    profilesQuery = {
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

    const unexpectedTable = (table) => ({
      select: jest.fn(() => {
        throw new Error(`Unexpected select on ${table}`)
      }),
      insert: jest.fn(() => {
        throw new Error(`Unexpected insert on ${table}`)
      }),
      update: jest.fn(() => {
        throw new Error(`Unexpected update on ${table}`)
      }),
      delete: jest.fn(() => {
        throw new Error(`Unexpected delete on ${table}`)
      })
    })

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
        return unexpectedTable(table)
      })
    }

    await jest.unstable_mockModule('../models/supabaseClient.js', () => ({
      supabase: supabaseMock
    }))

    const module = await import('../app.js')
    app = module.default
  })

  test('rejects protected fields on client update', async () => {
    const response = await request(app)
      .patch('/api/clients/client-1')
      .set('Authorization', 'Bearer token')
      .send({
        tenant_id: 'tenant-2'
      })

    expect(response.status).toBe(400)
    expect(response.body.message).toContain('protégés')
    expect(supabaseMock.from).not.toHaveBeenCalledWith('clients')
  })

  test('rejects protected fields on invoice update', async () => {
    const response = await request(app)
      .patch('/api/invoices/invoice-1')
      .set('Authorization', 'Bearer token')
      .send({
        total_amount: 999999
      })

    expect(response.status).toBe(400)
    expect(response.body.message).toContain('protégés')
    expect(supabaseMock.from).not.toHaveBeenCalledWith('invoices')
  })

  test('rejects manual invoice number on invoice creation', async () => {
    const response = await request(app)
      .post('/api/invoices')
      .set('Authorization', 'Bearer token')
      .send({
        invoice_number: 'FAC-MANUAL-1',
        items: [{ description: 'Audit', quantity: 1, unitPrice: 100 }]
      })

    expect(response.status).toBe(400)
    expect(response.body.message).toContain('protégés')
    expect(supabaseMock.from).not.toHaveBeenCalledWith('invoices')
  })
})

describe("Génération d'identifiant de facture", () => {
  test('returns a strong server-side invoice number format', async () => {
    const { generateInvoiceNumber } = await import('../utils/validation.js')

    const first = generateInvoiceNumber()
    const second = generateInvoiceNumber()

    expect(first).toMatch(/^FAC-\d{8}-[A-F0-9]{8}$/)
    expect(second).toMatch(/^FAC-\d{8}-[A-F0-9]{8}$/)
    expect(first).not.toBe(second)
  })
})
