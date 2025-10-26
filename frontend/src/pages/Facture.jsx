import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import InvoiceForm from '../components/InvoiceForm.jsx'
import InvoiceList from '../components/InvoiceList.jsx'
import { api } from '../services/api.js'

const Facture = () => {
  const [clients, setClients] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)

  const fetchClients = async () => {
    try {
      const { data } = await api.get('/clients')
      setClients(data)
    } catch (error) {
      toast.error(error.message)
    }
  }

  useEffect(() => {
    fetchClients()
  }, [])

  return (
    <div className='space-y-8'>
      <InvoiceForm
        clients={clients}
        onCreated={() => setRefreshKey((prev) => prev + 1)}
        defaultClientId={clients[0]?.id}
      />
      <InvoiceList refreshKey={refreshKey} />
    </div>
  )
}

export default Facture
