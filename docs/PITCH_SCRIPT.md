# Nurse Notes — Judge Pitch

**Aotearoa AI Hackathon Festival 2026 · University of Waikato**

---

## Read this first — three decisions baked into the script

**1. This is a 5-minute pitch, not 3.**
The event's own judging criteria say "Clear, structured, within 5 minutes," and the
official template is `0:30 Connect / 1:00 Problem / 2:00 Big Idea / 1:30 Impact`.
Your deck is *already* annotated to that template (slides 5 and 7 carry `2:00` and
`1:30` in their eyebrow text). The 3-minute structure in the Phase 5 brief is generic
hackathon advice — following it would cost you 40% of your allotted stage time and
desync your slides. A 3-minute cutdown is at the end of this document if the room
runs short on the day.

**2. Your demo beat has changed — the old one no longer fires.**
`CLAUDE.md` §2 says you're deliberately keeping the `6/52` → "6 weeks and 5 days"
bug as the moment the nurse catches an error. **That bug is fixed.** Commit
`9c2a129` added `src/lib/dates.js`, which resolves every interval in JavaScript and
hands the model finished dates. Commit `75d84f5` closed the "Activity limits"
fabrication too. If you rehearse the old beat you'll be waiting on an error that
never arrives.

The replacement is better, and it's *deterministic* — it fires every single time:

> The model reaches "Activity limits", finds the source document silent on it, and
> writes **"Your notes do not mention this. [flag for nurse review]"** — then the
> nurse fills that gap on screen and approves.

A bug caught by luck says your model is unreliable. A model that reports what it
doesn't know, into a field a human must clear, says **you designed the safety in**.
That is a stronger claim and it survives contact with a live demo.

**3. Never say "compliance" about a patient.**
NZ health research frames post-discharge failure as system-side — inadequate
support, medication problems, unpreparedness. "Poor patient compliance" in front of
NZ health judges will cost you the room. Say *"care a patient can't act on."*
(Provider-side legal compliance under Right 5 is fine — that's about the hospital,
not the patient.)

---

## Speaking roles

Three speakers, five on stage. Every handover costs ~4 seconds and breaks rhythm —
five speakers would burn 20 seconds of a 5-minute pitch on transitions alone.

| Segment | Speaker | Note |
|---|---|---|
| Connect (0:30) | **Himendra** | Your story. See the gap below. |
| Problem (1:00) | **Speaker B** | Takes the baton straight from the story. |
| Big Idea + Demo (2:00) | **Speaker C driving, B narrating** | C's hands never leave the keyboard. |
| Impact + Ask (1:30) | **Himendra** (closes) | Same voice opens and closes — bookends the story. |

Whoever isn't speaking: face the judges, don't watch the screen.

---

## THE SCRIPT

### 0:00 – 0:30 · CONNECT — *Himendra's story*
**Slide 1 (title)**

> ### ▓▓▓ YOUR STORY GOES HERE ▓▓▓
>
> **Budget: 30 seconds ≈ 70–75 spoken words.** Time it. This segment overrunning is
> the single most common way a hackathon pitch loses its demo.
>
> **What this slot has to do** (per the official template: *"who you are, what you
> care about"*):
> - Put one real person in the judges' heads — not a statistic.
> - End on the moment of **not understanding**: the form signed, the instructions
>   that made no sense, the question nobody asked.
> - Do **not** mention the product. Not once. The product arrives at 1:30.
>
> **Land on this exact handover line** so Speaker B can pick it up cleanly:
>
> > "…and they are not unusual. They are the majority."
>
> *(If your story ends somewhere else, tell B the last five words in advance so the
> baton pass is clean. Rehearse the seam, not just the halves.)*

---

### 0:30 – 1:30 · PROBLEM — *Speaker B*
**Slide 3 (the three statistics), then Slide 4 (Right 5)**

> Fifty-six percent of New Zealand adults — over 1.6 million people — can't obtain
> and understand basic health information well enough to make an informed decision.
> For Pacific people over fifteen, it's around ninety percent.
>
> So we hand someone a discharge summary written clinician-to-clinician. Dense with
> shorthand — TDS, SOB, melaena, 6/52 — at the exact moment they're tired, unwell,
> and least able to decode it. Then sixteen percent of over-65s are back in hospital
> within thirty days. Higher for Māori, Pacific, and deprived areas.
>
> **[SLIDE 4]** And here's the part that changed how we saw this. This isn't a
> service improvement. It's a legal right. Right 5 of the Code of Health and
> Disability Services Consumers' Rights guarantees every consumer effective
> communication — and I'll quote it — *"in a form, language, and manner that enables
> the consumer to understand."*
>
> Read that plainly. A consent form the patient didn't understand is arguably not
> compliant. Which means this isn't a nice-to-have that a hospital gets around to.
> It's an obligation that is currently, quietly, unmet — about a million and a half
> times over.

*(≈150 words. Deliver Right 5 slowly — it's the sentence you want a judge to write
down. Pause a full beat after "not compliant.")*

---

### 1:30 – 3:30 · BIG IDEA + LIVE DEMO — *C drives, B narrates*
**Slide 5, then switch to the app**

> **[B]** So we built Nurse Notes. It takes the clinical document, rewrites it in
> plain language, and puts a nurse between the model and the patient. Every time. No
> exceptions. And it runs entirely on this laptop — no cloud, no account, nothing
> uploaded.
>
> **[SWITCH TO APP — C clicks "Load sample"]**
>
> **[B]** This is a synthetic discharge summary — we've never used a real patient
> record, and we won't. On the left, the original. That badge says **61** — that's
> the count of pieces of clinical shorthand in this document that a patient cannot
> decode.
>
> **[C clicks "Generate" — text streams in]**
>
> **[B]** That's a four-billion-parameter model running locally. If we pulled the
> network cable right now, nothing would change.
>
> Two things to watch as it writes.
>
> **First — the dates.** This document has five slash intervals. `6/52` is six
> weeks. `5/7` is a five-day course. `4/7` is how long a cough lasted *before*
> admission. We don't ask the model to work those out — small models get it wrong,
> and we watched ours turn six weeks into "six weeks and five days." So we resolve
> them in JavaScript first, anchor them to the discharge date, and hand the model
> finished calendar dates to copy. It also has to tell an appointment apart from a
> course length — because putting a future date on a cough would be actively
> misleading. **[point]** There: a real date the patient can put in a calendar.
>
> **Second — this.** **[point at "Activity limits"]** The notes say nothing about
> activity limits. So the model doesn't guess, and it doesn't reassure. It writes
> *"Your notes do not mention this — flag for nurse review."* A silent document is
> not a document that says no. Only a human can close that gap —
>
> **[C clicks into the field and types a correction]**
>
> — and that's the nurse doing it. **[C types name, clicks "Approve for release"]**
> Locked. Timestamped. Signed. **[C clicks "View on patient's phone"]** And this is
> what the patient walks out with — sixth-grade reading level, read-aloud, and a QR
> code that carries the summary *inside the code itself*. No app, no account,
> nothing fetched.

*(≈300 words including pauses. Rehearse this on the presentation laptop until C
never has to look for a button.)*

---

### 3:30 – 5:00 · IMPACT + ASK — *Himendra closes*
**Slide 7, then Slide 8**

> The study we built on took a discharge summary from eleventh-grade to sixth-grade
> reading level. Measured patient understanding went from thirteen percent to
> eighty-one percent. That's their number, not ours — and in that same study the
> model introduced errors. That's not a footnote we're burying. It's the reason the
> nurse gate exists, and it's why we showed you the gate instead of claiming the
> model is always right.
>
> This maps to indicator 3.8.1 — coverage of essential health services. Care a
> patient can't act on isn't effective coverage. And to SDG 10.2, because low health
> literacy tracks with ethnicity and deprivation, so a document nobody can read
> isn't a usability problem — it's an equity problem.
>
> On running local: that's a privacy property, and it's also a data-sovereignty one.
> Data that never leaves the ward can't be governed by someone else's jurisdiction.
> That matters for Māori data sovereignty, and it's why we didn't reach for a cloud
> API.
>
> **[SLIDE 8]** What we need: a clinical partner to validate rewrites, verified te
> reo Māori and Pacific translations — human-verified, not machine-translated — and
> one pilot ward to measure whether comprehension actually moves.
>
> Right 5 has been law for thirty years. The technology to actually meet it fits on
> a laptop and runs offline. **Our ask is simple: help us put a plain-language,
> clinician-approved form in front of the next patient who has to sign one.**

*(≈240 words. Slow down on the last two sentences. Stop talking. Don't fill the
silence.)*

---

## The three judge questions you will get

### Q1. "How is this different from ChatGPT, or from Epic's Emmie?"
*This is the question. Health chatbots are the most crowded category at SDG
hackathons — the judges will be testing whether you know that.*

> Three ways. Epic's Emmie answers patient questions inside MyChart — it has no
> shipped feature that rewrites a full inpatient discharge summary, and New Zealand's
> public hospitals don't run on Epic, so none of it reaches a patient at Waikato.
> Second, we're not a chat box — the output is a fixed structure with a mandatory
> human approval step, and nothing reaches a patient unsigned. Third, paste a patient
> record into ChatGPT and you've just sent it offshore. Ours never leaves the
> machine.

### Q2. "The model will get things wrong. How is this safe?"
*Do not defend the model. Agree immediately, then show the architecture.*

> It will, and we assume it. That's why nothing is auto-sent — a nurse signs every
> release. But we didn't stop at the human. Where we could make an error impossible,
> we did: all date arithmetic is done in JavaScript, not by the model, because that's
> where a small model reliably fails. And the prompt is built so that a gap in the
> source produces a flag rather than a guess — the failure mode is "I don't know,"
> not a confident invention. The human catches what's left. Roughly: deterministic
> code for what must be exact, the model for language, a nurse for judgement.

### Q3. "Would a nurse actually use this? Isn't reviewing it more work?"
*The adoption question. Have a number and a boundary.*

> Reviewing a one-page plain-language summary is faster than writing one from
> scratch, which is what a good nurse does verbally today, unpaid and unrecorded.
> And it produces an artifact the patient takes home. We're not claiming zero cost —
> we're claiming the cost lands in the right place, and it's why our ask is a pilot
> ward with measured comprehension rather than a rollout. If a nurse won't use it,
> we'd want to know that in week one.

### Bonus — if a sponsor asks why you integrated no sponsor API
> Deliberately. Our privacy and Māori data-sovereignty claim is that patient text
> never leaves the device — a cloud API call would break the core promise of the
> product to win a side prize. We'd rather be honest about the trade.

---

## Deck changes to make before you present

| Slide | Change | Why |
|---|---|---|
| **5** | Delete the footer *"Concept mockup — the live build is a working web app (see next slide)"* | It's no longer a mockup. Apologising for a real build is the worst thing on the deck. |
| **6** | Retitle step 4 to **"Language & format — roadmap"** | Te reo / Pacific / audio isn't built. Read-aloud *is* (browser SpeechSynthesis). Claiming the rest as shipped is the one thing that could sink you on a follow-up question. |
| **6** | Add a fifth step or a footer line: **"Dates resolved in code, not by the model"** | Your strongest technical differentiator currently appears nowhere in the deck. |
| **7** | Add "in the study we build on" *visually*, not just spoken | The 13% → 81% figure is borrowed. Attribute it on the slide or a judge will assume you measured it. |
| **8** | Fine as-is | Criteria match the event's actual four (Inspiration / Technology / Design / Presentation). |

---

## Demo reliability checklist

Run through this on the **presentation device**, not your own laptop.

**The day before**
- [ ] LM Studio installed on the presentation laptop, `google/gemma-3n-e4b` downloaded
- [ ] Temperature **0.25** (Settings, not Sampling)
- [ ] Developer tab → **Start Server** → confirm `http://localhost:1234/v1` responds
- [ ] `npm run build` → confirm `dist/index.html` opens from disk and works
- [ ] **Screen-record the full demo end to end.** Save it on the desktop, one click away
- [ ] Confirm the "Activity limits" flag actually fires on the sample — this is your beat now. If the model's phrasing drifts, that's fine; the *flag* is what you point at

**Thirty minutes before**
- [ ] Model **loaded in LM Studio and warmed** — run one generation. A cold first-token wait is 20 seconds of dead air
- [ ] App already open at the review screen, sample **not** yet loaded
- [ ] Notifications off. Every other tab and app closed
- [ ] Screen brightness up, laptop on mains power, sleep disabled
- [ ] Recording file open in a background window, ready to alt-tab

**If it breaks**
Switch to the recording **without apologising**. Say:

> "I'll show you the recording — same run, made this morning."

Then keep narrating exactly as scripted. Never say "it worked earlier."

**Network:** irrelevant, and say so. "If the venue WiFi dies, this demo doesn't
notice" is a line worth using out loud.

---

## 3-minute cutdown (only if the room runs short)

| Time | Segment | What changes |
|---|---|---|
| 0:00–0:20 | Story | Cut to ~45 words. One person, one moment of not understanding |
| 0:20–0:50 | Problem | 56% / 1.6M, then straight to Right 5. **Drop the readmission stat** |
| 0:50–2:20 | Demo | Load → Generate → **skip the date explanation** → the flag → Approve → patient phone |
| 2:20–3:00 | Impact + ask | 13%→81% (attributed), 3.8.1 + 10.2, on-device, the ask |

Cut in that order. **Never cut the flag-and-approve moment** — it's the whole thesis.

---

## One-sentence version, for a corridor conversation

> Nurse Notes rewrites hospital discharge summaries into plain language on-device,
> and no patient sees a word of it until a nurse has corrected and signed it — because
> in New Zealand, communication a patient can understand isn't a courtesy, it's Right 5.
