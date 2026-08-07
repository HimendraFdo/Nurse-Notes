import { useRef, useState } from 'react'
import { generateRewrite, DEFAULT_BASE_URL, DEFAULT_MODEL } from './lib/llm.js'
import { extractText } from './lib/extractText.js'
import { downloadPatientPdf } from './lib/pdf.js'
import { GradeBadge, JargonBadge } from './components/Badges.jsx'
import MarkdownEditor from './components/MarkdownEditor.jsx'
import PatientView from './PatientView.jsx'
import SAMPLE_TEXT from '../samples/synthetic-discharge-01.txt?raw'

// Branding chrome shared by the clinician and patient views.
function Shell({ tagline, action, children }) {
  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo" aria-hidden="true">✚</span>
          <div>
            <h1>Nurse Notes</h1>
            <p className="app__tagline">{tagline}</p>
          </div>
        </div>
        {action}
      </header>
      {children}
      <footer className="app__footer">
        Runs entirely on this device. No data leaves your machine.
      </footer>
    </div>
  )
}

export default function App() {
  const [original, setOriginal] = useState('')
  const [rewrite, setRewrite] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')

  const [approved, setApproved] = useState(null) // { nurseName, at }
  const [nurseName, setNurseName] = useState('')

  const [showSettings, setShowSettings] = useState(false)
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL)
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [view, setView] = useState('clinician') // 'clinician' | 'patient'

  const fileInputRef = useRef(null)
  const abortRef = useRef(null)

  const isApproved = approved != null

  // Called whenever the source document changes. Aborts any in-flight stream,
  // otherwise its tokens would keep appending to the cleared rewrite.
  function resetRewriteState() {
    abortRef.current?.abort()
    setRewrite('')
    setError('')
    setApproved(null)
    setView('clinician')
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await extractText(file)
      setOriginal(text)
      resetRewriteState()
    } catch (err) {
      setError(`Could not read file: ${err.message}`)
    } finally {
      e.target.value = '' // allow re-selecting the same file
    }
  }

  async function handleGenerate() {
    if (!original.trim() || isGenerating) return
    setError('')
    setRewrite('')
    setApproved(null)
    setIsGenerating(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await generateRewrite({
        originalText: original,
        baseUrl,
        model,
        signal: controller.signal,
        onToken: (delta) => setRewrite((prev) => prev + delta),
      })
    } catch (err) {
      // Stop button — keep whatever streamed in so far, it's still editable.
      if (err.name !== 'AbortError') {
        setError(
          `${err.message}\n\nCheck that LM Studio is running with the server started ` +
            `(Developer tab → Start Server) at ${baseUrl}.`,
        )
      }
    } finally {
      abortRef.current = null
      setIsGenerating(false)
    }
  }

  function handleApprove() {
    const name = nurseName.trim()
    if (!name || !rewrite.trim()) return
    const at = new Date().toLocaleString('en-NZ', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    setApproved({ nurseName: name, at })
  }

  function handleUnlock() {
    setApproved(null)
    setView('clinician')
  }

  if (view === 'patient') {
    return (
      <Shell tagline="Patient view — what the patient sees on their phone">
        <PatientView rewrite={rewrite} approved={approved} onBack={() => setView('clinician')} />
      </Shell>
    )
  }

  return (
    <Shell
      tagline="Clinician review — plain-language discharge summaries"
      action={
        <button className="link-btn" onClick={() => setShowSettings((s) => !s)}>
          {showSettings ? 'Hide settings' : 'Settings'}
        </button>
      }
    >
      {showSettings && (
        <div className="settings">
          <label>
            LM Studio base URL
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} spellCheck={false} />
            <span className="settings__note">
              Under <code>npm run dev</code> this routes through the dev-server proxy (no CORS
              needed). In the single-file build it defaults to
              <code> http://localhost:1234/v1</code> directly — enable CORS in LM Studio for that mode.
            </span>
          </label>
          <label>
            Model
            <input value={model} onChange={(e) => setModel(e.target.value)} spellCheck={false} />
          </label>
          <p className="settings__hint">
            Swap to a larger model (e.g. Qwen 3 8B) for cleaner output. The review gate stays either way.
          </p>
        </div>
      )}

      {/* The gate banner — visible until Approve is clicked. */}
      {isApproved ? (
        <div className="banner banner--approved">
          <span className="banner__icon" aria-hidden="true">✓</span>
          <div>
            <strong>Approved for release</strong>
            <span className="banner__sub">
              Approved by {approved.nurseName} · {approved.at}
            </span>
          </div>
          <button className="btn btn--ghost banner__action" onClick={handleUnlock}>
            Unlock &amp; edit
          </button>
        </div>
      ) : (
        <div className="banner banner--warn">
          <span className="banner__icon" aria-hidden="true">⚠</span>
          <div>
            <strong>Nurse review required before release</strong>
            <span className="banner__sub">
              Read the plain-language version, correct any errors, then approve.
            </span>
          </div>
        </div>
      )}

      <main className="panes">
        {/* LEFT — Original */}
        <section className="pane pane--original">
          <div className="pane__head">
            <h2>Original</h2>
            <JargonBadge text={original} />
          </div>
          <div className="pane__toolbar">
            <button className="btn btn--sm" onClick={() => fileInputRef.current?.click()}>
              Upload .txt / .md / .pdf
            </button>
            <button
              className="btn btn--sm btn--ghost"
              onClick={() => {
                setOriginal(SAMPLE_TEXT)
                resetRewriteState()
              }}
            >
              Load sample
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
              onChange={handleFile}
              hidden
            />
          </div>
          <textarea
            className="pane__text"
            placeholder="Paste the clinical discharge text here, or upload a file / load the sample."
            value={original}
            onChange={(e) => setOriginal(e.target.value)}
            spellCheck={false}
          />
        </section>

        {/* RIGHT — Plain Language */}
        <section className="pane pane--plain">
          <div className="pane__head">
            <h2>Plain Language</h2>
            <GradeBadge text={rewrite} />
          </div>
          <div className="pane__toolbar">
            {isGenerating ? (
              <>
                <button className="btn btn--sm btn--warn" onClick={() => abortRef.current?.abort()}>
                  Stop
                </button>
                <span className="spinner" aria-label="Generating" />
              </>
            ) : (
              <button
                className="btn btn--sm btn--primary"
                onClick={handleGenerate}
                disabled={!original.trim()}
              >
                {rewrite ? 'Regenerate' : 'Generate'}
              </button>
            )}
          </div>
          <MarkdownEditor
            value={rewrite}
            onChange={setRewrite}
            readOnly={isApproved}
            placeholder="The plain-language rewrite will appear here, formatted. It is editable — correct anything the model got wrong before approving."
          />
        </section>
      </main>

      {error && <pre className="error">{error}</pre>}

      {/* Approval gate controls */}
      <section className="approve">
        <div className="approve__field">
          <label htmlFor="nurse">Reviewing nurse</label>
          <input
            id="nurse"
            placeholder="Your name"
            value={nurseName}
            onChange={(e) => setNurseName(e.target.value)}
            disabled={isApproved}
          />
        </div>
        {!isApproved ? (
          <button
            className="btn btn--primary btn--lg"
            onClick={handleApprove}
            disabled={!rewrite.trim() || !nurseName.trim()}
          >
            Approve for release
          </button>
        ) : (
          <>
            <button className="btn btn--ghost btn--lg" onClick={() => setView('patient')}>
              View on patient's phone
            </button>
            <button
              className="btn btn--primary btn--lg"
              onClick={() =>
                downloadPatientPdf({
                  text: rewrite,
                  nurseName: approved.nurseName,
                  approvedAt: approved.at,
                })
              }
            >
              Export patient PDF
            </button>
          </>
        )}
      </section>
    </Shell>
  )
}
