import { Router } from 'express'
import { signup, login, logout, createProfile, getProfile } from '../controllers/authController.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

router.post('/signup', signup)
router.post('/login', login)
router.post('/logout', logout)
router.post('/profile', createProfile)
router.get('/profile', requireAuth, getProfile)

export default router
