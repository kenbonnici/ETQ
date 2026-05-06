# ETQ Agent Operating Rules

Defines how an agent must operate when executing changes in this repository. This is a mandatory rules layer.

## Project Description

ETQ is a deterministic retirement-planning web application for individuals (and shared partner households) modelling when they can afford to stop working. It is a plain TypeScript browser app with three entry points: a landing quick estimate (`index.html` / `src/landing/main.ts`), a guided onboarding flow (`onboarding.html` / `src/onboarding/main.ts`), and the full calculator (`calculator.html` / `src/main.ts`). "Deterministic" means the model produces the same outputs for the same inputs every run: no randomness, no Monte Carlo, no hidden time-of-day or environment dependence. Given a `FieldState` plus UI helper state, the calculator projects cash, assets, and net worth year-by-year through a fixed pipeline so that scenario snapshots and golden tests stay byte-stable.

## Webapp is the Source of Truth

- The webapp is the source of truth.
- Do not treat Excel, extracted workbook artifacts, or historical parity tooling as verification targets.
- The calculator remains the source of truth for model behaviour. Landing and onboarding are real product surfaces, but they feed into the same semantic field state and calculator draft handoff.

## Glossary

- **Activation**: the first stage of the pipeline (`src/model/activation.ts`). Decides which fields are "live" given the current `FieldState` plus UI state, and prunes inactive fields so they do not influence downstream calculation.
- **Planned-sale**: a user-scheduled disposal of a property or asset of value at a specific year offset within the projection. Resolved by `src/model/plannedSales.ts`; sell years are constrained to the active projection window.
- **Liquidation rank**: the integer priority used to stage forced sales when cash runs short. Lower rank sells first. Rank `0` means excluded from staged liquidation entirely.
- **Projection axis**: the year-by-year axis along which the model projects forward, anchored to the user's current age and the projection start date resolved by `src/model/projectionTiming.ts` (with first-year prorating and month offsets).
- **Comparison retirement age**: the user-selected age the calculator compares against the earliest viable result. Surfaced via the early-retirement controls.
- **Earliest viable retirement age**: computed by `src/shared/findEarliestRetirementAge.ts`. The lowest age at which the scenario satisfies cash buffer and legacy constraints. If no age is viable, the calculator falls back to the statutory age for primary display.
- **Scenario snapshot**: the persisted bundle written via `src/onboarding/handoff.ts` (and read by the calculator on draft handoff). Contains pruned semantic fields plus current UI helper state, including planned sell years, early retirement age, selected currency, and living-expense helper state.
- **Pipeline ordering**: the load-bearing sequence `activation -> planned-sale/materialized-order prep -> validate -> normalize -> timing -> engine`. See `src/model/index.ts:runModel` for the canonical flow.

## Default Behaviour

### Scope discipline

Work only within the required layer:

- landing quick-estimate behaviour and session-storage handoff
- onboarding question flow, gating, and calculator handoff
- calculator UI rendering and interaction
- UI state and browser persistence
- retirement comparison presentation
- planned-sale / liquidation scheduling rules
- activation / visibility rules
- validation
- normalization
- projection timing
- model / calculation engine

Do not cross layers unless necessary.

### Technology constraints

- Plain TypeScript (strict mode), ES modules, Vite bundler with base path `/ETQ/`
- Direct DOM manipulation
- No frameworks (no React, Vue, or component libraries)

### Large-file constraint

- `src/main.ts` is intentionally large (~5,900 lines)
- Do not propose framework migration or broad componentization as incidental cleanup

## Core Invariants

Must always preserve:

- Deterministic model outputs for a given input set
- Pipeline ordering: `activation -> planned-sale/materialized-order prep -> validate -> normalize -> timing -> engine`
- Pruning of inactive fields before downstream calculation
- Timing logic, including first-year prorating and month offsets
- Projection axis behaviour as implemented in the webapp
- Planned sell years remaining constrained to the active projection window
- Default liquidation order: sell cheapest eligible assets first unless the user overrides
- Liquidation rank `0` means excluded from staged liquidation
- Calculator presentation uses earliest viable retirement age, or statutory fallback when none is viable, as the primary displayed comparison against the user-selected comparison retirement age
- Shared partner early-retirement mode may display the comparison control in calendar-year terms, but the model and semantic state remain age-based
- Scenario snapshots and onboarding handoff preserve pruned semantic fields plus their current UI helper state, including planned sell years, early retirement age, selected currency, and living-expense helper state

Never introduce:

- Hidden sequencing changes
- Silent behavioural drift
- Incidental scope creep

## High-Risk Areas

Changes here require extra caution:

- `src/main.ts` retirement comparison, persistence, and calculator rendering flow
- `src/onboarding/handoff.ts`
- `src/shared/findEarliestRetirementAge.ts`
- `src/model/index.ts`
- `src/model/activation.ts`
- `src/model/plannedSales.ts`
- `src/model/validate.ts`
- `src/model/normalization.ts`
- `src/model/projectionTiming.ts`
- liquidation logic
- planned-sale logic
- timing logic
- dependency / activation rules
- browser-storage snapshot contracts (`etq:scenario:draft:v2`, `etq:onboarding:state:v1`, landing session-storage seed)

If modifying any of the above:

- proceed conservatively
- preserve pipeline order
- preserve handoff and persistence shapes unless the task explicitly changes them
- run the full required checks before concluding the change

## Ask Before Acting

Pause and confirm before any of the following:

- Changing public function signatures (anything exported from `src/model/`, `src/shared/`, `src/onboarding/handoff.ts`, or used across entry points)
- Modifying golden snapshots or running `npm run test:update-snapshots`
- Adding, removing, or upgrading dependencies in `package.json`
- Touching the persistence schema (storage keys, snapshot shape, draft handoff contract)
- Any change above 30 lines of diff
- Renaming stable core identifiers (field IDs, pipeline stage names, persistence keys)

In each case, surface the proposed change and the reason, and wait for approval before proceeding.

## Testing and Verification

### Required checks after code changes

1. Type check: `npm run typecheck`
2. Build: `npm run build`
3. Test suite: `npm test`
4. Golden snapshots when model behaviour changes: `npm run test:golden`

A change is not complete unless the required checks pass. Run them yourself before reporting completion; do not ask the user to run them.

### Current coverage

- `npm test` runs both runtime and Playwright UI coverage
- calculator browser behaviour lives mainly in `specs/ui/app.spec.ts`
- onboarding browser behaviour lives in `specs/ui/onboarding.spec.ts`
- onboarding branching logic lives in `specs/runtime/onboardingSequence.test.ts`
- the invariant suite is in `specs/runtime/invariants.test.ts`

### Golden drift detection

- The standalone golden snapshot suite is the long-term drift detector for model behaviour
- Treat snapshot updates as deliberate changes, never background churn
- Use `npm run test:update-snapshots` only after deliberate logic changes (see Ask Before Acting)
- Review snapshot diffs carefully and commit them alongside the logic change that caused them

## Definition of Done

Before reporting a change complete, verify the following yourself:

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] `npm run test:golden` reviewed if model behaviour was touched
- [ ] Diff is small and reversible
- [ ] Diff is under 30 lines, or approval obtained if larger
- [ ] Commit message drafted in the agreed style (see Commit Conventions)

Do not ask the user to run these checks.

## Completion Report Format

When reporting a change complete, structure the response as:

- **Summary**: one line describing what changed
- **Files changed**: bullet list of file paths touched
- **Lines changed**: net `+X / -Y`
- **Checks**: results of typecheck, build, test, and (if applicable) golden snapshots
- **Risks flagged**: anything the user should sanity-check, or `none` if nothing
- **Commit message draft**: the proposed conventional-commit message, ready for approval

## Commit Conventions

- Use short conventional-commit style messages: `type(scope): subject`, where `type` is one of `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`. Keep the subject under ~72 characters.
- Wait for explicit approval before committing. Draft the message, present it, then commit only when told to.
- Work on `main` unless told otherwise. Do not create branches without instruction.
- Never amend or force-push without explicit instruction.

## Communication Preferences

For responses back to the user:

- Use bullet points where they aid scanning
- UK number formatting: `1,000.00` (comma thousands, dot decimal)
- Metric / EU units (kilometres, kilograms, Celsius, etc.)
- Plain English; no jargon where a simpler word will do
- No em dashes or en dashes in prose. Use commas, semicolons, or sentence breaks instead.
- Number any clarifying questions so they can be answered by index

## Prompt Interpretation

Assume prompts are minimal and outcome-focused.

If ambiguity exists, prioritise safety, minimal impact, preserving current webapp behaviour, and keeping landing/onboarding/calculator handoff contracts intact.

## UI and UX Rules

- Maintain a clean, minimal UI
- Avoid clutter; prefer clarity over density
- When modifying UI, do not alter underlying calculation logic unless the task explicitly calls for it

## Output Expectation

All changes must:

- Compile cleanly
- Pass the required checks
- Maintain deterministic outputs
- Preserve current webapp behaviour across landing, onboarding, and calculator unless the task explicitly changes it

## Failsafe

If a change risks breaking core logic, persistence contracts, or pipeline sequencing:

- Do not proceed blindly
- Implement the safest minimal version
- Surface the risk clearly

## Optional Guardrail

If a change can be implemented in under 30 lines, do not exceed that without justification. Anything above 30 lines triggers Ask Before Acting.
