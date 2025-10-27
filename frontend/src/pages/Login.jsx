import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth.jsx'
import { uploadCompanyLogo, supabase } from '../services/supabase.js'
import { showErrorToast } from '../utils/errorToast.js'

const INITIAL_FORM = {
  email: '',
  password: '',
  company: '',
  manager_name: '',
  address: '',
  city: '',
  state: '',
  tagline: '',
  national_id: '',
  rccm: '',
  nif: ''
}

const Login = () => {
  const { login, signup, session, updateProfile } = useAuth()
  const [isRegister, setIsRegister] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState(() => ({ ...INITIAL_FORM }))
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [logoError, setLogoError] = useState('')

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  useEffect(() => {
    return () => {
      if (logoPreview && logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview)
      }
    }
  }, [logoPreview])

  useEffect(() => {
    if (!isRegister) {
      if (logoPreview && logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview)
      }
      setLogoPreview('')
      setLogoFile(null)
      setLogoError('')
    }
  }, [isRegister])

  const shouldRedirect = Boolean(session)

  const handleLogoChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setLogoError('Veuillez sélectionner une image (PNG ou JPG).')
      return
    }
    if (file.size > 1024 * 1024) {
      setLogoError('Logo trop volumineux (1 Mo max).')
      return
    }
    if (logoPreview && logoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(logoPreview)
    }
    setLogoError('')
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      const trimmedEmail = form.email.trim()
      if (!trimmedEmail) {
        toast.error('Veuillez renseigner une adresse email valide.', { icon: '⚠️' })
        return
      }

      if (isRegister) {
        const trimmedCompany = form.company.trim()
        if (!trimmedCompany) {
          toast.error("Le nom de l'entreprise est obligatoire.", { icon: '⚠️' })
          return
        }

        await signup({
          ...form,
          email: trimmedEmail,
          company: trimmedCompany,
          password: form.password
        })

        if (logoFile) {
          try {
            const {
              data: { user: currentUser }
            } = await supabase.auth.getUser()
            if (currentUser) {
              const uploadedUrl = await uploadCompanyLogo(logoFile, currentUser.id)
              await updateProfile({ logo_url: uploadedUrl })
            }
          } catch (error) {
            console.error('Logo upload error', error)
            toast.error("Le logo n'a pas pu être enregistré", { icon: '⚠️' })
          } finally {
            if (logoPreview && logoPreview.startsWith('blob:')) {
              URL.revokeObjectURL(logoPreview)
            }
            setLogoFile(null)
            setLogoPreview('')
          }
        }

        toast.success('Compte créé, vérifiez vos emails pour confirmer.', { icon: '✅' })
        setIsRegister(false)
      } else {
        await login({ email: trimmedEmail, password: form.password })
        toast.success('Bienvenue sur Kadi ✨', { icon: '🙌' })
      }
      setForm({ ...INITIAL_FORM })
    } catch (error) {
      showErrorToast(toast.error, error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (shouldRedirect) {
    return <Navigate to='/' replace />
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
            <div className='space-y-4'>
              <div className='flex flex-col gap-2'>
                <label className='label'>Nom de votre entreprise</label>
                <input
                  name='company'
                  value={form.company}
                  onChange={handleChange}
                  placeholder='Ex. Gocongo'
                  className='input'
                  required
                />
              </div>

              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='flex flex-col gap-2'>
                  <label className='label'>Responsable</label>
                  <input
                    name='manager_name'
                    value={form.manager_name}
                    onChange={handleChange}
                    placeholder='Nom du gestionnaire'
                    className='input'
                  />
                </div>
                <div className='flex flex-col gap-2'>
                  <label className='label'>Tagline (optionnel)</label>
                  <input
                    name='tagline'
                    value={form.tagline}
                    onChange={handleChange}
                    placeholder='Ex. Facturation simple pour PME'
                    className='input'
                  />
                </div>
              </div>

              <div className='flex flex-col gap-2'>
                <label className='label'>Adresse</label>
                <textarea
                  name='address'
                  value={form.address}
                  onChange={handleChange}
                  placeholder='Adresse complète de l’entreprise'
                  className='textarea min-h-[90px]'
                />
              </div>

              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='flex flex-col gap-2'>
                  <label className='label'>Ville</label>
                  <input
                    name='city'
                    value={form.city}
                    onChange={handleChange}
                    placeholder='Kinshasa'
                    className='input'
                  />
                </div>
                <div className='flex flex-col gap-2'>
                  <label className='label'>État / Province</label>
                  <input
                    name='state'
                    value={form.state}
                    onChange={handleChange}
                    placeholder='Kongo Central'
                    className='input'
                  />
                </div>
              </div>

              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='flex flex-col gap-2'>
                  <label className='label'>ID. Nat. (optionnel)</label>
                  <input
                    name='national_id'
                    value={form.national_id}
                    onChange={handleChange}
                    placeholder='ID nat. de l’entreprise'
                    className='input'
                  />
                </div>
                <div className='flex flex-col gap-2'>
                  <label className='label'>RCCM (optionnel)</label>
                  <input
                    name='rccm'
                    value={form.rccm}
                    onChange={handleChange}
                    placeholder='RCCM'
                    className='input'
                  />
                </div>
              </div>

              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='flex flex-col gap-2'>
                  <label className='label'>NIF (optionnel)</label>
                  <input
                    name='nif'
                    value={form.nif}
                    onChange={handleChange}
                    placeholder='Numéro d’impôt'
                    className='input'
                  />
                </div>
              </div>

              <div className='flex flex-col gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[rgba(15,23,42,0.02)] p-4'>
                <p className='label'>Logo (optionnel)</p>
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt='Aperçu du logo'
                    className='h-24 w-24 self-start rounded-[var(--radius-md)] object-contain shadow-soft'
                  />
                ) : (
                  <p className='text-xs text-[var(--text-muted)]'>PNG ou JPG · 1&nbsp;Mo max.</p>
                )}
                <label className='btn-ghost h-9 cursor-pointer self-start px-4 text-xs font-semibold'>
                  Importer un logo
                  <input type='file' accept='image/*' className='hidden' onChange={handleLogoChange} />
                </label>
                {logoError ? <p className='text-xs text-red-500'>{logoError}</p> : null}
              </div>
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
