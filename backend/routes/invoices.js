import { Router } from 'express'
import {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  getSummary,
  getTodoItems,
  streamInvoicePdf
} from '../controllers/invoiceController.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

router.get('/', listInvoices)
router.get('/summary', getSummary)
router.get('/todo', getTodoItems)
router.get('/pdf/:id', streamInvoicePdf)
router.get('/:id', getInvoice)
router.post('/', createInvoice)
router.patch('/:id', updateInvoice)
router.delete('/:id', deleteInvoice)

export default router
