ETQ Codex Operating Rules

Purpose
Defines how Codex must operate when executing changes in this repository.
This is a mandatory rules layer.

--------------------------------------------------
PROJECT CONTEXT
--------------------------------------------------

ETQ is a deterministic retirement-planning web application implemented as a plain TypeScript DOM app.

The webapp is the source of truth.

Do not treat Excel, extracted workbook artifacts, or historical parity tooling as verification targets.

--------------------------------------------------
DEFAULT BEHAVIOUR
--------------------------------------------------

Approach
- Make minimal, targeted changes only
- Do not refactor broadly unless explicitly instructed
- Do not introduce new architecture or abstractions unless the task requires it

Scope discipline
Work only within the required layer:
- UI rendering and interaction
- UI state and persistence
- Activation / visibility rules
- Validation
- Normalization
- Projection timing
- Model / calculation engine

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
  activation -> validate -> normalize -> timing -> engine
- Pruning of inactive fields before downstream calculation
- Timing logic, including first-year prorating and month offsets
- Projection axis behavior as implemented in the webapp
- Default liquidation order:
  sell cheapest eligible assets first unless the user overrides
- Liquidation rank `0` means excluded from staged liquidation

Never introduce:
- Hidden sequencing changes
- Silent behavioural drift
- Incidental scope creep

--------------------------------------------------
HIGH-RISK AREAS
--------------------------------------------------

Changes here require extra caution:
- `src/model/index.ts`
- `src/model/activation.ts`
- `src/model/validate.ts`
- `src/model/normalization.ts`
- `src/model/projectionTiming.ts`
- liquidation logic
- timing logic
- dependency / activation rules

If modifying any of the above:
- proceed conservatively
- preserve pipeline order
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

Golden drift detection
- The standalone golden snapshot suite is the long-term drift detector for model behaviour
- Treat snapshot updates as deliberate changes, never background churn
- Use `npm run test:update-snapshots` only after deliberate logic changes
- Review snapshot diffs carefully and commit them alongside the logic change that caused them

--------------------------------------------------
PROMPT INTERPRETATION
--------------------------------------------------

Assume prompts are minimal and outcome-focused.

- Infer the affected layer
- Choose the safest minimal implementation
- Do not expand scope beyond the request

If ambiguity exists:
prioritise safety, minimal impact, and preserving current webapp behaviour

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
- Preserve current webapp behaviour unless the task explicitly changes it

--------------------------------------------------
FAILSAFE
--------------------------------------------------

If a change risks breaking core logic or pipeline sequencing:
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
