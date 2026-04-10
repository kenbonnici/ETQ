ETQ Overview and Repo Guide

ETQ is a deterministic retirement-planning web application implemented as a plain TypeScript DOM app.

The webapp is the source of truth. Historical Excel artifacts explain some of the repo's shape, but they are no longer the governing model or the verification target.

Its main product behavior is to compare two scenarios:
- retire at a user-selected early retirement age
- retire at the statutory retirement age

The main rendered outputs are:
- yearly cash projections
- yearly net worth projections
- milestone and event timeline hints
- expandable projection tables for cash flow and net worth
- an earliest-viable-retirement indicator
- a retirement-success flag based on minimum cash buffer plus legacy target

Current Application Shape

The app remains a single-page plain TypeScript direct-DOM application centered on `src/main.ts`.

Important UI behaviors:
- the left panel is metadata-driven from authored input definitions rather than hardcoded field markup
- the UI persists a local draft plus named saved scenarios in `localStorage`
- the scenario manager includes sample data, save, load, delete, and clear actions
- annual living expenses can be entered as one total or through expanded categories that write back into the same underlying field
- property and asset liquidation order can be manually overridden in the UI
- the right side renders cash and net worth comparison charts
- a separate timeline panel renders milestone and event markers by age and year
- a lower projection section renders detailed cash-flow and net-worth tables with scenario tabs and expandable groups

Architecture Overview

1. Browser orchestration
`src/main.ts` owns most browser behavior:
- DOM shell creation
- metadata-driven input rendering
- touched-field and validation reveal behavior
- scenario-manager persistence
- charts, timeline, and projection-table rendering
- earliest-viable-retirement search and indicator rendering
- sample-data loading
- downsizing preview and liquidation-order interaction logic

This file is intentionally large and should be treated as the current runtime shell for the app, not as an accident to clean up incidentally.

2. Input metadata
Authored input definitions live in `src/ui/inputDefinitions.ts`.

That metadata defines:
- semantic field ids
- labels and tooltips
- section ordering
- authored row ordering used throughout the UI

`src/ui/runtimeFields.ts` and `src/ui/runtimeRules.ts` provide UI-facing grouping, visibility, and liquidation-order helper logic built on those semantic field ids.

3. Input schema and state
`src/model/inputSchema.ts` organizes the authored metadata for model use.

Important current shapes:
- `FieldState`: raw semantic browser values keyed by field id
- `EffectiveInputs`: normalized engine inputs
- `ModelUiState`: UI-only state such as section toggles, early retirement age, liquidation-order mode, and optional projection month override

The webapp no longer routes through workbook-shaped raw inputs. The live pipeline is semantic input state into normalized engine input state.

4. Activation and validation
`src/model/activation.ts` prunes inactive inputs before validation and normalization.

Examples:
- rent is cleared when a home value is present
- loan companion fields are cleared when the corresponding balance is inactive
- downsizing inputs are cleared when the downsizing year is outside the active projection window
- buy vs rent downsizing inputs are mutually exclusive
- dependent, property, asset, event, and crash detail fields are cleared when their anchor fields are blank

`src/model/validate.ts` validates activated semantic fields and returns UI-facing messages.

Validation covers:
- required values
- numeric bounds and integer rules
- blocking errors versus warnings
- cross-field consistency

5. Normalization
`src/model/normalization.ts` converts activated `FieldState` into `EffectiveInputs`.

Current responsibilities include:
- treating blank numeric inputs as zero where the model expects numeric defaults
- clamping bounded inputs such as statutory retirement age
- keeping spending-adjustment brackets ordered and inside the planning horizon
- converting UI-authored fields into normalized arrays for dependents, properties, other assets, one-off events, and stock-market crashes
- resolving liquidation priority automatically or from manual ranks

6. Projection timing
`src/model/projectionTiming.ts` resolves timing inputs used by the annual model:
- `currentYear`
- `currentMonth`
- `monthsRemaining`
- `monthOffset`
- `proRate`

Important current truth:
- the displayed projection axis starts at the current year and current age
- first-period math is still adjusted through prorating and month offsets
- `projectionMonthOverride` exists for deterministic testing

7. Model coordination
`src/model/index.ts` is the top-level coordinator.

The pipeline order is load-bearing and must remain:
1. activation
2. validate
3. normalize
4. timing
5. engine

It then:
- runs the statutory scenario
- runs the early-retirement scenario
- derives `retirementSuccessful` from cash-buffer and legacy checks
- returns paired outputs plus validation and section-collapse metadata

8. Scenario engine
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
- yearly loan repayment schedules using fixed initial horizons
- staged liquidation to restore cash above the configured cash buffer

Current Functional Areas Worth Knowing

1. Scenario manager and local persistence
The app persists:
- a draft scenario snapshot
- named scenario snapshots

Snapshots include:
- pruned semantic fields
- section open or closed state
- selected currency
- early retirement age
- living-expense helper mode and category values

Persistence is local-browser only.

2. Living expenses helper
The app supports:
- a single annual total
- an expanded category mode

Expanded categories are a UI helper only. They always sync back into the same underlying `spending.livingExpenses.annual` field.

3. Earliest viable retirement indicator
`src/main.ts` searches candidate early retirement ages from the first projected age through statutory retirement age and reports:
- the current earliest viable age
- a retire-now state
- or not-yet-viable

This check uses the same model outputs the rest of the app uses.

4. Manual liquidation ordering
Current behavior:
- when manual ordering is off, the model derives a default order by ascending active asset value
- when manual ordering is on, user-entered ranks are used directly
- rank `0` means excluded from staged liquidation
- liquidation priority spans both investment properties and other assets of value

5. Downsizing behavior
Current rules include:
- downsizing year must fall inside the projection window
- buy-specific versus rent-specific inputs are mutually exclusive
- the model treats replacement home purchase as a cash purchase
- the UI preview estimates proceeds, payoff, replacement cost, and released cash using the same timing concepts as the model

6. Retirement-success rule
`retirementSuccessful` is true only if:
- every projected cash balance stays at or above `minimumCashBuffer`
- final projected net worth stays at or above `legacyAmount`

Current Constraints and Invariants

Most important invariants to preserve:
- deterministic outputs for a given input set
- pipeline ordering:
  activation -> validate -> normalize -> timing -> engine
- pruning of inactive fields before downstream work
- first-year prorating and month-offset behavior
- liquidation rank `0` means excluded
- default liquidation order sells the cheapest eligible assets first unless the user overrides it

Testing Regime

The test regime now has three layers:
- `npm test`
  Runs the runtime test suite plus the Playwright UI suite.
- `npm run test:golden`
  Runs only the golden snapshot suite.
- `npm run test:update-snapshots`
  Regenerates the checked-in golden snapshots after a deliberate logic change.

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

2. Adding a new golden persona
To add coverage for a new behaviour:
- add a new persona in `specs/runtime/golden/fixtures.ts`
- choose inputs that exercise a distinct path rather than a tiny variant of an existing persona
- run `npm run test:update-snapshots`
- review the generated diff in `specs/runtime/golden/goldenSnapshots.ts`
- commit the snapshot update in the same commit as the logic or fixture change that caused it

Good persona candidates are:
- common user journeys
- edge cases with multiple interacting features
- cases that should succeed
- cases that should fail the retirement-success rule

3. Snapshot update discipline
Snapshot regeneration is intentionally manual.

Use this flow:
- make the logic change
- run `npm run test:golden` to see the drift
- if the drift is intended, run `npm run test:update-snapshots`
- review the snapshot diff carefully
- commit the updated snapshots alongside the logic change

Do not refresh snapshots as background cleanup. A snapshot change should always correspond to an intentional behaviour change or a deliberate fixture change.

4. Invariant coverage
The runtime invariants suite lives in:
- `specs/runtime/invariants.test.ts`
- `specs/runtime/fixtures/invariantFixtures.ts`

These tests do not replace the golden suite. They cover different risks:
- accounting-level reconciliation of inflows, outflows, net cash flow, and net worth
- loan-payoff behaviour after planned or forced disposals
- manual liquidation ordering

The golden suite catches broad output drift.
The invariant suite checks core accounting truths that should remain valid even when outputs change intentionally.

5. What the UI suite covers
The Playwright suite in `specs/ui/app.spec.ts` covers browser behaviour such as:
- scenario manager flows
- persistence
- conditional field visibility
- rendering of charts, timeline, and tables

It is not the primary drift detector for projection math. That job belongs to the runtime golden suite plus the invariant suite.
