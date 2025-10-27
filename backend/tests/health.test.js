import request from 'supertest'

let app

beforeAll(async () => {
  const module = await import('../app.js')
  app = module.default
})

describe('Healthcheck', () => {
  test('GET /api/health returns operational status', async () => {
    const response = await request(app).get('/api/health').expect(200)
    expect(response.body).toEqual(
      expect.objectContaining({
        status: 'ok',
        service: 'kadi-backend'
      })
    )
    expect(new Date(response.body.time).toString()).not.toBe('Invalid Date')
  })
})
