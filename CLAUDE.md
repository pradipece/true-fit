@AGENTS.md

# CLAUDE.md

This file guides Claude Code (claude.ai/code) when working in this repository.

## Project status and purpose

`true-fit` is a hackathon project for the **Junction "Rethinking Recruitment" challenge by the City of Espoo**. The brief is in `espoo-challenge.pdf` at the repo root. It is untracked; on macOS, extract its text with PDFKit via `osascript -l JavaScript` if `pdftotext` isn't installed.

The MVP UI is a **front-end demo with a few API routes for the LLM steps**, all using **Google Gemini** through `@google/genai` (`lib/ai.ts`, default model `gemini-3.8-flash`, override with `GEMINI_MODEL`; key in `GEMINI_API_KEY`). `app/api/intake` runs the company intake chat; `app/api/talent/translate` (job title or career path → ESCO skills + Finnish job-ad vocabulary) and `app/api/talent/evidence` (answers → ESCO skills with verbatim supporting quotes, plus a privacy check) power the talent card. Responses use JSON-schema output constrained to the cached ESCO ids and are re-validated server-side (quotes must appear verbatim in the answer). Without a key, on any API error, or with `AI_MODE=rules`, each route answers with a deterministic rules engine (`lib/intake.ts`, `lib/talent-ai.ts`) so the demo works offline. Routes only see the sender's own text, never other people's data. There are no tests yet. All data is synthetic, and demo state lives in a client context persisted to `localStorage`.

- `app/` has one route per demo step: `/company` (clarifying intake chat → editable need card → human approval, with live pool count and a mock reminder timeline), `/talent` (skills translator → skill picker → four scenario answers plus optional voice note / work-sample file → reviewable evidence map, privacy check and anonymised skill card), `/organiser` (approve or dismiss suggested matches + decision log), `/meetings` (mutual opt-in → 10-min slot → feedback) and `/responsible` (AI Act, data retention, bias check). Pages are thin Server Components that render a client component from `components/`.
- Data lives in JSON: `data/esco/` is the cached ESCO subset (skills with real URIs, synonyms and adjacency; occupations with multilingual titles), refreshed via `yarn esco:refresh`. `data/seed/` holds the synthetic personas (5 companies / 7 needs, 26 talent profiles varied by origin, language, education and career path). `lib/seed.ts` validates and loads the seeds (re-exported from `lib/data.ts` with event constants); `lib/esco.ts` has the lookup helpers (`searchSkills`, `relatedSkills`, `searchOccupations`), keyword extraction and title translator, and `lib/match.ts` the transparent rule-based matching and bias audit. **Matching must use skills only**; `Talent.audit` is for aggregate fairness checks only. `lib/store.tsx` is the `DemoProvider` / `useDemo()` state.
- UI is **shadcn/ui** (`components.json`, style `base-nova`, built on **Base UI**, not Radix). Add components with `npx shadcn@latest add <name>`. Base UI uses `render={<Link href="…" />}` (plus `nativeButton={false}` on `Button`) instead of `asChild`. `cn` comes from the `cn` package (shadcn's own), re-exported from `@/lib/utils`.

Constraints from the brief that should shape product and technical decisions:

- Goal: help companies and job seekers find relevant matches before, during, and after Espoo's recruitment and matchmaking events (online, in person, or hybrid). Focus on "more signal, less noise", given that CVs and screening are increasingly generated or processed by AI.
- **No automated profiling or automated decisions about individuals without a human in the loop.** Matching may suggest; humans decide.
- **Synthetic data only.** Minimise personal data processing, and be ready to explain how privacy and EU AI Act compliance would work in a real deployment.
- Avoid bias based on nationality, language, education, or career path. Explainable or transparent matching helps here.
- Useful open resources: the ESCO skills/occupations taxonomy, Work in Finland / Job Market Finland, and Duunitori.
- Judging weights: Impact & Relevance 45%, Innovation & UX 35%, Responsible & Feasible Execution 20%. UX polish and a clear demo flow carry a lot of weight.

## Commands

The package manager is **Yarn 1** (`packageManager: yarn@1.22.22`, `yarn.lock`). Don't use npm or pnpm, so the lockfile doesn't drift.

```bash
yarn install
yarn dev      # next dev (Turbopack), http://localhost:3000
yarn build    # next build: production build, also type-checks
yarn start    # serve the production build
yarn lint     # eslint (flat config, eslint-config-next core-web-vitals + typescript + prettier)
yarn format   # prettier --write . (with prettier-plugin-tailwindcss)
```

A Husky pre-commit hook runs lint-staged (`eslint --fix` + `prettier --write` on staged files). There is no test runner or `typecheck` script yet. For a type check without a build, run `yarn tsc --noEmit`.

## Stack and versions

These are newer than most training data. Check `node_modules/next/dist/docs/` before relying on memory (see AGENTS.md).

- **Next.js 16.4** with the App Router only (`app/`, no `pages/`, no `src/`). **React 19.3**, **TypeScript 5** in strict mode.
- **Tailwind CSS v4**, CSS-first. There is no `tailwind.config.*` and no PostCSS config. Tailwind runs through the `@tailwindcss/turbopack` loader, set up under `turbopack.rules` in `next.config.ts`. `app/globals.css` uses `@import "tailwindcss"`, and theme tokens are defined in `@theme inline`. Add design tokens there, not in a JS config.
- Fonts: Geist and Geist Mono via `next/font/google`, exposed as `--font-geist-sans` / `--font-geist-mono` and mapped to Tailwind's `font-sans` / `font-mono`.
- Path alias: `@/*` resolves to the repo root (for example `@/app/...`). If you add `lib/` or `components/` at the root, import them as `@/lib/...`.

## Non-default Next.js config (`next.config.ts`)

These flags change how pages have to be written:

- **`cacheComponents: true`**: the Cache Components model. Data is **dynamic by default**, and caching is opt-in with the `"use cache"` directive, plus `cacheLife` / `cacheTag`. An uncached async read, or a runtime API (`cookies()`, `headers()`, `searchParams`, `params`), must sit inside a `<Suspense>` boundary. Otherwise the dev overlay reports a "blocking-route" insight. The old route-segment configs (`export const dynamic`, `revalidate`, and so on) don't apply. See `docs/01-app/01-getting-started/08-caching.md`.
- **`partialPrefetching: true`**: `<Link>` prefetches only the route's static "App Shell". URL-dependent data (`params`, `searchParams`) should be read inside `<Suspense>`. Use `<Link prefetch={true}>` only when the URL-specific content really must be prefetched. See `docs/01-app/02-guides/adopting-partial-prefetching.md`.
- **`experimental.agentFeedback: true`**: `next dev` rewrites the managed block in `AGENTS.md` and restores it if removed. Commit `AGENTS.md` changes along with your work instead of reverting them.

## Conventions in the scaffold

- Layouts and pages use the global, route-typed helpers `LayoutProps<"/route">` / `PageProps<"/route">`, which Next generates into `.next/types`. No import is needed.
- Components are Server Components by default. Add `"use client"` only for interactive leaves.
- Dark mode uses `next-themes` (`.dark` class, system default) with the shadcn CSS variables in `globals.css`. Brand and semantic tokens (`--evidence`, `--transfer`, `--gap`) are defined there too.
