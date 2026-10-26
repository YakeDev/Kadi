import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { supabase, createAuthClient } from '../models/supabaseClient.js'
import { LOGO_BUCKET, normalizeLogoStoragePath } from '../utils/logoStorage.js'
import { isMailConfigured, sendMail } from '../utils/mailer.js'

const fail = (message, status = 503) => Object.assign(new Error(message), { status })
const noCache = res => { res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('Vary', 'Authorization') }
const requestFields = 'id, user_id, tenant_id, email, status, verified_at, requested_at, export_acknowledged, processed_at, decision_note'
const publicReply = { message: 'Si cette adresse correspond à un compte Kadi, un lien de vérification sera envoyé.' }
const validEmail = email => typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
const escapeHtml = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

const rowsForTenant = async (table, tenantId) => {
  const rows = []
  for (let offset = 0; offset <= 20_000; offset += 500) {
    const { data, error } = await supabase.from(table).select('*').eq('tenant_id', tenantId).order('id').range(offset, offset + 499)
    if (error) throw error
    rows.push(...data)
    if (data.length < 500) return rows
  }
  throw fail('Export trop volumineux. Contactez le support pour obtenir toutes vos données.', 413)
}

export const exportAccountData = async (req, res, next) => {
  try {
    const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', req.user.id).eq('tenant_id', req.tenantId).single()
    const { data: tenant, error: tenantError } = await supabase.from('tenants').select('*').eq('id', req.tenantId).single()
    if (profileError || tenantError) throw fail('Export temporairement indisponible.')
    const [clients, catalogItems, quotes, invoices, payments] = await Promise.all([
      rowsForTenant('clients', req.tenantId), rowsForTenant('catalog_items', req.tenantId),
      rowsForTenant('quotes', req.tenantId), rowsForTenant('invoices', req.tenantId),
      rowsForTenant('invoice_payments', req.tenantId)
    ])
    let logo = null
    const logoPath = normalizeLogoStoragePath(profile.logo_url, req.user.id)
    if (logoPath) {
      const { data, error } = await supabase.storage.from(LOGO_BUCKET).download(logoPath)
      if (error) throw fail('Impossible d’inclure le logo dans l’export. Réessayez.')
      logo = { path: logoPath, base64: Buffer.from(await data.arrayBuffer()).toString('base64') }
    }
    noCache(res)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="kadi-mes-donnees.json"')
    res.json({ exported_at: new Date().toISOString(), account: { id: req.user.id, email: req.user.email },
      tenant, profile, clients, catalog_items: catalogItems, quotes, invoices, invoice_payments: payments, logo })
  } catch (error) { next(error) }
}

export const deletionStatus = async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('account_deletion_requests').select('id, status, requested_at, verified_at, processed_at, decision_note')
      .eq('user_id', req.user.id).order('requested_at', { ascending: false }).limit(1).maybeSingle()
    if (error) throw error
    noCache(res)
    res.json({ request: data })
  } catch (error) { next(error) }
}

export const requestDeletion = async (req, res, next) => {
  try {
    const password = req.body?.password
    if (!req.user.email_confirmed_at) throw fail('Confirmez votre adresse email avant de demander la suppression.', 403)
    if (typeof password !== 'string' || password.length < 1 || password.length > 128 || req.body?.exportAcknowledged !== true) {
      throw fail('Vérifiez votre mot de passe et confirmez la possibilité d’exporter vos documents.', 400)
    }
    const { error: verificationError } = await createAuthClient().auth.signInWithPassword({ email: req.user.email, password })
    if (verificationError) throw fail('Mot de passe invalide.', 400)
    const { data: existing, error: lookupError } = await supabase.from('account_deletion_requests').select('id, status')
      .eq('user_id', req.user.id).not('status', 'in', '(completed,cancelled)').maybeSingle()
    if (lookupError) throw lookupError
    if (existing?.status === 'pending_verification') {
      const { data, error } = await supabase.from('account_deletion_requests').update({
        status: 'pending_review', verified_at: new Date().toISOString(),
        verification_hash: null, verification_expires_at: null, export_acknowledged: true
      }).eq('id', existing.id).eq('user_id', req.user.id).eq('status', 'pending_verification')
        .select('id, status, requested_at').maybeSingle()
      if (error) throw error
      if (!data) throw fail('La demande a changé. Réessayez.', 409)
      noCache(res)
      return res.status(201).json({ request: data })
    }
    if (existing) throw fail('Une demande est déjà en cours pour ce compte.', 409)
    const { data, error } = await supabase.from('account_deletion_requests').insert({
      user_id: req.user.id, tenant_id: req.tenantId, email: req.user.email,
      status: 'pending_review', verified_at: new Date().toISOString(), export_acknowledged: true
    }).select('id, status, requested_at').single()
    if (error?.code === '23505') throw fail('Une demande est déjà en cours pour ce compte.', 409)
    if (error) throw error
    noCache(res)
    res.status(201).json({ request: data })
  } catch (error) { next(error) }
}

export const cancelDeletionRequest = async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('account_deletion_requests')
      .update({ status: 'cancelled', email: null, user_id: randomUUID(), tenant_id: randomUUID(),
        decision_note: null, verification_hash: null, verification_expires_at: null })
      .eq('user_id', req.user.id).in('status', ['pending_review', 'blocked'])
      .select('id').maybeSingle()
    if (error) throw error
    if (!data) throw fail('Cette demande ne peut plus être annulée.', 409)
    noCache(res)
    res.json({ message: 'Demande annulée.' })
  } catch (error) { next(error) }
}

export const requestDeletionPublic = async (req, res, next) => {
  try {
    const email = req.body?.email?.trim()
    if (!validEmail(email)) throw fail('Saisissez une adresse email valide.', 400)
    if (!isMailConfigured()) throw fail('Vérification par email temporairement indisponible.')
    const { data: matches, error: profileError } = await supabase.rpc('kadi_deletion_email_profile', { p_email: email })
    if (profileError) throw profileError
    noCache(res)
    if (!Array.isArray(matches) || matches.length !== 1) return res.status(202).json(publicReply)
    const profile = matches[0]
    const { data: existing, error: lookupError } = await supabase.from('account_deletion_requests').select('id, status, requested_at')
      .eq('user_id', profile.id).not('status', 'in', '(completed,cancelled)').maybeSingle()
    if (lookupError) throw lookupError
    if (existing && existing.status !== 'pending_verification') return res.status(202).json(publicReply)
    if (existing && Date.now() - new Date(existing.requested_at).getTime() < 10 * 60_000) return res.status(202).json(publicReply)
    const token = randomBytes(32).toString('base64url')
    const verification_hash = createHash('sha256').update(token).digest('hex')
    const record = { user_id: profile.id, tenant_id: profile.tenant_id, email: profile.email,
      status: 'pending_verification', verification_hash,
      verification_expires_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(), requested_at: new Date().toISOString() }
    const query = existing
      ? supabase.from('account_deletion_requests').update(record).eq('id', existing.id)
      : supabase.from('account_deletion_requests').insert(record)
    const { error } = await query
    if (error?.code === '23505') return res.status(202).json(publicReply)
    if (error) throw error
    const baseUrl = (process.env.APP_URL || 'https://kadi-facture.vercel.app').replace(/\/$/, '')
    const url = `${baseUrl}/suppression-compte?token=${encodeURIComponent(token)}`
    const sent = await sendMail({ to: profile.email, subject: 'Vérifiez votre demande de suppression Kadi',
      text: `Ouvrez ce lien sous 24 heures pour vérifier votre demande : ${url}\nSi vous n’avez rien demandé, ignorez ce message.`,
      html: `<p>Une suppression du compte Kadi a été demandée.</p><p><a href="${url}">Vérifier la demande</a> (lien valable 24 heures).</p><p>Si vous n’avez rien demandé, ignorez ce message.</p>` })
    if (!sent?.sent) {
      await supabase.from('account_deletion_requests').update({ status: 'cancelled', email: null,
        user_id: randomUUID(), tenant_id: randomUUID(), verification_hash: null, verification_expires_at: null })
        .eq('user_id', profile.id).eq('verification_hash', verification_hash)
      console.warn('[Account deletion] Verification email was not delivered')
      return res.status(202).json(publicReply)
    }
    res.status(202).json(publicReply)
  } catch (error) { next(error) }
}

export const verifyDeletionRequest = async (req, res, next) => {
  try {
    const token = req.body?.token
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw fail('Lien de vérification invalide ou expiré.', 400)
    const hash = createHash('sha256').update(token).digest('hex')
    const { data, error } = await supabase.from('account_deletion_requests')
      .update({ status: 'pending_review', verified_at: new Date().toISOString(), verification_hash: null, verification_expires_at: null })
      .eq('verification_hash', hash).eq('status', 'pending_verification').gt('verification_expires_at', new Date().toISOString())
      .select('id').maybeSingle()
    if (error) throw error
    if (!data) throw fail('Lien de vérification invalide ou expiré.', 400)
    noCache(res)
    res.json({ message: 'Demande vérifiée. Elle sera examinée avant la suppression du compte.' })
  } catch (error) { next(error) }
}

export const listDeletionRequests = async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('account_deletion_requests').select(requestFields)
      .order('requested_at', { ascending: false }).limit(100)
    if (error) throw error
    noCache(res)
    res.json({ requests: data })
  } catch (error) { next(error) }
}

export const reviewDeletionRequest = async (req, res, next) => {
  try {
    const status = req.body?.status
    const note = req.body?.note?.trim()
    if (!['blocked', 'pending_review'].includes(status) || typeof note !== 'string' || note.length < 3 || note.length > 1000) {
      throw fail('Indiquez une décision et un motif (3 à 1000 caractères).', 400)
    }
    const { data, error } = await supabase.from('account_deletion_requests').update({ status, decision_note: note, processed_by: req.user.id, processed_at: new Date().toISOString() })
      .eq('id', req.params.id).in('status', ['pending_review', 'blocked']).not('verified_at', 'is', null)
      .select('id, status, decision_note, email').maybeSingle()
    if (error) throw error
    if (!data) throw fail('Demande introuvable ou déjà traitée.', 409)
    const text = status === 'blocked'
      ? `Le traitement de votre demande Kadi est suspendu. Motif : ${note}\nContactez le support si vous avez une question.`
      : `L’examen de votre demande Kadi a repris. Motif : ${note}`
    const notice = data.email ? await sendMail({ to: data.email, subject: 'Suivi de votre demande Kadi', text,
      html: `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>` }) : { sent: false }
    noCache(res)
    res.json({ request: { id: data.id, status: data.status, decision_note: data.decision_note }, notification_sent: Boolean(notice?.sent) })
  } catch (error) { next(error) }
}

const removeLogos = async userId => {
  const bucket = supabase.storage.from(LOGO_BUCKET)
  for (let page = 0; page < 100; page++) {
    const { data, error } = await bucket.list(userId, { limit: 100, offset: 0 })
    if (error) throw error
    if (!data?.length) return
    if (data.some(item => !item.id)) throw fail('Un dossier de stockage nécessite une vérification manuelle.')
    const { error: removeError } = await bucket.remove(data.map(item => `${userId}/${item.name}`))
    if (removeError) throw removeError
  }
  throw fail('Trop de fichiers dans le compte : contactez le support.')
}

export const processDeletionRequest = async (req, res, next) => {
  try {
    const { data: item, error: lookupError } = await supabase.from('account_deletion_requests').select(requestFields)
      .eq('id', req.params.id).maybeSingle()
    if (lookupError) throw lookupError
    if (!item || !['pending_review', 'data_erased'].includes(item.status) || !item.verified_at) {
      throw fail('Demande non vérifiée ou indisponible.', 409)
    }
    if (item.user_id === req.user.id) throw fail('Un administrateur ne peut pas traiter sa propre suppression.', 409)
    const { data, error } = await supabase.rpc('kadi_erase_requested_account', { p_request_id: item.id, p_actor_id: req.user.id })
    if (error) throw error
    if (data?.user_id !== item.user_id || data?.stage !== 'data_erased') throw fail('État de suppression incohérent.')
    await removeLogos(item.user_id)
    const { error: authError } = await supabase.auth.admin.deleteUser(item.user_id)
    if (authError && authError.status !== 404) throw authError
    const { data: completed, error: completedError } = await supabase.from('account_deletion_requests')
      .update({ status: 'completed', email: null, user_id: randomUUID(), tenant_id: randomUUID(), decision_note: null,
        processed_at: new Date().toISOString() })
      .eq('id', item.id).eq('status', 'data_erased').select('id').maybeSingle()
    if (completedError || !completed) throw completedError || fail('Clôture de la demande à reprendre.')
    const notice = item.email ? await sendMail({ to: item.email, subject: 'Suppression de votre compte Kadi terminée',
      text: 'Votre compte Kadi et les données de votre entreprise ont été supprimés. Contactez le support pour toute question.',
      html: '<p>Votre compte Kadi et les données de votre entreprise ont été supprimés.</p><p>Contactez le support pour toute question.</p>' }) : { sent: false }
    noCache(res)
    res.json({ message: 'Compte et données supprimés. La demande est terminée.', notification_sent: Boolean(notice?.sent) })
  } catch (error) { next(error) }
}
