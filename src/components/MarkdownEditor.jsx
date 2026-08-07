import { useEffect, useRef } from 'react'
import { marked } from 'marked'
import TurndownService from 'turndown'

// Markdown is the source of truth (used by the reading-grade badge and the PDF
// export). This editor renders it as real formatting the nurse can edit inline,
// and converts edits back to markdown on the way out.
marked.setOptions({ gfm: true, breaks: true })

const turndown = new TurndownService({
  headingStyle: 'atx', // # heading
  bulletListMarker: '-',
  emDelimiter: '_',
  codeBlockStyle: 'fenced',
})

export default function MarkdownEditor({ value, onChange, readOnly, placeholder }) {
  const ref = useRef(null)

  // Render external updates (streaming tokens, Load sample, unlock) into the
  // editable div — but never while the user is typing in it, which would reset
  // the caret. When focused, the div owns its own DOM until blur.
  useEffect(() => {
    const el = ref.current
    if (!el || document.activeElement === el) return
    const html = value ? marked.parse(value) : ''
    if (el.innerHTML !== html) el.innerHTML = html
  }, [value])

  function handleInput() {
    const md = turndown.turndown(ref.current.innerHTML).replace(/\n{3,}/g, '\n\n').trim()
    onChange(md)
  }

  const empty = !value || !value.trim()

  return (
    <div className="md-wrap">
      <div
        ref={ref}
        className="pane__text md-editor"
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onInput={handleInput}
        spellCheck={false}
        role="textbox"
        aria-multiline="true"
        aria-readonly={readOnly}
      />
      {empty && <div className="md-placeholder">{placeholder}</div>}
    </div>
  )
}
