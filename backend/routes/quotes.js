import { Router } from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { pdfRateLimit } from '../middleware/security.js'
import { listQuotes,getQuote,createQuote,updateQuote,convertQuote,streamQuotePdf } from '../controllers/quoteController.js'
const router=Router()
router.use(requireAuth)
router.get('/',listQuotes)
router.get('/pdf/:id',pdfRateLimit,streamQuotePdf)
router.get('/:id',getQuote)
router.post('/',createQuote)
router.patch('/:id',updateQuote)
router.post('/:id/convert',convertQuote)
export default router
