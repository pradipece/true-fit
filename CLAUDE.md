@AGENTS.md

# CLAUDE.md

This file guides Claude Code (claude.ai/code) when working in this repository.

## Project status and purpose

`true-fit` is a hackathon project for the **Junction "Rethinking Recruitment" challenge by the City of Espoo**. The brief is in `espoo-challenge.pdf` at the repo root. It is untracked; on macOS, extract its text with PDFKit via `osascript -l JavaScript` if `pdftotext` isn't installed.

Right now the repo is still the **unmodified `create-next-app` scaffold**. `app/page.tsx` and the `metadata` in `app/layout.tsx` are boilerplate and should be replaced. Nothing is built yet: no domain code, data layer, API routes, tests, or env config.

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
yarn lint     # eslint (flat config, eslint-config-next core-web-vitals + typescript)
```

There is no test runner or `typecheck` script yet. For a type check without a build, run `yarn tsc --noEmit`.

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
- Dark mode currently follows `prefers-color-scheme` through CSS variables in `globals.css` (`--background`, `--foreground`) and Tailwind `dark:` variants.
