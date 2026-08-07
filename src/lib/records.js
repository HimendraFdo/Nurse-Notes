// Client for the local records store (see server/records-api.js). The web app
// calls this from the same origin it is served on, so no base URL is needed.

// Pull a few patient identifiers out of the verbatim clinical note so the phone
// list can show a real name / NHI / ward instead of a placeholder. Best-effort:
// anything not found is left blank and the store falls back to a default.
export function parsePatientMeta(originalText = '') {
  const text = String(originalText)
  const grab = (re) => {
    const m = text.match(re)
    return m ? m[1].trim() : ''
  }

  // "Patient: Aroha Ngata (fictional)   NHI: ZZZ9999 ..." -> "Aroha Ngata".
  // Cut at the first field boundary: a run of 2+ spaces, a parenthetical, or
  // the next labelled field (NHI / DOB / Age).
  let patientName = grab(/^\s*Patient:\s*(.+)$/im)
  patientName = patientName.split(/\s{2,}|\s*\(|\bNHI:|\bDOB:|\bAge\b/i)[0].trim()

  const nhi = grab(/\bNHI:\s*([A-Za-z0-9]+)/i)
  const ward = grab(/\bWard:\s*([^\n]+?)(?:\s{2,}|$)/i)

  // Hospital name is usually the first non-empty line, e.g.
  // "Waikato Hospital — Discharge Summary".
  const firstLine =
    text
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && !/^\[/.test(l)) || ''
  const hospital = firstLine.split(/[—–-]/)[0].trim()

  return { patientName, nhi, ward, hospital }
}

// Submit an approved summary to the local store. Returns the stored record.
export async function submitRecord(record) {
  const res = await fetch('/api/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  })
  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.json())?.error || ''
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Submit failed (HTTP ${res.status})`)
  }
  return res.json()
}
