ETQ Overview and Repo Guide

ETQ is a deterministic retirement-planning web application implemented as a plain TypeScript DOM app.

The webapp is the source of truth. Historical Excel artifacts explain some of the repo's history, but they are no longer the governing model or the verification target.

Current live product surfaces:
- landing quick estimate: `index.html` + `src/landing/main.ts`
- guided onboarding: `onboarding.html` + `src/onboarding/main.ts`
- full calculator: `calculator.html` + `src/main.ts`

The calculator is still the source of truth for model behavior. Landing and onboarding are now first-class parts of the webapp and hand off into the calculator through browser storage.

Current Product Behavior

The app no longer behaves as only a simple "user-selected early retirement age vs statutory retirement age" comparison.

Current product behavior is:
- the landing page offers a lightweight quick-estimate input that previews the earliest retirement age using the same model stack
- the onboarding flow collects a smaller guided subset of semantic inputs and writes a calculator draft snapshot
- the full calculator computes the earliest viable retirement age from the current inputs
- the main dashboard presents the earliest viable retirement age, or statutory retirement age if none is viable, as the primary comparison
- the dashboard compares that primary scenario against the user-selected comparison retirement age from the stepper
- when partner shared early retirement is active, the comparison control presents a calendar year rather than an age, while the model still remains age-based underneath

The main rendered outputs are:
- yearly cash projections
- yearly net worth projections
- milestone and event timeline hints
- custom comparison charts with hover context
- a charts view and a projections view
- expandable projection tables for cash flow and net worth
- an earliest-viable-retirement indicator
- per-scenario retirement-success flags based on minimum cash buffer plus legacy target

Current Application Shape

The repo is now a small multi-entry Vite app rather than only a single calculator page.

Build entry points are declared in `vite.config.js`:
- `index.html`
- `calculator.html`
- `onboarding.html`

Important browser-level behaviors:
- the landing page stores its quick-estimate inputs in `sessionStorage` and writes a seed for onboarding handoff
- the onboarding flow stores resumable progress in `localStorage`, including answered/gated question state and living-expense helper state
- onboarding handoff writes a calculator draft snapshot into the same storage contract the calculator uses
- the calculator persists a draft scenario plus named scenarios in `localStorage`
- saved scenarios persist planned sell years alongside semantic field values and UI-only state
- the calculator persists selected currency and living-expenses helper state inside the draft/named snapshots
- the dashboard view (`Charts` vs `Projections`) is persisted separately
- the projections area preserves scenario selection, expand/collapse state, and scroll restoration

Architecture Overview

1. Entry points and handoff

`src/landing/main.ts`
- reads six lightweight quick-estimate inputs
- recalculates a rough earliest retirement age with debounce
- persists landing inputs in `sessionStorage`
- writes a quick-estimate seed used by onboarding

`src/onboarding/main.ts`
- renders the guided conversational onboarding UI
- computes a live estimate panel and mini chart as answers accumulate
- persists resumable onboarding progress
- prunes orphaned answers as branches change
- hands off to the full calculator by writing the calculator draft snapshot

`src/onboarding/handoff.ts`
- owns the storage contract between landing, onboarding, and calculator
- maps quick-estimate seed values into semantic field ids
- writes onboarding progress
- writes calculator draft snapshots with pruned semantic fields and UI helper state

`src/main.ts`
- owns the full calculator shell
- remains intentionally large
- should be treated as the runtime shell for the calculator, not as accidental architecture to clean up incidentally

2. Calculator shell

`src/main.ts` owns most calculator browser behavior:
- DOM shell creation
- metadata-driven input rendering
- touched-field and validation reveal behavior
- scenario-manager persistence and notices
- charts, tooltips, timeline, and projection-table rendering
- earliest-viable-retirement search and indicator rendering
- comparison-age stepper behavior
- sample-data loading
- downsizing preview and liquidation-order interaction logic
- planned-sell-year jump/focus behavior
- charts/projections view switching

3. Input metadata and semantic ids

Authored semantic field ids are defined in `src/model/fieldRegistry.ts`.

Authored input definitions live in `src/ui/inputDefinitions.ts`, with model-facing validation/schema metadata in `src/model/inputSchema.ts`.

Supporting calculator UI helpers live in:
- `src/ui/runtimeFields.ts`
- `src/ui/runtimeRules.ts`
- `src/ui/livingExpenses.ts`

Those modules define:
- semantic field ids and labels
- section ordering
- runtime grouping and visibility rules
- stepper behavior
- liquidation-order UI helpers
- timeline milestone derivation helpers
- living-expense helper categories and aggregation

4. Input schema and state

Important current shapes live in `src/model/types.ts`:
- `FieldState`: raw semantic browser values keyed by field id
- `ModelUiState`: UI-only calculator state such as section toggles, comparison retirement age, liquidation-order mode, optional projection month override, and optional test-only debug mode
- `EffectiveInputs`: normalized engine inputs

The live pipeline is semantic input state into normalized engine input state. The webapp no longer routes through workbook-shaped raw inputs.

5. Landing and onboarding sequence

The onboarding sequence definition lives in `src/onboarding/sequence.ts`.

Current behavior includes:
- chapter-based guided questions
- activation gates for partner, housing, mortgage, properties, valuables, dependents, pension, and debts
- soft "add another?" prompts for repeatable groups
- pruning of stale answers when a branch changes
- living-expense question flow that can still hand off expanded helper state to the calculator

The shared earliest-retirement search helper lives in `src/shared/findEarliestRetirementAge.ts`.

6. Activation and planned-sale resolution

`src/model/activation.ts` prunes inactive inputs before validation and normalization.

Examples:
- rent is cleared when the user is effectively an owner
- owner-only fields are cleared when the user is effectively a renter
- loan companion fields are cleared when the corresponding balance is inactive
- downsizing inputs are cleared when the downsizing year is outside the active projection window
- buy vs rent downsizing inputs are mutually exclusive
- dependent, property, asset, event, and crash detail fields are cleared when their anchor fields are blank
- post-retirement supplement age bounds are cleared when the amount is inactive

`src/model/plannedSales.ts` resolves and validates planned sell years for:
- properties
- assets of value

Planned sell years are constrained to the active projection window and flow into both normalization and runtime UI behavior.

7. Validation

`src/model/validate.ts` validates activated semantic fields and returns UI-facing messages.

Validation covers:
- required values
- numeric bounds and integer rules
- blocking errors versus warnings
- cross-field consistency
- downsizing window and mode-specific requirements
- repayment-vs-interest warnings for loans
- duplicate and out-of-range liquidation ranks
- planned sell year window checks

Projection gating is semantic: some errors are marked `blocksProjection`, and the retirement indicator uses that gating rather than ad hoc UI rules.

8. Normalization

`src/model/normalization.ts` converts activated `FieldState` into `EffectiveInputs`.

Current responsibilities include:
- treating blank numeric inputs as zero where the model expects numeric defaults
- clamping bounded inputs such as statutory retirement age
- keeping spending-adjustment brackets ordered and inside the planning horizon
- converting UI-authored fields into normalized arrays for dependents, properties, other assets, one-off events, and stock-market crashes
- carrying planned sell years into normalized property and asset arrays
- resolving liquidation priority automatically or from manual ranks
- materializing liquidation-rank inputs before validation and normalization so the rest of the pipeline sees the effective order
- excluding scheduled disposals from staged-liquidation priority

9. Projection timing

`src/model/projectionTiming.ts` resolves timing inputs used by the annual model:
- `currentYear`
- `currentMonth`
- `monthsRemaining`
- `monthOffset`
- `proRate`

Important current truth:
- the displayed projection axis starts at the current year and current age
- first-period math still uses prorating and month offsets
- `projectionMonthOverride` exists for deterministic tests and fixtures
- `monthsRemaining` is `13 - currentMonth`, so January behaves as a full year and mid-year overrides only the first projected year

10. Model coordination

`src/model/index.ts` is the top-level coordinator.

The pipeline order is load-bearing and must remain:
1. activation
2. planned-sale resolution plus effective liquidation-rank materialization
3. validate
4. normalize
5. timing
6. engine

It then:
- runs the statutory scenario
- runs the early-retirement scenario for the currently requested comparison age
- derives `retirementSuccessful` per scenario from cash-buffer and legacy checks
- returns paired outputs plus validation and section-collapse metadata

11. Scenario engine

The shared engine lives in `src/model/engines/runScenario.ts`.

Thin wrappers parameterize it for the statutory and early-retirement comparisons.

Current engine behavior includes:
- main income until retirement
- partner employment income and pension behavior, including shared-early-retirement handling
- other work income until its configured end age, or until the active scenario retirement age when no end age is set
- state pension from statutory retirement age, reduced for early retirement by `pensionReductionPerYearEarly`
- optional post-retirement supplementary income across a configured age range
- one-off income and expense events by year
- living-expense adjustments across age brackets
- stock-market crash and recovery handling
- downsizing sale, mortgage payoff, replacement purchase, or rent transitions
- yearly loan repayment schedules using fixed initial horizons and partial first-year treatment
- staged liquidation to restore cash above the configured cash buffer
- scheduled property and asset disposals driven by planned sell years
- timeline milestone generation from scenario outputs

Current Functional Areas Worth Knowing

1. Landing quick estimate

The landing page:
- collects age, income, annual spending, cash, investments, and state pension
- persists those raw inputs in `sessionStorage`
- computes an earliest-retirement estimate through the same model path used elsewhere
- writes a quick-estimate seed consumed by onboarding

2. Guided onboarding and handoff

The onboarding flow:
- is resumable from `localStorage`
- pre-fills from the landing-page seed when available
- updates a live estimate panel as the user answers
- prunes orphaned answers when earlier choices change
- can save locally and resume later
- writes a calculator draft snapshot and navigates to `calculator.html#from=onboarding`

3. Scenario manager and local persistence

The calculator persists:
- a draft scenario snapshot
- named scenario snapshots

Snapshots include:
- pruned semantic fields
- planned sell year state
- section open or closed state
- selected currency
- comparison retirement age
- living-expense helper mode and category values

Persistence is local-browser only.

4. Retirement comparison presentation

Current calculator behavior:
- it searches candidate retirement ages from the current age through statutory retirement age
- the earliest viable age becomes the primary displayed comparison when one exists
- if no viable early-retirement age exists, statutory retirement age is the primary displayed comparison
- the user-selected comparison age remains independently editable
- the chart, timeline, and projection tables use the primary/comparison presentation layer, even though model internals still expose `scenarioEarly` and `scenarioNorm`

5. Living expenses helper

The calculator supports:
- a single annual total
- an expanded category mode

Expanded categories are a UI helper only. They always sync back into the same underlying `spending.livingExpenses.annual` field, and existing totals can seed the expanded categories.

6. Manual liquidation ordering and planned disposals

Current behavior:
- when manual ordering is off, the model derives a default order by ascending active asset value
- when manual ordering is on, user-entered ranks are used directly
- rank `0` means excluded from staged liquidation
- assets with a planned sell year are treated as scheduled and are removed from staged-liquidity ordering
- liquidation priority spans both investment properties and assets of value

7. Downsizing behavior

Current rules include:
- downsizing year must fall inside the projection window
- buy-specific versus rent-specific inputs are mutually exclusive
- owners must choose whether the downsized home will be bought or rented
- the model treats replacement home purchase as a cash purchase
- the UI preview estimates proceeds, payoff, replacement cost, and released cash using the same timing concepts as the model
- timeline milestones include downsizing sale, purchase, and rent-start events when applicable

8. Dashboard views and projections

The calculator now has two top-level dashboard views:
- `Charts`
- `Projections`

The charts view shows:
- cash and net-worth comparison charts
- the timeline panel

The projections view shows:
- cash-flow tables
- net-worth tables
- shared scenario selection between projections and timeline
- independent expand/collapse state for cash-flow and net-worth sections
- scroll restoration when switching sections or scenarios

9. Retirement-success rule

`retirementSuccessful` is true for a scenario only if:
- every projected cash balance stays at or above `minimumCashBuffer`
- final projected net worth stays at or above `legacyAmount`

Current Constraints and Invariants

Most important invariants to preserve:
- deterministic outputs for a given input set
- pipeline ordering:
  activation -> planned-sale/materialized-order prep -> validate -> normalize -> timing -> engine
- pruning of inactive fields before downstream work
- first-year prorating and month-offset behavior
- the displayed axis still beginning at the current year and current age
- planned sell years remaining constrained to the projection window
- liquidation rank `0` meaning excluded
- default liquidation order selling the cheapest eligible assets first unless the user overrides
- the calculator's primary displayed comparison remaining earliest viable retirement age, or statutory fallback, against the user-selected comparison age
- storage handoff contracts between landing, onboarding, and calculator remaining compatible unless deliberately changed

Testing Regime

The repo's required post-change checks are:
- `npm run typecheck`
- `npm run build`
- `npm test`
- `npm run test:golden` when model behavior changes

The scripts break down like this:
- `npm test`
  Runs `npm run test:runtime` and `npm run test:ui`.
- `npm run test:runtime`
  Runs the Node runtime suite in `specs/runtime/*.test.ts`.
- `npm run test:ui`
  Runs the Playwright browser suites, including calculator and onboarding coverage.
- `npm run test:golden`
  Runs only the golden snapshot suite.
- `npm run test:update-snapshots`
  Regenerates checked-in golden snapshots after a deliberate logic change.

1. Golden personas

The golden suite lives in:
- `specs/runtime/golden.test.ts`
- `specs/runtime/golden/fixtures.ts`
- `specs/runtime/golden/goldenSnapshots.ts`

Each golden persona is an authored semantic fixture, not an extracted external baseline.

Each persona snapshots, for both the statutory and early-retirement scenarios:
- `retirementSuccessful`
- full `cashSeries`
- full `netWorthSeries`
- milestone hints

This is the main drift detector for projection math. If a logic change moves yearly outputs, the checked-in snapshot diff should show exactly which persona, scenario, and series values changed.

2. Invariant coverage

The runtime invariants suite lives in:
- `specs/runtime/invariants.test.ts`
- `specs/runtime/fixtures/invariantFixtures.ts`

These tests cover:
- accounting-level reconciliation of inflows, outflows, net cash flow, and net worth
- loan-payoff behavior after planned or forced disposals
- manual liquidation ordering

The golden suite catches broad output drift.
The invariant suite checks accounting truths that should remain valid even when outputs change intentionally.

3. Runtime behavior coverage

Other runtime tests cover focused behaviors such as:
- activation and pruning
- validation rules
- projection timing and prorating
- living-expense helper semantics
- runtime visibility and liquidation-order helpers
- engine behavior for forced and planned sales
- onboarding sequence branching and pruning

4. UI coverage

The Playwright suites cover browser behavior such as:
- scenario manager flows and local persistence
- conditional field visibility
- planned sell year focus and tab order
- living-expenses single vs expanded mode
- charts, timeline, and projection table rendering
- liquidation reorder, exclude/include, and keyboard interactions
- sample-data loading and semantic fixture restoration
- onboarding branching, chips, estimate visibility, and handoff navigation

Main files:
- `specs/ui/app.spec.ts`
- `specs/ui/onboarding.spec.ts`

The UI suites are not the primary drift detector for projection math. That job belongs to the runtime golden suite plus the invariant suite.

5. Snapshot update discipline

Snapshot regeneration is intentionally manual.

Use this flow:
- make the logic change
- run `npm run test:golden` to see the drift
- if the drift is intended, run `npm run test:update-snapshots`
- review the snapshot diff carefully
- commit the updated snapshots alongside the logic change

Do not refresh snapshots as background cleanup. A snapshot change should always correspond to an intentional behavior change or a deliberate fixture change.
