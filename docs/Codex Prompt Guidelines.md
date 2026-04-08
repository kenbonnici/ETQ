# Codex Prompt Guidelines (ETQ)

## Purpose

Guide ChatGPT in generating high-quality Codex prompts.

Do not duplicate `AGENTS.md`.

## Input Interpretation

By default, treat all user input as a request to generate an optimised Codex prompt.

Exception:
Text enclosed in `< >` markers is instruction to ChatGPT only and must not be included in the generated prompt.

## Role Split

`AGENTS.md` handles:
- git workflow
- testing
- parity enforcement
- implementation discipline

This file handles:
- prompt clarity
- structure
- scoping
- reasoning level selection

## Core Principles

Prompts must be:
- minimal
- precise
- outcome-focused
- unambiguous

Avoid:
- repeating `AGENTS.md` rules
- unnecessary verbosity

## Scoping Rules

Always define scope explicitly:
- UI rendering
- UI state and persistence
- runtime visibility rules
- validation
- normalization
- projection timing
- field/cell mapping
- financial model math
- parity tooling

If unclear, choose the safest minimal scope.

## Relevant Files to Inspect

When relevant to the task, Codex should inspect:
- `src/main.ts`
- `src/model/index.ts`
- `src/model/projectionTiming.ts`
- the affected file in `src/model` or `src/ui`
- relevant tests in `specs/runtime` or `specs/ui`

## Explicit File Callouts

If the task touches any of these, mention it explicitly:
- `fieldRegistry.ts`
- `inputSchema.ts`
- `excelAdapter.ts`
- `normalization.ts`
- `projectionTiming.ts`
- `validate.ts`
- `runScenario.ts`

## Useful Task Phrases

Use when helpful:
- `this is parity-sensitive`
- `update semantic field ids and keep Excel mapping aligned`
- `change runtime visibility only, not model math`
- `change UI state/persistence only, not model behavior`
- `change projection timing behavior and verify displayed axis vs first-period prorating`
- `change scenario-manager behavior only; keep model inputs/outputs unchanged`
- `change downsizing preview/UI only, not downsizing model math`
- `change model math and run full parity checks`

Use sparingly, since they are already enforced globally:
- `preserve Excel parity`
- `plain DOM TypeScript app, not React`

## When to Add Constraints

Only include constraints specific to the task.

Do not include:
- git workflow
- testing instructions
- parity enforcement

## When to Expand Prompt

Add detail only when necessary:
- multi-step behaviour
- interaction design
- edge cases
- persistence behavior
- timing semantics

Otherwise keep it short.

## Current Webapp Areas Worth Naming

When the task is about one of these, name it directly in the prompt instead of describing it vaguely:
- scenario manager and local `localStorage` persistence
- earliest-viable-retirement indicator
- living-expenses single vs expanded-category mode
- manual liquidation ordering
- downsizing preview and downsizing-year window handling
- projection tables, scenario tabs, and expand/collapse behavior
- chart and timeline rendering

This helps keep prompts aligned with the current app structure in `src/main.ts`.

## Timing Guidance

Be careful with projection-timing wording.

Current behavior is:
- the displayed projection axis starts at current year and current age
- first-period math is still adjusted through prorating and month offset
- `projectionMonthOverride` exists for deterministic testing and parity work

Do not write prompts that assume the app currently shifts the visible axis to next year / next age unless the task is explicitly to change that behavior.

## Good Prompt Example

```text
Task
Fix timeline truncation.

Details
Show only primary event per year.
Add "+N events".
Click expands full list.

Scope
UI rendering only. No model changes.

Reasoning
LOW
```

## Reasoning Level Selection

Every prompt must include:

```text
Reasoning
LOW / MEDIUM / HIGH
```

### LOW

- styling
- text changes
- simple UI tweaks

### MEDIUM

- UI logic
- conditional rendering
- interaction behaviour
- local persistence
- scenario-manager behavior
- downsizing preview rendering

### HIGH

- model calculations
- timing / ordering logic
- liquidation logic
- normalization
- Excel mapping
- cross-layer changes

Default to the lowest safe level.

## Prompt Structure

Use clean, copy-paste format.

```text
Task
<what needs to be done>

Details
<specific behaviour>

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
- `UI rendering only.`
- `UI state/persistence only. No model changes.`
- `Projection timing only.`
- `Normalization only.`
- `Model math only.`

## Bad Prompt Example

```text
Fix timeline truncation.

Preserve Excel parity.
Run tests.
Use git checkpoint.
```

## Default Assumptions

Do not restate:
- Excel parity must be preserved
- tests must pass
- changes must be minimal
- git workflow is required

These are enforced by `AGENTS.md`.

Do not restate current repo facts unless they are directly relevant to the task.

Examples of repo facts that usually do not need repeating:
- the app compares early vs statutory retirement
- the app uses local scenario persistence
- the app has living-expense helper modes

Only mention them when the task is specifically about those areas.

## End
