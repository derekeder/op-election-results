"""Pull Oak Park contests out of the Cook County Clerk's suburban-wide precinct
canvass workbooks (legacy .xls) into one small CSV per race in data/source/,
which scripts/extract_results.py then reads like the per-race spreadsheets.

The canvass workbooks cover every suburban contest, one or more contests per
sheet, and a contest with many candidates can run on across two sheets.
Write-in columns are left out, as in the other races.

This only needs to run when a canvass workbook is added or changed, and it
needs the xlrd package (pip install xlrd); extract_results.py does not.

Usage: python3 scripts/extract_canvass.py
"""

import csv
import re
from pathlib import Path

import xlrd

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "data" / "source"

# Canvass workbook -> {race id: contest title exactly as in the workbook}
CANVASS = {
    "Precinct Canvass 2015.xls": {
        "parkdistrict_2015": "Commissioner, Oak Park Park District, 4yr",
        "d97_2015": "Board Member, Oak Park SD 97, 4yr",
        "d200_2015": "Board Member, OPRF HS Dist 200, 4yr",
    },
    "Precinct Canvass 2017.xls": {
        "clerk_2017": "Clerk, Village of Oak Park",
        "trustee_2017": "Trustee, Village of Oak Park",
        "library_2017": "Library Trustee, Village of Oak Park, 4yr",
        "d97_2017": "School B.M., Oak Park 97, 4yr",
        "d200_2017": "School B.M., Oak Park and River Forest HS 200, 4yr",
        "d97rate_2017": "School District 97, Increase Limiting Rate",
        "d97bonds_2017": "School District 97, Issue Bonds",
    },
    "Apr 2021 Precinct Canvass.xls": {
        "trustee_2021": "Trustee, Village of Oak Park",
        "president_2021": "President, Village of Oak Park",
        "clerk_2021": "Clerk, Village of Oak Park",
        "library_2021": "Library Trustee, Village of Oak Park, 4yr",
        "d97_2021": "School B.M., Oak Park 97, 4yr",
        "d200_2021": "School B.M., Oak Park and River Forest HS 200, 4yr",
        "triton2yr_2021": "Trustee, Triton College 504, 2yr.",
        "triton6yr_2021": "Trustee, Triton College 504, 6yr",
        "township_2021": "Trustee, Oak Park Township",
        "defundpolice_2021": "Village of Oak Park, Defund the Police Department",
    },
    "Precinct Canvass Apr 2019.xls": {
        "trustee_2019": "Trustee, Village of Oak Park",
        "parkdistrict_2019": "Cmsnr., Oak Park Park District, 4yr.",
        "d97_2019": "School B.M., Oak Park 97, 4yr",
        "d200_2019": "School B.M., Oak Park and River Forest HS 200, 4yr",
    },
}
# Oak Park Township's precinct ids are 85 followed by the precinct number
OAK_PARK = re.compile(r"85(\d{5})")


def output_path(race):
    return SOURCE / f"{race[-4:]}-OP-{race[:-5]}-canvass.csv"


def num(v):
    s = str(v).strip().replace(",", "")
    return int(float(s)) if s else 0


def contests(path):
    """Return {title: {"precincts": {id: (registered, ballots)}, "votes": {candidate: {id: votes}}, "total": {...}}}."""
    book = xlrd.open_workbook(path)
    out = {}
    for sheet in book.sheets()[1:]:  # the first sheet is the document map
        if sheet.nrows < 8:
            continue
        titles = {}
        for line in str(sheet.cell_value(4, 2)).splitlines():
            m = re.fullmatch(r"\s*(\d+)\s+(.+?)\s*", line)
            if m:
                titles[m[1]] = m[2]
        numbers, names = sheet.row_values(5), sheet.row_values(6)
        assert names[2:4] == ["Registered", "Ballots Cast"], f"{path.name} {sheet.name}: {names[:5]}"
        rows = [sheet.row_values(r) for r in range(7, sheet.nrows)]
        for col in range(7, sheet.ncols):
            n, name = str(numbers[col]).strip(), str(names[col]).strip()
            if not n or not name:
                continue
            c = out.setdefault(titles[n.split(".")[0]], {"precincts": {}, "votes": {}, "total": {}})
            for r in rows:
                pid = str(r[0]).strip()
                if re.fullmatch(r"\d{7}", pid):
                    # Checked in main(): a precinct should show the same counts on every sheet of a contest
                    c["precincts"].setdefault(pid, set()).add((num(r[2]), num(r[3])))
                    c["votes"].setdefault(name, {})[pid] = num(r[col])
                elif pid == "Contest Total":
                    c["total_counts"] = (num(r[2]), num(r[3]))
                    c["total"][name] = num(r[col])
    return out


def main():
    for fname, races in CANVASS.items():
        found = contests(SOURCE / fname)
        for race, title in races.items():
            c = found[title]
            candidates = [n for n in c["votes"] if n.lower() != "write-in"]
            ids = sorted(p for p in c["precincts"] if OAK_PARK.fullmatch(p))
            assert ids, f"{fname}: no Oak Park precincts for {title!r}"
            for p, counts in c["precincts"].items():
                assert len(counts) == 1, f"{race}: precinct {p} has differing counts {counts}"
                c["precincts"][p] = counts.pop()
            for n in candidates:
                assert set(c["votes"][n]) == set(c["precincts"]), f"{race}: {n} is missing precincts"
            # Contests held only in Oak Park should add up to the county's contest total
            if len(ids) == len(c["precincts"]):
                assert tuple(sum(c["precincts"][p][i] for p in ids) for i in (0, 1)) == c["total_counts"], f"{race}: counts mismatch"
                for n in candidates:
                    assert sum(c["votes"][n][p] for p in ids) == c["total"][n], f"{race}: {n} sum mismatch"
            with open(output_path(race), "w", newline="") as f:
                w = csv.writer(f)
                # The canvass writes nicknames as ''Jim'', and referendum choices as YES and NO
                names = [{"YES": "Yes", "NO": "No"}.get(n, n.replace("''", '"')) for n in candidates]
                w.writerow(["Precinct", "Registered Voters", "Ballots Cast"] + names + ["Total Votes"])
                for p in ids:
                    votes = [c["votes"][n][p] for n in candidates]
                    w.writerow([f"Oak Park Precinct {int(OAK_PARK.fullmatch(p)[1])}", *c["precincts"][p], *votes, sum(votes)])
            print(f"{race}: {len(ids)} Oak Park precincts, {len(candidates)} candidates -> {output_path(race).name}")


if __name__ == "__main__":
    main()
