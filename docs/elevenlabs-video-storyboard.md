# True Fit: ElevenLabs infographic video (2:00 max)

> A scene-by-scene storyboard for building the video in **ElevenLabs** (Studio / Video, with Voice, Sound Effects and Music).
> Audience: non-technical viewers such as judges, City of Espoo staff, companies and job seekers.
> Story: **the challenge → our solution → the demo, shown as graphics → the results**.
> Every number comes from the prototype itself (v0.22.0).

---

## 0. Quick setup in ElevenLabs

| Setting       | Value                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Length        | **1 min 55 s – 2 min 00 s**, hard maximum 2:00 (≈ 275 spoken words)                                                        |
| Format        | 16:9, 1920 × 1080, 30 fps. Make a 9:16 cut later for social media.                                                         |
| Voice model   | **Eleven v3** (it understands the audio tags in brackets, such as `[warm]` and `[short pause]`)                            |
| Voice         | A calm, friendly narrator with a neutral, international English accent. Stability ≈ 50 %, Similarity ≈ 75 %, Style ≈ 20 %. |
| Speed         | 1.0. If the voice track comes out longer than 1:55, set 1.05.                                                              |
| Music         | One track for the whole video, ducked to −18 dB under the voice. Prompt in section 4.                                      |
| Captions      | Burn in subtitles. Many people watch with the sound off.                                                                   |
| Pronunciation | Espoo = "ES-poh", Esbo = "ES-boo". Add these to a pronunciation dictionary.                                                |

### Look and feel

- **Colours** (taken from the app): deep navy background, white text, and three accent colours used the same way as in the app:
  - 🟢 **Green = shown** (a skill proven with the person's own words)
  - 🔵 **Blue = transferable** (a skill that carries over from another job)
  - 🟠 **Amber = gap** (a skill still missing)
- **Font:** Geist (or Inter). Bold for headlines, regular for labels.
- **Style:** flat vector icons, rounded cards, soft shadows, quick slide-and-fade motion. No stock photos of handshakes.
- **Pace:** with 2 minutes, show more than the voice says. Visuals carry the details (the AI assistant, the calendar, the bias chart); the narration carries the story.
- **Recurring characters** (keep them the same in every scene):
  - **Aino**, hiring manager at a small Espoo software company (company side)
  - **Sam**, a job seeker who moved to Finland and worked as a logistics coordinator (job seeker side)
  - **The Espoo event team**, shown as the Espoo swirl logo with a small group of three people
- **On-screen text:** at most about 8 words per line. Use plain words: "skill match", "shown / stated", "EU skills list", "people at this event". Avoid "ESCO", "LLM", "Gemini" and "pool" on screen, except in the small "under the hood" strip.

---

## 1. Storyboard

Each scene gives the time, what is on screen, the on-screen text, the narration to paste into ElevenLabs and the sound effects.

---

### ACT 1: THE CHALLENGE (0:00–0:24)

#### Scene 1: Title (0:00–0:05)

- **Visual:** Navy screen. The "PT" logo tile pops in, then the words **True Fit** type out beside it. Below: "Junction × City of Espoo · Rethinking Recruitment". The Espoo swirl fades in in the corner.
- **On-screen text:** **True Fit** · _More signal, less noise._
- **Narration:**
  > [warm] We're Project Hail Mary, and this is True Fit: fairer hiring at Espoo's recruitment events.
- **SFX:** soft "whoosh" and a light chime as the logo lands.

#### Scene 2: AI versus AI (0:05–0:18)

- **Visual:**
  1. On the left, a robot types CVs at high speed; dozens of identical grey CVs fly into a funnel with a robot face.
  2. A few colourful CVs, labelled with a different name, a different language and a career change, bounce off the funnel and fall away.
  3. Three small pain cards flash along the bottom: 🏢 "Too many look-alike applications" · 🧑‍💼 "Hard to prove real skills" · 🏛️ "Too little time to judge".
- **On-screen text:** **AI writes the CVs. AI screens the CVs.** → then: **Real people get lost.**
- **Narration:**
  > [serious] Today, AI writes the CVs, [short pause] and AI screens them. Companies drown in look-alike applications, and good people get filtered out for their name, their language or their career path.
- **SFX:** fast paper shuffling, a mechanical "clunk" for each rejected CV.

#### Scene 3: The rules (0:18–0:24)

- **Visual:** Four badges light up in a row: ✋ Human decides · 🔒 Synthetic data · ⚖️ No bias · 🇪🇺 EU AI Act ready.
- **On-screen text:** **The rules we had to follow**
- **Narration:**
  > The rules: humans decide, data stays private, and nobody is judged on where they come from.
- **SFX:** four "tick" sounds.

---

### ACT 2: OUR SOLUTION (0:24–0:36)

#### Scene 4: Three ideas, three views (0:24–0:36)

- **Visual:**
  1. Three large icons appear in a row: 🗣️ **Talk, don't write** (a speech bubble turns into a job card) · 💬 **Show, don't claim** (a quote mark turns into a green "shown" badge) · 🤝 **Humans decide** (the Espoo swirl joins two puzzle pieces).
  2. The row folds into one browser window that splits into three doors: **Company**, **Job seeker**, **City of Espoo**, each with a small padlock: "Only your own data."
- **On-screen text:** **Talk · Show · Decide** → **3 views · 1 journey**
- **Narration:**
  > True Fit rests on three ideas: [short pause] talk, don't write. Show, don't claim. And humans decide. One app, three separate views, and everyone sees only their own data.
- **SFX:** gentle rising tone under each idea, door "click".

---

### ACT 3: THE DEMO, AS GRAPHICS (0:36–1:30)

> Follow Aino and Sam through the whole journey. Use simplified, illustrated versions of the real screens (or real screenshots with a flat overlay) so the style stays consistent. Keep each step on screen for about 2 seconds.

#### Scene 5: The company talks (0:36–0:48)

- **Visual:**
  1. Aino taps a round microphone button. Sound waves animate; her words appear as subtitles: _"We need someone to plan deliveries and talk to customers, in English, hybrid."_
  2. An empty **job card** fills itself field by field: Job title → Skills (chips from the EU skills list) → Language: English → Way of working: Hybrid.
  3. A counter in the corner climbs: **"6 people at this event fit this."**
  4. A blue **Approve** button, then a check mark.
- **On-screen text:** **Just talk. The job card writes itself.**
- **Narration:**
  > [upbeat] Aino, a hiring manager, just talks. The AI asks follow-up questions and fills in the job card, while a live counter shows how many people at the event fit.
- **SFX:** mic "blip", soft typing for each field, a "ding" when the counter updates.

#### Scene 6: The job seeker shows proof (0:48–1:05)

- **Visual:**
  1. Sam drags a **CV file** onto a drop zone. Email, phone and address fly off the page: "Removed before the AI reads it". The file icon dissolves: "Never stored".
  2. Four **scenario cards** flip past; Sam types an answer with grey writing starters ("One time I…").
  3. The **evidence map**: skill chips turn 🟢 **green: shown**, each with the exact sentence highlighted from Sam's answer. Others stay grey: **stated**.
  4. **"Companies that suit you best"** slides in: company, job title, an **AI fit rate** gauge (e.g. 86) and a skill match bar, plus two amber chips "Skills that open the most doors: +3 roles". An **Apply now** button is pressed.
- **On-screen text:** **Every skill backed by your own words.** · 🟢 Shown · ⚪ Stated
- **Narration:**
  > Sam imports a CV, and contact details are removed before any AI reads it. Sam answers four real-life questions, and every skill links to Sam's own words: green means shown, grey means stated. Then Sam sees which companies fit best, and applies.
- **SFX:** paper "swish" for the drop, tiny "pings" as chips turn green, button "tap".

#### Scene 7: Espoo makes the introduction (1:05–1:17)

- **Visual:**
  1. The **Espoo review board**: Aino's role card on top, suitable candidates below, each with a skill match bar and green proof chips. A badge on Sam's card: "Candidate asked to meet".
  2. The organiser clicks **Introduce**; a box asks **"Why?"**, a reason is typed, and a line drops into the **decision log** with a timestamp.
  3. In the corner, the **Espoo Esbo assistant** bubble answers "Interviews booked today?" with a number only.
- **On-screen text:** **AI suggests. People decide.**
- **Narration:**
  > The City of Espoo is the broker. Its team sees each match with the proof behind it. The AI only suggests. [short pause] A person decides, always with a written reason, and every decision is logged.
- **SFX:** stamp "thunk" on Introduce, soft keyboard, notification "pop".

#### Scene 8: The six-step journey (1:17–1:30)

- **Visual:** A path with six numbered stops. A token (Sam + Aino side by side) travels along it; each stop lights up:
  1. **Applied or matched**
  2. **Espoo assessment**
  3. **Espoo interview**
  4. **Company sees the profile** (a padlock opens: contact details unlock only here)
  5. **Company interview + feedback** (a Mon–Fri calendar; a clashing slot is greyed out)
  6. **Job offer** 🎉 (confetti)
- **On-screen text:** **From first match to job offer.**
- **Narration:**
  > Next, an Espoo interview, and only after a pass does the company see Sam's details. Aino books an interview, both give feedback, [short pause] and Sam gets a job offer.
- **SFX:** a light "step" tick per stop, confetti pop at step 6.

---

### ACT 4: RESPONSIBLE AND FAIR (1:30–1:42)

#### Scene 9: Fair by design (1:30–1:42)

- **Visual:** A shield in the centre. Facts pop in around it:
  - ⚖️ **Skills only.** Nationality, language, education and career path are greyed out and crossed through.
  - 🏷️ **The AI never sees names.** Candidates appear as C1, C2, C3…
  - 🚫 **0 automatic rejections.**
  - 📊 A small bias-check bar chart, every group above the "four-fifths" line.
  - Footer: "Ready for the EU AI Act."
- **On-screen text:** **Fair by design.**
- **Narration:**
  > Fairness is built in. Matching uses skills only, the AI never sees names, and nobody is rejected automatically.
- **SFX:** low "shield" hum, ticks for each fact.

---

### ACT 5: THE RESULTS (1:42–2:00)

#### Scene 10: In numbers, benefits and end card (1:42–2:00)

- **Visual:**
  1. **1:42–1:50:** counters tick up from zero: **3** views · **6** steps · **10** languages · **177** automatic tests · **0** automatic rejections. A grey "under the hood" strip along the bottom: _Next.js · Google Gemini · EU ESCO skills · Tiger Data · Vercel · 100 % synthetic data_.
  2. **1:50–1:56:** three benefit tiles flip in: 🏢 "Minutes, not hours" · 🧑‍💼 "Judged on skills" · 🏛️ "Less screening, more connecting".
  3. **1:56–2:00:** end card: PT logo · **True Fit** · _More signal, less noise._ · Project Hail Mary · "Junction × City of Espoo".
- **Narration:**
  > The result: a working prototype with three views, six steps, and 177 automatic tests. Companies save time, job seekers are judged on skills, and Espoo connects the right people. [warm] True Fit. [short pause] More signal, less noise.
- **SFX:** counter "tick-tick-tick", then the music swells and resolves on the logo.

---

## 2. Full narration (paste into ElevenLabs in one go)

Paste this into a single Studio project, or split it at each `---` into one paragraph per scene so you can line the voice up with each visual.

```text
[warm] We're Project Hail Mary, and this is True Fit: fairer hiring at Espoo's recruitment events.
---
[serious] Today, AI writes the CVs, [short pause] and AI screens them. Companies drown in look-alike applications, and good people get filtered out for their name, their language or their career path.
---
The rules: humans decide, data stays private, and nobody is judged on where they come from.
---
True Fit rests on three ideas: [short pause] talk, don't write. Show, don't claim. And humans decide. One app, three separate views, and everyone sees only their own data.
---
[upbeat] Aino, a hiring manager, just talks. The AI asks follow-up questions and fills in the job card, while a live counter shows how many people at the event fit.
---
Sam imports a CV, and contact details are removed before any AI reads it. Sam answers four real-life questions, and every skill links to Sam's own words: green means shown, grey means stated. Then Sam sees which companies fit best, and applies.
---
The City of Espoo is the broker. Its team sees each match with the proof behind it. The AI only suggests. [short pause] A person decides, always with a written reason, and every decision is logged.
---
Next, an Espoo interview, and only after a pass does the company see Sam's details. Aino books an interview, both give feedback, [short pause] and Sam gets a job offer.
---
Fairness is built in. Matching uses skills only, the AI never sees names, and nobody is rejected automatically.
---
The result: a working prototype with three views, six steps, and 177 automatic tests. Companies save time, job seekers are judged on skills, and Espoo connects the right people. [warm] True Fit. [short pause] More signal, less noise.
```

---

## 3. Timing summary

| Act                      | Scenes | Time      | Length   |
| ------------------------ | ------ | --------- | -------- |
| 1. The challenge         | 1–3    | 0:00–0:24 | 24 s     |
| 2. Our solution          | 4      | 0:24–0:36 | 12 s     |
| 3. The demo, as graphics | 5–8    | 0:36–1:30 | 54 s     |
| 4. Responsible and fair  | 9      | 1:30–1:42 | 12 s     |
| 5. The results           | 10     | 1:42–2:00 | 18 s     |
| **Total**                | 10     |           | **2:00** |

**If the voice track runs over 1:55**, set the speed to 1.05 first. If it is still too long, cut in this order (about 4 s each):

1. Scene 4: "One app, three separate views, and everyone sees only their own data." (the doors visual still shows it)
2. Scene 3: drop the whole line and let the badges speak (fold the badges into the end of Scene 2).
3. Scene 6: "green means shown, grey means stated." (the chips still show it)

---

## 4. Prompts for ElevenLabs Music and Sound Effects

### Music (one track, 2:00)

> Modern, optimistic corporate-tech background music, 105 BPM, soft electronic pulse with warm piano and light plucks. Tense and minimal for the first 24 seconds, opens into a hopeful, steady groove at 0:24, gently builds through the middle, and resolves on a clean, uplifting final chord at 1:58. No vocals.

### Sound effects

| Scene | Prompt                                                     |
| ----- | ---------------------------------------------------------- |
| 1     | "Soft airy whoosh followed by a bright, short glass chime" |
| 2     | "Rapid paper sheets shuffling, light mechanical clunks"    |
| 3, 4  | "Clean UI tick", "Soft door click"                         |
| 5     | "Microphone activation blip", "Soft keyboard typing"       |
| 6     | "Paper swish onto a desk", "Tiny high digital ping"        |
| 7     | "Rubber stamp on paper, muffled"                           |
| 8     | "Light footstep tick", "Small confetti pop with a cheer"   |
| 9     | "Low warm electronic hum, shield activation"               |
| 10    | "Fast mechanical counter ticking, landing on a click"      |

---

## 5. What each scene covers in the code (for fact-checking)

| Scene | Feature in the app                                                                                                                                                                                                   |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4     | Demo sign-in and role-based access (`lib/auth/`), own accounts for companies and job seekers                                                                                                                         |
| 5     | Intake chat and live voice (`app/api/intake`, `/live`, `/transcribe`), live pool counts, need card approval                                                                                                          |
| 6     | CV import (`lib/cv-import.ts`, contact details stripped, file not stored), scenario starters, evidence map with verbatim quotes, "Companies that suit you best" (`lib/role-rank.ts`), door-opening skills, Apply now |
| 7     | Organiser review board, Introduce / Not now with reasons, decision log with CSV export, Espoo Esbo assistant (totals only)                                                                                           |
| 8     | Six-step pipeline (`lib/pipeline.ts`), contact details unlocked after the Espoo pass, Mon–Fri interview slots with clash blocking (`lib/schedule.ts`), feedback, offer                                               |
| 9     | Skills-only matching with protected-field tests, C1…Cn labels, bias audit (four-fifths), `/responsible` page                                                                                                         |
| 10    | 177 tests in `tests/`, live EU skill search in 10 languages, v0.22.0                                                                                                                                                 |

---

## 6. Production checklist

- [ ] Generate the voice first and check that it is 1:55 or shorter. Then line up each visual with its paragraph.
- [ ] Re-check the numbers in Scene 10 against `/organiser/insights` and `yarn test` on recording day.
- [ ] Keep captions on, and keep on-screen text under about 8 words per line.
- [ ] Export at 1080p, then a 9:16 version for social media.
