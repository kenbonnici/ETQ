import csv
import json
from pathlib import Path

from openpyxl import load_workbook

XLSX_PATH = Path("specs/ETQ v2.xlsx")
INPUTS_CSV_PATH = Path("specs/excel_prototype/analysis/step1_inputs_with_tooltips_ui_notes.csv")
OUT_PATH = Path("/tmp/etq_live_extract.json")


def read_ages_and_series(ws, row: int) -> list[float]:
    values: list[float] = []
    col = 3  # C
    while True:
        v = ws.cell(row=row, column=col).value
        if v is None or v == "":
            break
        values.append(float(v))
        col += 1
    return values


def load_raw_inputs(inputs_ws) -> dict:
    raw: dict = {}
    with INPUTS_CSV_PATH.open(newline="", encoding="utf-8") as f:
        for rec in csv.DictReader(f):
            cell = rec["cell"]
            value = inputs_ws[cell].value
            raw[cell] = value
    return raw


def main() -> None:
    wb = load_workbook(XLSX_PATH, data_only=True)
    ws_inputs = wb["Inputs"]
    ws_norm = wb["RetNorm_Engine"]
    ws_early = wb["RetEarly_Engine"]

    payload = {
        "early": int(float(ws_early["B3"].value)),
        "raw": load_raw_inputs(ws_inputs),
        "exp": {
            "ages": read_ages_and_series(ws_norm, 3),
            "cashE": read_ages_and_series(ws_early, 203),
            "cashN": read_ages_and_series(ws_norm, 203),
            "nwE": read_ages_and_series(ws_early, 204),
            "nwN": read_ages_and_series(ws_norm, 204),
        },
    }

    OUT_PATH.write_text(json.dumps(payload), encoding="utf-8")
    print(f"wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
