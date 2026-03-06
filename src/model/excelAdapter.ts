import { INPUT_DEFINITIONS } from "../ui/inputDefinitions";
import { ALL_INPUT_CELLS, CELL_TO_FIELD_ID, FIELD_ID_TO_CELL, FieldId, InputCell } from "./fieldRegistry";
import { FieldState, RawInputValue, RawInputs } from "./types";

export interface ExcelFieldRef {
  sheet: "Inputs";
  cell: InputCell;
}

export function getFieldIdForCell(cell: InputCell): FieldId {
  return CELL_TO_FIELD_ID[cell];
}

export function getCellForFieldId(fieldId: FieldId): InputCell {
  return FIELD_ID_TO_CELL[fieldId];
}

export function getExcelRefForField(fieldId: FieldId): ExcelFieldRef {
  return { sheet: "Inputs", cell: getCellForFieldId(fieldId) };
}

export function createEmptyFieldState(): FieldState {
  const state: FieldState = {};
  for (const def of INPUT_DEFINITIONS) state[def.fieldId] = null;
  return state;
}

export function createEmptyRawInputs(): RawInputs {
  const raw: RawInputs = {};
  for (const cell of ALL_INPUT_CELLS) raw[cell] = null;
  return raw;
}

export function fieldStateToRawInputs(fields: FieldState): RawInputs {
  const raw = createEmptyRawInputs();
  for (const def of INPUT_DEFINITIONS) {
    raw[def.cell] = fields[def.fieldId] ?? null;
  }
  return raw;
}

export function rawInputsToFieldState(raw: Partial<Record<string, RawInputValue>>): FieldState {
  const fields = createEmptyFieldState();
  for (const def of INPUT_DEFINITIONS) {
    fields[def.fieldId] = raw[def.cell] ?? null;
  }
  return fields;
}
