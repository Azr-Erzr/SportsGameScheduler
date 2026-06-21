type PdfImagePage = {
  bytes: Uint8Array
  width: number
  height: number
}

type PdfPalette = 'light' | 'dark'

const encoder = new TextEncoder()

const PAGE = {
  width: 612,
  height: 792,
  margin: 18,
}

const BACKGROUNDS: Record<PdfPalette, [number, number, number]> = {
  light: [0.953, 0.925, 0.851],
  dark: [0.031, 0.063, 0.031],
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
}

function contentStreamFor(page: PdfImagePage, imageName: string, palette: PdfPalette) {
  const maxW = PAGE.width - PAGE.margin * 2
  const maxH = PAGE.height - PAGE.margin * 2
  const scale = Math.min(maxW / page.width, maxH / page.height)
  const drawW = page.width * scale
  const drawH = page.height * scale
  const x = (PAGE.width - drawW) / 2
  const y = (PAGE.height - drawH) / 2
  const [r, g, b] = BACKGROUNDS[palette]

  return [
    'q',
    `${r} ${g} ${b} rg 0 0 ${PAGE.width} ${PAGE.height} re f`,
    'Q',
    'q',
    `${formatNumber(drawW)} 0 0 ${formatNumber(drawH)} ${formatNumber(x)} ${formatNumber(y)} cm`,
    `/${imageName} Do`,
    'Q',
    '',
  ].join('\n')
}

export function createPdfBlobFromImages(pages: PdfImagePage[], palette: PdfPalette = 'light') {
  if (pages.length === 0) throw new Error('Cannot create a PDF without pages.')

  const chunks: Uint8Array[] = []
  const offsets: number[] = []
  let offset = 0

  function write(bytes: Uint8Array) {
    chunks.push(bytes)
    offset += bytes.byteLength
  }

  function writeText(text: string) {
    const bytes = encoder.encode(text)
    write(bytes)
  }

  function startObject(id: number) {
    offsets[id] = offset
    writeText(`${id} 0 obj\n`)
  }

  writeText('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')

  const catalogId = 1
  const pagesId = 2
  const pageIds = pages.map((_, index) => 3 + index * 3)
  const imageIds = pages.map((_, index) => 4 + index * 3)
  const contentIds = pages.map((_, index) => 5 + index * 3)
  const objectCount = 2 + pages.length * 3

  startObject(catalogId)
  writeText(`<< /Type /Catalog /Pages ${pagesId} 0 R >>\nendobj\n`)

  startObject(pagesId)
  writeText(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj\n`)

  pages.forEach((page, index) => {
    const imageName = `Im${index + 1}`
    const content = contentStreamFor(page, imageName, palette)
    const contentBytes = encoder.encode(content)

    startObject(pageIds[index])
    writeText(
      [
        '<< /Type /Page',
        `/Parent ${pagesId} 0 R`,
        `/MediaBox [0 0 ${PAGE.width} ${PAGE.height}]`,
        `/Resources << /XObject << /${imageName} ${imageIds[index]} 0 R >> >>`,
        `/Contents ${contentIds[index]} 0 R`,
        '>>',
        'endobj',
        '',
      ].join('\n'),
    )

    startObject(imageIds[index])
    writeText(
      [
        '<< /Type /XObject',
        '/Subtype /Image',
        `/Width ${page.width}`,
        `/Height ${page.height}`,
        '/ColorSpace /DeviceRGB',
        '/BitsPerComponent 8',
        '/Filter /DCTDecode',
        `/Length ${page.bytes.byteLength}`,
        '>>',
        'stream',
        '',
      ].join('\n'),
    )
    write(page.bytes)
    writeText('\nendstream\nendobj\n')

    startObject(contentIds[index])
    writeText(`<< /Length ${contentBytes.byteLength} >>\nstream\n`)
    write(contentBytes)
    writeText('endstream\nendobj\n')
  })

  const xrefOffset = offset
  writeText(`xref\n0 ${objectCount + 1}\n`)
  writeText('0000000000 65535 f \n')
  for (let id = 1; id <= objectCount; id += 1) {
    writeText(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`)
  }
  writeText(`trailer\n<< /Size ${objectCount + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`)

  const blobParts = chunks.map((chunk) => {
    const buffer = new ArrayBuffer(chunk.byteLength)
    new Uint8Array(buffer).set(chunk)
    return buffer
  })

  return new Blob(blobParts, { type: 'application/pdf' })
}

export function canvasToJpegPage(canvas: HTMLCanvasElement) {
  return new Promise<PdfImagePage>((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error('Could not create PDF artwork.'))
          return
        }
        resolve({
          bytes: new Uint8Array(await blob.arrayBuffer()),
          width: canvas.width,
          height: canvas.height,
        })
      },
      'image/jpeg',
      0.94,
    )
  })
}
