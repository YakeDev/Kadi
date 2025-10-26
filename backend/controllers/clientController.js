import { supabase } from '../models/supabaseClient.js'

export const listClients = async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
    if (error) throw error
    res.json(data)
  } catch (error) {
    next(error)
  }
}

export const getClient = async (req, res, next) => {
  try {
    const { id } = req.params
    const { data, error } = await supabase.from('clients').select('*').eq('id', id).single()
    if (error) throw error
    res.json(data)
  } catch (error) {
    next(error)
  }
}

export const createClient = async (req, res, next) => {
  try {
    const payload = req.body
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
    const { data, error } = await supabase.from('clients').update(payload).eq('id', id).select().single()
    if (error) throw error
    res.json(data)
  } catch (error) {
    next(error)
  }
}

export const deleteClient = async (req, res, next) => {
  try {
    const { id } = req.params
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) throw error
    res.status(204).send()
  } catch (error) {
    next(error)
  }
}
