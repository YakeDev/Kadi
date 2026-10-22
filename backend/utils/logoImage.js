import sharp from 'sharp'

// One bounded PNG representation works in PDFKit for every format accepted by the UI.
// No external URL is fetched; SVG rendering uses the bytes already in our bucket.
export const normalizeLogoImage = async (buffer) => {
  try {
    if (!buffer?.length || buffer.length > 1024 * 1024) throw new Error('size')
    const image = sharp(buffer, { limitInputPixels: 16_000_000, failOn: 'warning' })
    const metadata = await image.metadata()
    if (!['png', 'jpeg', 'webp', 'svg'].includes(metadata.format)) throw new Error('format')
    return await image.rotate().resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .png().toBuffer()
  } catch {
    throw Object.assign(new Error('Logo illisible. Utilisez une image PNG, JPEG, WebP ou SVG de 1 Mo maximum (16 millions de pixels maximum).'), { status: 400 })
  }
}
