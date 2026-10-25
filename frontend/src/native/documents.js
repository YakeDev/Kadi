import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

const documentFolder = 'kadi-pdf'
const retentionMs = 24 * 60 * 60 * 1000
const asBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result).split(',')[1])
  reader.onerror = () => reject(new Error('Impossible de préparer le PDF.'))
  reader.readAsDataURL(blob)
})

export const clearNativeDocuments = async () => {
  // Only this app's temporary PDF folder; never user-selected shared copies.
  try { await Filesystem.rmdir({ path: documentFolder, directory: Directory.Cache, recursive: true }) } catch { /* Folder may not exist. */ }
}

export const shareNativePdf = async (blob, filename) => {
  if (!(await Share.canShare()).value) throw new Error('Le partage de fichiers est indisponible sur cet appareil.')
  try {
    const { files } = await Filesystem.readdir({ path: documentFolder, directory: Directory.Cache })
    await Promise.all(files.filter(file => file.type === 'directory' && Date.now() - file.mtime > retentionMs)
      .map(file => Filesystem.rmdir({ path: `${documentFolder}/${file.name}`, directory: Directory.Cache, recursive: true })))
  } catch { /* A fresh installation has no cached PDFs. */ }
  // A separate directory per export preserves the readable filename and prevents
  // a later payment PDF from overwriting a document still being shared.
  const path = `${documentFolder}/${crypto.randomUUID()}/${filename}`
  const { uri } = await Filesystem.writeFile({ path, directory: Directory.Cache, data: await asBase64(blob), recursive: true })
  try {
    await Share.share({ files: [uri], title: filename, dialogTitle: 'Partager le PDF' })
    return { action: 'shared' }
  } catch (error) {
    if (/cancel/i.test(error?.message || '')) {
      await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => {})
      return { action: 'cancelled' }
    }
    throw error
  }
}
