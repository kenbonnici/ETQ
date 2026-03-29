ETQ Overview and Repo Guide

ETQ is a deterministic Excel-parity retirement model implemented as a plain TypeScript DOM web application.

It is not a generic finance planner. The webapp is intentionally shaped around the reference workbook and should be understood as a browser implementation of that workbook's logic, structure, and sequencing.

Its core product behavior is to compare two retirement paths:
- retire at a user-selected early retirement age
- retire at the statutory retirement age

The main rendered outputs are:
- yearly cash projections
- yearly net worth projections
- an events timeline
- expandable projection tables for cash flow and net worth
- a simple retirement-success check based on minimum cash buffer and legacy target

Current Webapp Shape

The current app is still a plain TypeScript, direct-DOM, single-page webapp centered in `src/main.ts`.

Important current UI behaviors:
- inputs are grouped into `QUICK START`, `DEEPER DIVE`, and `FINER DETAILS`
- the left panel is a metadata-driven form, not hardcoded component markup
- the right side renders two charts: Cash and Net Worth
- a timeline panel renders milestone/event markers vertically by age
- a lower projection section renders detailed cash-flow and net-worth tables
- the app includes a currency selector for formatting only; it does not perform FX conversion
- the app includes `Load sample data`, `Clear inputs`, and finer-details default helpers
- annual living expenses can be entered either as one total or through expanded expense categories that roll back into the single model input
- asset liquidation order can be manually overridden in the UI; otherwise the model derives a default order

Architecture Overview

1. Browser entry and UI orchestration
`src/main.ts` owns almost all browser behavior:
- initial DOM shell creation
- section toggles and input rendering
- helper UI state such as touched fields, projection tab state, and expanded groups
- chart rendering
- timeline rendering
- projection-table rendering
- event wiring
- sample-data loading from the parity specimen

This file is large and acts as the runtime shell for the whole app.

2. Input metadata and Excel-linked schema
Authored input definitions live in `src/ui/inputDefinitions.ts`.

Those definitions are re-exposed and organized through `src/model/inputSchema.ts`, which is the main place for:
- field lookup by semantic field id
- field lookup by workbook cell
- grouped field sets such as dependents, properties, assets of value, events, and loan groups
- validation metadata and numeric constraint metadata

The field registry in `src/model/fieldRegistry.ts` is parity-critical because it maps semantic field ids to Excel cells.

3. Excel mapping layer
`src/model/excelAdapter.ts` maps between:
- semantic browser `FieldState`
- workbook-shaped `RawInputs`

This layer is the structural bridge between the webapp and the workbook representation. It should be treated as parity-sensitive.

4. Activation and dependency pruning
`src/model/activation.ts` prunes inactive inputs before downstream processing.

Current examples include:
- rent is cleared when a home value is present
- home loan rate/repayment are cleared when no home loan balance exists
- dependent detail fields are cleared when the dependent name is blank
- property and asset subfields are cleared when the group name is blank
- event amount/year fields are cleared when the event name is blank
- post-retirement income ages are cleared when the post-retirement income amount is not active

This pruning happens before normalization and is part of parity behavior.

5. Validation
`src/model/validate.ts` validates activated raw inputs.

Validation operates on workbook-shaped raw inputs and produces UI-facing validation messages. It covers required values, bounds, integer rules, projection-blocking errors, and cross-field consistency checks.

6. Normalization
`src/model/normalization.ts` converts activated raw inputs into `EffectiveInputs`.

This is where the current model resolves or enforces things such as:
- blank numeric values normalizing to zero
- bounded retirement age and life-expectancy handling
- normalized arrays for dependents, properties, assets, and events
- liquidation priority resolution, either default or manual

7. Projection timing
`src/model/projectionTiming.ts` resolves the current projection timing inputs.

This is an important update from older repo summaries:
- projections now start from the current year and current age
- the first year can be pro-rated based on the current month
- `projectionMonthOverride` exists for deterministic testing/parity runs

So if an older note says ETQ always starts next year / next age, that is no longer accurate for the current codebase.

8. Model coordination
`src/model/index.ts` is the top-level coordinator.

Its current pipeline is:
- map `FieldState` to workbook-style raw inputs
- apply activation/pruning
- materialize liquidation priority values for validation
- validate
- normalize
- resolve projection timing
- run statutory scenario
- run early-retirement scenario
- add retirement-success status to each scenario
- return combined outputs plus validation/collapse metadata

9. Scenario engine
The shared scenario engine lives in `src/model/engines/runScenario.ts`.

Thin wrappers parameterize it:
- `src/model/engines/runScenarioEarly.ts`
- `src/model/engines/runScenarioNorm.ts`

This shared-engine design remains important. Early and statutory projections should differ by scenario inputs and timing, not by duplicated math engines.

10. Supporting model utilities
Other important model modules include:
- `src/model/components/finance.ts`: finance primitives such as FV helpers and numeric utilities
- `src/model/timeline.ts`: timeline milestone generation support
- `src/model/parity/*`: specimen parity helpers, reports, and comparison logic
- `src/model.ts`: re-export surface used by the app and parity scripts

Current Execution Flow

The current end-to-end runtime flow is:
1. The user edits semantic UI fields in the browser.
2. `src/main.ts` stores those values in `FieldState`.
3. `runModel()` maps semantic fields into workbook-shaped raw inputs.
4. Activation prunes inactive/dependent inputs.
5. Validation runs on the activated workbook-shaped inputs.
6. Normalization builds `EffectiveInputs`.
7. Projection timing is resolved from the current date or an explicit month override.
8. The statutory scenario runs.
9. The early-retirement scenario runs.
10. The UI renders charts, timeline items, and detailed projection tables from the returned outputs.

Core Data Shapes

Main types live in `src/model/types.ts`.

The most important ones are:
- `FieldState`: semantic UI values keyed by field id
- `RawInputs`: workbook-shaped values keyed by Excel input cell
- `ModelUiState`: UI-only runtime state such as open sections, early retirement age, manual liquidation mode, and optional projection month override
- `EffectiveInputs`: normalized engine inputs
- `ScenarioOutputs`: yearly outputs for one scenario, including chart series, milestone hints, cash-flow rows, and net-worth rows
- `ModelOutputs`: paired early/statutory outputs with shared axes

Current Functional Areas Worth Knowing

1. Living expenses helper UI
The app now supports two entry modes for living expenses:
- a single annual total
- an expanded category view whose subtotal feeds the same underlying annual living-expenses field

This is a UI convenience layer, not a second calculation model.

2. Manual liquidation ordering
The app now exposes a manual liquidation-order control in the UI.

Behavior today:
- when manual ordering is not active, normalization derives a default order by ascending asset value
- when manual ordering is active, entered ranks are used directly
- rank `0` effectively means never liquidate

This applies across both properties and assets of value because the liquidation priority array is built from both groups.

3. Retirement-success check
The model currently marks a scenario as successful only if:
- every cash balance meets the configured minimum cash buffer
- final net worth meets the configured legacy amount

This status is derived after scenario execution in `src/model/index.ts`.

4. Sample-data loading
The UI's `Load sample data` action currently loads from the checked-in parity specimen:
- `src/model/parity/excelBaselineSpecimen.ts`

It does not read directly from the workbook at runtime.

Key Constraints and Current Truths

The single most important invariant is still Excel parity.

The app should be treated as a workbook-faithful implementation, not a product free to reinterpret the financial rules.

Current constraints to preserve:
- deterministic outputs only
- no hidden assumptions that diverge from workbook behavior
- field-id to Excel-cell mapping integrity
- pruning of inactive inputs before downstream use
- calculation ordering and year-to-year sequencing
- blank numeric inputs generally behaving as zero unless explicitly modeled otherwise
- default liquidation order being derived from cheapest-to-most-expensive active assets when the user has not overridden it
- projection timing behavior as currently implemented: current year/current age, with first-year prorating support

High-Risk / Parity-Sensitive Areas

These files remain especially risky:
- `src/model/excelAdapter.ts`
- `src/model/normalization.ts`
- `src/model/index.ts`
- `src/model/engines/runScenario.ts`
- `src/model/projectionTiming.ts`
- `src/model/fieldRegistry.ts`
- `src/model/activation.ts`

Also treat these topics as high risk:
- liquidation ordering and sale behavior
- timing/month-offset logic
- input-cell mapping changes
- dependency pruning rules
- retirement-age handling

Repo Structure Overview

Important locations in the current repo:
- `src/main.ts`: app shell, input rendering, charts, timeline, projection tables, UI event wiring
- `src/model.ts`: public model re-export surface
- `src/model/index.ts`: top-level model pipeline
- `src/model/excelAdapter.ts`: semantic field <-> workbook raw mapping
- `src/model/activation.ts`: dependency pruning
- `src/model/validate.ts`: validation
- `src/model/normalization.ts`: normalization and liquidation priority resolution
- `src/model/projectionTiming.ts`: current-year/current-age timing and prorating
- `src/model/engines/*`: shared scenario engine and wrappers
- `src/model/parity/*`: parity comparison/reporting helpers
- `src/ui/*`: input definitions, runtime field helpers, runtime rules, and living-expense helper logic
- `specs/runtime/*`: runtime/model unit tests
- `specs/ui/app.spec.ts`: Playwright UI coverage
- `specs/ETQ.xlsx`: current workbook under test
- `specs/excel_prototype/analysis/*`: parity-analysis and extraction utilities
- `docs/*`: built static output

Current Command Surface

Useful repo commands from `package.json`:
- `npm run dev`: run the Vite dev server
- `npm run build`: production build
- `npm run typecheck`: TypeScript type check
- `npm run test`: runtime tests plus UI tests
- `npm run parity`: specimen parity run against checked-in baseline data
- `npm run parity:live`: live parity check using extracted workbook data

`npm run parity:live` currently depends on:
- `specs/excel_prototype/analysis/extract_live_workbook.py`
- `src/parity-live-main.ts`
- a temp extract written to `/tmp/etq_live_extract.json`

How to Approach Changes Safely

When modifying ETQ, first identify the owning layer:
- UI rendering and interaction in `src/main.ts`
- runtime grouping/visibility helpers in `src/ui/*`
- Excel mapping in `src/model/excelAdapter.ts`
- dependency pruning in `src/model/activation.ts`
- validation in `src/model/validate.ts`
- normalization in `src/model/normalization.ts`
- timing in `src/model/projectionTiming.ts`
- scenario math in `src/model/engines/runScenario.ts`

Make the smallest targeted change in the owning layer. Avoid spreading a behavioral fix across multiple layers unless the bug genuinely spans them.

How to Read the Codebase

The fastest current reading path is:
1. Start in `src/main.ts` to understand the actual webapp surface and how the model is called.
2. Move to `src/model/index.ts` to understand the real current pipeline.
3. Read `src/model/projectionTiming.ts` if the work touches yearly sequencing or first-year behavior.
4. Read the specific behavior owner next:
- `activation.ts` for dependency pruning
- `validate.ts` for input rules and projection blockers
- `normalization.ts` for effective model assumptions
- `runScenario.ts` for year-by-year financial math
- `excelAdapter.ts` and `fieldRegistry.ts` for workbook mapping
5. Use `specs/runtime/*` and `specs/ui/app.spec.ts` to confirm what the current code is expected to do.

Practical Mental Model

The safest mental model for ETQ today is:
- the UI edits semantic fields
- those fields map to workbook-shaped raw inputs
- inactive inputs are pruned
- activated inputs are validated and normalized
- projection timing is resolved for the current year/month context
- one shared engine runs statutory and early scenarios
- the app renders comparative charts, timeline items, and detailed tables

If a proposed change conflicts with that sequence, assume the change is risky until proven otherwise.
