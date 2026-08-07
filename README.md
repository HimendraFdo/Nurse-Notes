# ClearChart

**Plain-language hospital discharge summaries, with a nurse in the loop.**

> Formerly named "Nurse Notes" during early ideation — hence the repository
> name. The project is called ClearChart.

ClearChart rewrites hospital discharge summaries and consent forms into plain
language (target ~6th-grade reading level) using a small language model that
runs entirely on the local machine. Nothing is released to a patient until a
clinician has reviewed, corrected, and approved it.

Built for the **Aotearoa AI Hackathon Festival 2026 (University of Waikato)**.

---

## Why this project exists

### Patients are handed documents they can't read

Discharge summaries are written clinician-to-clinician. They are dense with
shorthand — `TDS`, `OD`, `BD`, `SOB`, `melaena`, `6/52` — and are handed to a
patient at the moment they are tired, unwell, and least able to decode them.
The result is missed doses, missed follow-ups, and avoidable readmissions.

Low health literacy is not evenly distributed. In Aotearoa it tracks with
ethnicity and deprivation, so a document nobody can read is not just a
usability problem — it is an equity problem.

### It may also be a compliance problem

**Right 5** of the NZ Code of Health and Disability Services Consumers' Rights
guarantees effective communication "in a form, language, and manner that
enables the consumer to understand."

Read plainly, that means a consent form the patient did not understand is
arguably non-compliant. That reframes this tool from *nice to have* to
*required infrastructure*.

### SDG mapping

- **Indicator 3.8.1** — coverage of essential health services
- **SDG 10.2** — inclusion; health literacy gaps follow existing inequities

---

## The approach

Three design decisions carry the whole project. None of them are negotiable.

### 1. The clinician gate is the safety design

Model output is **never** sent straight to a patient. Every rewrite lands in a
review screen where a nurse can edit it, then explicitly approve it for
release. The AI drafts; the human signs.

This is what separates a product from "we put a chatbot in front of a medical
record." A small model *will* make mistakes — the design assumes it, and
catches them.

### 2. Everything runs on-device

Inference is local ([LM Studio](https://lmstudio.ai/), OpenAI-compatible server
on `localhost:1234`). No cloud, no account, no upload. Patient text never
leaves the machine it was typed on.

That is a privacy property, and it is also the Māori data-sovereignty story: 
data that never moves cannot be governed by someone else's jurisdiction.

### 3. Synthetic documents only

No real patient records — not in the app, not in the demo, not in the repo.
A synthetic discharge summary ships in `samples/` for testing and
demonstration.

---

## The demo moment (and the bug we kept on purpose)

The current model (`google/gemma-3n-e4b`) handles the hard parts well: it
expands clinical shorthand correctly, keeps every medicine and dose accurate,
flags which medicines are new, preserves the anticoagulant bleeding warning,
and honestly writes `[flag for nurse review]` when the source doesn't state
something rather than inventing it.

It gets one thing wrong. NZ date shorthand `6/52` means *6 weeks* — the model
reads it as division and outputs "6 weeks and 5 days". Prompt examples and low
temperature did not fully fix it; it's a model-size ceiling.

**We are keeping that bug.** It is the clearest possible argument for the
clinician gate. In the demo, the nurse spots "6 weeks and 5 days", corrects it
to "6 weeks", and approves. The safety layer isn't a slide — it's visible,
doing its job, on screen.

A larger model (e.g. Qwen 3 8B) produces cleaner output if polish is wanted.
The gate stays either way.

---

## Status

| Piece | State |
|---|---|
| Rewrite behaviour in LM Studio | Working |
| System prompt (`prompts/system-prompt.txt`) | Defined — see `CLAUDE.md` §3 |
| Synthetic sample document | Defined — see `CLAUDE.md` §7 |
| Clinician review screen | **Built** (Vite + React) |

## The review screen (built)

A two-pane clinician review app (Vite + React), running fully offline
against local LM Studio:

- **Left pane — Original** — the clinical text. Paste, or upload `.txt` /
  `.md` / `.pdf` (PDF parsed locally with pdf.js — nothing uploaded).
- **Right pane — Plain Language** — the plain-language rewrite, streamed from
  LM Studio into a **formatted WYSIWYG editor** so the clinician can correct it
  in place.
- **"Nurse review required before release"** banner, visible until approval.
- **Approve for release** — locks the text, stamps a timestamp and nurse name.
- **View on patient's phone** — the approved summary as the patient sees it,
  with a QR code that carries the text itself (nothing fetched over a network).
- **Export patient PDF** — generates the patient-facing PDF in-browser
  (jsPDF), enabled only after approval.

`npm run build` inlines everything into a single `dist/index.html` — open it
straight from disk, no server required.

### A note on the reading-level badges

The brief (§6) asked for a Flesch–Kincaid grade on both panes. In practice FK
measures only sentence and word *length*, so it rates telegraphic clinical
shorthand (`SOB`, `6/52`, `2.5mg OD`) as "easy" — often lower-grade than the
plain-language prose, which is the opposite of a patient's experience. So the
badges were split to tell an honest story:

- **Original** shows a **jargon count** — the pieces of clinical shorthand a
  patient can't decode (the sample scores 61).
- **Plain Language** shows the **Flesch–Kincaid grade** against the 6th-grade
  target (a good rewrite lands at ≈6 with a ✓).

Both are computed client-side, no external API.

### Explicitly out of scope

No hospital system integration, no auth, no database, no auto-sending of
rewrites anywhere. Local demo only. The gate is manual by design.

---

## Running it

**1. Start the local model (LM Studio)**

1. Install [LM Studio](https://lmstudio.ai/) and download `google/gemma-3n-e4b`.
2. Set **Temperature 0.25** (under Settings, not Sampling).
3. **Developer tab → Start Server.** This exposes an OpenAI-compatible API at
   `http://localhost:1234/v1` — no API key needed locally.

**2. Start the review screen**

```bash
npm install
npm run dev
```

Open the printed URL (default `http://localhost:5173`), click **Load sample**
(or paste / upload a document), then **Generate**. Correct the rewrite,
enter your name, **Approve for release**, and **Export patient PDF**.

To swap models (e.g. Qwen 3 8B for cleaner output), use the **Settings** panel
in the app, or edit the defaults in `src/lib/llm.js`.

Full API details and a minimal `fetch` example are in [`CLAUDE.md`](CLAUDE.md) §4.

---

## Repo layout

```
README.md                          this file
CLAUDE.md                          project brief & build context
index.html                         Vite entry point
package.json                       dependencies & scripts
vite.config.js                     build config (relative base, offline)
src/main.jsx                       React entry
src/App.jsx                        the clinician review screen
src/PatientView.jsx                patient-facing view + QR code
src/components/MarkdownEditor.jsx  WYSIWYG editor for the rewrite pane
src/styles.css                     styling
src/lib/llm.js                     LM Studio client (streams the rewrite)
src/lib/extractText.js             .txt / .md / .pdf text extraction (pdf.js)
src/lib/readability.js             Flesch–Kincaid + clinical-jargon counter
src/lib/pdf.js                     patient PDF generator (jsPDF)
prompts/system-prompt.txt          single source of truth for the prompt
samples/synthetic-discharge-01.txt synthetic test document
mmh-mobile/                        companion Expo / React Native app
docs/                              pitch deck & hackathon material
```

---

> **Runs entirely on this device. No data leaves your machine.**
