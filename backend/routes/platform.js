import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { createRateLimiter } from '../middleware/rateLimit.js'
import { platformSession, requirePlatformAdmin, platformOverview } from '../controllers/platformController.js'

const router = Router()
const rateLimit = createRateLimiter({ name: 'platform', windowMs: 60_000, max: 30, message: 'Trop de requêtes. Réessayez dans une minute.', keyGenerator: req => req.user.id })
router.use(requireAuth, rateLimit)
router.post('/session', platformSession)
router.get('/overview', requirePlatformAdmin, platformOverview)
export default router
