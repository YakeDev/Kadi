import { api } from './api.js'

export const fetchCatalogItems = async (params = {}) => {
  const { data } = await api.get('/products', { params })
  return data
}

export const createCatalogItem = async (payload) => {
  const { data } = await api.post('/products', payload)
  return data
}

export const updateCatalogItem = async (id, payload) => {
  const { data } = await api.patch(`/products/${id}`, payload)
  return data
}

export const deleteCatalogItem = async (id) => {
  await api.delete(`/products/${id}`)
}
