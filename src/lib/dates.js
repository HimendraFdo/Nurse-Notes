// Deterministic date arithmetic for NZ follow-up shorthand.
//
// A 4B model gets slash shorthand wrong often enough to matter — `5/7` has
// come back as "seven days" and `6/52` as "6 weeks and 5 days". Rather than
// fight that with prompt rules, we parse the intervals and compute the dates
// here, then hand the model finished values it only has to copy.
//
// Nothing leaves the machine; this is plain string and Date work.

const UNITS = {
  7: { name: 'days', add: (d, n) => d.setDate(d.getDate() + n) },
  52: { name: 'weeks', add: (d, n) => d.setDate(d.getDate() + n * 7) },
  12: { name: 'months', add: (d, n) => d.setMonth(d.getMonth() + n) },
  24: { name: 'hours', add: (d, n) => d.setHours(d.getHours() + n) },
}

// The anchor is the date the document describes the patient leaving care.
// Preference order matters: a discharge summary carries both an admission and
// a discharge date, and follow-ups count from discharge.
const ANCHOR_PATTERNS = [
  { label: 'the day you left hospital', re: /\bdischarge?d?\b[^\n:]{0,20}[:\s]\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i },
  { label: 'the day of your clinic visit', re: /\bdate\s*\/?\s*time\b[^\n:]{0,10}[:\s]\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i },
  { label: 'the date on your notes', re: /\bdate\b[^\n:]{0,10}[:\s]\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i },
]

function toDate(dd, mm, yyyy) {
  // Midday avoids any daylight-saving edge landing on the wrong calendar day.
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), 12, 0, 0)
  const valid =
    d.getFullYear() === Number(yyyy) &&
    d.getMonth() === Number(mm) - 1 &&
    d.getDate() === Number(dd)
  return valid ? d : null
}

export function formatNZ(date) {
  const p = (n) => String(n).padStart(2, '0')
  return `${p(date.getDate())}/${p(date.getMonth() + 1)}/${date.getFullYear()}`
}

// Find the date the document was written / the patient was discharged.
export function findAnchorDate(text) {
  for (const { label, re } of ANCHOR_PATTERNS) {
    const m = re.exec(text)
    if (!m) continue
    const date = toDate(m[1], m[2], m[3])
    if (date) return { date, label, raw: `${m[1]}/${m[2]}/${m[3]}` }
  }
  return null
}

// Match `6/52`, `5/7`, `3/12`, `48/24`.
//
// The lookarounds do the disambiguation the prompt used to hand-wave at:
//   - a leading `/` rejects the tail of a compound (`3kg/10/7`) and of a
//     calendar date, so `10/7` and `03/1948` never match
//   - a trailing `/` or digit rejects `02/12/2026`, which would otherwise
//     read as "2 months"
//   - the denominator alternation rejects `2/2` ("because of"), blood
//     pressure `148/86`, and paired labs `138 / 4.2`
const INTERVAL_RE = /(?<![\d/])(\d{1,3})\s*\/\s*(7|52|12|24)(?![\d/])/g

// Not every interval is a future appointment. `4/7 productive cough` is how
// long a symptom had been going *before* admission, and `5/7 course` is how
// long to take a tablet. Attaching a future calendar date to either would be
// actively misleading, so only follow-up language earns a date.
const APPOINTMENT_RE =
  /\b(f\/u|follow.?up|review|r\/v|repeat|recheck|re-?check|clinic|appointment|opa|opc|refer|seen|book)\b/i

function classify(context) {
  return APPOINTMENT_RE.test(context) ? 'appointment' : 'duration'
}

function contextAround(text, index, length) {
  const start = Math.max(0, index - 45)
  const end = Math.min(text.length, index + length + 45)
  return text
    .slice(start, end)
    .replace(/\s+/g, ' ')
    .trim()
}

// Every interval in the document, with the text around it so a reader can
// tell an appointment from a course length.
export function findIntervals(text) {
  const out = []
  const seen = new Set()
  INTERVAL_RE.lastIndex = 0
  let m
  while ((m = INTERVAL_RE.exec(text)) !== null) {
    const count = Number(m[1])
    const denom = Number(m[2])
    if (!count) continue
    const token = `${m[1]}/${m[2]}`
    const context = contextAround(text, m.index, m[0].length)
    const key = `${token}|${context}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      token,
      count,
      denom,
      unit: UNITS[denom].name,
      context,
      kind: classify(context),
    })
  }
  return out
}

export function addInterval(anchor, count, denom) {
  const d = new Date(anchor.getTime())
  UNITS[denom].add(d, count)
  return d
}

// Resolve every interval against the anchor. Returns the anchor, the
// resolved rows, and any problem worth surfacing to the reviewing nurse.
export function resolveDates(text) {
  const anchor = findAnchorDate(text)
  const intervals = findIntervals(text)
  if (!intervals.length) return { anchor, rows: [], problem: null }
  if (!anchor) {
    return {
      anchor: null,
      rows: [],
      problem: 'No discharge or clinic date found in the document, so no dates could be worked out.',
    }
  }
  const rows = intervals.map((i) => ({
    ...i,
    // Durations describe a length of time, not a day on the calendar.
    date: i.kind === 'appointment' ? addInterval(anchor.date, i.count, i.denom) : null,
  }))
  return { anchor, rows, problem: null }
}

// The block appended to the user message. The model copies from this instead
// of counting days itself.
export function buildDateBrief(text) {
  const { anchor, rows, problem } = resolveDates(text)

  if (problem) {
    return [
      '--- PRE-COMPUTED DATES ---',
      problem,
      'Write [flag for nurse review: no date given] wherever a date is needed.',
      '--- END PRE-COMPUTED DATES ---',
    ].join('\n')
  }
  if (!rows.length) return ''

  const plainOf = (r) => `${r.count} ${r.count === 1 ? r.unit.replace(/s$/, '') : r.unit}`

  const appts = rows.filter((r) => r.date)
  const durations = rows.filter((r) => !r.date)

  const block = [
    '--- PRE-COMPUTED DATES (already worked out for you — do NOT do any date maths) ---',
    `Anchor date: ${formatNZ(anchor.date)} — ${anchor.label}.`,
  ]

  if (appts.length) {
    block.push('', 'APPOINTMENTS, TESTS AND SCANS — use the calendar date:')
    for (const r of appts) {
      block.push(
        `  "${r.token}" = ${plainOf(r)} -> ${formatNZ(r.date)}   [from: "${r.context}"]`,
      )
    }
  }
  if (durations.length) {
    block.push('', 'LENGTHS OF TIME — use the words only, these are NOT dates:')
    for (const r of durations) {
      block.push(`  "${r.token}" = ${plainOf(r)}   [from: "${r.context}"]`)
    }
  }

  block.push(
    '',
    'Copy these values exactly. For an appointment, test or scan, write the',
    'calendar date followed by the plain interval in brackets, for example',
    '"16/08/2026 (2 weeks after you left hospital)". For how long a symptom',
    'lasted or how long to take a medicine, use the words only — never a date.',
    '--- END PRE-COMPUTED DATES ---',
  )
  return block.join('\n')
}
