import { useEffect, useState } from 'react'
import { api } from '../services/api.js'

const labels = {
  pending_verification: 'Email non vérifié', pending_review: 'À examiner', blocked: 'Suspendue',
  data_erased: 'Clôture à reprendre', completed: 'Terminée', cancelled: 'Annulée'
}

export default function DeletionRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [notes, setNotes] = useState({})
  const accept = data => {
    if (!Array.isArray(data?.requests)) throw new Error('Réponse invalide des demandes de suppression.')
    setRequests(data.requests)
  }
  const refresh = () => api.get('/platform/deletion-requests').then(({ data }) => accept(data))
  useEffect(() => { let active = true; api.get('/platform/deletion-requests')
    .then(({ data }) => { if (active) accept(data) })
    .catch(err => { if (active) setError(err.message) })
    .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  const decide = async (item, action) => {
    if (action === 'process' && !window.confirm(`Supprimer définitivement le compte ${item.email} et ses données Kadi après examen ?`)) return
    setBusyId(item.id); setError(''); setNotice('')
    try {
      const { data } = action === 'process'
        ? await api.post(`/platform/deletion-requests/${item.id}/process`)
        : await api.post(`/platform/deletion-requests/${item.id}/review`, { status: action, note: notes[item.id] || '' })
      if (!data.notification_sent) setNotice('Décision enregistrée, mais le mail de suivi n’a pas été envoyé. Contactez la personne manuellement.')
      await refresh()
    } catch (err) { setError(err.message) } finally { setBusyId(null) }
  }
  return <section className='card space-y-4 p-4 sm:p-6' aria-labelledby='deletion-requests-title'>
    <h2 id='deletion-requests-title' className='text-lg font-semibold'>Demandes de suppression de compte</h2>
    <p className='text-sm leading-6 text-[var(--text-muted)]'>Vérifiez l’identité, l’export et les éventuelles obligations de conservation avant de traiter une demande. Une demande suspendue garde son motif ; un échec après effacement peut être repris.</p>
    {loading ? <p role='status'>Chargement…</p> : null}
    {error ? <p role='alert' className='text-sm text-red-700'>{error}</p> : null}
    {notice ? <p role='alert' className='text-sm text-amber-800'>{notice}</p> : null}
    {!loading && requests.length === 0 ? <p className='text-sm'>Aucune demande.</p> : null}
    <div className='space-y-3'>{requests.map(item => <article key={item.id} className='rounded-lg border border-[var(--border)] p-4'>
      <div className='flex flex-wrap justify-between gap-2'><p className='break-all text-sm font-semibold'>{item.email || 'Compte supprimé'}</p><span className='text-sm'>{labels[item.status] || item.status}</span></div>
      <p className='mt-1 text-xs text-[var(--text-muted)]'>Reçue le {new Date(item.requested_at).toLocaleString('fr-FR')} · Export proposé : {item.export_acknowledged ? 'oui' : 'non'}</p>
      {item.decision_note ? <p className='mt-2 text-sm'>Motif : {item.decision_note}</p> : null}
      {['pending_review', 'blocked'].includes(item.status) ? <div className='mt-4 space-y-3'>
        <div><label className='label' htmlFor={`deletion-note-${item.id}`}>Motif d’examen ou de conservation</label><input id={`deletion-note-${item.id}`} className='input mt-1' maxLength={1000} value={notes[item.id] || ''} onChange={event => setNotes(previous => ({ ...previous, [item.id]: event.target.value }))} /></div>
        <div className='flex flex-wrap gap-2'>
          {item.status === 'pending_review' ? <button type='button' className='btn-secondary min-h-11' disabled={busyId === item.id || (notes[item.id] || '').trim().length < 3} onClick={() => decide(item, 'blocked')}>Suspendre avec motif</button> : <button type='button' className='btn-secondary min-h-11' disabled={busyId === item.id || (notes[item.id] || '').trim().length < 3} onClick={() => decide(item, 'pending_review')}>Reprendre l’examen</button>}
          {item.status === 'pending_review' ? <button type='button' className='btn-secondary min-h-11 text-red-700' disabled={busyId === item.id} onClick={() => decide(item, 'process')}>Supprimer après vérification</button> : null}
        </div>
      </div> : null}
      {item.status === 'data_erased' ? <button type='button' className='btn-secondary mt-3 min-h-11' disabled={busyId === item.id} onClick={() => decide(item, 'process')}>Terminer la suppression</button> : null}
    </article>)}</div>
  </section>
}
