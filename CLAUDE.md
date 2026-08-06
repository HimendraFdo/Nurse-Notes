# Nurse Notes — Project Brief & Build Context

> Drop this file at the root of the repo. Claude Code reads `CLAUDE.md`
> automatically as project context. Rename to `PROJECT_BRIEF.md` if you'd
> rather it not be auto-loaded.

---

## 1. What this is

**Nurse Notes** is an AI tool that rewrites hospital discharge summaries and
consent forms into plain language (target ~6th-grade reading level), with a
**mandatory clinician review gate** before anything reaches a patient.

Built for the **Aotearoa AI Hackathon Festival 2026 (University of Waikato)**.

- **SDG mapping:** Indicator 3.8.1 (coverage of essential health services) +
  SDG 10.2 (inclusion — low health literacy tracks with ethnicity/deprivation).
- **Legal hook (core of the pitch):** Right 5 of the NZ Code of Health and
  Disability Services Consumers' Rights guarantees effective communication "in
  a form, language, and manner that enables the consumer to understand." A
  consent form the patient didn't understand is arguably non-compliant. This
  reframes the tool from *helpful* to *required*.

### Non-negotiable design principles
1. **Clinician gate is the safety design.** Model output is NEVER shipped
   straight to a patient. A human approves/edits every rewrite first.
2. **Synthetic or published sample documents ONLY.** Never real patient
   records, in the app or the demo.
3. **Runs fully offline / on-device.** No cloud, no account, nothing uploaded.
   This is also the privacy / Māori data-sovereignty story.

---

## 2. Current status — what already works

The rewrite behaviour is working today in **LM Studio** (local inference).

- **Model:** `google/gemma-3n-e4b` (small, on-device). Swappable — see §5.
- **Temperature:** 0.25 (set in Settings, not Sampling, in the LM Studio UI).
- **Behaviour confirmed good:** correctly expands clinical shorthand
  (TDS/OD/BD/SOB/haemoptysis/melaena), keeps all medicines + doses accurate,
  correctly identifies which meds are new, preserves the anticoagulant bleeding
  warning, and honestly emits `[flag for nurse review]` when the source doesn't
  state something (e.g. activity limits).

### Known, INTENTIONAL limitation — do not "fix" silently
The small model misreads NZ date shorthand: `6/52` (= 6 weeks) comes out as
"6 weeks and 5 days". Prompt examples + low temperature did **not** fully fix
it — this is a model-size ceiling.

**This bug is kept on purpose.** It is the live demonstration of why the
clinician gate exists: in the demo, the nurse catches "6 weeks and 5 days",
corrects it to "6 weeks", and approves. Do not remove this behaviour or hide
it. (If a cleaner rewrite is wanted, swap to a larger model — see §5 — but the
gate stays either way.)

---

## 3. The system prompt (verbatim — this is the product logic)

```
You are a clinical-communication assistant. Rewrite the hospital
discharge summary the user gives you into plain language at a
6th-grade reading level.

Rules:
- Only use information present in the source. Never add facts or advice.
- Output these sections, in order, with these exact headings:
  Your medicines and what changed
  Warning signs — call someone now
  Follow-up appointments
  Activity limits
  Who to call
- Keep every clinical fact exactly as stated in the source.
- If something is unclear or missing, write "[flag for nurse review]"
  instead of guessing.
- Short sentences. No jargon. Define any medical term you must keep.

NZ time shorthand — convert EXACTLY like this:
  6/52 -> "6 weeks"     2/52 -> "2 weeks"     1/52 -> "1 week"
  5/7  -> "5 days"      3/7  -> "3 days"
The number before the slash is the count. The number after the slash
(52 or 7) is the UNIT ONLY: 52 means weeks, 7 means days. Never treat
the slash as division and never add extra days.

Return only the rewritten summary.
```

> Note: the small model still ignores the shorthand rule sometimes (see §2).
> Store this prompt in the repo at `prompts/system-prompt.txt` as the single
> source of truth so the web app and LM Studio use the same text.

---

## 4. Backend — LM Studio local server

LM Studio exposes an **OpenAI-compatible** endpoint. To turn it on:
**Developer tab → Start Server.**

- **Base URL:** `http://localhost:1234/v1`
- **Chat endpoint:** `POST http://localhost:1234/v1/chat/completions`
- **Auth:** none needed locally (any dummy API key string is accepted).
- **Request shape:** standard OpenAI chat format — `messages` array with a
  `system` message (the prompt in §3) and a `user` message (the discharge text),
  `temperature: 0.25`, `stream: true` optional.

Minimal call example:

```js
const res = await fetch("http://localhost:1234/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "google/gemma-3n-e4b",
    temperature: 0.25,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },   // from prompts/system-prompt.txt
      { role: "user", content: originalDischargeText }
    ]
  })
});
const data = await res.json();
const rewrite = data.choices[0].message.content;
```

---

## 5. Model swap (optional)

If a cleaner rewrite is wanted for the demo (dates likely correct):
- LM Studio → **Discover** tab → download **Qwen 3 8B** (Q4_K_M) or a Llama
  instruct model → reload in Chat → restart the server.
- Update the `model` field in the API call to match.
- Trade-off: loses a little of the "tiny on-device model" privacy angle, gains
  polish. The clinician gate stays regardless.

---

## 6. What to build next — THE ASK

A **clinician review screen** — this is the highest-value remaining piece. It
turns "we used an LLM in a chat window" into "we built a product with a safety
gate", and it's where the demo's key moment happens.

### Requirements
- **Single self-contained web page** (plain HTML/CSS/JS in one file is fine, or
  Vite + React if preferred). Must run fully offline against local LM Studio.
- **Left pane — Original:** the raw clinical discharge text. Support pasting
  text and/or uploading a `.txt`/`.pdf` sample.
- **Right pane — Plain Language:** the generated rewrite, rendered as an
  **editable** text area so the clinician can correct it (e.g. fix
  "6 weeks and 5 days" → "6 weeks").
- **Generate button:** calls the LM Studio endpoint (§4) with the system prompt
  (§3) and the original text; streams/loads the result into the right pane.
- **Reading-grade badges:** show a reading level on each pane. Compute
  Flesch–Kincaid grade client-side (simple word/syllable/sentence counts) — no
  external API.
- **"Approve for release" button:** locks the edited right-pane text, shows an
  approved state (timestamp + "Approved by [nurse name]"). This is the gate.
- **Highlight the gate in the UI:** a visible "Nurse review required before
  release" banner until Approve is clicked.
- **Privacy note in the footer:** "Runs entirely on this device. No data leaves
  your machine." (True — it only calls localhost.)

### Explicitly out of scope (do not build)
- No real hospital integration, no auth, no database. Local-only demo.
- No handling of real patient data. Ship with the synthetic sample (§7).
- Do not auto-send rewrites anywhere; the gate is manual by design.

---

## 7. Synthetic test document (ship this in `samples/`)

```
Waikato Hospital — Discharge Summary
[SYNTHETIC TEST DOCUMENT — not a real patient]

Patient: Aroha Ngata (fictional)   NHI: ZZZ9999   DOB: 14/03/1958  Age 68
Ward: M3   Consultant: Dr S. Patel
Admitted: 28/07/2026   Discharged: 02/08/2026

Dx: 1. Community-acquired pneumonia (RLL)  2. T2DM (poorly controlled, HbA1c 74)
3. New AF  4. CKD stage 3a

PC: 4/7 productive cough, fevers, increasing SOB. O/E febrile 38.7, sats 89% RA,
RR 24, crackles R base.

Ix: CXR RLL consolidation. CRP 187, WCC 15.2, eGFR 52, Trop neg. ECG AF ~110bpm.

Mgmt: IV ceftriaxone 1g OD 3/7 then switched PO. Rate control w/ bisoprolol.
Commenced apixaban for AF (CHA2DS2-VASc 4). Metformin held during admission,
restarted on d/c.

Meds on discharge:
- Amoxicillin 500mg TDS PO — 5/7 course, complete it
- Bisoprolol 2.5mg OD (NEW)
- Apixaban 5mg BD (NEW) — do not stop without advice, bleeding risk
- Metformin 1g BD (unchanged)
- Atorvastatin 40mg nocte (unchanged)

F/U: Repeat CXR in 6/52 via GP. Anticoag clinic r/v 2/52. GP recheck renal fn 1/52.
Cardiology OPA re AF — letter to follow.

Safety-net: return if worsening SOB, chest pain, haemoptysis, or signs of bleeding
(melaena, bruising). Diabetic education referral made.

Clinician: Dr J. Lee, House Officer
```

**Expected demo beat:** model rewrites this well but outputs "6 weeks and 5 days"
for the `6/52` CXR follow-up. Nurse edits it to "6 weeks" and clicks Approve.

---

## 8. Suggested repo layout

```
/README.md                     # short project description + how to run
/CLAUDE.md                     # this file
/index.html                    # the review screen (if single-file build)
/src/                          # (if React) components, api client
/prompts/system-prompt.txt     # the §3 prompt — single source of truth
/samples/synthetic-discharge-01.txt
```

## 9. Add this to the existing GitHub repo

From the repo directory:

```bash
# place this file as CLAUDE.md at the repo root, then:
git add CLAUDE.md
git commit -m "Add Nurse Notes project brief and build context"
git push
```

Then, in Claude Code, open this repo directory and ask it to build the
review screen described in §6.
