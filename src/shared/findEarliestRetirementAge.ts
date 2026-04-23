import { runModel } from "../model";
import { FieldState, ModelUiState } from "../model/types";

export interface EarliestAgeResult {
  age: number | null;
  result: ReturnType<typeof runModel> | null;
}

export function findEarliestRetirementAge(
  fields: FieldState,
  baseUi: ModelUiState
): EarliestAgeResult {
  const currentAge = Number(fields["profile.currentAge"] ?? NaN);
  const statutory = Number(fields["retirement.statutoryAge"] ?? NaN);
  if (!Number.isFinite(currentAge) || currentAge <= 0) {
    return { age: null, result: null };
  }
  const lo = Math.max(18, Math.floor(currentAge));
  const hi = Number.isFinite(statutory) && statutory > lo
    ? Math.ceil(statutory)
    : Math.min(95, lo + 40);
  let lastResult: ReturnType<typeof runModel> | null = null;
  for (let age = lo; age <= hi; age += 1) {
    const result = runModel({ ...fields }, { ...baseUi, earlyRetirementAge: age });
    lastResult = result;
    if (result.outputs.scenarioEarly.retirementSuccessful) {
      return { age, result };
    }
  }
  return { age: null, result: lastResult };
}
