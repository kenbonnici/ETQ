ETQ Codex Operating Rules

Purpose
Defines how Codex must operate when executing changes.
This is a mandatory rules layer.

--------------------------------------------------
PROJECT CONTEXT
--------------------------------------------------

ETQ is a deterministic Excel parity financial model implemented as a plain TypeScript DOM application.

It must behave identically to the Excel model.

Core principle
Preserve Excel parity at all times unless explicitly instructed otherwise.

--------------------------------------------------
DEFAULT BEHAVIOUR
--------------------------------------------------

Approach
- Make minimal, targeted changes only
- Do not refactor broadly unless explicitly instructed
- Do not introduce new architecture or abstractions

Scope discipline
Work only within the required layer:
- UI (rendering, layout, interaction)
- Activation / visibility rules
- Normalisation
- Model / calculation engine

Do not cross layers unless necessary.

Technology constraints
- Plain TypeScript
- Direct DOM manipulation
- No frameworks
- No React, Vue, or component libraries

--------------------------------------------------
MANDATORY GIT WORKFLOW
--------------------------------------------------

Before making any change:

1. Stage all current changes
   git add -A

2. Create checkpoint commit
   git commit -m "checkpoint before <short description>"

This step is mandatory and must never be skipped.

- Work on main branch only
- Do not create branches unless explicitly instructed

--------------------------------------------------
EXCEL PARITY RULES (CRITICAL)
--------------------------------------------------

Must always preserve:

- Field ID to Excel cell mapping integrity
- Blank inputs treated as zero (unless explicitly designed otherwise)
- Pruning of inactive fields before calculations
- Correct ordering of operations
- Timing logic (year start, age progression)
- Projection start: next year and next age
- Default liquidation order:
  sell cheapest assets first unless user overrides

Never introduce:

- Rounding drift
- Hidden assumptions not present in Excel
- Changes to calculation sequencing

--------------------------------------------------
HIGH RISK AREAS
--------------------------------------------------

Changes here require extra caution:

- excelAdapter.ts
- normalization.ts
- runScenario.ts
- liquidation logic
- timing logic
- dependency / activation rules

If modifying any of the above:
- proceed conservatively
- ensure full validation is run

--------------------------------------------------
REGRESSION TESTING POLICY
--------------------------------------------------

After every code change, always run:

1. Type check
   npm run typecheck

2. Build
   npm run build

3. Parity tests
   npm run parity

Additionally, run:

   npm run parity:live

At the following checkpoints:

- Before any commit
- After changes affecting:
  - model math
  - timing or order of operations
  - liquidation logic
  - input mapping
- Whenever specs/ETQ.xlsx changes

A change is not complete unless all checks pass.

--------------------------------------------------
PROMPT INTERPRETATION
--------------------------------------------------

Assume prompts are minimal and outcome-focused.

- Infer the affected layer
- Choose the safest minimal implementation
- Do not expand scope beyond the request

If ambiguity exists:
prioritise safety, minimal impact, and parity preservation

--------------------------------------------------
UI AND UX RULES
--------------------------------------------------

- Maintain clean, minimal UI
- Avoid spreadsheet-like clutter unless required
- Prefer clarity over density

When modifying UI:
- Do not alter underlying calculation logic

--------------------------------------------------
CHANGE MANAGEMENT PRINCIPLES
--------------------------------------------------

Prefer:
- Small diffs
- Isolated edits
- Reversible changes

Avoid:
- Wide refactors
- File structure changes
- Renaming core identifiers unless required

--------------------------------------------------
OUTPUT EXPECTATION
--------------------------------------------------

All changes must:

- Compile cleanly
- Pass all parity checks
- Maintain deterministic outputs
- Match Excel behaviour exactly

--------------------------------------------------
FAILSAFE
--------------------------------------------------

If a change risks breaking parity or core logic:

- Do not proceed blindly
- Implement the safest minimal version
- Preserve existing behaviour

--------------------------------------------------
OPTIONAL GUARDRAIL
--------------------------------------------------

If a change can be implemented in under 30 lines,
do not exceed that without justification.

--------------------------------------------------
END
