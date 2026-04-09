import { EffectiveInputs, ScenarioOutputs } from "../types";
import { ProjectionTiming } from "../projectionTiming";
import { runScenario } from "./runScenario";

export function runScenarioEarly(
  inputs: EffectiveInputs,
  earlyRetirementAge: number,
  timing: ProjectionTiming,
  includeDebug = false
): ScenarioOutputs {
  return runScenario(inputs, { retirementAge: earlyRetirementAge }, timing, includeDebug);
}
