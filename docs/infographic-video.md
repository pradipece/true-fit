# TrueFit: infographic video content

> Source material for the 2-minute demo video. Minute 1 is an infographic and minute 2 is the live product.
> Replace `[Team name]` before recording. All numbers come from the prototype itself; don't add impact claims we can't back up.

---

## 1. Identity

| Item           | Text                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| Team           | **[Team name]**                                                                                      |
| Project        | **TrueFit**                                                                                          |
| Event          | Junction hackathon, **"Rethinking Recruitment"** challenge by the **City of Espoo**                  |
| Tagline        | **More signal, less noise.**                                                                         |
| One-line pitch | Companies talk, candidates show proof, and Espoo makes the introduction. AI suggests, people decide. |

---

## 2. The challenge

**The question from Espoo:**

> How can Espoo's recruitment events help companies and talent find each other, now that AI writes the CVs and AI screens them?

**What goes wrong today**

| Who              | Pain                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------- |
| 🏢 Companies     | Vague needs sent too late, then a flood of look-alike AI-written applications                |
| 🧑‍💼 Job seekers   | Hard to put real skills into words; international talent faces language and career-path bias |
| 🏛️ City of Espoo | Too many applications, too little time to judge real ability                                 |

**Rules we had to follow**

- ✋ No automated decisions about people. A human is always in the loop.
- 🔒 Synthetic data only, with minimal personal data.
- ⚖️ No bias by nationality, language, education or career path.
- 🇪🇺 Ready to explain EU AI Act compliance. Recruitment AI is **high-risk** under Annex III.

---

## 3. Our approach: three ideas

| #   | Idea                     | What it means                                                                                             |
| --- | ------------------------ | --------------------------------------------------------------------------------------------------------- |
| 1   | 🗣️ **Talk, don't write** | Companies describe what they need by chat or **live voice**, and the job card fills itself in.            |
| 2   | 💬 **Show, don't claim** | Candidates answer short real-life scenarios. Every skill links to **their own words** as proof.           |
| 3   | 🤝 **Humans decide**     | The **City of Espoo event team** acts as a broker. It interviews candidates and makes every introduction. |

---

## 4. Everything we built

### 4.1 For companies 🏢

- **AI intake chat and live voice conversation.** Describe the role in your own words. The AI asks follow-up questions and fills in the job card as you talk.
- **Speech-to-text** in the chat (up to 60 s). The transcript is shown for you to check and is never sent automatically.
- **Live pool counts** while you type: "6 people at this event fit this".
- **Smart quick replies** written for each conversation.
- **Editable job card** with an EU-standard skills list (ESCO). Language, way of working and contract type are free text.
- **Suitable candidates** with skill match and an optional **AI fit rate** (0–100 plus a one-line reason). Nobody is hidden.
- **"Ask Espoo to introduce"** for any candidate.
- **Candidates from Espoo:** only people Espoo has already interviewed and passed, with contact details unlocked at that point.
- **Book interviews** across a work week (Mon–Fri, 30-minute slots). Clashes are blocked.
- **Feedback form and job offer** in one place.
- **My agenda** with calendar (.ics) export.

### 4.2 For job seekers 🧑‍💼

- **Job portal home page** and **Find jobs** board with search, filters and "Apply now".
- **CV import** from a LinkedIn PDF, Word or pasted text. Contact details are removed before the AI sees anything, and the file is never stored.
- **Skills translator:** job title or career path → EU skills and Finnish job-ad words.
- **Four scenario questions** with writing starters (never ready-made answers).
- **Evidence map:** every skill is marked _shown_ (proven with a quote) or _stated_ (claimed).
- **Privacy check** before sharing.
- **"Companies that suit you best"**, ranked live and updated as you add more.
- **Skills that open the most doors:** the missing skills that would unlock the most roles.
- **"What companies see"** preview of the anonymised profile.
- **My applications:** answer Espoo's invitation, book the Espoo interview, see the result, answer the company and the offer.
- **Profile autosave.**

### 4.3 For the City of Espoo (organiser) 🏛️

- **Review board:** every company need with suitable candidates, skill match and evidence.
- **Introduce / Not now / Undo**, always with a written reason.
- **Two views:** by company need, or by candidate (every company ranked for one person).
- **Pipeline tab:** every pair from request to offer, showing whose move it is.
- **Record Espoo interview results** (passed / not passed).
- **Append-only decision log** with CSV export.
- **Espoo Esbo assistant:** an AI helper that answers questions about the event from totals only, never from individuals, and never decides.
- **Event insights dashboard:** charts with a table view, interviews per weekday, satisfaction and accuracy of the cards.
- **Impact section** built from meeting feedback.

### 4.4 The recruitment pipeline (6 steps) 🔁

```
1 Applied / matched → 2 Espoo assessment → 3 Espoo interview
→ 4 Company decides → 5 Company interview + feedback → 6 Offer
```

- Either side can start: the candidate asks to meet, or the company asks for an introduction.
- The company sees the profile and contact details **only after Espoo's interview is passed**.
- Undoing a step clears everything after it.
- Nobody is told why someone said no, which protects both sides.

### 4.5 Responsible AI and fairness ⚖️

- **Matching on skills only.** Automated tests fail if scoring ever reads nationality, language, education or career path.
- **Explainable scores:** points for each skill, plus a "why this match" text.
- **Proof, not claims:** AI quotes must appear word for word in the candidate's answer, and this is checked on the server.
- **AI never sees names or ids.** Candidates appear as C1…Cn and roles as R1…Rn.
- **Bias check** by nationality, language, education and career path (four-fifths rule).
- **No auto-reject.** People below the guide stay listed.
- **Fallbacks:** if the AI is down, talent and match features keep working on transparent rules.
- **Responsible AI page:** who decides at each step, what the AI does and never does, a data inventory, and the EU AI Act Annex III 4(a) classification with a prototype-vs-production table.

### 4.6 Access and privacy 🔐

- Demo sign-in for three roles: company, job seeker and organiser.
- **Role-based access:** each side sees only its own pairs and can change only its own answers.
- Signed session cookie (12 h). Every page and API route is checked.
- All data is synthetic, and there is row-level security on every table.

### 4.7 Under the hood (one slide at most) ⚙️

- Next.js 16 + React 19 web app, deployed on Vercel.
- Google Gemini for chat, live voice, transcription, CV reading, fit rates and the assistant.
- Official EU **ESCO** skills taxonomy, with live search in **10 languages**.
- Tiger Data (Postgres) database. Shared state syncs every 4 s across browsers.
- Polite scraper for **9 public Finnish recruitment sources** (research only). It honours robots.txt and stores no contact details.

---

## 5. Results (prototype numbers)

| Number         | What                                                    |
| -------------- | ------------------------------------------------------- |
| **3**          | separate role views: company, job seeker, City of Espoo |
| **6**          | pipeline steps, from first match to job offer           |
| **5 / 7 / 26** | synthetic companies / job roles / diverse candidates    |
| **10**         | languages for skill search                              |
| **0**          | automatic rejections                                    |
| **170+**       | automated tests, including fairness and privacy tests   |
| **24**         | feature releases (v0.20.0)                              |

> Check these on `/organiser/insights` and in the repo before recording.

---

## 6. Benefits

### For companies 🏢

- ⏱️ **Minutes, not hours:** no job ad to write. Just talk.
- 🎯 **Fewer, better candidates,** each with proof of their skills.
- 🤝 **Pre-screened by Espoo** before you spend time on them.
- 📅 **One place** for interviews, feedback and offers.
- ⚖️ **Fair and explainable,** ready for EU AI Act requirements.

### For job seekers 🧑‍💼

- 💬 Show what you can do, not how well an AI writes your CV.
- 🌍 Judged on skills, not on your name, language or career path.
- 🧭 See which companies fit you and which skills open more doors.

### For the City of Espoo 🏛️

- 🧠 Less time screening, more time connecting.
- 📊 Live view of the whole event, with fairness numbers.
- 🧾 Every decision logged with a reason: transparent and auditable.

---

## 7. Video script

### Minute 1: infographic

| Time      | Visual                                                           | On-screen text                                                   | Voiceover                                                                                                                                                                                                  |
| --------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:06 | Team logo, then the TrueFit logo                                 | **[Team name] presents TrueFit**<br>Junction × City of Espoo     | "We're [Team name], and this is TrueFit."                                                                                                                                                                  |
| 0:06–0:20 | Robot-written CVs pour into a robot funnel; good people fall out | **AI writes the CVs. AI screens the CVs.**                       | "Today AI writes the CVs and AI screens them. Companies drown in look-alike applications, and good people get filtered out because of their name, language or career path."                                |
| 0:20–0:38 | Three icons appear one by one                                    | **Talk, don't write · Show, don't claim · Humans decide**        | "TrueFit works in three steps. Companies just talk, and the job card writes itself. Candidates show their skills with real examples. Then the Espoo event team, not an algorithm, decides who meets whom." |
| 0:38–0:48 | Counters tick up; fairness badge                                 | **6 steps · 0 auto-rejections · skills-only matching**           | "The result is a working prototype that covers the whole journey, from the first conversation to a job offer, and checks every match for bias."                                                            |
| 0:48–1:00 | Four benefit tiles                                               | **Minutes, not hours · Better candidates · Pre-screened · Fair** | "For companies, that means no job ads to write, fewer but better candidates already interviewed by Espoo, and a fair process you can explain. Let us show you."                                            |

### Minute 2: live product

| Time      | Screen                                                         | Voiceover                                                                            |
| --------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1:00–1:15 | Company: live voice → job card fills in                        | "The company just talks, and it sees right away how many people at the event fit."   |
| 1:15–1:35 | Job seeker: CV import → evidence map → companies that suit you | "Every skill is backed by the person's own words, and they see where they fit best." |
| 1:35–1:50 | Espoo: Introduce with a reason → Pipeline tab                  | "The AI suggests, but Espoo decides. Every decision has a reason and is logged."     |
| 1:50–2:00 | End card: logo, tagline, team, QR/demo link                    | "TrueFit. More signal, less noise."                                                  |

---

## 8. Production notes

- Keep on-screen lines under about 8 words, and add captions because many people watch muted.
- Use the app's colours in the infographic so the cut to the live demo feels seamless.
- Pre-record the AI steps (voice, CV import) and cut out loading waits.
- Prepare a strong match in the data in advance, so the organiser scene shows a clear "yes".
- Use the same two people (one company contact, one candidate) all the way through.
- Use plain words on screen: "skill match", "shown / stated", "EU skills list". Avoid "ESCO", "LLM" or "pool".
