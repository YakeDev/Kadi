import { Router } from 'express'
import { listClients, getClient, createClient, updateClient, deleteClient } from '../controllers/clientController.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

router.use(requireAuth)

router.get('/', listClients)
router.get('/:id', getClient)
router.post('/', createClient)
router.patch('/:id', updateClient)
router.delete('/:id', deleteClient)

export default router
