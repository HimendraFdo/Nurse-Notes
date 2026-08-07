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

const ACRONYM_RE = new RegExp(
  LB + '(?:' + ACRONYMS.slice().sort((a, b) => b.length - a.length).map(escapeRe).join('|') + ')' + RB,
  'g',
)
const WORD_RE = new RegExp(LB + '(?:' + JARGON_WORDS.map(escapeRe).join('|') + ')' + RB, 'gi')
// NZ time shorthand (6/52, 5/7) and concatenated doses (2.5mg, 1g, 500mcg).
const PATTERN_RE = new RegExp(
  LB + '(?:\\d+\\/(?:52|7)|\\d+(?:\\.\\d+)?\\s?(?:mg|mcg|g|ml|units?))' + RB,
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
