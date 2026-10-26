import { useEffect, useState } from 'react'
import { api } from '../services/api.js'
import { InformationLayout } from './InformationPages.jsx'

export default function DeletionRequestPage() {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token'))
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(Boolean(token))
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    window.history.replaceState(window.history.state, '', window.location.pathname)
    let active = true
    api.post('/auth/deletion-request/verify', { token }).then(({ data }) => {
      if (active) setMessage(data.message)
    }).catch(err => { if (active) setError(err.message) })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [token])

  const submit = async event => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const { data } = await api.post('/auth/deletion-request/public', { email })
      setMessage(data.message); setEmail('')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return <InformationLayout eyebrow='Gestion du compte' title='Demander la suppression du compte' introduction='Si vous n’avez plus accès à Kadi, vérifiez votre demande depuis l’adresse email liée à votre compte.'>
    <section className='rounded-[var(--radius-xl)] border border-[var(--border)] bg-white p-5 sm:p-8'>
      <h2 className='text-lg font-semibold'>Avant de demander la suppression</h2>
      <p className='mt-3 text-sm leading-7 text-[var(--text-muted)]'>Si vous pouvez encore vous connecter, exportez vos données depuis « Mon entreprise » et téléchargez les PDF à conserver. Une demande vérifiée est ensuite examinée avant le traitement. Le compte reste accessible jusque-là.</p>
      {!token ? <form onSubmit={submit} className='mt-6 max-w-lg space-y-4'>
        <div><label htmlFor='deletion-email' className='label'>Adresse email du compte</label><input id='deletion-email' type='email' autoComplete='email' className='input mt-1' value={email} onChange={event => setEmail(event.target.value)} maxLength={254} required /></div>
        <button type='submit' className='btn-primary min-h-11' disabled={busy}>Recevoir un lien de vérification</button>
      </form> : null}
      {busy ? <p role='status' className='mt-4 text-sm'>Traitement en cours…</p> : null}
      {message ? <p role='status' className='mt-4 text-sm text-green-700'>{message}</p> : null}
      {error ? <p role='alert' className='mt-4 text-sm text-red-700'>{error}</p> : null}
    </section>
  </InformationLayout>
}
