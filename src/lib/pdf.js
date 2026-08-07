// Build the patient-facing PDF from the approved plain-language text.
// Runs entirely in the browser via jsPDF — no server, nothing uploaded.
import { jsPDF } from 'jspdf'

// The exact section headings the model is prompted to emit
// (prompts/system-prompt.txt, Step 4). Lines that match one of these are
// rendered as bold headings in the PDF. Keep this list in sync with the
// prompt — an unlisted heading silently renders as body text.
const KNOWN_HEADINGS = [
  'Why you were seen',
  'Your medicines and what changed',
  'Looking after yourself at home',
  'Warning signs — call someone now',
  'Warning signs - call someone now',
  'Follow-up appointments',
  'Activity limits',
  'Who to call',
]

function isHeading(line) {
  const t = line.trim().replace(/[:*#]/g, '').trim()
  return KNOWN_HEADINGS.some((h) => t.toLowerCase() === h.toLowerCase())
}

// Remove inline markdown markers so no literal ** _ ` # leak into the PDF.
function stripInline(s) {
  return s
    .replace(/^#{1,6}\s*/, '') // leading heading hashes
    .replace(/\*\*(.+?)\*\*/g, '$1') // **bold**
    .replace(/(^|[^*])\*(?!\*)([^*]+?)\*(?!\*)/g, '$1$2') // *italic*
    .replace(/__(.+?)__/g, '$1') // __bold__
    .replace(/(^|[^_])_(?!_)([^_]+?)_(?!_)/g, '$1$2') // _italic_
    .replace(/`([^`]+?)`/g, '$1') // `code`
    .trim()
}

export function buildPatientPdf({ text, nurseName, approvedAt }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 56
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const maxWidth = pageWidth - margin * 2
  let y = margin

  const newPageIfNeeded = (lineHeight) => {
    if (y + lineHeight > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
  }

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Your discharge summary', margin, y)
  y += 22
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(110)
  doc.text('In plain language — reviewed and approved by your care team.', margin, y)
  doc.setTextColor(0)
  y += 20

  // Divider
  doc.setDrawColor(210)
  doc.line(margin, y, pageWidth - margin, y)
  y += 20

  // Body
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    if (line.trim() === '') {
      y += 8
      continue
    }
    if (isHeading(line)) {
      y += 6
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      newPageIfNeeded(18)
      doc.text(line.trim().replace(/[:*#]/g, '').trim(), margin, y)
      y += 18
      continue
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)

    // Bullet list item? Render a real bullet with a hanging indent. Leading
    // whitespace marks nesting depth (turndown indents nested items).
    const bullet = line.match(/^(\s*)[-*+]\s+(.*)$/)
    let x = margin
    let content = line
    let bulletChar = ''
    if (bullet) {
      const depth = Math.floor(bullet[1].length / 2)
      x = margin + 14 + depth * 14
      content = bullet[2]
      bulletChar = '•  '
    }

    content = stripInline(content)
    const bulletWidth = bulletChar ? doc.getTextWidth(bulletChar) : 0
    const wrapped = doc.splitTextToSize(content, maxWidth - (x - margin) - bulletWidth)
    wrapped.forEach((wl, i) => {
      newPageIfNeeded(15)
      if (i === 0 && bulletChar) doc.text(bulletChar, x, y)
      doc.text(wl, x + bulletWidth, y) // hanging indent aligns wrapped lines
      y += 15
    })
  }

  // Approval footer on every page
  const stamp = `Approved by ${nurseName} — ${approvedAt}`
  const privacy = 'Prepared on-device. No data left this machine.'
  const pageCount = doc.internal.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setDrawColor(210)
    doc.line(margin, pageHeight - margin + 8, pageWidth - margin, pageHeight - margin + 8)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(stamp, margin, pageHeight - margin + 22)
    doc.text(privacy, margin, pageHeight - margin + 33)
    doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin, pageHeight - margin + 22, {
      align: 'right',
    })
    doc.setTextColor(0)
  }

  return doc
}

export function downloadPatientPdf(opts) {
  const doc = buildPatientPdf(opts)
  const safeName = (opts.nurseName || 'nurse').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  doc.save(`plain-language-summary-${safeName}.pdf`)
}
