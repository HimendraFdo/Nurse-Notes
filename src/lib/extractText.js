// Extract plain text from an uploaded file: .txt / .md read directly,
// .pdf parsed locally with pdf.js. Nothing is uploaded anywhere.
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Point pdf.js at the worker bundled by Vite (stays fully offline).
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

async function extractPdf(file) {
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    // Join items; insert a newline when pdf.js marks end-of-line.
    let line = ''
    const lines = []
    for (const item of content.items) {
      line += item.str
      if (item.hasEOL) {
        lines.push(line)
        line = ''
      }
    }
    if (line) lines.push(line)
    pages.push(lines.join('\n'))
  }
  return pages.join('\n\n')
}

export async function extractText(file) {
  const name = (file.name || '').toLowerCase()
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    return extractPdf(file)
  }
  // .txt, .md, or anything else — read as UTF-8 text.
  return file.text()
}
