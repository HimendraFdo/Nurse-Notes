<<<<<<< HEAD
=======
// Flesch–Kincaid grade level, computed client-side. No external API.
// Grade = 0.39*(words/sentences) + 11.8*(syllables/words) - 15.59

function countSyllablesInWord(raw) {
  const word = raw.toLowerCase().replace(/[^a-z]/g, '')
  if (!word) return 0
  if (word.length <= 3) return 1

  // Drop common silent endings, and a leading y (a consonant in that position).
  const stem = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '')

  const groups = stem.match(/[aeiouy]{1,2}/g)
  return groups ? groups.length : 1
}

function countSentences(text) {
  // Strip period artifacts that aren't sentence endings, so clinical text
  // like "38.7", "sats 89%", or "Dr S. Patel" isn't split into fragments.
  const cleaned = text
    .replace(/(\d)[.,](\d)/g, '$1$2') // decimals / thousands: 38.7 -> 387
    .replace(/\b([A-Za-z])\./g, '$1') // single-letter initials: S. -> S

  // A sentence ends at . ! ? followed by whitespace or end of text.
  const matches = cleaned.match(/[.!?]+(?:\s|$)/g)
  return Math.max(matches?.length ?? 0, 1)
}

export function readingGrade(text) {
  if (!text || !text.trim()) return null

  const sentences = countSentences(text)

  // Words: run of letters/digits/apostrophes.
  const words = text.match(/[A-Za-z0-9']+/g) || []
  if (words.length === 0) return null

  const syllables = words.reduce((sum, w) => sum + countSyllablesInWord(w), 0)

  const grade =
    0.39 * (words.length / sentences) +
    11.8 * (syllables / words.length) -
    15.59

  // Clamp to a sane display range.
  return Math.max(1, Math.round(grade))
}

// Human label for a grade number, used in badge tooltips.
export function gradeLabel(grade) {
  if (grade <= 6) return 'plain language'
  if (grade <= 9) return 'moderate'
  return 'complex'
}

>>>>>>> dbd1531cec49b0cdc9b3fba7345624f181a4be1e
// ---------------------------------------------------------------------------
// Clinical shorthand / jargon detector.
//
// Reading-grade formulas measure sentence and word LENGTH, so they rate
// telegraphic clinical shorthand ("SOB", "6/52", "2.5mg OD") as "easy" — the
// opposite of a patient's experience. This counts the shorthand a patient
// can't decode, which is the real accessibility signal on the source document.
// ---------------------------------------------------------------------------

// Uppercase clinical acronyms — matched case-sensitively (they appear
// uppercase in notes; case-insensitive would false-match inside plain words).
const ACRONYMS = [
  'TDS', 'OD', 'BD', 'QDS', 'QID', 'TID', 'PRN', 'PO', 'IV', 'IM', 'SC', 'SL',
  'SOB', 'PC', 'O/E', 'Ix', 'Dx', 'Mgmt', 'F/U', 'r/v', 'd/c', 'OPA', 'GP',
  'RA', 'RR', 'RLL', 'LLL', 'LFT', 'U&E', 'bpm', 'CXR', 'ECG', 'CRP', 'WCC',
  'eGFR', 'Trop', 'HbA1c', 'AF', 'T2DM', 'CKD', 'NHI', 'DOB', 'CHA2DS2-VASc',
]

// Lowercase medical words most patients won't know — matched case-insensitively.
const JARGON_WORDS = [
  'haemoptysis', 'hemoptysis', 'melaena', 'melena', 'consolidation',
  'anticoagulant', 'febrile', 'crackles', 'sats', 'nocte', 'mane', 'stat',
  'dyspnoea', 'oedema', 'tachycardia',
]

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Boundaries that treat letters/digits as "word" chars, so shorthand with
// slashes (O/E, 6/52) still matches but substrings inside words do not.
const LB = '(?<![A-Za-z0-9])'
const RB = '(?![A-Za-z0-9])'

// Longest alternative first, so multi-part shorthand (CHA2DS2-VASc) wins over
// the shorter acronyms it starts with.
const byLengthDesc = [...ACRONYMS].sort((a, b) => b.length - a.length)

const ACRONYM_RE = new RegExp(`${LB}(?:${byLengthDesc.map(escapeRe).join('|')})${RB}`, 'g')
const WORD_RE = new RegExp(`${LB}(?:${JARGON_WORDS.map(escapeRe).join('|')})${RB}`, 'gi')
// NZ time shorthand (6/52, 5/7) and concatenated doses (2.5mg, 1g, 500mcg).
const PATTERN_RE = new RegExp(
  `${LB}(?:\\d+/(?:52|7)|\\d+(?:\\.\\d+)?\\s?(?:mg|mcg|g|ml|units?))${RB}`,
  'gi',
)

// Returns { count, unique } — total shorthand occurrences and distinct terms.
export function countJargon(text) {
  if (!text || !text.trim()) return { count: 0, unique: 0 }
  const hits = [
    ...(text.match(ACRONYM_RE) || []),
    ...(text.match(WORD_RE) || []),
    ...(text.match(PATTERN_RE) || []),
  ]
  const unique = new Set(hits.map((h) => h.toLowerCase().replace(/\s+/g, ''))).size
  return { count: hits.length, unique }
}
