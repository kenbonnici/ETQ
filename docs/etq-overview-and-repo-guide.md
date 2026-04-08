ETQ Overview and Repo Guide

ETQ is a deterministic Excel-parity retirement model implemented as a plain TypeScript DOM web application.

It is not a generic financial-planning app. The browser app is a workbook-shaped implementation whose job is to preserve Excel behavior, sequencing, and input mapping while presenting that model through a cleaner UI.

Its main product behavior is to compare two scenarios:
- retire at a user-selected early retirement age
- retire at the statutory retirement age

The main rendered outputs are:
- yearly cash projections
- yearly net worth projections
- an events timeline
- expandable projection tables for cash flow and net worth
- an earliest-viable-retirement indicator
- a retirement-success flag based on minimum cash buffer plus legacy target

Current Webapp Shape

The app remains a single-page plain TypeScript direct-DOM application centered in `src/main.ts`.

Important current UI behaviors:
- the left panel is metadata-driven from authored input definitions rather than hardcoded field markup
- the UI is organized around `MY DATA`, `QUICK START`, `DEEPER DIVE`, and `FINER DETAILS`
- the right side renders two comparison charts: Cash and Net Worth
- a separate timeline panel renders milestone and event markers by age/year
- a lower projection section renders detailed cash-flow and net-worth tables with scenario tabs and expandable groups
- the app includes a currency selector for display formatting only; it does not convert model values
- the app supports local draft persistence and named scenarios through `localStorage`
- the app includes `Load sample data`, `Save`, `Load`, `Delete`, and `Clear` actions in the scenario manager
- annual living expenses can be entered either as one total or through expanded categories that write back into the same model field
- property and asset liquidation order can be manually overridden in the UI; otherwise the model derives a default order
- downsizing inputs include an inline preview that estimates sale proceeds, mortgage payoff, replacement purchase cost, and cash released

Architecture Overview

1. Browser entry and orchestration
`src/main.ts` owns most browser behavior:
- initial DOM shell creation
- metadata-driven input rendering
- validation reveal/touched-field behavior
- scenario-manager persistence and local-storage handling
- charts, timeline, and projection-table rendering
- earliest-viable-retirement search and indicator rendering
- sample-data loading from the checked-in parity specimen
- downsizing preview and liquidation-order interaction logic

This file is intentionally large and currently acts as the runtime shell for the app.

2. Input metadata and schema
Authored input definitions live in `src/ui/inputDefinitions.ts`.

`src/model/inputSchema.ts` re-exposes and organizes that metadata for model use:
- field lookup by semantic field id
- field lookup by workbook cell
- grouped field sets such as dependents, properties, assets of value, events, crashes, loans, and downsizing fields
- validation metadata and numeric constraints

3. Field registry and workbook mapping
`src/model/fieldRegistry.ts` is parity-critical because it defines the canonical field-id to Excel-cell mapping.

`src/model/excelAdapter.ts` maps between:
- `FieldState`: semantic browser values keyed by field id
- `RawInputs`: workbook-shaped values keyed by Excel input cell

This adapter layer is the bridge between the webapp and the workbook representation. Any drift here breaks parity.

4. Activation and dependency pruning
`src/model/activation.ts` prunes inactive inputs before normalization and calculation.

Current examples include:
- rent is cleared when a home value is present
- home-loan rate and repayment are cleared when no home-loan balance exists
- downsizing fields are cleared if the downsizing year is outside the projection window
- downsizing purchase vs rent fields are mutually pruned based on mode
- dependent, property, asset, event, and crash detail fields are cleared when their anchor field is blank
- post-retirement income start/end ages are cleared when the income amount is not active

This pruning is part of parity behavior, not just UI cleanup.

5. Validation
`src/model/validate.ts` validates activated workbook-shaped inputs and returns UI-facing messages.

Validation covers:
- required values
- numeric bounds and integer rules
- projection-blocking errors vs warnings
- cross-field consistency

6. Normalization
`src/model/normalization.ts` converts activated `RawInputs` into `EffectiveInputs`.

Current responsibilities include:
- treating blank numeric inputs as zero
- clamping statutory retirement age to `50..70`
- clamping life expectancy to at least current age and at most `120`
- defaulting spending-adjustment bracket ages to `65` and `75`
- ensuring spending-adjustment brackets stay ordered inside the projection horizon
- converting monthly rent inputs to annual values where the model expects annual amounts
- building normalized arrays for dependents, properties, assets, one-off events, and stock-market crashes
- resolving liquidation priority either automatically or from manual ranks

7. Projection timing
`src/model/projectionTiming.ts` resolves timing inputs used by the annual model:
- `currentYear`
- `currentMonth`
- `monthsRemaining`
- `monthOffset`
- `proRate`

Important current truth:
- the model supports a `projectionMonthOverride` for deterministic tests and parity tooling
- first-year cashflows, growth, and loan logic are prorated using `proRate`
- the visible projection axis is still built from `currentYear + i` and `ageNow + i`

So older notes that say ETQ always shifts the displayed axis to next year / next age are no longer accurate. The current code keeps the visible axis anchored to the current year and age, while first-period math is still adjusted using `monthsRemaining` and `monthOffset`.

8. Model coordination
`src/model/index.ts` is the top-level pipeline coordinator.

Its current flow is:
- map `FieldState` to workbook-shaped raw inputs
- apply activation/pruning
- materialize liquidation-priority cells for validation when manual override is off
- validate the activated raw inputs
- normalize the activated raw inputs into `EffectiveInputs`
- resolve projection timing
- run the statutory scenario
- run the early-retirement scenario
- derive `retirementSuccessful` for each scenario from cash-buffer and legacy checks
- return paired outputs plus validation and section-collapse metadata

One subtle but important detail:
- validation runs on `effectiveRawInputs`, where liquidation rank cells are materialized
- normalization currently runs from `activation.activatedInputs` plus the same manual-override option

That split is intentional and should be preserved.

9. Scenario engine
The shared engine lives in `src/model/engines/runScenario.ts`.

Thin wrappers parameterize it:
- `src/model/engines/runScenarioEarly.ts`
- `src/model/engines/runScenarioNorm.ts`

Current engine behavior includes:
- salary until the earlier of statutory retirement age and the active scenario retirement age
- other work income until its configured end age
- state pension from statutory retirement age, reduced for early retirement by `pensionReductionPerYearEarly`
- optional post-retirement supplementary income across a configured age range
- one-off income and expense events by projection year
- living-expense adjustments across three age brackets
- stock-market crash and recovery handling
- downsizing sale, mortgage payoff, replacement purchase, or rent transitions
- yearly loan repayment schedules using fixed initial NPER-style horizons
- liquidation staging to restore cash above the configured cash buffer

10. Supporting utilities
Other important modules include:
- `src/model/downsizing.ts`: downsizing window checks, mode normalization, and UI preview estimates
- `src/model/timeline.ts`: year/age axis generation
- `src/model/components/finance.ts`: finance primitives and helpers
- `src/model/parity/*`: parity helpers and specimen/report tooling
- `src/model.ts`: public re-export surface used by the app and scripts
- `src/ui/runtimeFields.ts`, `src/ui/runtimeRules.ts`, `src/ui/livingExpenses.ts`: runtime UI grouping, visibility, liquidation-order UI rules, and living-expense helper logic

Current Execution Flow

The current end-to-end runtime flow is:
1. The user edits semantic UI fields in the browser.
2. `src/main.ts` stores values in `FieldState` and separate UI-only state such as section open/closed state, early retirement age, liquidation-order mode, currency, and living-expense helper mode.
3. `runModel()` maps semantic fields into workbook-shaped raw inputs.
4. Activation prunes inactive and dependent inputs.
5. Validation runs on activated raw inputs with liquidation ranks materialized.
6. Normalization builds `EffectiveInputs`.
7. Projection timing is resolved from the current date or an explicit month override.
8. The statutory scenario runs.
9. The early-retirement scenario runs.
10. Retirement-success flags are derived from cash-buffer and legacy conditions.
11. The UI renders charts, timeline entries, retirement messaging, and detailed projection tables from the returned outputs.

Core Data Shapes

Main types live in `src/model/types.ts`.

The most important ones are:
- `FieldState`: semantic UI values keyed by field id
- `RawInputs`: workbook-shaped values keyed by Excel input cell
- `ModelUiState`: UI-only state such as section toggles, early retirement age, manual liquidation mode, and optional projection month override
- `EffectiveInputs`: normalized engine inputs
- `ScenarioOutputs`: one scenario’s yearly outputs, milestone hints, and detailed cash-flow/net-worth rows
- `ModelOutputs`: paired early/statutory outputs with shared axes

Current Functional Areas Worth Knowing

1. Scenario manager and local persistence
The app now persists:
- a draft scenario snapshot
- named scenario snapshots

Snapshots include:
- pruned raw inputs
- section open/closed state
- selected currency
- early retirement age
- living-expense helper mode and category values

Persistence is local-browser only and does not send data anywhere.

2. Living expenses helper
The app supports two entry modes:
- a single annual total
- an expanded category mode

Expanded categories are a UI helper only. They always sync back into the same underlying `spending.livingExpenses.annual` model field.

3. Earliest viable retirement indicator
The retirement indicator is no longer just a passive comparison label.

`src/main.ts` now searches candidate early retirement ages from the first projected age through statutory retirement age and reports:
- current earliest viable age
- a “retire now” state
- or “not yet viable”

This check uses the existing model itself rather than a separate simplified heuristic.

4. Manual liquidation ordering
The app exposes manual liquidation ordering for properties and assets of value.

Behavior today:
- when manual ordering is not active, normalization derives default ranks by ascending active asset value
- when manual ordering is active, user-entered ranks are used directly
- rank `0` means excluded from staged liquidation
- liquidation priority spans both properties and assets of value, not just properties

5. Downsizing behavior
Downsizing is now more explicit in both UI and model behavior.

Current rules include:
- downsizing year must fall inside the projection window
- if the user is not a homeowner, buy-specific downsizing fields are pruned
- buy vs rent fields are mutually exclusive
- downsizing home purchase is modeled as a cash purchase; the model does not create a new mortgage for the replacement home
- the UI preview uses the same timing concepts as the model to estimate sale proceeds and cash released

6. Retirement-success rule
`retirementSuccessful` is true only if:
- every projected cash balance stays at or above `minimumCashBuffer`
- final projected net worth stays at or above `legacyAmount`

This status is derived after scenario execution in `src/model/index.ts`.

Current Constraints and Invariants

The most important invariant is still Excel parity.

The app should be treated as a workbook-faithful implementation, not a product free to reinterpret financial rules.

Current constraints to preserve:
- deterministic outputs only
- field-id to Excel-cell mapping integrity
- blank numeric inputs generally behaving as zero unless explicitly modeled otherwise
- pruning of inactive inputs before downstream use
- validation and normalization operating on workbook-shaped raw inputs, not directly on arbitrary UI state
- calculation ordering and year-to-year sequencing
- fixed-horizon loan repayment behavior matching the Excel-style setup
- liquidation defaulting to cheapest active assets first unless the user has explicitly overridden ranks
- rank `0` meaning excluded from liquidation staging
- current timing behavior: displayed axis starts at current year/current age, with first-period prorating handled through timing factors rather than a shifted axis

High-Risk / Parity-Sensitive Areas

These files remain especially risky:
- `src/model/excelAdapter.ts`
- `src/model/fieldRegistry.ts`
- `src/model/activation.ts`
- `src/model/normalization.ts`
- `src/model/index.ts`
- `src/model/projectionTiming.ts`
- `src/model/engines/runScenario.ts`

These topics are also high risk:
- field-id / Excel-cell mapping changes
- dependency-pruning rules
- timing and prorating behavior
- liquidation ordering and staged sale behavior
- retirement-age and pension-reduction handling
- downsizing sequencing and cash-purchase assumptions

Repo Structure Overview

Important locations in the current repo:
- `src/main.ts`: app shell, input rendering, persistence, charts, timeline, projections, retirement indicator, and interaction wiring
- `src/model.ts`: public model re-export surface
- `src/model/index.ts`: top-level model pipeline
- `src/model/fieldRegistry.ts`: canonical field-id to workbook-cell mapping
- `src/model/excelAdapter.ts`: semantic field <-> workbook raw mapping
- `src/model/activation.ts`: dependency pruning
- `src/model/validate.ts`: validation
- `src/model/normalization.ts`: normalization and liquidation-priority resolution
- `src/model/projectionTiming.ts`: timing and first-period prorating support
- `src/model/downsizing.ts`: downsizing window logic and UI estimates
- `src/model/engines/*`: shared scenario engine and scenario wrappers
- `src/model/parity/*`: parity comparison/reporting helpers
- `src/ui/*`: input definitions, runtime field helpers, runtime rules, and living-expense helper logic
- `specs/runtime/*`: runtime/model unit tests
- `specs/ui/app.spec.ts`: Playwright UI coverage
- `specs/ETQ.xlsx`: current workbook under test
- `src/parity-main.ts` and `src/parity-live-main.ts`: parity entry points
- `docs/*`: built static output plus this guide

Current Command Surface

Useful repo commands from `package.json`:
- `npm run dev`: run the Vite dev server
- `npm run build`: production build
- `npm run typecheck`: TypeScript type check
- `npm run test`: runtime tests plus UI tests
- `npm run parity`: specimen parity run against checked-in baseline data
- `npm run parity:live`: live parity check using extracted workbook data

`npm run parity:live` currently runs:
- `specs/excel_prototype/analysis/extract_live_workbook.py`
- `src/parity-live-main.ts`

How to Approach Changes Safely

When modifying ETQ, first identify the owning layer:
- UI rendering and interaction in `src/main.ts`
- runtime grouping/visibility/helper logic in `src/ui/*`
- field/cell mapping in `src/model/fieldRegistry.ts`
- workbook adapter logic in `src/model/excelAdapter.ts`
- dependency pruning in `src/model/activation.ts`
- validation in `src/model/validate.ts`
- normalization in `src/model/normalization.ts`
- timing in `src/model/projectionTiming.ts`
- scenario math in `src/model/engines/runScenario.ts`

Make the smallest targeted change in the owning layer. Avoid spreading one behavioral fix across multiple layers unless the issue genuinely spans them.

How to Read the Codebase

The fastest current reading path is:
1. Start in `src/main.ts` to understand the actual UI surface and what state the browser owns.
2. Move to `src/model/index.ts` to see the real model pipeline.
3. Read `src/model/projectionTiming.ts` and `src/model/timeline.ts` if the work touches sequencing, axis semantics, or prorating.
4. Read the specific behavior owner next:
- `activation.ts` for dependency pruning
- `validate.ts` for input rules and blockers
- `normalization.ts` for model assumptions and liquidation priority
- `runScenario.ts` for year-by-year financial math
- `downsizing.ts` for downsizing window logic and preview estimates
- `excelAdapter.ts` and `fieldRegistry.ts` for workbook mapping
5. Use `specs/runtime/*` and `specs/ui/app.spec.ts` to confirm current expectations.

Practical Mental Model

The safest mental model for ETQ today is:
- the UI edits semantic fields and a small amount of UI-only state
- semantic fields map to workbook-shaped raw inputs
- inactive inputs are pruned
- activated inputs are validated and normalized
- timing factors are resolved for the current year/month context
- one shared engine runs statutory and early scenarios
- the app renders comparative charts, milestone timeline items, retirement feedback, and detailed projection tables

If a proposed change conflicts with that sequence, assume it is risky until proven otherwise.
