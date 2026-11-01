import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Building2, Image as ImageIcon, Link as LinkIcon, Phone, Lock } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.jsx'
import { uploadCompanyLogo } from '../services/supabase.js'
import { changePassword } from '../services/auth.js'
import { showErrorToast } from '../utils/errorToast.js'
import FormSection from '../components/FormSection.jsx'
import PageHeader from '../components/PageHeader.jsx'
import AccountLifecycle from '../components/AccountLifecycle.jsx'

const initialState = {
  company: '',
  manager_name: '',
  address: '',
  city: '',
  state: '',
  tagline: '',
  national_id: '',
  rccm: '',
  nif: '',
  phone: '',
  website: ''
}

const trimOrNull = (value) => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const Company = () => {
  const { profile, updateProfile, isLoading, user } = useAuth()
  const [form, setForm] = useState(initialState)
  const [isSaving, setIsSaving] = useState(false)
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [logoError, setLogoError] = useState('')
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  const companyEmail = useMemo(() => user?.email ?? '', [user])

  const syncFormWithProfile = (data) => {
    if (!data) return
    setForm({
      company: data.company ?? '',
      manager_name: data.manager_name ?? '',
      address: data.address ?? '',
      city: data.city ?? '',
      state: data.state ?? '',
      tagline: data.tagline ?? '',
      national_id: data.national_id ?? '',
      rccm: data.rccm ?? '',
      nif: data.nif ?? '',
      phone: data.phone ?? '',
      website: data.website ?? ''
    })
    setLogoPreview(data.logo_url ?? '')
    setLogoFile(null)
    setLogoError('')
  }

  useEffect(() => {
    syncFormWithProfile(profile)
  }, [profile])

  useEffect(() => {
    return () => {
      if (logoPreview && logoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(logoPreview)
      }
    }
  }, [logoPreview])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleLogoChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setLogoError('Choisissez un logo PNG, JPEG ou WebP.')
      return
    }
    if (file.size > 1024 * 1024) {
      setLogoError('Logo trop volumineux (1 Mo maximum).')
      return
    }
    if (logoPreview && logoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(logoPreview)
    }
    setLogoError('')
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const handlePasswordFieldChange = (event) => {
    const { name, value } = event.target
    setPasswordForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleLogoReset = () => {
    if (logoPreview && logoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(logoPreview)
    }
    setLogoFile(null)
    setLogoPreview(profile?.logo_url ?? '')
    setLogoError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      const payload = {
        company: trimOrNull(form.company) ?? '',
        manager_name: trimOrNull(form.manager_name),
        address: trimOrNull(form.address),
        city: trimOrNull(form.city),
        state: trimOrNull(form.state),
        tagline: trimOrNull(form.tagline),
        national_id: trimOrNull(form.national_id),
        rccm: trimOrNull(form.rccm),
        nif: trimOrNull(form.nif),
        phone: trimOrNull(form.phone),
        website: trimOrNull(form.website)
      }

      if (!payload.company) {
        toast.error("Le nom de l'entreprise est obligatoire.")
        return
      }

      if (logoFile) {
        setIsUploadingLogo(true)
        try {
          const { storagePath, previewUrl } = await uploadCompanyLogo(logoFile, user?.id)
          if (logoPreview && logoPreview.startsWith('blob:')) {
            URL.revokeObjectURL(logoPreview)
          }
          payload.logo_url = storagePath
          setLogoPreview(previewUrl || '')
          setLogoFile(null)
          setLogoError('')
        } catch (error) {
          console.error('logo upload failed', error)
          setLogoError(error.message)
          throw error
        } finally {
          setIsUploadingLogo(false)
        }
      }

      await updateProfile(payload)
      toast.success('Informations enregistrées ✅')
    } catch (error) {
      showErrorToast(toast.error, error)
    } finally {
      setIsSaving(false)
    }
  }

  const disabled = isLoading || isSaving || isUploadingLogo

  const handleChangePassword = async (event) => {
    event.preventDefault()
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      toast.error('Renseignez votre mot de passe actuel et le nouveau.')
      return
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error('Le nouveau mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (passwordForm.newPassword === passwordForm.currentPassword) {
      toast.error('Choisissez un mot de passe différent de l’actuel.')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('La confirmation ne correspond pas au nouveau mot de passe.')
      return
    }

    setIsUpdatingPassword(true)
    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      })
      toast.success('Mot de passe mis à jour ✅')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      showErrorToast(toast.error, error)
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  const renderLogoUploader = () => (
    <div
      className={[
        'relative flex w-full flex-col items-center gap-4 rounded-[var(--radius-xl)] border-2 border-dashed p-4 text-center transition',
        isUploadingLogo
          ? 'border-[var(--primary)] bg-[rgba(10,132,255,0.06)]'
          : 'border-[var(--border)] bg-[rgba(15,23,42,0.02)]'
      ].join(' ')}
    >
      <div className='relative'>
        <div className='h-20 w-20 overflow-hidden rounded-full border border-[var(--border)] bg-white'>
          {logoPreview ? (
            <img src={logoPreview} alt='Logo de votre entreprise' className='h-full w-full object-cover' />
          ) : (
            <div className='flex h-full w-full flex-col items-center justify-center gap-1 text-[var(--text-muted)]'>
              <ImageIcon className='h-7 w-7' />
              <span className='text-[11px] font-medium'>Logo</span>
            </div>
          )}
        </div>
        <label className='btn-primary absolute -bottom-3 left-1/2 flex h-9 -translate-x-1/2 items-center justify-center px-4 text-xs font-semibold'>
          {logoPreview ? 'Modifier' : 'Importer un logo'}
          <input type='file' accept='image/png,image/jpeg,image/webp' className='hidden' onChange={handleLogoChange} disabled={disabled} />
        </label>
      </div>
      {logoPreview ? (
        <button
          type='button'
          className='text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-dark)]'
          onClick={handleLogoReset}
          disabled={disabled}
        >
          Réinitialiser
        </button>
      ) : null}
      {logoError ? <p className='text-xs text-red-500'>{logoError}</p> : null}
      <p className='text-[11px] text-[var(--text-muted)]'>PNG, JPEG ou WebP · 1&nbsp;Mo max.</p>
    </div>
  )

  return (
    <div className='space-y-8'>
      <PageHeader
        icon={Building2}
        title='Identité et mentions légales'
        subtitle='Ces informations apparaîtront sur vos factures et dans la navigation.'
      />

      <form onSubmit={handleSubmit} className='space-y-6'>
        <FormSection
          title='Identité visuelle'
          description='Votre logo et votre slogan apparaîtront sur vos factures.'
          icon={ImageIcon}
        >
          <div className='grid gap-6 md:grid-cols-2 md:items-start'>
            <div className='flex justify-center md:justify-start md:pt-1'>{renderLogoUploader()}</div>
            <div className='grid gap-4 md:grid-cols-2'>
              <div className='flex flex-col gap-2 md:col-span-2'>
                <label className='label' htmlFor='company-company'>Nom de l’entreprise</label>
                <input id='company-company' name='company' value={form.company} onChange={handleChange} className='input' required />
              </div>
              <div className='flex flex-col gap-2 md:col-span-2'>
                <label className='label' htmlFor='company-tagline'>Tagline (optionnel)</label>
                <input id='company-tagline'
                  name='tagline'
                  value={form.tagline}
                  onChange={handleChange}
                  className='input'
                  placeholder='Facturation simple pour PME'
                />
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection
          title='Coordonnées principales'
          description='Ces informations sont utilisées pour contacter votre entreprise.'
          icon={Phone}
        >
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='flex flex-col gap-2'>
              <label className='label' htmlFor='company-manager_name'>Responsable</label>
              <input id='company-manager_name'
                name='manager_name'
                value={form.manager_name}
                onChange={handleChange}
                className='input'
                placeholder='Nom et prénom'
              />
            </div>
            <div className='flex flex-col gap-2'>
              <label className='label' htmlFor='company-phone'>Téléphone</label>
              <input id='company-phone'
                name='phone'
                value={form.phone}
                onChange={handleChange}
                className='input'
                placeholder='+243 000 000 000'
              />
            </div>
          </div>
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='flex flex-col gap-2'>
              <label className='label' htmlFor='company-email-de-contact'>Email de contact</label>
              <input id='company-email-de-contact' value={companyEmail} disabled className='input bg-[rgba(148,163,184,0.12)]' />
            </div>
            <div className='flex flex-col gap-2'>
              <label className='label' htmlFor='company-website'>Site web</label>
              <input id='company-website'
                name='website'
                value={form.website}
                onChange={handleChange}
                className='input'
                placeholder='https://kadi.app'
              />
            </div>
          </div>
        </FormSection>

        <FormSection
          title='Adresse professionnelle'
          description='Localisation physique de votre entreprise.'
          icon={Building2}
        >
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='flex flex-col gap-2 md:col-span-2'>
              <label className='label' htmlFor='company-address'>Adresse</label>
              <textarea id='company-address'
                name='address'
                value={form.address}
                onChange={handleChange}
                className='textarea'
                placeholder='Rue, numéro, ville'
              />
            </div>
            <div className='flex flex-col gap-2'>
              <label className='label' htmlFor='company-city'>Ville</label>
              <input id='company-city' name='city' value={form.city} onChange={handleChange} className='input' />
            </div>
            <div className='flex flex-col gap-2'>
              <label className='label' htmlFor='company-state'>Province / État</label>
              <input id='company-state' name='state' value={form.state} onChange={handleChange} className='input' />
            </div>
          </div>
        </FormSection>

        <FormSection
          title='Mentions légales (optionnel)'
          description='Ajoutez vos informations légales pour les faire apparaître sur vos documents.'
          icon={LinkIcon}
        >
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='flex flex-col gap-2'>
              <label className='label' htmlFor='company-rccm'>Registre du commerce (RCCM)</label>
              <input id='company-rccm' name='rccm' value={form.rccm} onChange={handleChange} className='input' />
            </div>
            <div className='flex flex-col gap-2'>
              <label className='label' htmlFor='company-nif'>Numéro fiscal (NIF)</label>
              <input id='company-nif' name='nif' value={form.nif} onChange={handleChange} className='input' />
            </div>
            <div className='flex flex-col gap-2'>
              <label className='label' htmlFor='company-national_id'>Identifiant national</label>
              <input id='company-national_id' name='national_id' value={form.national_id} onChange={handleChange} className='input' />
            </div>
          </div>
        </FormSection>

        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end'>
          <button type='button' onClick={() => syncFormWithProfile(profile)} className='btn-ghost justify-center'>
            Restaurer
          </button>
          <button type='submit' className='btn-primary justify-center' disabled={disabled}>
            {isSaving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>

      <FormSection
        title='Sécurité du compte'
        description='Modifiez régulièrement votre mot de passe pour protéger l’accès à Kadi.'
        icon={Lock}
      >
        <form onSubmit={handleChangePassword} className='space-y-4'>
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='flex flex-col gap-2'>
              <label className='label' htmlFor='company-currentPassword'>Mot de passe actuel</label>
              <input id='company-currentPassword'
                type='password'
                name='currentPassword'
                value={passwordForm.currentPassword}
                onChange={handlePasswordFieldChange}
                className='input'
                placeholder='••••••••'
                autoComplete='current-password'
                required
              />
            </div>
            <div className='flex flex-col gap-2'>
              <label className='label' htmlFor='company-newPassword'>Nouveau mot de passe</label>
              <input id='company-newPassword'
                type='password'
                name='newPassword'
                value={passwordForm.newPassword}
                onChange={handlePasswordFieldChange}
                className='input'
                placeholder='8 caractères minimum'
                autoComplete='new-password'
                required
              />
            </div>
            <div className='flex flex-col gap-2 md:col-span-2'>
              <label className='label' htmlFor='company-confirmPassword'>Confirmer le nouveau mot de passe</label>
              <input id='company-confirmPassword'
                type='password'
                name='confirmPassword'
                value={passwordForm.confirmPassword}
                onChange={handlePasswordFieldChange}
                className='input'
                placeholder='Répétez le nouveau mot de passe'
                autoComplete='new-password'
                required
              />
            </div>
          </div>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end'>
            <button
              type='submit'
              className='btn-primary justify-center'
              disabled={isUpdatingPassword}
            >
              {isUpdatingPassword ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
            </button>
          </div>
        </form>
      </FormSection>
      <AccountLifecycle />
    </div>
  )
}

export default Company
