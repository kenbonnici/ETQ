import csv
import json
import zipfile
import xml.etree.ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

XLSX = "specs/ETQ.xlsx"
INPUTS_CSV = "specs/excel_prototype/analysis/step1_inputs_with_tooltips_ui_notes.csv"
OUT_JSON = "specs/excel_prototype/analysis/excel_baseline_specimen.json"
OUT_TS = "src/model/parity/excelBaselineSpecimen.ts"


def get_sst(zf):
    ss = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    return ["".join(t.text or "" for t in si.iterfind(".//m:t", NS)) for si in ss.findall("m:si", NS)]


def cell_value(cell, sst):
    if cell is None:
        return None
    t = cell.attrib.get("t")
    v = cell.find("m:v", NS)
    if v is None:
        return None
    if t == "s":
        return sst[int(v.text)]
    if t == "b":
        return 1 if v.text == "1" else 0
    return v.text


def parse_numeric_cells(sheet_xml, refs, sst):
    sh = ET.fromstring(sheet_xml)
    out = {}
    for r in refs:
        c = sh.find(f"m:sheetData/m:row/m:c[@r='{r}']", NS)
        val = cell_value(c, sst)
        if val is None or str(val).strip() == "":
            out[r] = None
            continue
        try:
            out[r] = float(val)
        except Exception:
            out[r] = str(val)
    return out


def row_series(sheet_xml, row_number, sst):
    sh = ET.fromstring(sheet_xml)
    row = sh.find(f"m:sheetData/m:row[@r='{row_number}']", NS)
    if row is None:
        return []

    def col_index(ref):
        col = "".join(ch for ch in ref if ch.isalpha())
        n = 0
        for ch in col:
            n = n * 26 + (ord(ch) - 64)
        return n

    pairs = []
    for c in row.findall("m:c", NS):
        ref = c.attrib["r"]
        idx = col_index(ref)
        if idx < 3:
            continue
        v = cell_value(c, sst)
        if v is None or str(v).strip() == "":
            continue
        try:
            num = float(v)
            pairs.append((idx, num))
        except Exception:
            pass

    pairs.sort(key=lambda x: x[0])
    return [v for _, v in pairs]


def main():
    with zipfile.ZipFile(XLSX) as zf:
        sst = get_sst(zf)
        sheet1 = zf.read("xl/worksheets/sheet1.xml")
        sheet3 = zf.read("xl/worksheets/sheet3.xml")
        sheet4 = zf.read("xl/worksheets/sheet4.xml")

    input_cells = [r["cell"] for r in csv.DictReader(open(INPUTS_CSV))]
    raw_inputs = parse_numeric_cells(sheet1, input_cells, sst)

    # preserve strings for text cells from CSV specimen
    with zipfile.ZipFile(XLSX) as zf:
        sst = get_sst(zf)
        sh1 = ET.fromstring(zf.read("xl/worksheets/sheet1.xml"))
        text_cells = set(["B33", "B38", "B43", "B48", "B53", "B60", "B65", "B70", "B110", "B115", "B120", "B127", "B132", "B137"])
        for cell in text_cells:
            c = sh1.find(f"m:sheetData/m:row/m:c[@r='{cell}']", NS)
            v = cell_value(c, sst)
            raw_inputs[cell] = "" if v is None else str(v)

    ages = row_series(sheet3, 3, sst)
    cash_norm = row_series(sheet3, 203, sst)
    nw_norm = row_series(sheet3, 204, sst)
    cash_early = row_series(sheet4, 203, sst)
    nw_early = row_series(sheet4, 204, sst)

    # Use RetEarly_Engine!B3 as source of early retirement age.
    sh4 = ET.fromstring(sheet4)
    b3 = sh4.find("m:sheetData/m:row[@r='3']/m:c[@r='B3']", NS)
    b3v = cell_value(b3, sst)
    early_age = int(float(b3v)) if b3v is not None else 62

    payload = {
        "scenario_name": "excel_specimen",
        "early_retirement_age": early_age,
        "raw_inputs": raw_inputs,
        "excel_outputs": {
            "ages": ages,
            "cashSeriesEarly": cash_early,
            "cashSeriesNorm": cash_norm,
            "netWorthSeriesEarly": nw_early,
            "netWorthSeriesNorm": nw_norm,
        },
    }

    with open(OUT_JSON, "w") as f:
        json.dump(payload, f, indent=2)

    # Also generate a TS constant for model-side harness.
    with open(OUT_TS, "w") as f:
        f.write("export const EXCEL_BASELINE_SPECIMEN = ")
        json.dump(payload, f, indent=2)
        f.write(" as const;\n")

    print("wrote", OUT_JSON)
    print("wrote", OUT_TS)
    print("ages", len(ages), "cashEarly", len(cash_early), "cashNorm", len(cash_norm))


if __name__ == "__main__":
    main()
