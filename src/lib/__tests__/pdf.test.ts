import { describe, expect, test } from 'vitest'
import { createPdfBlobFromImages } from '../pdf'

function fakeJpegBytes() {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0xff, 0xd9])
}

describe('createPdfBlobFromImages', () => {
  test('creates a multi-page PDF with embedded JPEG artwork', async () => {
    const blob = createPdfBlobFromImages([
      { bytes: fakeJpegBytes(), width: 2160, height: 3000 },
      { bytes: fakeJpegBytes(), width: 2160, height: 3000 },
    ])
    const text = new TextDecoder('latin1').decode(await blob.arrayBuffer())

    expect(blob.type).toBe('application/pdf')
    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text).toContain('/Count 2')
    expect(text.match(/\/Subtype \/Image/g)).toHaveLength(2)
    expect(text).toContain('/Filter /DCTDecode')
    expect(text).toContain('xref')
    expect(text).toContain('%%EOF')
  })

  test('rejects empty PDFs', () => {
    expect(() => createPdfBlobFromImages([])).toThrow('Cannot create a PDF without pages.')
  })
})
