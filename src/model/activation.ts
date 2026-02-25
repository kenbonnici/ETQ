import { DEEPER_DIVE_CELLS, FINER_DETAILS_CELLS, FINER_DETAILS_COL_C_DEFAULTS } from "./inputSchema";
import { InputCell, RawInputs, RawInputValue, ModelUiState } from "./types";

function hasMeaningfulValue(v: RawInputValue): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim() !== "";
  return !Number.isNaN(v);
}

function sectionHasValues(raw: RawInputs, cells: InputCell[]): boolean {
  return cells.some((c) => hasMeaningfulValue(raw[c]));
}

export interface ActivationResult {
  activatedInputs: RawInputs;
  canCollapseDeeperDive: boolean;
  canCollapseFinerDetails: boolean;
}

export function applySectionActivation(raw: RawInputs, uiState: ModelUiState): ActivationResult {
  const activatedInputs: RawInputs = { ...raw };

  if (!uiState.deeperDiveOpen) {
    for (const cell of DEEPER_DIVE_CELLS) {
      activatedInputs[cell] = null;
    }
  }

  if (!uiState.finerDetailsOpen) {
    for (const cell of FINER_DETAILS_CELLS) {
      activatedInputs[cell] = FINER_DETAILS_COL_C_DEFAULTS[cell] ?? null;
    }
  }

  // Collapse eligibility is based on user-entered/raw section values,
  // not on auto-applied defaults used while sections are closed.
  const canCollapseDeeperDive = !sectionHasValues(raw, DEEPER_DIVE_CELLS);
  const canCollapseFinerDetails = !sectionHasValues(raw, FINER_DETAILS_CELLS);

  return {
    activatedInputs,
    canCollapseDeeperDive,
    canCollapseFinerDetails
  };
}
