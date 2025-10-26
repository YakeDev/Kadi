import { supabase } from '../models/supabaseClient.js'

export const listProducts = async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false })
    if (error) throw error
    res.json(data)
  } catch (error) {
    next(error)
  }
}

export const createProduct = async (req, res, next) => {
  try {
    const payload = req.body
    const { data, error } = await supabase.from('products').insert(payload).select().single()
    if (error) throw error
    res.status(201).json(data)
  } catch (error) {
    next(error)
  }
}

export const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params
    const payload = req.body
    const { data, error } = await supabase.from('products').update(payload).eq('id', id).select().single()
    if (error) throw error
    res.json(data)
  } catch (error) {
    next(error)
  }
}

export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) throw error
    res.status(204).send()
  } catch (error) {
    next(error)
  }
}
