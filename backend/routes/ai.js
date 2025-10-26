import { Router } from 'express'
import { generateInvoiceFromText } from '../controllers/aiController.js'

const router = Router()

router.post('/facture', generateInvoiceFromText)

export default router
