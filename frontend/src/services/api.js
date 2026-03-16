import axios from 'axios'
import { getAccessToken } from './session.js'

const backendUrl = import.meta.env.VITE_BACKEND_URL || ''
const baseURL = backendUrl ? backendUrl.replace(/\/$/, '') : ''

export const api = axios.create({
  baseURL: backendUrl ? `${baseURL}/api` : '/api',
  withCredentials: false
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error?.response?.data?.message || error.message
    return Promise.reject(new Error(message))
  }
)

api.interceptors.request.use(
  async (config) => {
    try {
      const token = await getAccessToken()
      config.headers = config.headers || {}
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      } else if (config.headers?.Authorization) {
        delete config.headers.Authorization
      }
    } catch (error) {
      console.warn('Impossible de récupérer la session Supabase courante.', error)
    }
    return config
  },
  (error) => Promise.reject(error)
)
