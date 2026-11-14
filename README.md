# True Fit

A prototype for the **"Rethinking Recruitment"** challenge by the City of Espoo (Junction). The full brief is in [espoo-challenge.pdf](espoo-challenge.pdf).

---

## 1. The challenge

> How can recruitment and matchmaking events organized by the City of Espoo help companies and talent relevantly find and connect with each other, despite AI-generated job search materials and AI-assisted recruitment processes becoming common?

Espoo runs recruitment and matchmaking events online, in person and in hybrid format. Candidates now write their CVs with AI, and companies screen them with AI. The result is that AI talks to AI, and nobody really learns what the other side can do or needs.

**Goal:** stronger signal and less noise before, during and after an event. This is not about building a better CV-matching algorithm.

## 2. Who uses it and what goes wrong

| Who                       | What goes wrong                                                                                                                                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Companies**             | They don't see the city as a real source of candidates ("free means low quality"). They describe their needs vaguely and send them too late, right before the event. During the event they get flooded with irrelevant approaches. |
| **Talent**                | They can't put their skills, transferable skills or value into words. Their AI-written CVs all sound the same. International candidates also face language, culture, permit, relocation and onboarding issues.                     |
| **Organisers (the city)** | They get a lot of applications and have little time to judge real ability, especially for tech skills. The current platform is clunky and crashes when everyone logs in at the start of an event.                                  |

## 3. Hard constraints

1. **No automated decisions about people without a human involved.** The system can suggest, rank or explain, but a person always makes the call. No auto-reject and no hidden scores.
2. **Synthetic data only** in the prototype.
3. **Process as little personal data as possible**, and show how privacy would work in a real deployment under the **EU AI Act**. Recruitment AI counts as high-risk under Annex III, which requires transparency, human oversight and bias controls.
4. **Fairness:** no disadvantage based on nationality, language, educational background, career path or other characteristics unrelated to the opportunity.

## 4. Judging criteria

| Criterion                        | Weight | What it means for us                                                                                                                  |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Impact & Relevance               | 45%    | Solve one listed pain point end to end, with a clear before and after. It should work for organisers as well as companies and talent. |
| Innovation & UX                  | 35%    | Challenge existing approaches; another swipe-and-match app won't stand out. The demo must feel effortless.                            |
| Responsible & Feasible Execution | 20%    | Credible tech, privacy by design and a realistic path to a pilot in Espoo.                                                            |

## 5. Solution directions

1. **Evidence instead of documents:** short, structured proof of skill (scenario answers, a 60-second voice note, a small work sample) mapped to **ESCO** skills. It's harder to fake with AI and quicker for a human to judge.
2. **AI-guided needs intake for companies:** a short chat helps a company turn "we need a dev" into concrete, ESCO-mapped needs **weeks before** the event. It sends reminders and shows how many relevant candidates are already in the pool, which addresses the "low quality" belief.
3. **Explainable, two-way matching:** both sides see _why_ a match was suggested ("shared skill: data pipelines; transferable: logistics → supply-chain analytics"). Both must opt in. Short scheduled slots replace open-floor chaos.
4. **Anonymised first round:** name, nationality, photo and school are hidden until both sides opt in.
5. **Skills translator:** turns foreign job titles and unusual career paths into ESCO skills and local job vocabulary.
6. **Follow-up loop:** structured feedback after the event improves the next one and gives the city impact metrics.

## 6. MVP scope

One flow that combines directions 1–4:

1. **Company intake chat:** a vague need becomes a structured, ESCO-tagged **need card**.
2. **Talent profile from evidence:** 3–4 scenario prompts plus self-chosen skills become an anonymised **skill card** (no CV).
3. **Organiser dashboard:** suggested matches, each with a plain-language explanation. The organiser approves or edits them (human oversight).
4. **Mutual opt-in, then a scheduled 10-minute meeting slot**, plus a feedback form afterwards.
5. **Responsible AI panel:** what data is stored and for how long, what the AI does and doesn't decide, and a bias check across groups in the synthetic data.

### Technical approach

- **Next.js** app (App Router).
- An **LLM** structures input and writes match explanations. It never makes decisions.
- **ESCO API** (or a cached subset) for the skill taxonomy.
- **Synthetic personas** (companies and talent) seeded from JSON.
- Static or edge-cached pages and pre-scheduled slots, to avoid the login crash at event start.

## 7. Risks

- Overselling "AI matching" can look like automated profiling. Present it as **decision support**.
- A scope that's too broad leads to a shallow demo. Go deep on one journey.
- The organiser is the actual customer. Don't leave them out.
- Answer clearly why companies should trust a free city service.

## 8. Resources

- [ESCO: European Skills, Competences, Qualifications and Occupations](https://esco.ec.europa.eu/)
- Job portals: Duunitori, The Hub, Work in Finland, Job Market Finland
- Event platforms for reference: Brella, Tavata
- National Forum for Skills Anticipation, Suomi.fi PTV Open API, Business Espoo

---

## Getting started

```bash
yarn install
yarn dev
```

Open [http://localhost:3000](http://localhost:3000).
