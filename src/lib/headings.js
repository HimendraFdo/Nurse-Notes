// The exact section headings the model is prompted to emit
// (prompts/system-prompt.txt, "Output these sections, in order").
//
// The model writes them as bare lines, not as markdown `## Heading`, so both
// renderers have to recognise them by text. Keeping the list here means the
// editor and the PDF can't drift apart — an unlisted heading silently renders
// as body text in both.
export const KNOWN_HEADINGS = [
  'Why you were seen',
  'Your medicines and what changed',
  'Looking after yourself at home',
  'Warning signs — call someone now',
  'Follow-up appointments',
  'Activity limits',
  'Who to call',
]

// Markdown markers removed — this is the heading text as it should be shown.
export const stripMarkers = (line) => line.replace(/[:*#]/g, '').trim()

// Additionally dash- and space-normalised for matching only, so a heading the
// nurse retyped as `## Warning signs - call someone now` still matches.
export const headingKey = (line) =>
  stripMarkers(line).replace(/[–—]/g, '-').replace(/\s+/g, ' ').toLowerCase()

const HEADING_KEYS = new Set(KNOWN_HEADINGS.map(headingKey))

export const isKnownHeading = (line) => HEADING_KEYS.has(headingKey(line))

// A markdown list item — `- foo`, `* foo`, `1. foo`. Excluded from promotion
// below: stripMarkers() drops the `*`, so a bullet that happens to repeat a
// heading's wording would otherwise be turned into a heading.
const LIST_ITEM_RE = /^\s*(?:[-*+]\s|\d+[.)]\s)/

// Promote bare heading lines to `## Heading` so `marked` renders them as real
// headings instead of running them into the following sentence as body text.
//
// Runs on every streamed token, so it stays a cheap line scan. A partially
// streamed heading simply doesn't match yet and renders as a paragraph until
// the line completes.
export function promoteHeadings(markdown = '') {
  if (!markdown) return markdown
  return markdown
    .split('\n')
    .map((line) => {
      if (!line.trim() || line.trimStart().startsWith('#')) return line
      if (LIST_ITEM_RE.test(line)) return line
      return isKnownHeading(line) ? `## ${stripMarkers(line)}` : line
    })
    .join('\n')
}
