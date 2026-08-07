import { useMemo } from 'react'
import { readingGrade, gradeLabel, countJargon } from '../lib/readability.js'

// Both panes and the patient view share these, so they live outside App.jsx.

function levelClass(level) {
  return `badge badge--${level.replace(/\s+/g, '-')}`
}

// Flesch–Kincaid grade for the rewrite. 6th grade or below is the target.
export function GradeBadge({ text }) {
  const grade = useMemo(() => readingGrade(text), [text])
  if (grade == null) return <span className="badge badge--empty">—</span>
  const level = gradeLabel(grade)
  return (
    <span
      className={levelClass(level)}
      title={`Flesch–Kincaid reading grade ${grade} (${level}). Target for patients: 6th grade or below.`}
    >
      {grade <= 6 && <span className="badge__tick" aria-hidden="true">✓</span>}
      <strong>{grade}</strong>
      <span className="badge__unit">grade</span>
    </span>
  )
}

// Clinical shorthand count for the source document — see readability.js for
// why the source gets this instead of a reading grade.
export function JargonBadge({ text }) {
  const { count, unique } = useMemo(() => countJargon(text), [text])
  if (!text.trim()) return <span className="badge badge--empty">—</span>
  const level = count === 0 ? 'plain language' : count <= 8 ? 'moderate' : 'complex'
  return (
    <span
      className={levelClass(level)}
      title={
        count === 0
          ? 'No clinical shorthand detected — a patient can read this.'
          : `${count} pieces of clinical shorthand (${unique} distinct) a patient can't decode.`
      }
    >
      <strong>{count}</strong>
      <span className="badge__unit">jargon</span>
    </span>
  )
}
