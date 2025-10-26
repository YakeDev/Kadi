import { Router } from 'express'
import { listProducts, createProduct, updateProduct, deleteProduct } from '../controllers/productController.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

router.get('/', listProducts)
router.post('/', createProduct)
router.patch('/:id', updateProduct)
router.delete('/:id', deleteProduct)

export default router
