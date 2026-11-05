"""Extract precinct-level results from the Cook County Clerk spreadsheets in
data/source/ into data/<race>.json, compute the progressive-conservative lean
index into data/lean.json, then rebuild js/data.js for the page.

Usage: python3 scripts/extract_results.py
"""

import csv
import json
import re
import statistics
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
    # Pulled from the county-wide canvass workbooks by scripts/extract_canvass.py
    "clerk_2017": "2017-OP-clerk-canvass.csv",
    "trustee_2017": "2017-OP-trustee-canvass.csv",
    "library_2017": "2017-OP-library-canvass.csv",
    "d97_2017": "2017-OP-d97-canvass.csv",
    "d200_2017": "2017-OP-d200-canvass.csv",
    "d97rate_2017": "2017-OP-d97rate-canvass.csv",
    "d97bonds_2017": "2017-OP-d97bonds-canvass.csv",
    "trustee_2021": "2021-OP-trustee-canvass.csv",
    "president_2021": "2021-OP-president-canvass.csv",
    "clerk_2021": "2021-OP-clerk-canvass.csv",
    "library_2021": "2021-OP-library-canvass.csv",
    "d97_2021": "2021-OP-d97-canvass.csv",
    "d200_2021": "2021-OP-d200-canvass.csv",
    "triton2yr_2021": "2021-OP-triton2yr-canvass.csv",
    "triton6yr_2021": "2021-OP-triton6yr-canvass.csv",
    "township_2021": "2021-OP-township-canvass.csv",
    "defundpolice_2021": "2021-OP-defundpolice-canvass.csv",
    "parkdistrict_2015": "2015-OP-parkdistrict-canvass.csv",
    "d97_2015": "2015-OP-d97-canvass.csv",
    "d200_2015": "2015-OP-d200-canvass.csv",
    "trustee_2019": "2019-OP-trustee-canvass.csv",
    "parkdistrict_2019": "2019-OP-parkdistrict-canvass.csv",
    "d97_2019": "2019-OP-d97-canvass.csv",
    "d200_2019": "2019-OP-d200-canvass.csv",
}

# Earlier Oak Park precinct lines, from the county's precinct maps, written to
# data/precinct_<set>.json. Each set lists its source file, the property
# holding the 7-digit precinct id (Oak Park Township's start with 85), how
# many precincts Oak Park had, and the elections drawn on it.
OLD_BOUNDARIES = {
    # The 38 precincts used 2012-2015
    "boundaries_2015": (SOURCE / "suburban-cook-precincts-2011.geojson", "idpct", 38, ("2015",)),
    # The 37 precincts used 2017-2021, before the 2022 redraw
    "boundaries_2017": (SOURCE / "suburban-cook-precincts-2021.geojson", "precinctid", 37, ("2017", "2019", "2021")),
}

# Candidates that define the progressive-conservative lean, one row per
# candidate: race id, candidate name (exactly as in the spreadsheet) and label
# (progressive, moderate or conservative, or blank). Moderates count as
# neutral, pulling a precinct toward the center. Candidates with a blank label
# are ignored, and only races with at least one progressive and one
# conservative count.
LABELS = ROOT / "data" / "candidate_labels.csv"
# Only these elections count toward the lean (the local consolidated elections)
LEAN_YEARS = ("2023", "2025")


def load_lean():
    """Read the candidate labels into {race: {label: [candidates]}}, keeping race order."""
    lean = {}
    with open(LABELS, newline="") as f:
        for row in csv.DictReader(f):
            race, name, label = row["race"].strip(), row["candidate"].strip(), row["label"].strip().lower()
            if not label or race[-4:] not in LEAN_YEARS:
                continue
            assert label in ("progressive", "moderate", "conservative"), f"{LABELS.name}: bad label {label!r} for {name!r}"
            lean.setdefault(race, {"progressive": [], "moderate": [], "conservative": []})[label].append(name)
    # The lean compares progressives with conservatives, so a race needs both
    for race in [r for r, sides in lean.items() if not (sides["progressive"] and sides["conservative"])]:
        print(f"lean: skipping {race}, which needs at least one progressive and one conservative")
        del lean[race]
    return lean


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


def old_boundaries(path, id_field, count):
    """Oak Park's precinct boundaries from a county precinct map, rounded like precinct_boundaries.json."""
    def ring(r):
        pts = [[round(x, 6), round(y, 6)] for x, y in r]
        return [pt for i, pt in enumerate(pts) if i == 0 or pt != pts[i - 1]]

    out = []
    for f in json.loads(path.read_text())["features"]:
        pid = str(f["properties"][id_field])
        if not pid.startswith("85"):
            continue
        g = f["geometry"]
        coords = [[ring(r) for r in poly] for poly in (g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]])]
        geometry = {"type": "Polygon", "coordinates": coords[0]} if len(coords) == 1 else {"type": "MultiPolygon", "coordinates": coords}
        out.append({"precinct": int(pid[2:]), "geometry": geometry})
    assert sorted(b["precinct"] for b in out) == list(range(1, count + 1)), f"{path.name}: expected Oak Park precincts 1-{count}"
    return sorted(out, key=lambda b: b["precinct"])


def extract(path):
    if path.suffix == ".csv":
        # Already checked against the county's contest totals by extract_canvass.py
        with open(path, newline="") as f:
            header, *rows = list(csv.reader(f))
    else:
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
    if path.suffix == ".csv":
        return sorted(results, key=lambda r: r["precinct"])
    assert check, f"{path.name}: no total row"
    for i, key in enumerate(["registered_voters", "ballots_cast"]):
        assert sum(r[key] for r in results) == to_int(check[i + 1]), f"{path.name}: {key} sum mismatch"
    for c, v in zip(candidates, check[3:-1]):
        assert sum(r[c] for r in results) == to_int(v), f"{path.name}: {c} sum mismatch"
    return sorted(results, key=lambda r: r["precinct"])


def lean_index(datasets):
    """Score each current precinct on how progressive or conservative it votes.

    For each race in data/candidate_labels.csv, a precinct's lean is the progressive candidates'
    share of the race's votes minus the conservative candidates' share. That
    is measured against the average Oak Park precinct and divided by the
    spread across precincts, so every race counts equally. The index is the
    average over races: above 0 leans progressive, below 0 conservative.

    The index is relative, so about half of precincts land on each side. As
    an absolute measure, races with candidates on both sides are also scored
    on a -100 to +100 scale centered on a tie: the average progressive
    candidate's votes minus the average conservative candidate's, divided by
    the averages of all three groups (moderates count as 0, pulling the score
    toward the center). abs_lean_pts averages that over those races; h2h_won
    counts the races where the progressive side outpolled the conservative.
    Each race also gets <race>_abs, its absolute lean.
    """
    to_current = {b["precinct_2023"]: b["precinct"] for b in datasets["boundaries"]}
    rows = {b["precinct"]: {"precinct": b["precinct"]} for b in datasets["boundaries"]}
    scores = {p: [] for p in rows}
    h2h = {p: [] for p in rows}
    races = []
    for race, sides in load_lean().items():
        results = datasets[race]
        sides = {"progressive": sides["progressive"], "moderate": sides.get("moderate", []), "conservative": sides["conservative"]}
        for name in sides["progressive"] + sides["moderate"] + sides["conservative"]:
            assert name in results[0], f"{race}: no candidate named {name!r}"
        lean = {}
        for r in results:
            # 2023 results use the 2023 precinct numbers
            p = to_current[r["precinct"]] if race.endswith("_2023") else r["precinct"]
            net = sum(r[c] for c in sides["progressive"]) - sum(r[c] for c in sides["conservative"])
            lean[p] = net / r["total_votes"]
            if sides["progressive"] and sides["conservative"]:
                prog = statistics.mean(r[c] for c in sides["progressive"])
                cons = statistics.mean(r[c] for c in sides["conservative"])
                mod = statistics.mean(r[c] for c in sides["moderate"]) if sides["moderate"] else 0
                h2h[p].append((prog - cons) / (prog + mod + cons))
                rows[p][race + "_abs"] = round((prog - cons) / (prog + mod + cons) * 100, 1)
        mean, sd = statistics.mean(lean.values()), statistics.pstdev(lean.values())
        for p, v in lean.items():
            # Points above or below the average precinct, for display
            rows[p][race] = round((v - mean) * 100, 1)
            scores[p].append((v - mean) / sd)
        races.append({"race": race, **sides, "average_lean_pct": round(mean * 100, 1),
                      "head_to_head": bool(sides["progressive"] and sides["conservative"])})
    for p, row in rows.items():
        row["index"] = round(statistics.mean(scores[p]), 2)
        row["races"] = len(scores[p])
        row["h2h_won"] = sum(lean > 0 for lean in h2h[p])
        row["h2h_races"] = len(h2h[p])
        row["abs_lean_pts"] = round(statistics.mean(h2h[p]) * 100, 1)
    return sorted(rows.values(), key=lambda r: r["precinct"]), races


def main():
    datasets = {"boundaries": json.loads((ROOT / "data" / "precinct_boundaries.json").read_text())}
    for name, (path, id_field, count, _) in OLD_BOUNDARIES.items():
        datasets[name] = old_boundaries(path, id_field, count)
        (ROOT / "data" / f"precinct_{name}.json").write_text(json.dumps(datasets[name], separators=(",", ":")))
    for race, fname in RACES.items():
        results = extract(SOURCE / fname)
        (ROOT / "data" / f"{race}.json").write_text(json.dumps(results, ensure_ascii=False, separators=(",", ":")))
        for name, (_, _, count, years) in OLD_BOUNDARIES.items():
            if race[-4:] in years:
                assert len(results) == count, f"{race}: expected all {count} precincts of {name}"
        datasets[race] = results
        print(f"{race}: {len(results)} precincts from {fname}")
    lean, lean_races = lean_index(datasets)
    (ROOT / "data" / "lean.json").write_text(json.dumps(lean, ensure_ascii=False, separators=(",", ":")))
    (ROOT / "data" / "lean_races.json").write_text(json.dumps(lean_races, ensure_ascii=False, indent=2) + "\n")
    datasets["lean"], datasets["lean_races"] = lean, lean_races
    # Precinct demographics come from scripts/demographics.py, which needs a Census API key
    demographics = ROOT / "data" / "demographics.json"
    if demographics.exists():
        datasets["demographics"] = json.loads(demographics.read_text())
    print(f"lean: index for {len(lean)} precincts from {len(lean_races)} races")
    js = "window.OPX_DATASETS = " + json.dumps(datasets, ensure_ascii=False, separators=(",", ":")) + ";\n"
    (ROOT / "js" / "data.js").write_text(js)
    print("wrote js/data.js")


if __name__ == "__main__":
    main()
