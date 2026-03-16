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

const router = Router()

router.post('/signup', authRateLimit, signup)
router.post('/login', authRateLimit, login)
router.post('/logout', logout)
router.post('/profile', requireAuth, createProfile)
router.get('/profile', requireAuth, getProfile)
router.post('/resend-verification', authRateLimit, resendVerificationEmail)
router.post('/password/forgot', authRateLimit, requestPasswordReset)
router.post('/password/change', authRateLimit, requireAuth, changePassword)

export default router
