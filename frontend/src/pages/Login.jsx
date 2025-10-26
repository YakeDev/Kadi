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
        toast.success('Compte créé, vérifiez vos emails pour confirmer.')
        setIsRegister(false)
      } else {
        await login(form)
        toast.success('Bienvenue sur Kadi ✨')
      }
      setForm({ email: '', password: '', company: '' })
    } catch (error) {
      toast.error(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className='flex min-h-screen flex-col justify-center bg-neutre px-4'>
      <div className='mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm'>
        <div className='mb-6'>
          <span className='inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent/20 text-xl font-semibold text-accent'>
            K
          </span>
          <h1 className='mt-4 text-2xl font-semibold text-nuit'>Kadi</h1>
          <p className='text-sm text-slate-500'>
            {isRegister
              ? 'Créez votre compte pour gérer vos factures.'
              : 'Connectez-vous pour accéder à votre espace.'}
          </p>
        </div>
        <form onSubmit={handleSubmit} className='space-y-4'>
          {isRegister && (
            <div className='flex flex-col gap-2'>
              <label className='text-xs font-medium uppercase tracking-wide text-slate-500'>
                Nom de votre entreprise
              </label>
              <input
                name='company'
                value={form.company}
                onChange={handleChange}
                placeholder='Ex. Gocongo'
                className='rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-nuit focus:outline-none focus:ring-2 focus:ring-nuit/20'
                required
              />
            </div>
          )}
          <div className='flex flex-col gap-2'>
            <label className='text-xs font-medium uppercase tracking-wide text-slate-500'>Email</label>
            <input
              type='email'
              name='email'
              value={form.email}
              onChange={handleChange}
              placeholder='vous@entreprise.com'
              className='rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-nuit focus:outline-none focus:ring-2 focus:ring-nuit/20'
              required
            />
          </div>
          <div className='flex flex-col gap-2'>
            <label className='text-xs font-medium uppercase tracking-wide text-slate-500'>Mot de passe</label>
            <input
              type='password'
              name='password'
              value={form.password}
              onChange={handleChange}
              placeholder='••••••••'
              className='rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-nuit focus:outline-none focus:ring-2 focus:ring-nuit/20'
              required
              minLength={6}
            />
          </div>
          <button
            type='submit'
            disabled={isSubmitting}
            className='w-full rounded-2xl bg-nuit px-4 py-3 text-sm font-semibold text-white transition hover:bg-nuit/90 disabled:cursor-not-allowed disabled:bg-slate-400'
          >
            {isSubmitting ? 'Patientez…' : isRegister ? 'Créer mon compte' : 'Se connecter'}
          </button>
        </form>
        <div className='mt-6 text-center text-sm text-slate-500'>
          {isRegister ? 'Déjà un compte ?' : "Pas encore de compte ?"}{' '}
          <button
            onClick={() => setIsRegister((prev) => !prev)}
            className='font-semibold text-accent hover:text-accent/80'
          >
            {isRegister ? 'Se connecter' : "S'inscrire"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Login
