import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { createRateLimiter } from '../middleware/rateLimit.js'
import { platformSession, requirePlatformAdmin, platformOverview } from '../controllers/platformController.js'
import { listDeletionRequests, reviewDeletionRequest, processDeletionRequest } from '../controllers/accountLifecycleController.js'

const router = Router()
const rateLimit = createRateLimiter({ name: 'platform', windowMs: 60_000, max: 30, message: 'Trop de requêtes. Réessayez dans une minute.', keyGenerator: req => req.user.id })
router.use(requireAuth, rateLimit)
router.post('/session', platformSession)
router.get('/overview', requirePlatformAdmin, platformOverview)
router.get('/deletion-requests', requirePlatformAdmin, listDeletionRequests)
router.post('/deletion-requests/:id/review', requirePlatformAdmin, reviewDeletionRequest)
router.post('/deletion-requests/:id/process', requirePlatformAdmin, processDeletionRequest)
export default router
