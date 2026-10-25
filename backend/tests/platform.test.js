import { beforeEach, expect, test, vi } from 'vitest'
import request from 'supertest'
import { adminPeriod } from '../utils/adminPeriod.js'
let app, database, user, allowed
beforeEach(async()=>{
  vi.resetModules();allowed=false
  user={id:'session-user',email_confirmed_at:'2026-01-01',user_metadata:{is_super_admin:true,platform_role:'super_admin'}}
  const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),maybeSingle:vi.fn(async()=>({data:{tenant_id:'tenant-one',company:'A'},error:null}))}
  database={auth:{getUser:vi.fn(async()=>({data:{user},error:null}))},from:vi.fn(()=>query),rpc:vi.fn(async name=>({data:name==='kadi_platform_admin_status'?allowed:name==='kadi_platform_session'?{is_super_admin:allowed}:{totals:{companies:7},daily:[]},error:null}))}
  vi.doMock('../models/supabaseClient.js',()=>({supabase:database,createAuthClient:()=>database}))
  app=(await import('../app.js')).default
})
test('anonymous and ordinary accounts cannot access global statistics, even with forged metadata',async()=>{
  expect((await request(app).get('/api/platform/overview')).status).toBe(401)
  const response=await request(app).get('/api/platform/overview').set('Authorization','Bearer token')
  expect(response.status).toBe(403)
  expect(database.rpc).not.toHaveBeenCalledWith('kadi_platform_overview',expect.anything())
})
test('statistics use the authenticated actor and prohibit public caching',async()=>{
  allowed=true
  const response=await request(app).get('/api/platform/overview?from=2026-01-01&to=2026-01-03').set('Authorization','Bearer token')
  expect(response.status).toBe(200)
  expect(database.rpc).toHaveBeenCalledWith('kadi_platform_overview',{p_actor_id:'session-user',p_from:'2026-01-01',p_to:'2026-01-03'})
  expect(response.headers['cache-control']).toBe('private, no-store')
  expect(response.headers.vary).toContain('Authorization')
})
test('session activity ignores caller-supplied identity and never writes a grant',async()=>{
  const response=await request(app).post('/api/platform/session').set('Authorization','Bearer token').send({actor_id:'someone-else',is_super_admin:true})
  expect(response.status).toBe(200);expect(response.body).toEqual({is_super_admin:false})
  expect(database.rpc).toHaveBeenCalledWith('kadi_platform_session',{p_actor_id:'session-user'})
})
test('an unconfirmed account and unavailable permission checks fail closed',async()=>{
  allowed=true;user.email_confirmed_at=null
  expect((await request(app).get('/api/platform/overview').set('Authorization','Bearer token')).status).toBe(403)
  user.email_confirmed_at='2026-01-01';database.rpc.mockResolvedValue({data:null,error:new Error('DB down')})
  expect((await request(app).get('/api/platform/overview').set('Authorization','Bearer token')).status).toBe(503)
})
test('invalid or unbounded date ranges cannot reach the global aggregation RPC',async()=>{
  allowed=true
  for(const params of ['from=0000-01-01','from=2026-02-30','from=2026-01-03&to=2026-01-01','from=2024-01-01&to=2026-01-01','to=2099-01-01','actor_id=other']){
    expect((await request(app).get('/api/platform/overview?'+params).set('Authorization','Bearer token')).status).toBe(400)
  }
  expect(database.rpc).not.toHaveBeenCalledWith('kadi_platform_overview',expect.anything())
  expect(adminPeriod({},'2026-01-30')).toEqual({from:'2026-01-01',to:'2026-01-30'})
})
