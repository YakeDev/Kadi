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
