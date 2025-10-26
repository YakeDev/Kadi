import { supabase } from '../models/supabaseClient.js'

export const signup = async (req, res, next) => {
  try {
    const { email, password, company } = req.body
    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis.' })
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { company }
    })

    if (error) throw error
    res.status(201).json({ user: data.user })
  } catch (error) {
    next(error)
  }
}

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis.' })
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) throw error
    res.json(data)
  } catch (error) {
    next(error)
  }
}

export const logout = async (req, res, next) => {
  try {
    await supabase.auth.signOut()
    res.status(200).json({ message: 'Déconnecté' })
  } catch (error) {
    next(error)
  }
}

export const createProfile = async (req, res, next) => {
  try {
    const { email, company } = req.body
    if (!email) {
      return res.status(400).json({ message: 'Email requis.' })
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert({ email, company })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (error) {
    next(error)
  }
}
