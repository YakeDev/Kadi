import { vi as jest } from 'vitest'
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

    await jest.doMock('../models/supabaseClient.js', () => ({
      supabase: supabaseMock,
      createAuthClient: () => supabaseMock
    }))

    const module = await import('../app.js')
    app = module.default
  })

  test('creates clients with optional text identifiers scoped to the authenticated tenant', async () => {
    const clients = {
      insert: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'client-1', nif: '000123' }, error: null })
    }
    supabaseMock.from.mockImplementation(table => table === 'clients' ? clients : profilesQuery)
    const response = await request(app).post('/api/clients').set('Authorization', 'Bearer token')
      .send({ company_name: ' Acme ', nif: ' 000123 ', national_id: ' 01-ABC ', rccm: '' })
    expect(response.status).toBe(201)
    expect(clients.insert).toHaveBeenCalledWith({ company_name: 'Acme', nif: '000123', national_id: '01-ABC', rccm: null, tenant_id: 'tenant-1' })
  })

  test('clears an identifier with a tenant-scoped update and leaves omitted fields unchanged', async () => {
    const clients = {
      update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'client-1', nif: null }, error: null })
    }
    supabaseMock.from.mockImplementation(table => table === 'clients' ? clients : profilesQuery)
    const response = await request(app).patch('/api/clients/client-1').set('Authorization', 'Bearer token').send({ nif: '' })
    expect(response.status).toBe(200)
    expect(clients.update).toHaveBeenCalledWith({ nif: null })
    expect(clients.eq).toHaveBeenCalledWith('id', 'client-1')
    expect(clients.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1')
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
