"""Extract precinct-level results from the Cook County Clerk spreadsheets in
data/source/ into data/<race>.json, then rebuild js/data.js for the page.

Usage: python3 scripts/extract_results.py
"""

import json
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "data" / "source"

# Race id (and output file name) -> source spreadsheet
RACES = {
    "senate_2026": "2026-Primary-OP-Senate-ElectionResults.xlsx",
    "comptroller_2026": "2026-Primary-OP-comptroller-ElectionResults.xlsx",
    "congress7_2026": "2026-Primary-OP-7th-ElectionResults.xlsx",
    "staterep8_2026": "2026-Primary-OP-8th-ElectionResults.xlsx",
    "countypres_2026": "2026-Primary-OP-county-pres-ElectionResults.xlsx",
    "assessor_2026": "2026-Primary-OP-county-assessor-ElectionResults.xlsx",
    "statecentral_2026": "2026-Primary-OP-committeeperson-ElectionResults.xlsx",
    "trustee_2025": "2025-OP-Trustees-ElectionResults.xlsx",
    "president_2025": "2025-vicki-raviElectionResults.xlsx",
    "library_2025": "2025-OP-library-ElectionResults.xlsx",
    "d97_2025": "2025-OP-d97-ElectionResults.xlsx",
    "d200_2025": "2025-OP-d200-ElectionResults.xlsx",
    "triton_2025": "2025-OP-triton-ElectionResults.xlsx",
    "congress7_2024": "2024-Primary-OP-7th-ElectionResults.xlsx",
    "statesattorney_2024": "2024-Primary-OP-cook-states-attorney-ElectionResults.xlsx",
    "circuitclerk_2024": "2024-Primary-OP-circuit-clerk-ElectionResults.xlsx",
    "boardofreview_2024": "2024-Primary-OP-board-of-review-ElectionResults.xlsx",
    "countyboard1_2024": "2024-Primary-OP-stamps-ElectionResults.xlsx",
    "trustee_2023": "2023-OP-Trustees-ElectionResults.xlsx",
    "d200_2023": "2023-OP-d200-ElectionResults.xlsx",
}

NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def read_sheet(path, name):
    """Return the rows of a worksheet as lists of strings."""
    with zipfile.ZipFile(path) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS):
                shared.append("".join(t.text or "" for t in si.iter(f"{{{NS['m']}}}t")))
        book = ET.fromstring(z.read("xl/workbook.xml"))
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        targets = {r.get("Id"): r.get("Target") for r in rels}
        sheet = next(s for s in book.find("m:sheets", NS) if s.get("name") == name)
        target = targets[sheet.get(REL)].lstrip("/")
        if not target.startswith("xl/"):
            target = "xl/" + target
        rows = []
        for row in ET.fromstring(z.read(target)).iter(f"{{{NS['m']}}}row"):
            cells = {}
            for c in row.findall("m:c", NS):
                col = re.match(r"[A-Z]+", c.get("r")).group()
                idx = 0
                for ch in col:
                    idx = idx * 26 + ord(ch) - 64
                if c.get("t") == "s":
                    val = shared[int(c.find("m:v", NS).text)]
                elif c.get("t") == "inlineStr":
                    val = "".join(t.text or "" for t in c.iter(f"{{{NS['m']}}}t"))
                else:
                    v = c.find("m:v", NS)
                    val = v.text if v is not None else ""
                cells[idx - 1] = val
            if cells:
                rows.append([cells.get(i, "") for i in range(max(cells) + 1)])
        return rows


def to_int(s):
    return int(str(s).replace(",", ""))


def extract(path):
    header, *rows = read_sheet(path, "Precinct")
    assert header[:3] == ["Precinct", "Registered Voters", "Ballots Cast"], header
    assert header[-1] == "Total Votes", header
    candidates = header[3:-1]

    results, check = [], None
    for row in rows:
        if row[0] == "Suburban Cook County":
            check = row
            continue
        m = re.fullmatch(r"Oak Park Precinct (\d+)", row[0])
        assert m, f"{path.name}: unexpected row {row[0]!r}"
        registered, ballots = to_int(row[1]), to_int(row[2])
        votes = {c: to_int(v) for c, v in zip(candidates, row[3:-1])}
        total = to_int(row[-1])
        assert sum(votes.values()) == total, f"{path.name}: precinct {m[1]} total mismatch"
        top = max(votes.values())
        leaders = [c for c in candidates if votes[c] == top]
        results.append({
            "precinct": int(m[1]),
            "registered_voters": registered,
            "ballots_cast": ballots,
            "turnout_pct": round(ballots / registered * 100, 1) if registered else 0,
            "total_votes": total,
            **votes,
            "top_candidate": leaders[0] if len(leaders) == 1 else "Tie: " + " & ".join(leaders),
        })

    # The precinct rows should add up to the county's total row
    assert check, f"{path.name}: no total row"
    for i, key in enumerate(["registered_voters", "ballots_cast"]):
        assert sum(r[key] for r in results) == to_int(check[i + 1]), f"{path.name}: {key} sum mismatch"
    for c, v in zip(candidates, check[3:-1]):
        assert sum(r[c] for r in results) == to_int(v), f"{path.name}: {c} sum mismatch"
    return sorted(results, key=lambda r: r["precinct"])


def main():
    datasets = {"boundaries": json.loads((ROOT / "data" / "precinct_boundaries.json").read_text())}
    for race, fname in RACES.items():
        results = extract(SOURCE / fname)
        (ROOT / "data" / f"{race}.json").write_text(json.dumps(results, ensure_ascii=False, separators=(",", ":")))
        datasets[race] = results
        print(f"{race}: {len(results)} precincts from {fname}")
    js = "window.OPX_DATASETS = " + json.dumps(datasets, ensure_ascii=False, separators=(",", ":")) + ";\n"
    (ROOT / "js" / "data.js").write_text(js)
    print("wrote js/data.js")


if __name__ == "__main__":
    main()
