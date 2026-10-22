import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.SUPABASE_URL = 'https://test-project.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'
const requests = []
const previousFetch = globalThis.fetch
const token = (email) => `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: email, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`
globalThis.fetch = async (url, options) => {
  requests.push({ url: String(url), authorization: new Headers(options?.headers).get('Authorization') })
  if (String(url).includes('/auth/v1/token')) {
    const { email } = JSON.parse(options.body)
    return new Response(JSON.stringify({ access_token: token(email), refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600,
      user: { id: email, email, aud: 'authenticated', role: 'authenticated' } }), { headers: { 'Content-Type': 'application/json' } })
  }
  return new Response('[]', { headers: { 'Content-Type': 'application/json' } })
}
const { supabase, createAuthClient } = await import('../models/supabaseClient.js')

test('signing in on request-scoped clients cannot change the admin database identity', async () => {
  try {
    await Promise.all(['one@example.com', 'two@example.com'].map(async (email) => {
      const client = createAuthClient()
      const { error } = await client.auth.signInWithPassword({ email, password: 'test-password' })
      assert.equal(error, null)
    }))
    await supabase.from('clients').select('*')
    assert.equal(requests.at(-1).authorization, 'Bearer test-service-key')
    assert.equal((await supabase.auth.getSession()).data.session, null)
    assert.equal(requests.filter((request) => request.url.includes('/auth/v1/token')).length, 2)
  } finally { globalThis.fetch = previousFetch }
})
