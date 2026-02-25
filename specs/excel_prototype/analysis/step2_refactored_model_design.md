# Step 2 — Refactored Model Design (Excel -> Web Model)

## Scope and Output Contract
- App scope remains single-page.
- Inputs are exactly the 86 yellow input cells from `Inputs` tab.
- Only outputs are the two charts:
  - `Cash`
  - `Net Worth`
- Retirement spinner controls **early retirement age only** and maps to `RetEarly_Engine!B3` behavior.
- Statutory pension age remains `B19`.

## Design Goals
- Preserve financial intent and output parity with Excel for supported behavior.
- Replace duplicated spreadsheet blocks with deterministic TypeScript functions.
- Keep section/UI activation rules explicit and separate from financial math.

## Confirmed Behavioral Decisions from SME
- Preserve blank-to-zero behavior for numeric inputs in calculations (unless explicitly constrained).
- Event year inputs are calendar years.
- Hide (not disable) dependency-driven fields until conditions are met.
- `Housing rent (B23)` shown only when `B12` is truly blank.
- `B71` shown only when `B70` is non-blank and non-zero.
- `DEEPER DIVE` and `FINER DETAILS` are collapsed by default and opened only on user request.
- If a section contains values, it cannot be collapsed again until user clears that section.
- If `DEEPER DIVE` is never opened, values remain blank.
- If `FINER DETAILS` is never opened, values come from column `C` defaults.
- `B166:B168` liquidation order: blanks are treated as `0` (do not sell).
- If no user liquidation order values are entered, sale sequence defaults cheapest-to-most-expensive.
- Label typo should be corrected in UI to `General inflation`.

## Intent-Preserving vs Approved Intent Changes

### Preserved
- All core yearly projection mechanics for income, expenses, assets, liabilities, and cashflow paths.
- Separation of statutory pension age (`B19`) and early retirement age (spinner).
- Chart series semantics:
  - Normal/statutory path
  - Early-retirement path

### Approved Changes (intent-level)
1. Pension reduction rule expression is simplified to:
   - `max(0, (B19 - earlyRetAge)) * B157`
   - applied when pension starts.
2. Property liquidation order control is simplified:
   - no reliance on legacy `B165` branch behavior,
   - use explicit user order where provided,
   - blanks => `0` (never sell),
   - when unset globally, default by ascending property value.

## Proposed Refactored Architecture

## `/src/model/types.ts`
- `InputsQuickStart`
- `InputsDeeperDive`
- `InputsFinerDetails`
- `EffectiveInputs` (post section-activation policy and defaults)
- `ProjectionPoint` (age, year, cash, netWorth, etc.)
- `ModelOutputs`:
  - `cashSeriesEarly`
  - `cashSeriesNorm`
  - `netWorthSeriesEarly`
  - `netWorthSeriesNorm`
  - shared `ages`

## `/src/model/inputSchema.ts`
- Canonical 86-field schema from Step 1 extraction.
- Validation constraints from Excel data validations + clarified behavior.
- Display metadata (labels/tooltips/UI notes/dependencies).

## `/src/model/activation.ts`
- Applies section rules before calculations:
  - unopened `DEEPER DIVE` => blanks
  - unopened `FINER DETAILS` => col `C` defaults
- Enforces collapse lock rule:
  - cannot collapse a section while it has any non-empty value.

## `/src/model/normalization.ts`
- Converts raw UI values into `EffectiveInputs`.
- Implements blank-to-zero conversion rules for numeric fields.
- Applies derived/default liquidation order behavior for `B166:B168`.

## `/src/model/timeline.ts`
- Builds projection horizon:
  - start age from `B4 + 1`
  - end age from `B134`
  - start year from runtime `YEAR(TODAY()) + 1`

## `/src/model/components/`
- `employmentIncome.ts`
- `otherIncome.ts`
- `pension.ts`
- `livingCosts.ts`
- `loanAmortization.ts`
- `creditAndOtherLoans.ts`
- `assetGrowth.ts` (cash interest, stock return, property appreciation)
- `eventAdjustments.ts` (major life events)
- `liquidation.ts` (stock/property disposals, costs, loan clearance)

Each component returns annual vectors aligned to timeline indices.

## `/src/model/engines/`
- `runScenarioNorm.ts` (statutory retirement path)
- `runScenarioEarly.ts` (spinner-selected early retirement path)

Both engines reuse identical component functions and differ only in retirement-age parameterization.

## `/src/model/index.ts`
- `runModel(rawInputs, uiState) -> ModelOutputs`
- deterministic pure function; no UI dependencies.

## Excel-to-Refactor Mapping (high-level)

| Excel Area | Existing Meaning | Refactored Module |
|---|---|---|
| `Ret* row 3` age axis | Age timeline | `timeline.ts` |
| `Ret* rows 5-17` income stack | salary, other income, rental, pension, events | `employmentIncome.ts`, `otherIncome.ts`, `pension.ts`, `eventAdjustments.ts` |
| `Ret* rows 20-46` outflows | living, dependents, rents, loans, events | `livingCosts.ts`, `loanAmortization.ts`, `creditAndOtherLoans.ts`, `eventAdjustments.ts` |
| `Ret* rows 48-50` net cash/carry | annual cash recursion | `runScenario*.ts` core loop |
| `Ret* rows 52-66` net worth (no liquidation) | assets - liabilities | `assetGrowth.ts` + liabilities from loan modules |
| `Ret* rows 75-156` liquidation mechanics | disposals, costs, clearance ordering | `liquidation.ts` |
| `Ret* rows 159-172` net worth (with liquidation) | post-liquidation balance sheet | `liquidation.ts` + scenario loop |
| `Ret* rows 183/184 -> 201/202` chart feed | final series staging | `index.ts` output assembly |

## Dependency Graph Summary (refactored)
- `Raw Inputs + UI State` -> `activation.ts`
- `activated inputs` -> `normalization.ts`
- `effective inputs` + `timeline` -> shared component vectors
- shared vectors -> `runScenarioNorm` and `runScenarioEarly`
- scenario outputs -> chart series arrays

Graph is acyclic and deterministic.

## Rounding Policy (for Step 3 implementation)
- Internal calculations: full precision floating point.
- Parity comparison/reporting:
  - currency tolerance: `±0.01`
  - percentage tolerance: `±0.0001`
- Do not pre-round intermediate annual vectors unless Excel logic explicitly imposes it.

## Section/UI Behavior Design (for Step 4 integration)
- Visibility dependencies from Step 1 rules are treated as UI state only.
- Hidden fields still exist in model input object with blank values unless shown/filled.
- On submission/recalc, normalization applies blank/default policy exactly.

## No-Intent-Change Statement
This refactor preserves the model's financial intent except for two SME-approved intent updates:
- pension reduction rule simplification,
- liquidation-order logic simplification with explicit defaulting behavior.

All other changes are structural only (modularization, deduplication, clearer flow).
