import { vi as jest, describe, test, expect, beforeEach } from 'vitest'

let database
let profileQuery
let requireAuth
beforeEach(async () => {
  jest.resetModules()
  profileQuery = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn()
  }
  database = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1', email: 'one@example.com' } }, error: null }) },
    from: jest.fn(() => profileQuery), rpc: jest.fn()
  }
  await jest.doMock('../models/supabaseClient.js', () => ({ supabase: database }))
  ;({ requireAuth } = await import('../middleware/requireAuth.js'))
})
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() })
describe('Authentication never provisions or reassigns an enterprise', () => {
  test('database errors fail closed without any write', async () => {
    profileQuery.maybeSingle.mockResolvedValue({ data: null, error: { code: '08006', message: 'temporary database outage' } })
    const next = jest.fn()
    await requireAuth({ headers: { authorization: 'Bearer token' } }, response(), next)
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 503 }))
    expect(database.from).toHaveBeenCalledTimes(1)
    expect(database.from).toHaveBeenCalledWith('profiles')
    expect(database.rpc).not.toHaveBeenCalled()
  })
  test('missing profile returns 403 without a new tenant', async () => {
    profileQuery.maybeSingle.mockResolvedValue({ data: null, error: null })
    const res = response()
    const next = jest.fn()
    await requireAuth({ headers: { authorization: 'Bearer token' } }, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
    expect(database.from).not.toHaveBeenCalledWith('tenants')
  })
})
