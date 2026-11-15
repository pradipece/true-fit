# True Fit: ElevenLabs infographic video (2:00 max)

> A scene-by-scene storyboard for building the video in **ElevenLabs** (Studio / Video, with Voice, Sound Effects and Music).
> Audience: non-technical viewers such as judges, City of Espoo staff, companies and job seekers.
> Story: **the challenge → our solution → the demo, shown as graphics → the results**.
> Every number comes from the working app itself (v0.25.0). The video uses no technical terms: it shows what was built and what it achieves.

---

## 0. Quick setup in ElevenLabs

| Setting       | Value                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Length        | **1 min 55 s – 2 min 00 s**, hard maximum 2:00 (≈ 280 spoken words)                                                        |
| Format        | 16:9, 1920 × 1080, 30 fps. Make a 9:16 cut later for social media.                                                         |
| Voice model   | **Eleven v3** (it understands the audio tags in brackets, such as `[warm]` and `[short pause]`)                            |
| Voice         | A calm, friendly narrator with a neutral, international English accent. Stability ≈ 50 %, Similarity ≈ 75 %, Style ≈ 20 %. |
| Speed         | 1.0. If the voice track comes out longer than 1:55, set 1.05.                                                              |
| Music         | One track for the whole video, ducked to −18 dB under the voice. Prompt in section 4.                                      |
| Captions      | Burn in subtitles. Many people watch with the sound off.                                                                   |
| Pronunciation | Espoo = "ES-poh", Esbo = "ES-boo". Add these to a pronunciation dictionary.                                                |

### Look and feel: match the real app

The demo scenes (5–9) should look like simplified copies of the real screens, so the video and a live demo feel like the same product. Record real screenshots on a laptop (light theme, browser at 1440 px wide) and trace them as flat illustrations, or use the screenshots with a soft blur on everything except the part being explained.

- **Background and cards:** a very light grey-blue page (`#F7F9FC` area) with **white cards**, thin light-grey borders, rounded corners (about 12 px) and soft shadows. Dark text. Use the light theme for the whole video; Scenes 1–4 and 10 can use the same palette on a plain background.
- **Main colour:** a strong **royal blue** (about `#3D5BD9`) for primary buttons, the "PT" logo tile, active tabs and the round chat button.
- **Skill chips** (small rounded pills, exactly as in the app):
  - 🟢 **Green chip with a check-badge icon = shown** ("Shown in an answer, voice note or sample")
  - ⚪ **Grey chip with a small circle = stated** ("Stated, not shown yet")
  - 🟠 **Amber chip with an arrow = comes from a related skill** (for example "Spreadsheets → Data analysis")
  - ◌ **Dashed outline chip = missing skill**
  - Required skills carry a tiny uppercase **MUST** tag inside the chip.
- **Skill match meter:** a row of small vertical bars, filled **green** when the match is 60 % or more and **blue** below that, followed by text such as "**82 %** match for **Logistics coordinator**".
- **The header (top of every screen):** on the left the blue **PT** tile and "True Fit"; in the middle the role tab (**Job seeker**, **Company** or **Espoo Esbo** with the Espoo swirl icon); on the right a small cloud icon with "**Saved**" and a round avatar pill with the signed-in name. A second, thinner row holds the page links of that role:
  - Job seeker: Find jobs · My profile · My applications · My agenda
  - Company: Find candidates · Candidates from Espoo · My agenda
  - Espoo Esbo: Introductions · Insights
- **Notifications:** small toasts slide in at the bottom-right corner (for example "Introduction requested").
- **Font:** Geist (or Inter). Bold for headlines, regular for labels.
- **Motion:** quick slide-and-fade, a highlight ring around the button being "clicked", and a small cursor or finger tap. No stock photos of handshakes.
- **Pace:** with 2 minutes, show more than the voice says. Visuals carry the details; the narration carries the story.
- **Recurring characters** (keep them the same in every scene):
  - **Aino**, hiring manager at a small Espoo software company (company side)
  - **Sam**, a job seeker who moved to Finland and worked as a logistics coordinator (job seeker side)
  - **The Espoo event team**, shown as the Espoo swirl logo with a small group of three people
- **On-screen text:** at most about 8 words per line. Button and tab labels are copied exactly from the app (in **bold** below). No technical words anywhere in the video: no AI model names, database or framework names, "ESCO", "algorithm" or "pool".

---

## 1. Storyboard

Each scene gives the time, what is on screen, the on-screen text, the narration to paste into ElevenLabs and the sound effects.

---

### ACT 1: THE CHALLENGE (0:00–0:24)

#### Scene 1: Title (0:00–0:05)

- **Visual:** Plain light background. The blue "PT" logo tile pops in, then the words **True Fit** type out beside it. Below: "Junction × City of Espoo · Rethinking Recruitment". The Espoo swirl fades in in the corner.
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
  1. Three large icons appear in a row: 🗣️ **Talk, don't write** (a speech bubble turns into a job card) · 💬 **Show, don't claim** (a quote mark turns into a green "shown" chip) · 🤝 **Humans decide** (the Espoo swirl joins two puzzle pieces).
  2. The row folds into the real **sign-in page**: three side-by-side cards, each with its icon and three ticks:
     - **Job seeker:** "Browse and apply to jobs · Build your own skill profile · Answer invitations and offers"
     - **Company:** "Post and edit your own roles · Ask Espoo for introductions · Interview and make offers"
     - **Espoo Esbo** (City of Espoo event team): "See every role and candidate · Introduce and run Espoo interviews · Insights"
  3. A small padlock settles on each card: "Only your own data."
- **On-screen text:** **Talk · Show · Decide** → **3 views · 1 journey**
- **Narration:**
  > True Fit rests on three ideas: [short pause] talk, don't write. Show, don't claim. And humans decide. One app, three separate views, and everyone sees only their own data.
- **SFX:** gentle rising tone under each idea, door "click".

---

### ACT 3: THE DEMO, AS GRAPHICS (0:36–1:30)

> Follow Aino and Sam through the whole journey on simplified copies of the real screens (see "Look and feel"). Keep each step on screen for about 2 seconds, and put a highlight ring around each button as it is "clicked".

#### Scene 5: The company chats (0:36–0:48)

**Screen:** Company tab → **Find candidates**.

- **Visual:**
  1. The page is almost empty: a white bar says "Tell TrueFit Assistant who you need. "We need a dev" is a fine start." with two buttons, **Talk live** (outline) and **Chat with TrueFit Assistant** (blue). In the bottom-right corner sits a **round blue chat button** with a small pulsing green dot.
  2. Aino clicks the round button. A chat window opens from the corner: title **TrueFit Assistant** with a robot icon and a small badge "● AI · online"; under it, "It only sees what you type or say and how many people are registered, never any candidate."
  3. Aino types in the box ("Type or speak your answer…"): _"We need someone to plan deliveries and talk to customers, in English, hybrid."_ Three dots show "Assistant is typing", then a short follow-up question appears with a row of **Suggested answers:** pills underneath, for example "Finnish", "Swedish", "English", "Another language". A small note slides in: "Skills added".
  4. Behind the chat, the white bar on the page updates: "**Logistics coordinator** · 6 of 40 people at this event fit", with skill chips below it (two with the **MUST** tag).
  5. Under **Suitable candidates** ("Best skill match first"), candidate cards stack in one column. Each card shows round initials, name and one-line headline, the bar meter "**82 %** match for **Logistics coordinator**", city, email and phone, and a short "Background · Languages · Prefers · Available" line. When Aino types _"Make customer service a nice-to-have"_, the cards reshuffle.
  6. On Sam's card, Aino clicks **Ask Espoo Esbo to introduce** (hand icon). The button becomes a blue badge "✓ **Asked the organiser**" and a toast appears: "**Introduction requested**: Espoo sees your request."
- **On-screen text:** **Just chat. The right candidates appear.**
- **Narration:**
  > [upbeat] Aino, a hiring manager, just chats with the TrueFit Assistant. It fills in the job card, the best-matching candidates appear as she types, and she asks Espoo Esbo to introduce them.
- **SFX:** soft keyboard typing for her message, a light "pop" for each chip, a "ding" when the list reshuffles, a soft "tap" on the request button.

#### Scene 6: The job seeker shows proof (0:48–1:05)

**Screens:** Job seeker tab → **My profile** (with the "Companies that suit you best" card on the right), then **Find jobs**.

- **Visual:**
  1. **My profile** opens with a four-step progress line at the top, **Background · Skills · Evidence · Review profile**, and "☁ Saved automatically" on the right.
  2. A card "**Start from your CV or LinkedIn profile**" with buttons **Upload CV** and **Paste text**. Sam drops a PDF. A result panel "**Found in your CV**" lists _Latest job title_, _Your path, without names or places_ and _Working languages_; below it a greyed box "**Left out of your card**" holds the email, phone and address, which fade out. Sam clicks **Use this**. A caption: "Contact details removed before the AI reads it. The file is never stored."
  3. **Evidence** step: four question cards, each with a hint and a "Your answer…" box with a word counter. Show the first one: _"Describe a time something broke or went wrong at work, in your studies or at home. What did you check first, and why?"_ Under the box, **Ideas for you** shows half-sentence starters in grey; Sam types.
  4. Sam clicks **Map my answers**. A panel "**Which answer supports which skill**" appears: each skill chip turns 🟢 green with a check badge, and the exact sentence from Sam's answer is highlighted next to it. Chips without a quote stay ⚪ grey (stated).
  5. An amber **Privacy check: 1 detail** box flags a word Sam typed (for example a company name) with **Remove** and **Keep** buttons; Sam clicks Remove and the box turns into a green "shield" tick.
  6. On the right, the card "**Companies that suit you best**" ("Based on your skills and the job titles here") shows a spinning "AI is ranking" badge, then a numbered list: a green trophy circle on #1, then 2, 3… Each row has a company name, job title and a fit percentage. The order changes when Sam adds an answer.
  7. Quick cut to **Find jobs**: a search box ("Job title, skill or company"), a "Any way of working" filter and a "Best skill match" sort; job cards with a bar meter. Under **Improve your chances**, "**Skills that open the most doors here**" (amber key icon) shows two chips. Sam clicks **Apply now** (paper-plane icon) on the top job; a toast confirms it.
- **On-screen text:** **Every skill backed by your own words.** · 🟢 Shown · ⚪ Stated
- **Narration:**
  > Sam imports a CV, and contact details are removed before any AI reads it. Sam answers four real-life questions, and every skill links to Sam's own words: green means shown, grey means stated. Then Sam sees which companies fit best, and applies.
- **SFX:** paper "swish" for the drop, tiny "pings" as chips turn green, button "tap".

#### Scene 7: Espoo decides who meets whom (1:05–1:17)

**Screen:** Espoo Esbo tab (Espoo swirl icon) → **Introductions**.

- **Visual:**
  1. Three tabs at the top: **Suitable candidates** (with a small blue count badge), **Pipeline** and **Decisions log**, plus a switch "Review by: **By company need** / **By candidate**".
  2. Aino's role card on top, candidate cards below with name, contact details, bar meter and green "shown" chips. Sam's card carries two small badges: "**Candidate asked to meet**" and "**Company asked for an introduction**", with a tooltip: "It doesn't change the skill match."
  3. At the bottom of Sam's card: **✓ Invite to Espoo interview** (blue), **✕ Not now**, **Other company…**, and a grey note on the right: "_Suggestion only · you decide_".
  4. The organiser clicks **Invite to Espoo interview**. A dialog asks "**Invite this candidate to an Espoo interview?**" with preset reasons to pick from ("Must-haves shown in their answers", "One side asked to meet", …) and a note box. They pick one and click **Invite with reason**. Toast: "**Espoo interview invitation sent**".
  5. Cut to the **Decisions log** tab: a table with the columns **When · Action · Need · Candidate · Change · Reason / note**, and the new row slides in at the top.
  6. In the corner, the **Espoo Esbo assistant** chat ("Ask about the event…") answers "How many interviews are booked?" with a total only, labelled "AI answer from event totals".
- **On-screen text:** **AI suggests. People decide.**
- **Narration:**
  > The City of Espoo is the broker. Its team sees each match with the proof behind it. The AI only suggests. [short pause] A person decides, always with a written reason, and every decision is logged.
- **SFX:** stamp "thunk" on the invite, soft keyboard, notification "pop".

#### Scene 8: The six-step journey (1:17–1:30)

**Screens:** Job seeker → **My applications**, Espoo Esbo → **Pipeline**, Company → **Candidates from Espoo**.

- **Visual:** The app's own **six-step stepper** (six boxes in a row, done steps filled blue, the current one outlined) runs across the top the whole time, lighting up as the story moves:
  **1 Applied or matched · 2 Espoo assessment · 3 Espoo interview · 4 Profile sent to company · 5 Company interview · 6 Job offer**
  1. **Sam, My applications:** "**Espoo invites you to an interview**" → Sam accepts and picks a time ("Book your Espoo interview", a 10-minute slot).
  2. **Espoo, Pipeline:** the row "Espoo interview booked · result to record" → **Record Espoo result** → "Passed" with a reason. Toast: "**Passed: profile sent to the company**".
  3. **Aino, Candidates from Espoo:** "**Do you want to interview this candidate?**" → **Invite to interview**. Sam answers **Yes, let's meet**.
  4. A week calendar (**Mon 30 Nov – Fri 4 Dec, 9:00–16:00**, 30-minute slots): taken and clashing times are greyed out; Aino picks one at "Table 3, Otaniemi hall". Toast: "**Added to both agendas.**"
  5. A short star-rating card, "**30-second feedback**", fills in on both sides.
  6. Aino sends a **Job offer**; Sam clicks **Accept the offer**: "**Congratulations! You accepted the offer.**" The status reads "Offer accepted · hired" and confetti falls over step 6.
- **On-screen text:** **From first match to job offer.**
- **Narration:**
  > Next, Espoo interviews Sam, and only after a pass is Sam's profile sent to the company. Aino books an interview, both give feedback, [short pause] and Sam gets a job offer.
- **SFX:** a light "step" tick per stop, confetti pop at step 6.

---

### ACT 4: RESPONSIBLE AND FAIR (1:30–1:42)

#### Scene 9: Fair by design (1:30–1:42)

**Screen:** Espoo Esbo → **Insights**, the fairness card.

- **Visual:**
  1. A shield in the centre. Facts pop in around it:
     - ⚖️ **Skills only.** Nationality, language, education and career path are greyed out and crossed through.
     - 🏷️ **The AI never sees names.** Candidates stay anonymous to the AI.
     - 🚫 **0 automatic rejections.**
  2. The shield slides aside to show the real **Insights** card "**Is every group treated alike?**" ("For each group, how often its members get suggested, compared with the best-served group. Below 80 % needs a closer look."): one bar per group with a dashed line at 80 %, every bar above it, and green "**Balanced**" badges for nationality, language, education and career path.
  3. Footer: "Ready for the EU AI Act."
- **On-screen text:** **Fair by design.**
- **Narration:**
  > Fairness is built in. Matching uses skills only, the AI never sees names, and nobody is rejected automatically.
- **SFX:** low "shield" hum, ticks for each fact.

---

### ACT 5: THE RESULTS (1:42–2:00)

#### Scene 10: What we built, the results and end card (1:42–2:00)

- **Visual:**
  1. **1:42–1:47: What we built.** A grid of eight tiles lights up one by one, each a small thumbnail of the real screen with a plain label:
     💬 TrueFit Assistant: chat to build a job card · 📄 Private CV import · 💬 Profiles backed by proof · 🧭 Best-fit companies for every job seeker · 🏛️ Espoo Esbo review board · 📅 Interview booking without clashes · ⭐ Feedback and job offers · ⚖️ Built-in fairness check
  2. **1:47–1:55: The results.** Big numbers, one per beat, each counting up from zero with a short plain caption underneath (one at a time, about 1.3 s each, the screen filled by the number):
     - **93 %** · "of candidates matched to at least one role" (37 of 40)
     - **83 %** · "less noise: companies review only the strongest matches" (47 good matches out of 280 possible pairings)
     - **61** · "skills proven in candidates' own words"
     - **87 %+** · "fairness score in every group, above the 80 % bar" (a small bar shows every group passing the line)
     - **0** · "automatic rejections"
     - **10** · "languages for skill search"
     - Small footnote along the bottom for the whole beat: _"Measured on 40 test candidates and 7 real-style job roles."_
  3. **1:55–2:00: End card.** Three short benefit lines fade in above the logo: 🏢 "Minutes, not hours" · 🧑‍💼 "Judged on skills" · 🏛️ "Less screening, more connecting". Then: PT logo · **True Fit** · _More signal, less noise._ · Project Hail Mary · "Junction × City of Espoo".
- **On-screen text:** **What we built** → **The results**
- **Narration:**
  > The result: 93 percent of candidates found a fitting role, companies review 83 percent fewer profiles, and every group is treated fairly. Companies save time, job seekers are judged on skills, and Espoo connects the right people. [warm] True Fit. [short pause] More signal, less noise.
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
[upbeat] Aino, a hiring manager, just chats with the TrueFit Assistant. It fills in the job card, the best-matching candidates appear as she types, and she asks Espoo Esbo to introduce them.
---
Sam imports a CV, and contact details are removed before any AI reads it. Sam answers four real-life questions, and every skill links to Sam's own words: green means shown, grey means stated. Then Sam sees which companies fit best, and applies.
---
The City of Espoo is the broker. Its team sees each match with the proof behind it. The AI only suggests. [short pause] A person decides, always with a written reason, and every decision is logged.
---
Next, Espoo interviews Sam, and only after a pass is Sam's profile sent to the company. Aino books an interview, both give feedback, [short pause] and Sam gets a job offer.
---
Fairness is built in. Matching uses skills only, the AI never sees names, and nobody is rejected automatically.
---
The result: 93 percent of candidates found a fitting role, companies review 83 percent fewer profiles, and every group is treated fairly. Companies save time, job seekers are judged on skills, and Espoo connects the right people. [warm] True Fit. [short pause] More signal, less noise.
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
| 5     | "Soft keyboard typing", "Soft UI pop"                      |
| 6     | "Paper swish onto a desk", "Tiny high digital ping"        |
| 7     | "Rubber stamp on paper, muffled"                           |
| 8     | "Light footstep tick", "Small confetti pop with a cheer"   |
| 9     | "Low warm electronic hum, shield activation"               |
| 10    | "Fast mechanical counter ticking, landing on a click"      |

---

## 5. What each scene covers in the code (for the team only, never shown in the video)

| Scene | Feature in the app                                                                                                                                                                                                                                                                                                                                               |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4     | Demo sign-in and role-based access (`lib/auth/`), own accounts for companies and job seekers                                                                                                                                                                                                                                                                     |
| 5     | TrueFit Assistant (`components/company-intake.tsx`): intake chat and live voice (`app/api/intake`, `/live`, `/transcribe`), live pool counts; for an existing company it refines the selected role and the suitable-candidate list follows it (best match first, never saved, "Back to the saved role"); "Ask Espoo Esbo to introduce" sets the company's opt-in |
| 6     | CV import (`lib/cv-import.ts`, contact details stripped, file not stored), scenario starters, evidence map with verbatim quotes, "Companies that suit you best" (`lib/role-rank.ts`), door-opening skills, Apply now                                                                                                                                             |
| 7     | Espoo Esbo tab (swirl icon): organiser review board with "Candidate asked to meet" / "Company asked for an introduction" badges, Invite to Espoo interview / Not now with preset reasons (`lib/oversight.ts`), decision log with CSV export, Espoo Esbo assistant (totals only)                                                                                  |
| 8     | Six-step pipeline (`lib/pipeline.ts`), contact details unlocked after the Espoo pass, Mon–Fri interview slots with clash blocking (`lib/schedule.ts`), feedback, offer                                                                                                                                                                                           |
| 9     | Skills-only matching with protected-field tests, C1…Cn labels, bias audit (four-fifths), `/responsible` page                                                                                                                                                                                                                                                     |
| 10    | From the test snapshot (`tests/fixtures`, 40 candidates × 7 roles), refreshed in d6da9bf: 37/40 have ≥ 1 suggested role; 47 of 280 pairs suggested (score ≥ 0.4, `SUGGEST_THRESHOLD`); 61 evidence quotes; `biasAudit` ratio 0.87 origin, 0.88 language, 0.92 education, 0.93 career path; 10 ESCO search languages; no auto-reject                              |

---

## 6. Production checklist

- [ ] Generate the voice first and check that it is 1:55 or shorter. Then line up each visual with its paragraph.
- [ ] Re-check the Scene 10 numbers against the live data on recording day (`/responsible` shows the fairness scores). If the candidate list has changed, update the numbers and the footnote.
- [ ] Keep captions on, and keep on-screen text under about 8 words per line.
- [ ] Export at 1080p, then a 9:16 version for social media.
