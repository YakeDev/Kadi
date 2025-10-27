import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Building2, Image as ImageIcon, Link as LinkIcon, Phone } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.jsx'
import { uploadCompanyLogo } from '../services/supabase.js'
import { showErrorToast } from '../utils/errorToast.js'
import FormSection from '../components/FormSection.jsx'

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
    if (!file.type.startsWith('image/')) {
      setLogoError('Veuillez choisir un fichier image (PNG ou JPG).')
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
          const url = await uploadCompanyLogo(logoFile, user?.id)
          if (logoPreview && logoPreview.startsWith('blob:')) {
            URL.revokeObjectURL(logoPreview)
          }
          payload.logo_url = url
          setLogoPreview(url)
          setLogoFile(null)
          setLogoError('')
        } catch (error) {
          console.error('logo upload failed', error)
          setLogoError(error.message)
          toast.error("Échec de l'upload du logo", { icon: '⚠️' })
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

  const renderLogoUploader = () => (
    <div className='flex flex-col items-center gap-3 rounded-[var(--radius-xl)] border border-dashed border-[var(--border)] bg-[rgba(15,23,42,0.02)] p-5 text-center'>
      <div className='relative flex h-28 w-28 items-center justify-center rounded-[var(--radius-lg)] bg-white shadow-soft'>
        {logoPreview ? (
          <img
            src={logoPreview}
            alt='Logo de votre entreprise'
            className='h-full w-full rounded-[var(--radius-lg)] object-contain'
          />
        ) : (
          <div className='flex h-full w-full flex-col items-center justify-center gap-2 text-[var(--text-muted)]'>
            <ImageIcon className='h-8 w-8' />
            <span className='text-xs font-semibold'>Logo</span>
          </div>
        )}
        <label className='btn-primary absolute -bottom-3 left-1/2 flex h-9 -translate-x-1/2 items-center justify-center px-4 text-xs font-semibold shadow-soft'>
          {logoPreview ? 'Modifier' : 'Importer un logo'}
          <input type='file' accept='image/*' className='hidden' onChange={handleLogoChange} disabled={disabled} />
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
      <p className='text-[11px] text-[var(--text-muted)]'>PNG ou JPG · 1&nbsp;Mo max.</p>
    </div>
  )

  return (
    <div className='space-y-8'>
      <header className='flex flex-col gap-2'>
        <p className='text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]'>Mon entreprise</p>
        <h1 className='text-3xl font-semibold text-[var(--text-dark)]'>Identité et mentions légales</h1>
        <p className='text-sm text-[var(--text-muted)]'>Ces informations apparaîtront sur vos factures et dans la navigation.</p>
      </header>

      <form onSubmit={handleSubmit} className='space-y-6'>
        <FormSection
          title="Identité visuelle"
          description='Votre logo et votre slogan apparaîtront sur vos factures.'
          icon={ImageIcon}
        >
          {renderLogoUploader()}
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='flex flex-col gap-2'>
              <label className='label'>Nom de l’entreprise</label>
              <input name='company' value={form.company} onChange={handleChange} className='input' required />
            </div>
            <div className='flex flex-col gap-2'>
              <label className='label'>Tagline (optionnel)</label>
              <input
                name='tagline'
                value={form.tagline}
                onChange={handleChange}
                className='input'
                placeholder='Facturation simple pour PME'
              />
            </div>
          </div>
        </FormSection>

        <FormSection
          title='Coordonnées principales'
          description="Ces informations sont utilisées pour contacter votre entreprise."
          icon={Phone}
        >
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='flex flex-col gap-2'>
              <label className='label'>Responsable</label>
              <input
                name='manager_name'
                value={form.manager_name}
                onChange={handleChange}
                className='input'
                placeholder='Nom et prénom'
              />
            </div>
            <div className='flex flex-col gap-2'>
              <label className='label'>Téléphone</label>
              <input
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
              <label className='label'>Email de contact</label>
              <input value={companyEmail} disabled className='input bg-[rgba(148,163,184,0.12)]' />
            </div>
            <div className='flex flex-col gap-2'>
              <label className='label'>Site web (optionnel)</label>
              <input
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
          description='Ces informations apparaissent sur vos factures et documents légaux.'
          icon={Building2}
        >
          <div className='flex flex-col gap-2'>
            <label className='label'>Adresse complète</label>
            <textarea
              name='address'
              value={form.address}
              onChange={handleChange}
              className='textarea textarea-compact min-h-[100px]'
              placeholder='Adresse postale, quartier, numéro de bâtiment…'
            />
          </div>
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='flex flex-col gap-2'>
              <label className='label'>Ville</label>
              <input name='city' value={form.city} onChange={handleChange} className='input' />
            </div>
            <div className='flex flex-col gap-2'>
              <label className='label'>État / Province</label>
              <input name='state' value={form.state} onChange={handleChange} className='input' />
            </div>
          </div>
        </FormSection>

        <FormSection title='Mentions légales (optionnel)' icon={LinkIcon}>
          <div className='grid gap-4 md:grid-cols-3'>
            <div className='flex flex-col gap-2'>
              <label className='label'>ID. Nat.</label>
              <input
                name='national_id'
                value={form.national_id}
                onChange={handleChange}
                className='input'
                placeholder='Numéro national'
              />
            </div>
            <div className='flex flex-col gap-2'>
              <label className='label'>RCCM</label>
              <input
                name='rccm'
                value={form.rccm}
                onChange={handleChange}
                className='input'
                placeholder='RCCM'
              />
            </div>
            <div className='flex flex-col gap-2'>
              <label className='label'>NIF</label>
              <input
                name='nif'
                value={form.nif}
                onChange={handleChange}
                className='input'
                placeholder='Numéro fiscal'
              />
            </div>
          </div>
        </FormSection>

        <div className='flex justify-end gap-3 pt-2'>
          <button
            type='button'
            onClick={() => syncFormWithProfile(profile)}
            className='btn-ghost px-4 text-sm font-semibold'
            disabled={disabled}
          >
            Réinitialiser
          </button>
          <button type='submit' className='btn-primary px-6 text-sm font-semibold' disabled={disabled}>
            {isSaving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default Company
