import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

export default function ResetPassword() {
  const { session, isLoading, resetPassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const navigate = useNavigate()
  const submit = async (event) => {
    event.preventDefault()
    if (password.length < 8 || password !== confirmation) {
      setError('Utilisez au moins 8 caractères et deux mots de passe identiques.')
      return
    }
    setPending(true)
    setError('')
    try {
      await resetPassword(password)
      navigate('/login?passwordUpdated=1', { replace: true })
    } catch (failure) {
      setError(failure.message || 'Ce lien est expiré. Demandez un nouveau lien.')
    } finally { setPending(false) }
  }
  if (isLoading) return <p role='status' className='p-8'>Vérification du lien…</p>
  return (
    <main className='flex min-h-screen items-center justify-center bg-[var(--bg-base)] p-6'>
      <div className='card w-full max-w-md space-y-5 p-6'>
        <h1 className='text-xl font-semibold'>Nouveau mot de passe</h1>
        {!session ? (
          <p role='alert'>Ce lien est invalide, expiré ou déjà utilisé. Demandez un nouveau lien depuis la page de connexion.</p>
        ) : (
          <form onSubmit={submit} className='space-y-4'>
            <label className='block'>Nouveau mot de passe
              <input aria-label='Nouveau mot de passe' type='password' autoComplete='new-password' minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} className='input mt-2' />
            </label>
            <label className='block'>Confirmation
              <input aria-label='Confirmation' type='password' autoComplete='new-password' minLength={8} maxLength={128} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className='input mt-2' />
            </label>
            {error ? <p role='alert' className='text-sm text-red-600'>{error}</p> : null}
            <button type='submit' disabled={pending} className='btn-primary w-full justify-center'>
              {pending ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
            </button>
          </form>
        )}
        <Link to='/login' className='block text-sm underline'>Retour à la connexion</Link>
      </div>
    </main>
  )
}
