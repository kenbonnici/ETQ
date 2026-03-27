import json
import re
from pathlib import Path

from openpyxl import load_workbook

XLSX_PATH = Path("specs/ETQ.xlsx")
FIELD_REGISTRY_PATH = Path("src/model/fieldRegistry.ts")
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


def load_input_cells() -> list[str]:
    field_registry = FIELD_REGISTRY_PATH.read_text(encoding="utf-8")
    return re.findall(r'^\s*(B\d+):\s+"[^"]+",?$', field_registry, flags=re.MULTILINE)


def load_raw_inputs(inputs_ws) -> dict:
    raw: dict = {}
    for cell in load_input_cells():
        raw[cell] = inputs_ws[cell].value
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
            "cashE": read_ages_and_series(ws_early, 247),
            "cashN": read_ages_and_series(ws_norm, 247),
            "nwE": read_ages_and_series(ws_early, 248),
            "nwN": read_ages_and_series(ws_norm, 248),
        },
    }

    OUT_PATH.write_text(json.dumps(payload), encoding="utf-8")
    print(f"wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
