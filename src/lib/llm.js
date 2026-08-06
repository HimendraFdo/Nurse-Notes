// Talks to the local LM Studio server (OpenAI-compatible). Streams tokens
// so the rewrite fills in progressively. No API key needed locally.
import SYSTEM_PROMPT from '../../prompts/system-prompt.txt?raw'

export { SYSTEM_PROMPT }

// Under `npm run dev`, the Vite proxy (vite.config.js) forwards same-origin
// `/v1/*` to LM Studio, avoiding the cross-origin CORS preflight. That proxy
// doesn't exist when the single-file build is opened directly (`file://` or
// a static host with no backend), so fall back to hitting LM Studio
// directly there — this requires CORS enabled in LM Studio for that mode.
export const DEFAULT_BASE_URL =
  typeof window !== 'undefined' && window.location.protocol === 'file:'
    ? 'http://localhost:1234/v1'
    : '/v1'
export const DEFAULT_MODEL = 'google/gemma-3n-e4b'

// Stream a rewrite. `onToken(delta)` is called with each text chunk.
// Returns the full text. Throws on network/HTTP errors so the UI can show them.
export async function generateRewrite({
  originalText,
  onToken,
  baseUrl = DEFAULT_BASE_URL,
  model = DEFAULT_MODEL,
  temperature = 0.25,
  signal,
} = {}) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model,
      temperature,
      stream: true,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: originalText },
      ],
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`LM Studio returned ${res.status}. ${detail}`.trim())
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE frames are separated by blank lines; each data line is JSON.
    const frames = buffer.split('\n')
    buffer = frames.pop() // keep the trailing partial line
    for (const frame of frames) {
      const line = frame.trim()
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') continue
      try {
        const json = JSON.parse(data)
        const delta = json.choices?.[0]?.delta?.content || ''
        if (delta) {
          full += delta
          onToken?.(delta)
        }
      } catch {
        // Ignore keep-alive / non-JSON lines.
      }
    }
  }

  return full
}
