# Nurse Notes

**Plain-language hospital discharge summaries, with a nurse in the loop.**

Nurse Notes rewrites hospital discharge summaries and consent forms into plain
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
| Clinician review screen | **Next to build** |

## What gets built next

A single self-contained review screen:

- **Left pane** — the original clinical text (paste or upload)
- **Right pane** — the plain-language rewrite, **editable** by the clinician
- **Reading-grade badges** on both panes (Flesch–Kincaid, computed client-side)
- **"Nurse review required before release"** banner, visible until approval
- **Approve for release** — locks the text, stamps a timestamp and nurse name

Full requirements are in [`CLAUDE.md`](CLAUDE.md) §6.

### Explicitly out of scope

No hospital system integration, no auth, no database, no auto-sending of
rewrites anywhere. Local demo only. The gate is manual by design.

---

## Running it

1. Install [LM Studio](https://lmstudio.ai/) and download `google/gemma-3n-e4b`.
2. Set **Temperature 0.25** (under Settings, not Sampling).
3. **Developer tab → Start Server.** This exposes an OpenAI-compatible API at
   `http://localhost:1234/v1` — no API key needed locally.
4. Open the review screen and click **Generate**.

Full API details and a minimal `fetch` example are in [`CLAUDE.md`](CLAUDE.md) §4.

---

## Repo layout

```
README.md                          this file
CLAUDE.md                          project brief & build context
index.html                         the clinician review screen
prompts/system-prompt.txt          single source of truth for the prompt
samples/synthetic-discharge-01.txt synthetic test document
```

---

> **Runs entirely on this device. No data leaves your machine.**
