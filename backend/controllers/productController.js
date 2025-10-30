import { supabase } from '../models/supabaseClient.js'
import { getPaginationParams, buildPaginationMeta } from '../utils/pagination.js'

const TABLE_NAME = 'catalog_items'
const ITEM_TYPES = ['product', 'service']
const ALLOWED_FIELDS = ['name', 'description', 'item_type', 'unit_price', 'currency', 'sku', 'is_active']

const sanitizePayload = (body = {}, { ensureType = false } = {}) => {
  const payload = {}

  for (const field of ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      payload[field] = body[field]
    }
  }

  if (payload.name) {
    payload.name = String(payload.name).trim()
  }

  if (payload.description != null) {
    payload.description = String(payload.description).trim()
  }

  const providedType = payload.item_type != null ? String(payload.item_type).toLowerCase() : null
  if (providedType) {
    payload.item_type = ITEM_TYPES.includes(providedType) ? providedType : 'product'
  } else if (ensureType) {
    payload.item_type = 'product'
  }

  if (payload.unit_price != null) {
    const rawPrice = Number(payload.unit_price)
    payload.unit_price = Number.isFinite(rawPrice) ? rawPrice : 0
  }

  if (payload.currency) {
    payload.currency = String(payload.currency).trim().toUpperCase()
  }

  if (payload.sku != null) {
    payload.sku = String(payload.sku).trim()
    if (payload.sku === '') {
      payload.sku = null
    }
  }

  if (payload.is_active != null) {
    payload.is_active = Boolean(payload.is_active)
  }

  if (Object.keys(payload).length > 0) {
    payload.updated_at = new Date().toISOString()
  }

  return payload
}

export const listProducts = async (req, res, next) => {
  try {
    const tenantId = req.tenantId
    const { search, type, active } = req.query
    const { page, pageSize, from, to } = getPaginationParams(req.query)

    let query = supabase.from(TABLE_NAME).select('*', { count: 'exact' }).eq('tenant_id', tenantId)

    if (type && ITEM_TYPES.includes(type.toLowerCase())) {
      query = query.eq('item_type', type.toLowerCase())
    }

    if (active != null) {
      if (active === 'true' || active === 'false') {
        query = query.eq('is_active', active === 'true')
      }
    }

    if (search) {
      const term = `%${search.trim()}%`
      query = query.or(`name.ilike.${term},description.ilike.${term},sku.ilike.${term}`)
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)
    if (error) throw error

    res.json({
      data: data ?? [],
      pagination: buildPaginationMeta(count ?? 0, page, pageSize)
    })
  } catch (error) {
    next(error)
  }
}

export const createProduct = async (req, res, next) => {
  try {
    const tenantId = req.tenantId
    const payload = sanitizePayload(req.body, { ensureType: true })
    payload.tenant_id = tenantId

    if (!payload.name) {
      return res.status(400).json({ message: 'Le nom de l’article est obligatoire.' })
    }

    const { data, error } = await supabase.from(TABLE_NAME).insert(payload).select().single()
    if (error) throw error
    res.status(201).json(data)
  } catch (error) {
    next(error)
  }
}

export const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params
    const tenantId = req.tenantId
    const payload = sanitizePayload(req.body)

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ message: 'Aucune donnée à mettre à jour.' })
    }

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(payload)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw error
    res.json(data)
  } catch (error) {
    next(error)
  }
}

export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params
    const tenantId = req.tenantId
    const { error } = await supabase.from(TABLE_NAME).delete().eq('id', id).eq('tenant_id', tenantId)
    if (error) throw error
    res.status(204).send()
  } catch (error) {
    next(error)
  }
}
