import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { GradeBadge } from './App.jsx'

// The patient-facing mobile view: what the patient actually sees on their
// phone after the clinician approves. Two ways to get the text onto the
// phone, both fully offline (no server, no upload):
//   1. Scan the QR code — the approved text is encoded directly into it, so
//      the patient's phone camera app opens it with nothing to install.
//   2. Or preview it right here in a phone-shaped frame, for the demo.
// SOTA on-device TTS (Kokoro etc.) needs a model download, which breaks the
// "single file, works offline the moment it opens" story — the browser's
// built-in Web Speech API (SpeechSynthesis) ships in every major browser,
// needs no download, and is the honest choice for a hackathon demo of this
// scope. Named as a future-roadmap upgrade path in the docx/slides.

// QR codes have a practical capacity ceiling (~2-3KB at low error
// correction). Long summaries still render — the QR just gets denser — but
// past this we warn rather than silently truncate the patient's record.
const QR_SAFE_LIMIT = 1500

function speakSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function useSpeech(text) {
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    return () => window.speechSynthesis?.cancel()
  }, [])

  function toggle() {
    if (!speakSupported()) return
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const utter = new SpeechSynthesisUtterance(text)
    utter.rate = 0.95
    utter.onend = () => setSpeaking(false)
    utter.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utter)
    setSpeaking(true)
  }

  return { speaking, toggle, supported: speakSupported() }
}

export default function PatientView({ rewrite, approved, onBack }) {
  const { speaking, toggle, supported } = useSpeech(rewrite)
  const qrPayload = useMemo(() => {
    const header = `Discharge summary — approved by ${approved?.nurseName ?? ''} on ${approved?.at ?? ''}\n\n`
    return header + rewrite
  }, [rewrite, approved])
  const qrTooLong = qrPayload.length > QR_SAFE_LIMIT

  return (
    <div className="patient">
      <button className="link-btn patient__back" onClick={onBack}>
        ← Back to clinician review
      </button>

      <div className="phone">
        <div className="phone__notch" aria-hidden="true" />
        <div className="phone__screen">
          <header className="phone__header">
            <span className="phone__logo" aria-hidden="true">✚</span>
            <div>
              <strong>My discharge summary</strong>
              <span className="phone__sub">Reviewed by your care team</span>
            </div>
          </header>

          <div className="phone__badge-row">
            <GradeBadge text={rewrite} />
            <button
              className="btn btn--sm btn--ghost phone__listen"
              onClick={toggle}
              disabled={!supported || !rewrite.trim()}
              title={supported ? 'Read this summary aloud' : 'Text-to-speech is not supported in this browser'}
            >
              {speaking ? '■ Stop' : '🔊 Listen'}
            </button>
          </div>

          <div className="phone__body">
            {rewrite.trim() ? (
              <pre className="phone__text">{rewrite}</pre>
            ) : (
              <p className="phone__empty">
                Nothing has been approved yet — go back and approve a rewrite first.
              </p>
            )}
          </div>

          <footer className="phone__footer">
            Approved by {approved?.nurseName || '—'} · {approved?.at || '—'}
          </footer>
        </div>
      </div>

      <div className="qr-panel">
        <h3>Scan to save on your phone</h3>
        <p className="qr-panel__hint">
          No app, no account — this QR code contains the approved summary itself, in plain text.
          Point a phone camera at it; the phone reads the text straight out of the code, with
          nothing fetched over a network.
        </p>
        {rewrite.trim() ? (
          <>
            <div className="qr-panel__code">
              <QRCodeSVG
                value={qrPayload}
                size={200}
                level="M"
                includeMargin
                title="QR code containing your approved discharge summary"
              />
            </div>
            {qrTooLong && (
              <p className="qr-panel__warn">
                This summary is long — the code above is dense and may need a steady hand to
                scan. For very long summaries, the PDF export is the more reliable option.
              </p>
            )}
          </>
        ) : (
          <p className="qr-panel__hint">Approve a rewrite to generate its QR code.</p>
        )}
      </div>
    </div>
  )
}
