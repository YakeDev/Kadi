import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Facture from './pages/Facture.jsx'
import Clients from './pages/Clients.jsx'
import Navbar from './components/Navbar.jsx'
import { useAuth } from './hooks/useAuth.jsx'

const ProtectedLayout = ({ children }) => {
  const { session, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-neutre'>
        <p className='text-nuit'>Chargement en cours…</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to='/login' replace />
  }

  return (
    <div className='min-h-screen bg-neutre'>
      <Navbar />
      <main className='max-w-6xl mx-auto px-4 py-8'>{children}</main>
    </div>
  )
}

const App = () => {
  return (
    <>
      <Routes>
        <Route path='/login' element={<Login />} />
        <Route
          path='/'
          element={
            <ProtectedLayout>
              <Dashboard />
            </ProtectedLayout>
          }
        />
        <Route
          path='/factures'
          element={
            <ProtectedLayout>
              <Facture />
            </ProtectedLayout>
          }
        />
        <Route
          path='/clients'
          element={
            <ProtectedLayout>
              <Clients />
            </ProtectedLayout>
          }
        />
        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes>
      <Toaster position='top-right' />
    </>
  )
}

export default App
