import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Loader2,
  MailCheck,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Users
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth.jsx'
import { showErrorToast } from '../utils/errorToast.js'

const ACCOUNT_INITIAL = {
  email: '',
  password: '',
  confirmPassword: ''
}

const COMPANY_INITIAL = {
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

const Steps = {
  LOGIN: 'login',
  ACCOUNT: 'register-account',
  COMPANY: 'register-company',
  SUCCESS: 'register-success'
}

const MAX_LOGO_SIZE_BYTES = 1024 * 1024 // 1 MB

const evaluatePasswordStrength = (password = '') => {
  const tests = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password)
  }

  const score = Object.values(tests).filter(Boolean).length

  if (!password) {
    return {
      score: 0,
      label: 'Commencez à saisir votre mot de passe',
      color: 'bg-[var(--border)]',
      textColor: 'text-[var(--text-muted)]',
      tests
    }
  }

  if (score <= 2) {
    return {
      score,
      label: 'Mot de passe trop faible',
      color: 'bg-red-500',
      textColor: 'text-red-500',
      tests
    }
  }

  if (score === 3) {
    return {
      score,
      label: 'Mot de passe correct',
      color: 'bg-amber-500',
      textColor: 'text-amber-500',
      tests
    }
  }

  if (score === 4) {
    return {
      score,
      label: 'Mot de passe solide',
      color: 'bg-emerald-500',
      textColor: 'text-emerald-500',
      tests
    }
  }

  return {
    score,
    label: 'Mot de passe excellent',
    color: 'bg-blue-500',
    textColor: 'text-blue-500',
    tests
  }
}

const passwordRequirements = [
  { test: (pwd) => pwd.length >= 8, label: '8 caractères minimum' },
  { test: (pwd) => /[A-Z]/.test(pwd), label: '1 lettre majuscule' },
  { test: (pwd) => /[a-z]/.test(pwd), label: '1 lettre minuscule' },
  { test: (pwd) => /[0-9]/.test(pwd), label: '1 chiffre' },
  { test: (pwd) => /[^A-Za-z0-9]/.test(pwd), label: '1 caractère spécial' }
]

const trimOrNull = (value) => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

const RegistrationStepper = ({ currentStep }) => {
  const steps = [
    { id: Steps.ACCOUNT, label: 'Compte' },
    { id: Steps.COMPANY, label: 'Entreprise' }
  ]

  return (
    <div className='mb-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]'>
      {steps.map((step, index) => {
        const isActive = currentStep === step.id
        const isCompleted =
          steps.findIndex((entry) => entry.id === currentStep) > index
        return (
          <div key={step.id} className='flex items-center gap-2'>
            <div
              className={[
                'flex h-8 w-8 items-center justify-center rounded-full border text-[11px]',
                isCompleted
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                  : isActive
                    ? 'border-[var(--primary)] text-[var(--primary)]'
                    : 'border-[var(--border)] text-[var(--text-muted)]'
              ].join(' ')}
            >
              {index + 1}
            </div>
            <span
              className={
                isActive || isCompleted ? 'text-[var(--text-dark)]' : undefined
              }
            >
              {step.label}
            </span>
            {index < steps.length - 1 ? (
              <div className='h-[1px] w-10 bg-[var(--border)]' />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

const Login = () => {
  const { login, signup, session } = useAuth()

  const [view, setView] = useState(Steps.LOGIN)

  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [loginErrors, setLoginErrors] = useState({})
  const [accountForm, setAccountForm] = useState(ACCOUNT_INITIAL)
  const [companyForm, setCompanyForm] = useState(COMPANY_INITIAL)
  const [signupMessage, setSignupMessage] = useState(
    'Compte créé ! Vérifiez votre boîte mail.'
  )

  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isRegisterSubmitting, setIsRegisterSubmitting] = useState(false)

  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [logoError, setLogoError] = useState('')
  const [isLogoDragging, setIsLogoDragging] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')

  const fileInputRef = useRef(null)

  const passwordStrength = useMemo(
    () => evaluatePasswordStrength(accountForm.password),
    [accountForm.password]
  )

  useEffect(() => {
    return () => {
      if (logoPreview && logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview)
      }
    }
  }, [logoPreview])

  const shouldRedirect = Boolean(session)

  const resetRegistrationState = () => {
    setAccountForm(ACCOUNT_INITIAL)
    setCompanyForm(COMPANY_INITIAL)
    setIsRegisterSubmitting(false)
    setLogoError('')
    setPendingEmail('')
    if (logoPreview && logoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(logoPreview)
    }
    setLogoPreview('')
    setLogoFile(null)
  }

  const handleSwitchToLogin = () => {
    resetRegistrationState()
    setView(Steps.LOGIN)
  }

  const handleSwitchToRegister = () => {
    resetRegistrationState()
    setView(Steps.ACCOUNT)
    setAccountForm((prev) => ({
      ...prev,
      email: loginForm.email || prev.email
    }))
  }

  const handleLoginChange = (event) => {
    const { name, value } = event.target
    setLoginForm((prev) => ({ ...prev, [name]: value }))
    if (loginErrors[name]) {
      setLoginErrors((prev) => ({ ...prev, [name]: null, global: null }))
    }
  }

  const handleAccountChange = (event) => {
    const { name, value } = event.target
    setAccountForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleCompanyChange = (event) => {
    const { name, value } = event.target
    setCompanyForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleLoginSubmit = async (event) => {
    event.preventDefault()
    setLoginErrors({})
    setIsAuthenticating(true)
    try {
      const trimmedEmail = loginForm.email.trim()
      if (!trimmedEmail) {
        setLoginErrors({ email: 'Veuillez indiquer une adresse email valide.' })
        return
      }
      const trimmedPassword = loginForm.password.trim()
      if (!trimmedPassword) {
        setLoginErrors((prev) => ({ ...prev, password: 'Veuillez saisir votre mot de passe.' }))
        return
      }

      await login({ email: trimmedEmail, password: trimmedPassword })
      toast.success('Bienvenue sur Kadi ✨', { icon: '🙌' })
      setLoginForm({ email: '', password: '' })
      setLoginErrors({})
    } catch (error) {
      const normalized = (error.message || '').toLowerCase()
      let message = error.message || 'Identifiants invalides. Réessayez.'
      if (
        normalized.includes('email not confirmed') ||
        normalized.includes('email_confirm') ||
        normalized.includes('confirmation')
      ) {
        message =
          "Votre email n'est pas encore confirmé. Consultez votre boîte de réception ou demandez un nouvel envoi."
      }
      setLoginErrors((prev) => ({
        ...prev,
        global: message
      }))
    } finally {
      setIsAuthenticating(false)
    }
  }

  const handleAccountSubmit = (event) => {
    event.preventDefault()
    const trimmedEmail = accountForm.email.trim()
    if (!trimmedEmail) {
      toast.error('Renseignez une adresse email valide.', { icon: '⚠️' })
      return
    }

    if (accountForm.password !== accountForm.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas.', { icon: '⚠️' })
      return
    }

    if (passwordStrength.score < 3) {
      toast.error('Renforcez votre mot de passe avant de continuer.', { icon: '⚠️' })
      return
    }

    setAccountForm((prev) => ({ ...prev, email: trimmedEmail }))
    setView(Steps.COMPANY)
  }

  const handleLogoSelection = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setLogoError('Formats acceptés : PNG, JPG ou WEBP.')
      return
    }
    if (file.size > MAX_LOGO_SIZE_BYTES) {
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

  const handleLogoInputChange = (event) => {
    const file = event.target.files?.[0]
    handleLogoSelection(file)
    if (event.target) {
      event.target.value = ''
    }
  }

  const handleLogoDrop = (event) => {
    event.preventDefault()
    setIsLogoDragging(false)
    const file = event.dataTransfer.files?.[0]
    handleLogoSelection(file)
  }

  const handleLogoDragOver = (event) => {
    event.preventDefault()
    setIsLogoDragging(true)
  }

  const handleLogoDragLeave = (event) => {
    event.preventDefault()
    setIsLogoDragging(false)
  }

  const handleRegistrationSubmit = async (event) => {
    event.preventDefault()
    const trimmedCompany = companyForm.company.trim()
    if (!trimmedCompany) {
      toast.error("Indiquez le nom de votre entreprise.", { icon: '⚠️' })
      return
    }

    setIsRegisterSubmitting(true)
    try {
      const payload = {
        email: accountForm.email.trim(),
        password: accountForm.password,
        company: trimmedCompany,
        manager_name: trimOrNull(companyForm.manager_name),
        address: trimOrNull(companyForm.address),
        city: trimOrNull(companyForm.city),
        state: trimOrNull(companyForm.state),
        tagline: trimOrNull(companyForm.tagline),
        national_id: trimOrNull(companyForm.national_id),
        rccm: trimOrNull(companyForm.rccm),
        nif: trimOrNull(companyForm.nif)
      }

      if (logoFile) {
        const dataUrl = await fileToDataUrl(logoFile)
        payload.logo_file = dataUrl
        payload.logo_filename = logoFile.name
      }

      const response = await signup(payload)
      setPendingEmail(response?.user?.email ?? accountForm.email.trim())
      setSignupMessage(response?.message || 'Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse.')
      setAccountForm(ACCOUNT_INITIAL)
      setCompanyForm(COMPANY_INITIAL)
      setLogoError('')
      if (logoPreview && logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview)
      }
      setLogoPreview('')
      setLogoFile(null)
      toast.success(response?.message || 'Compte créé ! Vérifiez votre boîte mail.', { icon: '✅' })
      setView(Steps.SUCCESS)
    } catch (error) {
      showErrorToast(toast.error, error)
    } finally {
      setIsRegisterSubmitting(false)
    }
  }

  if (shouldRedirect) {
    return <Navigate to='/' replace />
  }

  const renderPasswordStrength = () => {
    const segments = 5
    return (
      <div className='space-y-2'>
        <div className='flex items-center justify-between text-xs font-semibold'>
          <span className={passwordStrength.textColor}>{passwordStrength.label}</span>
          <span className='text-[var(--text-muted)]'>
            {passwordStrength.score}/{segments}
          </span>
        </div>
        <div className='flex gap-1'>
          {Array.from({ length: segments }, (_, index) => (
            <div
              key={index}
              className={[
                'h-1 flex-1 rounded-full transition-colors',
                index < passwordStrength.score
                  ? passwordStrength.color
                  : 'bg-[var(--border)]'
              ].join(' ')}
            />
          ))}
        </div>
        <div className='grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2 text-[11px] text-[var(--text-muted)]'>
          {passwordRequirements.map((requirement) => {
            const isValid = requirement.test(accountForm.password)
            return (
              <div
                key={requirement.label}
                className={[
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1 transition',
                  isValid
                    ? 'border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.12)] text-emerald-600'
                    : 'border-[rgba(15,23,42,0.05)] bg-white/80'
                ].join(' ')}
              >
                <ShieldCheck
                  className={`h-3.5 w-3.5 ${isValid ? 'text-emerald-500' : 'text-[var(--border)]'}`}
                />
                <span>{requirement.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderLoginForm = () => (
    <>
      <div className='mb-6 space-y-2 text-center'>
        <p className='text-xs uppercase tracking-[0.25em] text-[var(--text-muted)]'>Bienvenue sur</p>
        <h1 className='text-3xl font-semibold text-[var(--text-dark)]'>Kadi</h1>
        <p className='text-sm text-[var(--text-muted)]'>
          Connectez-vous pour retrouver votre espace de facturation.
        </p>
      </div>
      <form
        onSubmit={handleLoginSubmit}
        className='space-y-4 rounded-[var(--radius-xl)] border border-[var(--border)] bg-white/85 p-6 shadow-soft'
      >
        {loginErrors.global ? (
          <div className='rounded-[var(--radius-lg)] border border-[rgba(248,113,113,0.35)] bg-[rgba(248,113,113,0.08)] px-4 py-2 text-sm text-red-500'>
            {loginErrors.global}
          </div>
        ) : null}
        <div className='flex flex-col gap-2'>
          <label className='label'>Email</label>
          <input
            type='email'
            name='email'
            value={loginForm.email}
            onChange={handleLoginChange}
            placeholder='vous@entreprise.com'
            className='input'
            required
          />
          {loginErrors.email ? (
            <p className='text-xs font-medium text-red-500'>{loginErrors.email}</p>
          ) : null}
        </div>
        <div className='flex flex-col gap-2'>
          <label className='label'>Mot de passe</label>
          <input
            type='password'
            name='password'
            value={loginForm.password}
            onChange={handleLoginChange}
            placeholder='••••••••'
            className='input'
            required
          />
          {loginErrors.password ? (
            <p className='text-xs font-medium text-red-500'>{loginErrors.password}</p>
          ) : null}
        </div>
        <button
          type='submit'
          disabled={isAuthenticating}
          className='btn-primary w-full justify-center'
        >
          {isAuthenticating ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' /> Connexion en cours…
            </>
          ) : (
            'Se connecter'
          )}
        </button>
      </form>
      <div className='mt-6 text-center text-sm text-[var(--text-muted)]'>
        Pas encore de compte ?{' '}
        <button
          onClick={handleSwitchToRegister}
          className='font-semibold text-[var(--primary)] hover:underline'
        >
          S&apos;inscrire
        </button>
      </div>
    </>
  )

  const renderAccountStep = () => (
    <>
      <RegistrationStepper currentStep={Steps.ACCOUNT} />
      <div className='mb-6 space-y-2'>
        <p className='text-xs uppercase tracking-[0.25em] text-[var(--text-muted)]'>Étape 1/2</p>
        <h1 className='text-2xl font-semibold text-[var(--text-dark)]'>Créons votre accès</h1>
        <p className='text-sm text-[var(--text-muted)]'>
          Votre email servira d’identifiant. Choisissez un mot de passe robuste pour sécuriser vos factures.
        </p>
      </div>

      <form
        onSubmit={handleAccountSubmit}
        className='space-y-4 rounded-[var(--radius-xl)] border border-[var(--border)] bg-white/85 p-6 shadow-soft'
      >
        <div className='flex flex-col gap-2'>
          <label className='label'>Email professionnel</label>
          <input
            type='email'
            name='email'
            value={accountForm.email}
            onChange={handleAccountChange}
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
            value={accountForm.password}
            onChange={handleAccountChange}
            placeholder='••••••••'
            className='input'
            required
            minLength={8}
          />
        </div>
        <div className='flex flex-col gap-2'>
          <label className='label'>Confirmer le mot de passe</label>
          <input
            type='password'
            name='confirmPassword'
            value={accountForm.confirmPassword}
            onChange={handleAccountChange}
            placeholder='••••••••'
            className='input'
            required
          />
        </div>
        {renderPasswordStrength()}
        <div className='mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <button
            type='button'
            onClick={handleSwitchToLogin}
            className='btn-ghost justify-center'
          >
            <ArrowLeft className='mr-2 h-4 w-4' />
            Retour
          </button>
          <button type='submit' className='btn-primary justify-center'>
            Continuer
          </button>
        </div>
      </form>
    </>
  )

  const renderLogoDropzone = () => (
    <div
      onDragOver={handleLogoDragOver}
      onDragLeave={handleLogoDragLeave}
      onDrop={handleLogoDrop}
      className={[
        'relative flex flex-col items-center gap-4 rounded-[var(--radius-xl)] border-2 border-dashed p-6 text-center transition',
        isLogoDragging ? 'border-[var(--primary)] bg-[rgba(10,132,255,0.06)]' : 'border-[var(--border)] bg-[rgba(15,23,42,0.02)]'
      ].join(' ')}
    >
      <div className='relative'>
        <div className='h-24 w-24 overflow-hidden rounded-full border border-[rgba(255,255,255,0.6)] bg-white shadow-soft'>
          {logoPreview ? (
            <img
              src={logoPreview}
              alt='Aperçu du logo'
              className='h-full w-full object-cover'
            />
          ) : (
            <div className='flex h-full w-full flex-col items-center justify-center gap-1 text-[var(--text-muted)]'>
              <ImageIcon className='h-7 w-7' />
              <span className='text-[11px] font-medium'>Logo</span>
            </div>
          )}
        </div>
        <button
          type='button'
          onClick={() => fileInputRef.current?.click()}
          className='absolute -bottom-2 -right-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-soft'
        >
          <UploadCloud className='h-4 w-4' />
        </button>
      </div>
      <div className='w-full max-w-[220px] rounded-[var(--radius-xl)] border border-white/60 bg-white/90 p-3 text-left shadow-[0_14px_38px_-30px_rgba(28,28,30,0.28)]'>
        <div className='mb-2 flex items-center gap-2 text-[11px] text-[var(--text-muted)]'>
          <Building2 className='h-3.5 w-3.5 text-[var(--primary)]' />
          <span>Prévisualisation facture</span>
        </div>
        <div className='space-y-1 rounded-[var(--radius-lg)] bg-[rgba(15,23,42,0.03)] p-3'>
          <div className='flex h-2 w-20 rounded-full bg-white/70' />
          <div className='flex h-2 w-14 rounded-full bg-white/50' />
          <div className='mt-3 space-y-1'>
            <div className='flex h-2 w-full rounded-full bg-white/70' />
            <div className='flex h-2 w-3/4 rounded-full bg-white/60' />
          </div>
        </div>
      </div>
      <p className='text-sm font-semibold text-[var(--text-dark)]'>
        Glissez-déposez votre logo ou cliquez pour parcourir
      </p>
      <p className='text-xs text-[var(--text-muted)]'>PNG, JPG, WEBP · 1 Mo max · fond transparent recommandé</p>
      {logoError ? <p className='text-xs text-red-500'>{logoError}</p> : null}
      <input
        ref={fileInputRef}
        type='file'
        accept='image/*'
        className='hidden'
        onChange={handleLogoInputChange}
      />
    </div>
  )

  const renderCompanyStep = () => (
    <>
      <RegistrationStepper currentStep={Steps.COMPANY} />
      <div className='mb-6 space-y-2'>
        <p className='text-xs uppercase tracking-[0.25em] text-[var(--text-muted)]'>Étape 2/2</p>
        <h1 className='text-2xl font-semibold text-[var(--text-dark)]'>Votre identité entreprise</h1>
        <p className='text-sm text-[var(--text-muted)]'>
          Ces informations alimentent vos factures et votre future zone client. Vous pourrez les compléter plus tard.
        </p>
      </div>

      <form
        onSubmit={handleRegistrationSubmit}
        className='space-y-5 rounded-[var(--radius-xl)] border border-[var(--border)] bg-white/85 p-6 shadow-soft'
      >
        <div className='rounded-[var(--radius-xl)] bg-[rgba(15,23,42,0.02)] p-5'>
          {renderLogoDropzone()}
        </div>

        <div className='space-y-4'>
          <div className='flex flex-col gap-2'>
            <label className='label'>Nom de l’entreprise</label>
            <input
              name='company'
              value={companyForm.company}
              onChange={handleCompanyChange}
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
                value={companyForm.manager_name}
                onChange={handleCompanyChange}
                placeholder='Nom du gestionnaire'
                className='input'
              />
            </div>
            <div className='flex flex-col gap-2'>
              <label className='label'>Tagline (optionnel)</label>
              <input
                name='tagline'
                value={companyForm.tagline}
                onChange={handleCompanyChange}
                placeholder='Ex. Facturation simple pour PME'
                className='input'
              />
            </div>
          </div>

          <div className='flex flex-col gap-2'>
            <label className='label'>Adresse</label>
            <textarea
              name='address'
              value={companyForm.address}
              onChange={handleCompanyChange}
              placeholder='Adresse complète de l’entreprise'
              className='textarea min-h-[100px]'
            />
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='flex flex-col gap-2'>
              <label className='label'>Ville</label>
              <input
                name='city'
                value={companyForm.city}
                onChange={handleCompanyChange}
                placeholder='Kinshasa'
                className='input'
              />
            </div>
            <div className='flex flex-col gap-2'>
              <label className='label'>État / Province</label>
              <input
                name='state'
                value={companyForm.state}
                onChange={handleCompanyChange}
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
                value={companyForm.national_id}
                onChange={handleCompanyChange}
                placeholder='ID nat. de l’entreprise'
                className='input'
              />
            </div>
            <div className='flex flex-col gap-2'>
              <label className='label'>RCCM (optionnel)</label>
              <input
                name='rccm'
                value={companyForm.rccm}
                onChange={handleCompanyChange}
                placeholder='RCCM'
                className='input'
              />
            </div>
          </div>

          <div className='flex flex-col gap-2 sm:w-1/2'>
            <label className='label'>NIF (optionnel)</label>
            <input
              name='nif'
              value={companyForm.nif}
              onChange={handleCompanyChange}
              placeholder='Numéro d’impôt'
              className='input'
            />
          </div>
        </div>

        <div className='mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <button
            type='button'
            onClick={() => setView(Steps.ACCOUNT)}
            className='btn-ghost justify-center'
          >
            <ArrowLeft className='mr-2 h-4 w-4' />
            Retour
          </button>
          <button
            type='submit'
            className='btn-primary justify-center'
            disabled={isRegisterSubmitting}
          >
            {isRegisterSubmitting ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' /> Création du compte…
              </>
            ) : (
              'Créer mon compte'
            )}
          </button>
        </div>
      </form>
    </>
  )

  const renderSuccessStep = () => (
    <div className='space-y-6 text-center'>
      <div className='inline-flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)] shadow-soft'>
        <CheckCircle2 className='h-10 w-10' />
      </div>
      <div className='space-y-2'>
        <h1 className='text-2xl font-semibold text-[var(--text-dark)]'>Bienvenue dans Kadi !</h1>
        <p className='text-sm text-[var(--text-muted)]'>
          {signupMessage}{' '}
          {pendingEmail ? (
            <span>
              Adresse utilisée : <strong>{pendingEmail}</strong>
            </span>
          ) : null}
        </p>
      </div>
      <div className='rounded-[var(--radius-xl)] border border-[var(--border)] bg-[rgba(15,23,42,0.02)] p-5 text-left shadow-soft'>
        <p className='text-sm font-semibold text-[var(--text-dark)]'>Étapes suivantes</p>
        <ul className='mt-3 space-y-3 text-sm text-[var(--text-muted)]'>
          <li className='flex items-start gap-3'>
            <MailCheck className='mt-1 h-4 w-4 text-[var(--primary)]' />
            <span>Ouvrez l’email de confirmation et validez votre adresse.</span>
          </li>
          <li className='flex items-start gap-3'>
            <Users className='mt-1 h-4 w-4 text-[var(--primary)]' />
            <span>Ajoutez vos premiers clients pour préparer vos factures.</span>
          </li>
          <li className='flex items-start gap-3'>
            <FileText className='mt-1 h-4 w-4 text-[var(--primary)]' />
            <span>Créez et envoyez votre première facture en quelques clics.</span>
          </li>
          <li className='flex items-start gap-3'>
            <Sparkles className='mt-1 h-4 w-4 text-[var(--primary)]' />
            <span>Personnalisez votre compte avec votre logo et votre slogan.</span>
          </li>
        </ul>
      </div>
      <div className='flex flex-col gap-3 sm:flex-row sm:justify-center'>
        <button
          type='button'
          onClick={handleSwitchToLogin}
          className='btn-primary justify-center'
        >
          Retour à la connexion
        </button>
        <a
          href='https://mail.google.com'
          target='_blank'
          rel='noopener noreferrer'
          className='btn-secondary justify-center'
        >
          Ouvrir ma messagerie
        </a>
      </div>
    </div>
  )

  return (
    <div className='flex min-h-screen flex-col justify-center bg-[var(--bg-base)] px-4 py-6'>
      <div className='mx-auto w-full max-w-[620px] rounded-[var(--radius-2xl)] border border-white/55 bg-[rgba(255,255,255,0.9)] px-9 py-10 shadow-[0_35px_120px_-42px_rgba(28,28,30,0.42)] backdrop-blur-xl'>
        {view === Steps.LOGIN && renderLoginForm()}
        {view === Steps.ACCOUNT && renderAccountStep()}
        {view === Steps.COMPANY && renderCompanyStep()}
        {view === Steps.SUCCESS && renderSuccessStep()}
      </div>
    </div>
  )
}

export default Login
