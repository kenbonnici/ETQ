import { EffectiveInputs, ScenarioOutputs } from "../types";
import { ProjectionTiming } from "../projectionTiming";
import { runScenario } from "./runScenario";

export function runScenarioNorm(
  inputs: EffectiveInputs,
  timing: ProjectionTiming,
  includeDebug = false
): ScenarioOutputs {
  return runScenario(inputs, { retirementAge: inputs.statutoryRetirementAge }, timing, includeDebug);
}
