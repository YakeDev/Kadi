import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Login from './pages/Login.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Facture from './pages/Facture.jsx'
import InvoiceCreate from './pages/InvoiceCreate.jsx'
import Quotes from './pages/Quotes.jsx'
import QuoteDetail from './pages/QuoteDetail.jsx'
import Catalogue from './pages/Catalogue.jsx'
import Clients from './pages/Clients.jsx'
import Company from './pages/Company.jsx'
import PlatformAdmin from './pages/PlatformAdmin.jsx'
import { AboutPage, PrivacyPage, TermsPage } from './pages/InformationPages.jsx'
import DeletionRequestPage from './pages/DeletionRequestPage.jsx'
import { useAuth } from './hooks/useAuth.jsx'
import ShellLayout from './components/ShellLayout.jsx'
import NativeRuntime from './components/NativeRuntime.jsx'

const ProtectedLayout = ({ children }) => {
  const { session, isLoading, isPasswordRecovery } = useAuth()

  if (isLoading) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-[var(--bg-base)] text-[var(--text-muted)]'>
        <p>Chargement en cours…</p>
      </div>
    )
  }

  if (isPasswordRecovery) return <Navigate to='/reset-password' replace />

  if (!session) {
    return <Navigate to='/login' replace />
  }

  return <ShellLayout>{children}</ShellLayout>
}

const App = () => {
  return (
    <>
      <NativeRuntime />
      <Routes>
        <Route path='/login' element={<Login />} />
        <Route path='/a-propos' element={<AboutPage />} />
        <Route path='/conditions-utilisation' element={<TermsPage />} />
        <Route path='/confidentialite' element={<PrivacyPage />} />
        <Route path='/suppression-compte' element={<DeletionRequestPage />} />
        <Route path='/reset-password' element={<ResetPassword />} />
        <Route path='/administration' element={<ProtectedLayout><PlatformAdmin /></ProtectedLayout>} />
        <Route path='/devis' element={<ProtectedLayout><Quotes /></ProtectedLayout>} />
        <Route path='/devis/nouveau' element={<ProtectedLayout><InvoiceCreate documentType='quote' /></ProtectedLayout>} />
        <Route path='/devis/:id' element={<ProtectedLayout><QuoteDetail /></ProtectedLayout>} />
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
          path='/factures/nouvelle'
          element={
            <ProtectedLayout>
              <InvoiceCreate />
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
      <Toaster position='top-right' containerStyle={{ top: 'calc(16px + var(--native-top, 0px))' }} />
    </>
  )
}

export default App
