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

const router = Router()

router.post('/signup', signup)
router.post('/login', login)
router.post('/logout', logout)
router.post('/profile', requireAuth, createProfile)
router.get('/profile', requireAuth, getProfile)
router.post('/resend-verification', resendVerificationEmail)
router.post('/password/forgot', requestPasswordReset)
router.post('/password/change', requireAuth, changePassword)

export default router
