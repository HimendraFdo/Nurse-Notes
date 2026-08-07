# Nurse Notes — Project Brief & Build Context

> Briefly called "ClearChart" mid-project; the name reverted to Nurse Notes,
> which matches the repository and the app. "ClearChart" should not appear
> anywhere below or in the UI.
>
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
  warning, converts NZ time shorthand including `/24`, `/12`, the `x` prefix,
  and compounds (`3kg/10/7`), and separates patient-facing instructions from
  staff-only notes (e.g. "hold ramipril if Cr rises >20%").

### Known, INTENTIONAL limitation — do not "fix" silently
The small model misreads NZ date shorthand: `6/52` (= 6 weeks) comes out as
"6 weeks and 5 days". Prompt examples + low temperature did **not** fully fix
it — this is a model-size ceiling.

**This bug is kept on purpose.** It is the live demonstration of why the
clinician gate exists: in the demo, the nurse catches "6 weeks and 5 days",
corrects it to "6 weeks", and approves. Do not remove this behaviour or hide
it. (If a cleaner rewrite is wanted, swap to a larger model — see §5 — but the
gate stays either way.)

### Known regression from the prompt rewrite — not yet fixed
When "Activity limits" is absent from the source, the model now sometimes
fabricates "Your doctor may have limited the amount of activity you can do"
instead of correctly flagging it for nurse review. The prior prompt handled
this case correctly; the broader real-record coverage in the current prompt
(see §3) introduced this regression. Left in place — the clinician gate
catches it — but do not describe this as "fixed" in the pitch or docs.

---

## 3. The system prompt (this is the product logic)

Rewritten against a real-format Waikato outpatient clinic record, not just
the synthetic sample — broader input types (discharge summary, clinic
record, letter, consent form), fuller NZ shorthand disambiguation (`/24`,
`/12`, the `x` prefix, compounds like `3kg/10/7`, and non-time slashes like
`2/2` = "because of"), a full glossary of shorthand actually seen in these
records, and an explicit rule to separate patient-facing instructions from
staff-only notes. Adds two new output headings: "Why you were seen" and
"Looking after yourself at home" (the original five headings are preserved).

Full text lives at `prompts/system-prompt.txt` — that file is the single
source of truth the web app and LM Studio both read from; do not let this
doc drift from it. See §2 for the one known regression this rewrite
introduced.

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
