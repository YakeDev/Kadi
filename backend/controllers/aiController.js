import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const normalizeLineItem = (item = {}) => {
  if (!item || typeof item !== 'object') {
    return null
  }

  const quantity = Number(item.quantity ?? item.qty ?? 0) || 0
  const unitPrice = Number(item.unitPrice ?? item.unit_price ?? 0) || 0
  const description = String(item.description ?? item.name ?? '').trim()
  const currency = String(item.currency ?? '').trim() || undefined

  return {
    description: description || '',
    quantity,
    unitPrice,
    currency
  }
}

const normalizeAIResponse = (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw Object.assign(new Error('Réponse IA invalide.'), { status: 502 })
  }

  const clientId = payload.client_id ?? payload.clientId ?? null
  const items = Array.isArray(payload.items)
    ? payload.items
        .map(normalizeLineItem)
        .filter(Boolean)
        .filter((item) => item.description || item.quantity || item.unitPrice)
    : []

  return {
    client_id: clientId,
    issue_date: payload.issue_date ?? payload.issueDate ?? null,
    due_date: payload.due_date ?? payload.dueDate ?? null,
    status: payload.status ?? 'draft',
    notes: payload.notes ?? '',
    items,
    currency: payload.currency ?? (items[0]?.currency || undefined)
  }
}

export const generateInvoiceFromText = async (req, res, next) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({ message: 'OPENAI_API_KEY manquant.' })
    }

    const { texte } = req.body
    if (!texte) {
      return res.status(400).json({ message: 'Le champ texte est requis.' })
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: [
        { role: 'system', content: 'Tu es un assistant qui crée des factures JSON valides.' },
        {
          role: 'user',
          content: `Analyse ce texte et renvoie une facture JSON strictement valide : ${texte}`
        }
      ],
      response_format: { type: 'json_object' }
    })

    const content = response?.choices?.[0]?.message?.content
    if (!content) {
      throw Object.assign(new Error("Réponse IA vide ou invalide."), { status: 502 })
    }

    let rawPayload
    try {
      rawPayload = JSON.parse(content)
    } catch (parseError) {
      throw Object.assign(new Error('Réponse IA non parseable.'), { status: 502, cause: parseError })
    }

    const sanitized = normalizeAIResponse(rawPayload)
    res.json(sanitized)
  } catch (error) {
    next(error)
  }
}
