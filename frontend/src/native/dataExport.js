import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

export const shareNativeExport = async blob => {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(new Error('Impossible de préparer l’export.'))
    reader.readAsDataURL(blob)
  })
  const { uri } = await Filesystem.writeFile({ path: 'kadi-export/kadi-mes-donnees.json', directory: Directory.Cache, data: base64, recursive: true })
  await Share.share({ files: [uri], title: 'kadi-mes-donnees.json', dialogTitle: 'Enregistrer mes données' })
}
