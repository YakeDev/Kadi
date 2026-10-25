import { api } from '../services/api.js'
export const downloadDocument = async (path, filename) => {
  const { data } = await api.get(path, { responseType: 'blob' })
  const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename.replace(/[^a-z0-9_.-]/giu, '-')
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
