import { Router } from 'express'
import {
  signup,
  login,
  logout,
  createProfile,
  getProfile,
  resendVerificationEmail,
  requestPasswordReset,
  changePassword
} from '../controllers/authController.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { authRateLimit } from '../middleware/security.js'
import { exportAccountData, deletionStatus, requestDeletion, requestDeletionPublic, verifyDeletionRequest, cancelDeletionRequest } from '../controllers/accountLifecycleController.js'

const router = Router()

router.post('/signup', authRateLimit, signup)
router.post('/login', authRateLimit, login)
router.post('/logout', requireAuth, logout)
router.post('/profile', requireAuth, createProfile)
router.get('/profile', requireAuth, getProfile)
router.post('/resend-verification', authRateLimit, resendVerificationEmail)
router.post('/password/forgot', authRateLimit, requestPasswordReset)
router.post('/password/change', authRateLimit, requireAuth, changePassword)
router.get('/data-export', requireAuth, exportAccountData)
router.get('/deletion-request', requireAuth, deletionStatus)
router.post('/deletion-request', authRateLimit, requireAuth, requestDeletion)
router.post('/deletion-request/cancel', authRateLimit, requireAuth, cancelDeletionRequest)
router.post('/deletion-request/public', authRateLimit, requestDeletionPublic)
router.post('/deletion-request/verify', authRateLimit, verifyDeletionRequest)

export default router
