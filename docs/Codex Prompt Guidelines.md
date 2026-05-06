# Codex Prompt Guidelines (ETQ)

## Purpose

Guide ChatGPT in generating high-quality Codex prompts for this repo.

Do not duplicate `AGENTS.md`.

## Input Interpretation

By default, treat all user input as a request to generate an optimized Codex prompt.

Exception:
Text enclosed in `< >` markers is instruction to ChatGPT only and must not be included in the generated prompt.

## Role Split

`AGENTS.md` handles:
- implementation discipline
- testing expectations
- repo invariants

This file handles:
- prompt clarity
- structure
- scoping
- reasoning level selection

## Core Principles

Prompts should be:
- minimal
- precise
- outcome-focused
- unambiguous

Avoid:
- repeating `AGENTS.md` rules
- unnecessary verbosity

## Scoping Rules

Always define scope explicitly.

Current ETQ work usually falls into one of these owning areas:
- landing quick estimate
- onboarding flow and handoff
- calculator UI rendering
- calculator UI state and persistence
- retirement comparison presentation
- runtime visibility and interaction rules
- validation
- planned-sale resolution
- normalization
- projection timing
- financial model math

If unclear, choose the safest minimal scope.

## Relevant Files to Inspect

When relevant to the task, Codex should inspect:
- `src/main.ts`
- `src/landing/main.ts`
- `src/onboarding/main.ts`
- `src/onboarding/sequence.ts`
- `src/onboarding/handoff.ts`
- `src/shared/findEarliestRetirementAge.ts`
- `src/model/index.ts`
- `src/model/projectionTiming.ts`
- the affected file in `src/model`, `src/ui`, `src/onboarding`, or `src/model/engines`
- relevant tests in `specs/runtime` or `specs/ui`

## Explicit File Callouts

If the task touches any of these, mention them explicitly when helpful:
- `src/model/fieldRegistry.ts`
- `src/model/inputSchema.ts`
- `src/model/plannedSales.ts`
- `src/model/activation.ts`
- `src/model/validate.ts`
- `src/model/normalization.ts`
- `src/model/projectionTiming.ts`
- `src/model/engines/runScenario.ts`
- `src/ui/runtimeRules.ts`
- `src/ui/livingExpenses.ts`
- `src/onboarding/handoff.ts`
- `src/onboarding/sequence.ts`

Use file callouts only when they materially narrow the work.

## Useful Task Phrases

Use when helpful:
- `change landing quick-estimate behavior only; keep calculator and onboarding behavior unchanged`
- `change onboarding flow or handoff only; keep calculator math unchanged`
- `change runtime visibility only, not model math`
- `change UI state and persistence only, not model behavior`
- `change retirement comparison presentation only; keep model outputs unchanged`
- `change planned-sell-year behavior only; keep staged-liquidation math otherwise unchanged`
- `change projection timing behavior and verify displayed axis vs first-period prorating`
- `change scenario-manager behavior only; keep model inputs and outputs unchanged`
- `change downsizing preview/UI only, not downsizing model math`
- `change model math and review golden plus invariant coverage carefully`

Use sparingly, since they are already enforced globally:
- `plain DOM TypeScript app, not React`
- `pipeline ordering is load-bearing`

## When to Add Constraints

Only include constraints specific to the task.

Do not include:
- git workflow
- generic testing instructions
- repo-wide invariants already covered by `AGENTS.md`

## When to Expand Prompt

Add detail only when necessary:
- multi-step behavior
- interaction design
- edge cases
- persistence behavior
- landing/onboarding handoff behavior
- planned-sale or liquidation interactions
- timing semantics
- comparison-label or primary-vs-comparison behavior

Otherwise keep it short.

## Current Webapp Areas Worth Naming

When the task is about one of these, name it directly in the prompt:
- landing quick estimate and `sessionStorage` seed handoff
- direct landing-to-calculator handoff (the "I'm ready" CTA writes a calculator draft snapshot, separate from the landing-to-onboarding seed path)
- guided onboarding question flow, gate pruning, and calculator draft handoff
- scenario manager and local `localStorage` persistence
- earliest-viable-retirement indicator and comparison stepper
- shared-partner retirement mode that presents the stepper in calendar years
- living-expenses single vs expanded-category mode
- manual liquidation ordering, exclusion, and keyboard reordering
- planned sell years for properties and assets of value
- downsizing preview and downsizing-year window handling
- charts/timeline view versus projections view
- projection tables, scenario tabs, expand/collapse, and scroll restoration
- chart tooltip/context rendering and timeline milestones

This keeps prompts aligned with the actual app structure in `src/main.ts`, `src/landing/main.ts`, `src/onboarding/main.ts`, and `src/ui/runtimeRules.ts`.

## Timing Guidance

Be careful with projection-timing wording.

Current behavior is:
- the displayed projection axis starts at the current year and current age
- first-period math is still adjusted through prorating and month offset
- `projectionMonthOverride` exists for deterministic testing
- `monthsRemaining` is `13 - currentMonth`, so January behaves as a full year and mid-year overrides partially prorate only the first projected year

Do not write prompts that assume the app shifts the visible axis to next year or next age unless the task is explicitly to change that behavior.

## Comparison Guidance

Be careful with retirement-comparison wording.

Current calculator presentation is:
- the earliest viable retirement age, if one exists, is the primary displayed comparison
- if no viable early-retirement age exists, the primary displayed comparison falls back to statutory retirement age
- the user-controlled stepper is the comparison retirement age
- shared-partner early-retirement mode may present that stepper as a retirement year instead of an age, while the model still uses ages underneath

Do not write prompts that assume the calculator always compares a user-selected early-retirement age directly against statutory retirement age unless the task is explicitly to restore or change that behavior.

## Testing Guidance for Prompts

Usually do not restate the repo's standard checks.

Only mention specific tests when the task likely needs focused verification, for example:
- `check relevant runtime tests in specs/runtime/runtimeRules.test.ts`
- `check onboarding branching in specs/runtime/onboardingSequence.test.ts`
- `review golden snapshot impact if model outputs move`
- `cover Playwright behavior in specs/ui/app.spec.ts if the change is browser-visible in the calculator`
- `cover Playwright behavior in specs/ui/onboarding.spec.ts if the change is browser-visible in onboarding`

## Good Prompt Example

```text
Task
Fix timeline truncation.

Details
Show only the primary event per year.
Add "+N events".
Click expands the full list.

Scope
Calculator UI rendering only. No model changes.

Reasoning
LOW
```

## Reasoning Level Selection

Every prompt should include:

```text
Reasoning
LOW / MEDIUM / HIGH
```

### LOW

- styling
- text changes
- simple UI tweaks

### MEDIUM

- landing quick-estimate behavior
- onboarding flow logic
- UI logic
- conditional rendering
- interaction behavior
- local persistence
- scenario-manager behavior
- downsizing preview rendering
- retirement comparison presentation
- planned-sell-year focus, tab order, or validation reveal behavior

### HIGH

- model calculations
- timing or ordering logic
- liquidation logic
- planned-sale semantics
- normalization
- cross-layer changes
- storage-contract changes that affect handoff into model state

Default to the lowest safe level.

## Prompt Structure

Use clean, copy-paste format.

```text
Task
<what needs to be done>

Details
<specific behavior>

Scope
<affected layer>

Constraints (only if needed)
<task-specific only>
```

Reasoning level for the user to select, outside the prompt copy/paste pane:

```text
LOW / MEDIUM / HIGH
```

Prefer naming one concrete owning layer in `Scope`.

Examples:
- `Landing quick estimate only.`
- `Onboarding flow and handoff only. No calculator math changes.`
- `Calculator UI rendering only.`
- `Calculator UI state/persistence only. No model changes.`
- `Retirement comparison presentation only.`
- `Projection timing only.`
- `Planned-sale resolution only.`
- `Normalization only.`
- `Model math only.`

## Bad Prompt Example

```text
Fix timeline truncation.

Run the standard checks.
Follow the repo rules.
```

## Default Assumptions

Do not restate:
- repo invariants from `AGENTS.md`
- generic testing expectations
- minimal-diff guidance

Do not restate current repo facts unless they are directly relevant to the task.

Only mention current app behavior when it meaningfully narrows the work.

## End
