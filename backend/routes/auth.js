import { Router } from 'express'
import { signup, login, logout, createProfile } from '../controllers/authController.js'

const router = Router()

router.post('/signup', signup)
router.post('/login', login)
router.post('/logout', logout)
router.post('/profile', createProfile)

export default router
