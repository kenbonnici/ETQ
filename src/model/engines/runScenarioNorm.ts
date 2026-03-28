import { EffectiveInputs, ScenarioOutputs } from "../types";
import { ProjectionTiming } from "../projectionTiming";
import { runScenario } from "./runScenario";

export function runScenarioNorm(inputs: EffectiveInputs, timing: ProjectionTiming): ScenarioOutputs {
  return runScenario(inputs, { retirementAge: inputs.statutoryRetirementAge }, timing);
}
