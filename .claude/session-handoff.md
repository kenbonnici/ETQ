## Project State

- **Repo**: ETQ (deterministic retirement-planning webapp, plain TS + Vite, no framework). Branch: `main`, 2 commits ahead of `origin/main`, unpushed.
- **Working tree**: clean.
- **Key files added/modified this session**:
  - `onboarding.html` (new) — Vite entry for the onboarding page.
  - `src/onboarding/main.ts` (new, ~750 lines) — orchestrates conversation UI, field state, estimate panel, handoff.
  - `src/onboarding/sequence.ts` (new) — full question sequence, activation rules, `pruneOrphanedAnswers`.
  - `src/onboarding/render.ts` (new) — card / chip / chapter divider DOM helpers.
  - `src/onboarding/chart.ts` (new, ~100 lines) — self-contained DPR-aware mini chart; intentionally not reusing `drawChart` from `src/main.ts`.
  - `src/onboarding/handoff.ts` (new) — reads `etq:landing:quick-estimate`, writes `etq:scenario:draft:v2` on handoff, navigates to `calculator.html#from=onboarding`.
  - `specs/runtime/onboardingSequence.test.ts` (new) — 7 tests for activation/pruning.
  - `specs/ui/onboarding.spec.ts` (new) — 7 Playwright tests.
  - `src/main.ts` — appended onboarding handoff banner block near line 5937. Captures `cameFromOnboarding` **before** `persistActiveView()` runs (line 5931 wipes the hash). Banner id `#onboarding-handoff-banner`.
  - `index.html` — first `.calc-choice` and middle `.step` card link to `onboarding.html`; landing script now writes the 6 quick-estimate inputs to `sessionStorage['etq:landing:quick-estimate']` on any click of `a[href="onboarding.html"]`.
  - `vite.config.js` — added `onboarding` to rollupOptions.input.
- **Build/test status**: typecheck clean, build clean (onboarding bundle 35.10 kB / 9.66 kB gz), 90/90 runtime tests, 55/55 Playwright (+2 pre-existing `.fixme`), 11/11 golden.

## Session Objective

Implement Progressive Onboarding per `mockups/progressive-onboarding-spec.md` — a single-page guided walkthrough between the landing 30-second estimate and the full calculator. Then: remove sample-data ingress paths so onboarding only uses schema defaults + landing seed. **Both completed and committed** as `c11aeda`.

## Decisions Made

- **Separate entry module** (`/src/onboarding/main.ts`) instead of branching inside `src/main.ts`. Rationale: main.ts is already 5900+ lines; keeps bundles separate and avoids edits to a heavy file.
- **Self-contained `drawMiniChart`** rather than reusing `drawChart` from main.ts. Spec said "reuses drawChart primitives", but main.ts's version is ~180 lines with heavy coupling; a ~100-line canvas chart is simpler, testable, no export churn.
- **Gate state (yes/no answers like `hasMortgage`, `propertiesGate`) tracked outside `FieldState`** in a `Record<string, "YES"|"NO"|null>` on `ActivationCtx`, because these are not real schema fields.
- **Share `etq:scenario:draft:v2` key with calculator for handoff writes only**. Initial plan was to also resume from it; that was later removed (see below).
- **Sample-data removal strategy**: the sharing of `etq:scenario:draft:v2` was a leak path — if a user loaded `--sample data--` in the calculator, then opened the onboarding, it would pre-fill with sample data. Fix: onboarding init now reads only `createEmptyFieldState()` + `readQuickEstimateSeed()`. Wrote `readExistingDraft()` helper earlier, then deleted it since it's unused.
- **Landing → onboarding seed**: landing page's 30-second estimate inputs had no wire-up to sessionStorage. Added a click handler on `a[href="onboarding.html"]` that writes a `QuickEstimateSeed` object with the 6 fields (age, netAnnualIncome, livingExpensesAnnual, cashBalance, equityBalance, statePensionAnnual).
- **Banner hash capture**: `persistActiveView()` in `src/main.ts:5931` replaces the URL hash with `#view=charts` before the banner check at 5937 could see `#from=onboarding`. Fix: capture `const cameFromOnboarding = window.location.hash.includes("from=onboarding")` before `persistActiveView()` runs.

## Current Work in Progress

None. Task complete, committed, working tree clean.

## Open Questions / Blockers

- User has not yet pushed (`origin/main` is 2 commits behind).
- Two pre-existing `.fixme` Playwright tests remain (documented in memory `post_detachment_followups.md`) — unrelated to this work.

## Context the Next Session Needs

- **Read first if touching onboarding**:
  - `mockups/progressive-onboarding-spec.md` — full product spec
  - `src/onboarding/sequence.ts` — single source of truth for the question graph
  - `src/onboarding/main.ts` — entry, state orchestration, estimate panel paint
  - `src/onboarding/handoff.ts` — seed/draft keys
- **Storage keys**:
  - `etq:landing:quick-estimate` (sessionStorage) — shape defined in `handoff.ts` `QuickEstimateSeed`
  - `etq:scenario:draft:v2` (localStorage) — shared with calculator; onboarding only *writes* it on handoff
- **Playwright base URL is `/ETQ/`** (Vite `base: '/ETQ/'`). All `page.goto` calls must use `/ETQ/onboarding.html` etc.
- **Do not use `page.addInitScript(() => localStorage.clear())`** in onboarding tests — it fires on every navigation, including the post-handoff calculator load, wiping the draft we just wrote. Use `page.goto` + `page.evaluate` to clear, then `page.goto` again.
- **Commands**:
  - `npm run typecheck`
  - `npm run build`
  - `npm test` (runs `test:runtime` + `test:ui`)
  - `npm run test:golden` (required per CLAUDE.md after any model-layer change; onboarding doesn't touch it but it's cheap)
  - `npm run dev -- --host 127.0.0.1 --port 5173` for local
- **Pipeline invariant** (from CLAUDE.md): `activation → planned-sale prep → validate → normalize → timing → engine`. Onboarding reuses `applySectionActivation` + `runModel`; do not add new ordering.

## Do Not Repeat

- **Do not reuse `drawChart` from `src/main.ts`** — tried the idea; rejected due to coupling. `drawMiniChart` in `src/onboarding/chart.ts` is intentional.
- **Do not restore onboarding's field state from `etq:scenario:draft:v2` on init** — that was the leak path that allowed calculator sample data into the onboarding. `readExistingDraft` was removed from `handoff.ts`.
- **Do not check `window.location.hash.includes("from=onboarding")` at line 5937 of `src/main.ts`** directly — `persistActiveView()` at 5931 has already wiped it. Use the captured `cameFromOnboarding` boolean.
- **Do not attempt to reset the URL after banner dismiss** — the dismiss-time hash is already `#view=charts`, so the cleanup branch was dead code. Removed.
- **Do not name the onboarding chart wrapper `data-visible` attribute absent-meaning-false** in tests — regex `/false|^$/` handles both the `false` string and an unset attribute. Already in place in `specs/ui/onboarding.spec.ts`.
