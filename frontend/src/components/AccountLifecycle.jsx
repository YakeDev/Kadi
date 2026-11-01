import { useEffect, useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { api } from '../services/api.js'
import { isNativeAndroid } from '../native/platform.js'

const labels = {
  pending_verification: 'En attente de vérification email', pending_review: 'En attente d’examen',
  blocked: 'Traitement suspendu', data_erased: 'Données supprimées, clôture en cours',
  completed: 'Terminée', cancelled: 'Annulée'
}

export default function AccountLifecycle() {
  const [request, setRequest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [password, setPassword] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.get('/auth/deletion-request').then(({ data }) => { if (active) setRequest(data.request) })
      .catch(err => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const exportData = async () => {
    setBusy(true); setError(''); setMessage('')
    try {
      const { data } = await api.get('/auth/data-export', { responseType: 'blob' })
      const blob = new Blob([data], { type: 'application/json' })
      if (isNativeAndroid()) {
        const { shareNativeExport } = await import('../native/dataExport.js')
        await shareNativeExport(blob)
        setMessage('Export préparé. Enregistrez le fichier depuis le menu de partage.')
      } else {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url; link.download = 'kadi-mes-donnees.json'
        document.body.appendChild(link); link.click(); link.remove()
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
        setMessage('Export téléchargé. Conservez aussi les PDF nécessaires à votre activité.')
      }
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const submit = async event => {
    event.preventDefault()
    if (!window.confirm('Envoyer la demande de suppression de votre compte et de ses données ?')) return
    setBusy(true); setError(''); setMessage('')
    try {
      const { data } = await api.post('/auth/deletion-request', { password, exportAcknowledged: acknowledged })
      setRequest(data.request); setPassword('')
      setMessage('Demande reçue. Le compte reste accessible pendant son examen.')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const cancel = async () => {
    setBusy(true); setError(''); setMessage('')
    try {
      await api.post('/auth/deletion-request/cancel')
      setRequest(previous => ({ ...previous, status: 'cancelled' }))
      setMessage('Demande annulée.')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const activeRequest = request && !['completed', 'cancelled'].includes(request.status)
  return <section className='card space-y-4 p-5 sm:p-6' aria-labelledby='account-data-title'>
    <div className='flex items-center gap-2'><Trash2 aria-hidden='true' className='h-5 w-5 text-[var(--primary)]' /><h2 id='account-data-title' className='text-lg font-semibold'>Données et suppression du compte</h2></div>
    <p className='text-sm leading-6 text-[var(--text-muted)]'>Téléchargez vos données et conservez les PDF que vous devez garder. Une demande de suppression sera vérifiée puis examinée avant toute opération irréversible. Vous serez informé si certains éléments doivent être conservés.</p>
    <button type='button' className='btn-secondary min-h-11' onClick={exportData} disabled={busy}><Download aria-hidden='true' className='mr-2 h-4 w-4' />Exporter mes données (JSON)</button>
    {loading ? <p role='status' className='text-sm'>Chargement de la demande…</p> : null}
    {activeRequest ? <div className='rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-4 text-sm'>
      <p><strong>État :</strong> {labels[request.status] || request.status}</p>
      {request.decision_note ? <p className='mt-2'>Motif : {request.decision_note}</p> : null}
      {['pending_review', 'blocked'].includes(request.status) ? <button type='button' className='mt-3 text-red-700 underline' onClick={cancel} disabled={busy}>Annuler ma demande</button> : null}
    </div> : null}
    {!loading && !activeRequest ? <form onSubmit={submit} className='max-w-lg space-y-4'>
      <div><label className='label' htmlFor='deletion-password'>Mot de passe actuel</label><input id='deletion-password' type='password' autoComplete='current-password' className='input mt-1' value={password} onChange={event => setPassword(event.target.value)} required maxLength={128} /></div>
      <label className='flex items-start gap-3 text-sm leading-6'><input type='checkbox' className='mt-1.5' checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} required /><span>Je sais que je peux exporter mes données avant le traitement et que les documents supprimés ne pourront pas être récupérés dans Kadi.</span></label>
      <button type='submit' className='btn-secondary min-h-11 text-red-700' disabled={busy}>Demander la suppression du compte</button>
    </form> : null}
    {message ? <p role='status' className='text-sm text-green-700'>{message}</p> : null}
    {error ? <p role='alert' className='text-sm text-red-700'>{error}</p> : null}
  </section>
}
