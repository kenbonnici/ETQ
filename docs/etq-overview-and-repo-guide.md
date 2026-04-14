ETQ Overview and Repo Guide

ETQ is a deterministic retirement-planning web application implemented as a plain TypeScript DOM app.

The webapp is the source of truth. Historical Excel artifacts explain some of the repo's history, but they are no longer the governing model or the verification target.

Its main product behavior is to compare two scenarios:
- retire at a user-selected early retirement age
- retire at the statutory retirement age

The main rendered outputs are:
- yearly cash projections
- yearly net worth projections
- milestone and event timeline hints
- expandable projection tables for cash flow and net worth
- an earliest-viable-retirement indicator
- per-scenario retirement-success flags based on minimum cash buffer plus legacy target

Current Application Shape

The app remains a single-page plain TypeScript direct-DOM application centered on `src/main.ts`.

Important UI behaviors:
- the left panel is metadata-driven from authored semantic input definitions rather than hardcoded field markup
- the UI persists a local draft plus named saved scenarios in `localStorage`
- saved scenarios now persist planned sell years alongside semantic field values and UI-only state
- the scenario manager includes sample data, save, load, delete, clear, and draft-status flows
- annual living expenses can be entered as one total or through expanded categories that always sync back into the same underlying field
- property and asset liquidation order can be manually overridden in the UI, including explicit exclusion from staged liquidation
- planned sell years can be entered for properties and assets of value and participate in both validation and model behavior
- the right side renders custom canvas cash and net-worth comparison charts
- a separate timeline panel renders milestone and event markers by age and year, with early/statutory scenario toggles
- a lower projection section renders detailed cash-flow and net-worth tables with scenario tabs, expand/collapse controls, and scroll restoration

Architecture Overview

1. Browser orchestration
`src/main.ts` owns most browser behavior:
- DOM shell creation
- metadata-driven input rendering
- touched-field and validation reveal behavior
- scenario-manager persistence and notices
- charts, timeline, and projection-table rendering
- earliest-viable-retirement search and indicator rendering
- sample-data loading
- downsizing preview and liquidation-order interaction logic
- planned-sell-year jump/focus behavior

This file is intentionally large and should be treated as the current runtime shell for the app, not as accidental architecture to clean up incidentally.

2. Input metadata and semantic ids
Authored semantic field ids are defined in `src/model/fieldRegistry.ts`.

Authored input definitions live in `src/ui/inputDefinitions.ts`, with model-facing validation/schema metadata in `src/model/inputSchema.ts`.

Supporting UI helpers live in:
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

3. Input schema and state
Important current shapes live in `src/model/types.ts`:
- `FieldState`: raw semantic browser values keyed by field id
- `ModelUiState`: UI-only state such as section toggles, early retirement age, liquidation-order mode, optional projection month override, and optional test-only debug mode
- `EffectiveInputs`: normalized engine inputs

The live pipeline is semantic input state into normalized engine input state. The webapp no longer routes through workbook-shaped raw inputs.

4. Activation and planned-sale resolution
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

5. Validation
`src/model/validate.ts` validates activated semantic fields and returns UI-facing messages.

Validation covers:
- required values
- numeric bounds and integer rules
- blocking errors versus warnings
- cross-field consistency
- downsizing window and mode-specific requirements
- repayment-vs-interest warnings for loans
- planned sell year window checks

Projection gating is semantic: some errors are marked `blocksProjection`, and the retire-check indicator uses that gating rather than ad hoc UI rules.

6. Normalization
`src/model/normalization.ts` converts activated `FieldState` into `EffectiveInputs`.

Current responsibilities include:
- treating blank numeric inputs as zero where the model expects numeric defaults
- clamping bounded inputs such as statutory retirement age
- keeping spending-adjustment brackets ordered and inside the planning horizon
- converting UI-authored fields into normalized arrays for dependents, properties, other assets, one-off events, and stock-market crashes
- carrying planned sell years into normalized property and asset arrays
- resolving liquidation priority automatically or from manual ranks
- materializing liquidation-rank inputs before validation and normalization so the rest of the pipeline sees the effective order

7. Projection timing
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
- `monthsRemaining` is `13 - currentMonth`, so January behaves as a full year and mid-year overrides partially prorate only the first projected year

8. Model coordination
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
- runs the early-retirement scenario
- derives `retirementSuccessful` per scenario from cash-buffer and legacy checks
- returns paired outputs plus validation and section-collapse metadata

9. Scenario engine
The shared engine lives in `src/model/engines/runScenario.ts`.

Thin wrappers parameterize it for the statutory and early-retirement comparisons.

Current engine behavior includes:
- employment income until retirement
- other work income until its configured end age
- state pension from statutory retirement age, reduced for early retirement by `pensionReductionPerYearEarly`
- optional post-retirement supplementary income across a configured age range
- one-off income and expense events by year
- living-expense adjustments across age brackets
- stock-market crash and recovery handling
- downsizing sale, mortgage payoff, replacement purchase, or rent transitions
- yearly loan repayment schedules using fixed initial horizons and partial first-year treatment
- staged liquidation to restore cash above the configured cash buffer
- scheduled property and asset disposals driven by planned sell years

Current Functional Areas Worth Knowing

1. Scenario manager and local persistence
The app persists:
- a draft scenario snapshot
- named scenario snapshots

Snapshots include:
- pruned semantic fields
- planned sell year state
- section open or closed state
- selected currency
- early retirement age
- living-expense helper mode and category values

Persistence is local-browser only.

2. Living expenses helper
The app supports:
- a single annual total
- an expanded category mode

Expanded categories are a UI helper only. They always sync back into the same underlying `spending.livingExpenses.annual` field, and existing totals can seed the expanded categories.

3. Earliest viable retirement indicator
`src/main.ts` searches candidate early retirement ages from the current age through statutory retirement age and reports:
- the earliest viable age token
- a "Now" state when the current age is already viable
- or "Not yet viable"

This check uses the same model outputs the rest of the app uses.

4. Manual liquidation ordering and planned disposals
Current behavior:
- when manual ordering is off, the model derives a default order by ascending active asset value
- when manual ordering is on, user-entered ranks are used directly
- rank `0` means excluded from staged liquidation
- assets with a planned sell year are treated as scheduled and are removed from staged-liquidity ordering
- liquidation priority spans both investment properties and assets of value

5. Downsizing behavior
Current rules include:
- downsizing year must fall inside the projection window
- buy-specific versus rent-specific inputs are mutually exclusive
- owners must choose whether the downsized home will be bought or rented
- the model treats replacement home purchase as a cash purchase
- the UI preview estimates proceeds, payoff, replacement cost, and released cash using the same timing concepts as the model
- timeline milestones include downsizing sale, purchase, and rent-start events when applicable

6. Retirement-success rule
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
- default liquidation order selling the cheapest eligible assets first unless the user overrides it

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
  Runs the Playwright browser suite in `specs/ui/app.spec.ts`.
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

4. UI coverage
The Playwright suite in `specs/ui/app.spec.ts` covers browser behavior such as:
- scenario manager flows and local persistence
- conditional field visibility
- planned sell year focus and tab order
- living-expenses single vs expanded mode
- charts, timeline, and projection table rendering
- liquidation reorder, exclude/include, and keyboard interactions
- sample-data loading and semantic fixture restoration

The UI suite is not the primary drift detector for projection math. That job belongs to the runtime golden suite plus the invariant suite.

5. Snapshot update discipline
Snapshot regeneration is intentionally manual.

Use this flow:
- make the logic change
- run `npm run test:golden` to see the drift
- if the drift is intended, run `npm run test:update-snapshots`
- review the snapshot diff carefully
- commit the updated snapshots alongside the logic change

Do not refresh snapshots as background cleanup. A snapshot change should always correspond to an intentional behavior change or a deliberate fixture change.
