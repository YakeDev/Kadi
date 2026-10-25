import { api } from '../services/api.js'
import { isNativeAndroid } from '../native/platform.js'
export const downloadDocument = async (path, filename) => {
  const { data } = await api.get(path, { responseType: 'blob' })
  const safeName = filename.replace(/[^a-z0-9_.-]/giu, '-')
  const blob = new Blob([data], { type: 'application/pdf' })
  if (isNativeAndroid()) {
    const { shareNativePdf } = await import('../native/documents.js')
    return shareNativePdf(blob, safeName)
  }
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = safeName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { action: 'downloaded' }
}
