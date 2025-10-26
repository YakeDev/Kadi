import axios from 'axios'

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
  (config) => {
    if (typeof window !== 'undefined') {
      const storedSession = window.localStorage.getItem('kadi.session')
      if (storedSession) {
        try {
          const session = JSON.parse(storedSession)
          const token = session?.access_token
          if (token) {
            config.headers.Authorization = `Bearer ${token}`
          }
        } catch (error) {
          console.warn('Session invalide dans le localStorage.', error)
        }
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)
