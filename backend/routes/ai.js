import { Router } from 'express'
import { generateInvoiceFromText } from '../controllers/aiController.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

router.post('/facture', generateInvoiceFromText)

export default router
