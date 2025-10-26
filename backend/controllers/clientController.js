import { supabase } from '../models/supabaseClient.js'

export const listClients = async (req, res, next) => {
  try {
    const tenantId = req.tenantId
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data)
  } catch (error) {
    next(error)
  }
}

export const getClient = async (req, res, next) => {
  try {
    const { id } = req.params
    const tenantId = req.tenantId
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    if (error) throw error
    res.json(data)
  } catch (error) {
    next(error)
  }
}

export const createClient = async (req, res, next) => {
  try {
    const tenantId = req.tenantId
    const payload = { ...req.body, tenant_id: tenantId }
    const { data, error } = await supabase.from('clients').insert(payload).select().single()
    if (error) throw error
    res.status(201).json(data)
  } catch (error) {
    next(error)
  }
}

export const updateClient = async (req, res, next) => {
  try {
    const { id } = req.params
    const payload = req.body
    const tenantId = req.tenantId
    const { data, error } = await supabase
      .from('clients')
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

export const deleteClient = async (req, res, next) => {
  try {
    const { id } = req.params
    const tenantId = req.tenantId
    const { error } = await supabase.from('clients').delete().eq('id', id).eq('tenant_id', tenantId)
    if (error) throw error
    res.status(204).send()
  } catch (error) {
    next(error)
  }
}
