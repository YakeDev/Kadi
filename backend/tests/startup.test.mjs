import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.SUPABASE_URL = 'http://127.0.0.1:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
process.env.NODE_ENV = 'test'
delete process.env.OPENAI_API_KEY
const { default: app } = await import('../app.js')
test('API starts without optional AI credentials and rejects anonymous business reads', async () => {
  const server = app.listen(0, '127.0.0.1')
  try {
    await new Promise((resolve) => server.once('listening', resolve))
    const url = `http://127.0.0.1:${server.address().port}`
    const health = await fetch(`${url}/api/health`)
    assert.equal(health.status, 200)
    for (const endpoint of ['invoices', 'clients', 'products', 'auth/profile']) {
      const response = await fetch(`${url}/api/${endpoint}`)
      assert.equal(response.status, 401)
    }
  } finally { await new Promise((resolve) => server.close(resolve)) }
})
