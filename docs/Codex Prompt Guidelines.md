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

Always define scope explicitly:
- UI rendering
- UI state and persistence
- runtime visibility rules
- validation
- normalization
- projection timing
- financial model math

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
- `normalization.ts`
- `projectionTiming.ts`
- `validate.ts`
- `runScenario.ts`

## Useful Task Phrases

Use when helpful:
- `change runtime visibility only, not model math`
- `change UI state and persistence only, not model behavior`
- `change projection timing behavior and verify displayed axis vs first-period prorating`
- `change scenario-manager behavior only; keep model inputs and outputs unchanged`
- `change downsizing preview/UI only, not downsizing model math`
- `change model math and review downstream runtime coverage carefully`

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
- timing semantics

Otherwise keep it short.

## Current Webapp Areas Worth Naming

When the task is about one of these, name it directly in the prompt:
- scenario manager and local `localStorage` persistence
- earliest-viable-retirement indicator
- living-expenses single vs expanded-category mode
- manual liquidation ordering
- downsizing preview and downsizing-year window handling
- projection tables, scenario tabs, and expand/collapse behavior
- chart and timeline rendering

This keeps prompts aligned with the actual app structure in `src/main.ts`.

## Timing Guidance

Be careful with projection-timing wording.

Current behavior is:
- the displayed projection axis starts at the current year and current age
- first-period math is still adjusted through prorating and month offset
- `projectionMonthOverride` exists for deterministic testing

Do not write prompts that assume the app shifts the visible axis to next year or next age unless the task is explicitly to change that behavior.

## Good Prompt Example

```text
Task
Fix timeline truncation.

Details
Show only the primary event per year.
Add "+N events".
Click expands the full list.

Scope
UI rendering only. No model changes.

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

- UI logic
- conditional rendering
- interaction behavior
- local persistence
- scenario-manager behavior
- downsizing preview rendering

### HIGH

- model calculations
- timing or ordering logic
- liquidation logic
- normalization
- cross-layer changes

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
- `UI rendering only.`
- `UI state/persistence only. No model changes.`
- `Projection timing only.`
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
