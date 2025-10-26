import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth.jsx'

const Login = () => {
  const { login, signup, session } = useAuth()
  const [isRegister, setIsRegister] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    email: '',
    password: '',
    company: ''
  })

  if (session) {
    return <Navigate to='/' replace />
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      if (isRegister) {
        await signup(form)
        toast.success('Compte créé, vérifiez vos emails pour confirmer.', { icon: '✅' })
        setIsRegister(false)
      } else {
        await login(form)
        toast.success('Bienvenue sur Kadi ✨', { icon: '🙌' })
      }
      setForm({ email: '', password: '', company: '' })
    } catch (error) {
      toast.error(error.message, { icon: '⚠️' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className='flex min-h-screen flex-col justify-center bg-[var(--bg-base)] px-4 py-6'>
      <div className='surface mx-auto w-full max-w-md p-10 shadow-card'>
        <div className='mb-6'>
          <span className='inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xl font-semibold text-[var(--primary)] shadow-soft'>
            K
          </span>
          <h1 className='mt-4 text-2xl font-semibold text-[var(--text-dark)]'>Kadi</h1>
          <p className='text-sm text-[var(--text-muted)]'>
            {isRegister
              ? 'Créez votre compte pour gérer vos factures.'
              : 'Connectez-vous pour accéder à votre espace.'}
          </p>
        </div>
        <form onSubmit={handleSubmit} className='space-y-4'>
          {isRegister && (
            <div className='flex flex-col gap-2'>
              <label className='label'>
                Nom de votre entreprise
              </label>
              <input
                name='company'
                value={form.company}
                onChange={handleChange}
                placeholder='Ex. Gocongo'
                className='input'
                required
              />
            </div>
          )}
          <div className='flex flex-col gap-2'>
            <label className='label'>Email</label>
            <input
              type='email'
              name='email'
              value={form.email}
              onChange={handleChange}
              placeholder='vous@entreprise.com'
              className='input'
              required
            />
          </div>
          <div className='flex flex-col gap-2'>
            <label className='label'>Mot de passe</label>
            <input
              type='password'
              name='password'
              value={form.password}
              onChange={handleChange}
              placeholder='••••••••'
              className='input'
              required
              minLength={6}
            />
          </div>
          <button
            type='submit'
            disabled={isSubmitting}
            className='btn-primary w-full justify-center'
          >
            {isSubmitting ? 'Patientez…' : isRegister ? 'Créer mon compte' : 'Se connecter'}
          </button>
        </form>
        <div className='mt-6 text-center text-sm text-[var(--text-muted)]'>
          {isRegister ? 'Déjà un compte ?' : "Pas encore de compte ?"}{' '}
          <button
            onClick={() => setIsRegister((prev) => !prev)}
            className='font-semibold text-[var(--primary)] hover:underline'
          >
            {isRegister ? 'Se connecter' : "S'inscrire"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Login
