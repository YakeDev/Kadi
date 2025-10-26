import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Facture from './pages/Facture.jsx'
import Catalogue from './pages/Catalogue.jsx'
import Clients from './pages/Clients.jsx'
import Company from './pages/Company.jsx'
import { useAuth } from './hooks/useAuth.jsx'
import ShellLayout from './components/ShellLayout.jsx'

const ProtectedLayout = ({ children }) => {
  const { session, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-[var(--bg-base)] text-[var(--text-muted)]'>
        <p>Chargement en cours…</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to='/login' replace />
  }

  return <ShellLayout>{children}</ShellLayout>
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
          path='/catalogue'
          element={
            <ProtectedLayout>
              <Catalogue />
            </ProtectedLayout>
          }
        />
        <Route
          path='/entreprise'
          element={
            <ProtectedLayout>
              <Company />
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
