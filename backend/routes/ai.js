import { Router } from 'express'
import { generateInvoiceFromText } from '../controllers/aiController.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { aiRateLimit } from '../middleware/security.js'

const router = Router()

router.use(requireAuth)

router.post('/facture', aiRateLimit, generateInvoiceFromText)

export default router
