// Session storage keeps a separate draft per account and browser tab.
export const invoiceDraftKey = (userId, invoice) =>
  userId
    ? `kadi:invoice-draft:v1:${userId}:${invoice?.id || 'new'}:${invoice?.version ?? invoice?.updated_at ?? '0'}`
    : null

export const readInvoiceDraft = (key) => {
  if (!key) return null
  try {
    const draft = JSON.parse(sessionStorage.getItem(key))
    if (
      !draft ||
      draft.version !== 1 ||
      !Array.isArray(draft.form?.items) ||
      !draft.form.items.length ||
      draft.form.items.length > 200
    )
      return null
    if (!['USD', 'CDF'].includes(draft.form.currency)) return null
    if (
      !draft.form.items.every(
        (line) =>
          line &&
          typeof line.description === 'string' &&
          Number.isFinite(line.quantity) &&
          Number.isFinite(line.unitPrice)
      )
    )
      return null
    // A local unsaved document is always a draft, never an issued invoice.
    return { ...draft.form, status: 'draft' }
  } catch {
    return null
  }
}

export const writeInvoiceDraft = (key, form) => {
  if (!key) return false
  try {
    sessionStorage.setItem(key, JSON.stringify({ version: 1, form }))
    return true
  } catch {
    return false
  }
}

export const clearInvoiceDraft = (key) => {
  if (!key) return
  try {
    sessionStorage.removeItem(key)
  } catch {
    /* Storage may be disabled. */
  }
}
