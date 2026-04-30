ETQ Codex Operating Rules

Purpose
Defines how Codex must operate when executing changes in this repository.
This is a mandatory rules layer.

--------------------------------------------------
PROJECT CONTEXT
--------------------------------------------------

ETQ is a deterministic retirement-planning web application implemented as a plain TypeScript DOM app.

The live webapp currently has three browser entry points:
- landing quick estimate: `index.html` / `src/landing/main.ts`
- guided onboarding: `onboarding.html` / `src/onboarding/main.ts`
- full calculator: `calculator.html` / `src/main.ts`

The webapp is the source of truth.

Do not treat Excel, extracted workbook artifacts, or historical parity tooling as verification targets.

The calculator remains the source of truth for model behavior. Landing and onboarding are real product surfaces, but they feed into the same semantic field state and calculator draft handoff.

--------------------------------------------------
DEFAULT BEHAVIOUR
--------------------------------------------------

Approach
- Make minimal, targeted changes only
- Do not refactor broadly unless explicitly instructed
- Do not introduce new architecture or abstractions unless the task requires it

Scope discipline
Work only within the required layer:
- landing quick-estimate behavior and session-storage handoff
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

Technology constraints
- Plain TypeScript
- Direct DOM manipulation
- No frameworks
- No React, Vue, or component libraries

Large-file constraint
- `src/main.ts` is intentionally large
- Do not propose framework migration or broad componentization as incidental cleanup

--------------------------------------------------
CORE INVARIANTS
--------------------------------------------------

Must always preserve:
- Deterministic model outputs for a given input set
- Pipeline ordering:
  activation -> planned-sale/materialized-order prep -> validate -> normalize -> timing -> engine
- Pruning of inactive fields before downstream calculation
- Timing logic, including first-year prorating and month offsets
- Projection axis behavior as implemented in the webapp
- Planned sell years remaining constrained to the active projection window
- Default liquidation order:
  sell cheapest eligible assets first unless the user overrides
- Liquidation rank `0` means excluded from staged liquidation
- Calculator presentation uses earliest viable retirement age, or statutory fallback when none is viable, as the primary displayed comparison against the user-selected comparison retirement age
- Shared partner early-retirement mode may display the comparison control in calendar-year terms, but the model and semantic state remain age-based
- Scenario snapshots and onboarding handoff preserve pruned semantic fields plus their current UI helper state, including planned sell years, early retirement age, selected currency, and living-expense helper state

Never introduce:
- Hidden sequencing changes
- Silent behavioural drift
- Incidental scope creep

--------------------------------------------------
HIGH-RISK AREAS
--------------------------------------------------

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
- browser-storage snapshot contracts

If modifying any of the above:
- proceed conservatively
- preserve pipeline order
- preserve handoff and persistence shapes unless the task explicitly changes them
- run the full required checks before concluding the change

--------------------------------------------------
TESTING AND VERIFICATION
--------------------------------------------------

Current baseline checks
After code changes, run:

1. Type check
   `npm run typecheck`

2. Build
   `npm run build`

3. Test suite
   `npm test`

4. Golden snapshots when model behaviour changes
   `npm run test:golden`

Change-complete rule
- A change is not complete unless the required checks pass

Current coverage worth remembering
- `npm test` runs both runtime and Playwright UI coverage
- calculator browser behavior lives mainly in `specs/ui/app.spec.ts`
- onboarding browser behavior lives in `specs/ui/onboarding.spec.ts`
- onboarding branching logic lives in `specs/runtime/onboardingSequence.test.ts`
- the invariant suite is in `specs/runtime/invariants.test.ts`

Golden drift detection
- The standalone golden snapshot suite is the long-term drift detector for model behaviour
- Treat snapshot updates as deliberate changes, never background churn
- Use `npm run test:update-snapshots` only after deliberate logic changes
- Review snapshot diffs carefully and commit them alongside the logic change that caused them

--------------------------------------------------
PROMPT INTERPRETATION
--------------------------------------------------

Assume prompts are minimal and outcome-focused.

- Infer the affected entry point and layer
- Choose the safest minimal implementation
- Do not expand scope beyond the request

If ambiguity exists:
prioritise safety, minimal impact, preserving current webapp behaviour, and keeping landing/onboarding/calculator handoff contracts intact

--------------------------------------------------
UI AND UX RULES
--------------------------------------------------

- Maintain a clean, minimal UI
- Avoid clutter
- Prefer clarity over density

When modifying UI:
- Do not alter underlying calculation logic unless the task explicitly calls for it

--------------------------------------------------
CHANGE MANAGEMENT PRINCIPLES
--------------------------------------------------

Prefer:
- Small diffs
- Isolated edits
- Reversible changes

Avoid:
- Wide refactors without approval
- File-structure churn without need
- Renaming stable core identifiers unless required by the task

--------------------------------------------------
OUTPUT EXPECTATION
--------------------------------------------------

All changes must:
- Compile cleanly
- Pass the required checks
- Maintain deterministic outputs
- Preserve current webapp behaviour across landing, onboarding, and calculator unless the task explicitly changes it

--------------------------------------------------
FAILSAFE
--------------------------------------------------

If a change risks breaking core logic, persistence contracts, or pipeline sequencing:
- Do not proceed blindly
- Implement the safest minimal version
- Surface the risk clearly

--------------------------------------------------
OPTIONAL GUARDRAIL
--------------------------------------------------

If a change can be implemented in under 30 lines,
do not exceed that without justification.

--------------------------------------------------
END
