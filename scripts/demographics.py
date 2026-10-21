"""Estimate race and ethnicity, age, median household income, housing tenure,
building type and household type for each Oak Park precinct from the American
Community Survey, writing
data/demographics.json. Rerun scripts/extract_results.py afterwards to
include it in js/data.js.

Usage: CENSUS_API_KEY=... python3 scripts/demographics.py

Source: 2020-2024 ACS 5-year estimates by census block group: Tables B03002
(Hispanic or Latino origin by race), B01001 (sex by age), B19001
(household income), B25003 (tenure: owner or renter occupied), B25024
(units in structure), B11001 (household type) and B11002 (population in
households, for persons per household). Block groups don't line up with precincts, so each block
group's counts are split among its 2020 census blocks in proportion to their
2020 population (or housing units, for households), and each block is
assigned to the precinct containing its internal point.

Medians can't be added up, so each precinct's median household income is
estimated from its household counts in B19001's income brackets, by linear
interpolation within the bracket holding the middle household.
"""

import json
import os
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ACS_URL = "https://api.census.gov/data/2024/acs/acs5"
TIGERWEB = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer"
BLOCKS_LAYER, BLOCK_GROUPS_LAYER = 10, 8
# Oak Park village, for checking that the precinct estimates add up
OAK_PARK_PLACE = "54885"



def by_age(first, last):
    """B01001 variables for an age range, men (003-025) and women (027-049)."""
    return [f"B01001_{n:03d}E" for n in range(first, last + 1)] + [f"B01001_{n + 24:03d}E" for n in range(first, last + 1)]


# Groups shown on the page -> ACS variables summed into each, by table
TABLES = {
    "B03002": {
        "total": "B03002_001E",
        "groups": {
            "white": ["B03002_003E"],  # Not Hispanic: White alone
            "black": ["B03002_004E"],  # Not Hispanic: Black alone
            "hispanic": ["B03002_012E"],  # Hispanic or Latino, any race
            "asian": ["B03002_006E"],  # Not Hispanic: Asian alone
            # Not Hispanic: American Indian, Pacific Islander, some other race, two or more races
            "other": ["B03002_005E", "B03002_007E", "B03002_008E", "B03002_009E"],
        },
    },
    "B01001": {
        "total": "B01001_001E",
        "groups": {
            "age_under18": by_age(3, 6),  # under 5 through 15-17
            "age_18_29": by_age(7, 11),  # 18-19 through 25-29
            "age_30_44": by_age(12, 14),  # 30-34 through 40-44
            "age_45_64": by_age(15, 19),  # 45-49 through 62-64
            "age_65plus": by_age(20, 25),  # 65-66 through 85 and over
        },
    },
}
# Both tables count the same people; percentages use this one's total
TOTAL = TABLES["B03002"]["total"]

# Household income brackets (B19001_002E-017E) by lower bound; the top one is $200,000 or more
INCOME_BRACKETS = list(zip(
    [f"B19001_{n:03d}E" for n in range(2, 18)],
    [0, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000, 60000, 75000, 100000, 125000, 150000, 200000],
))
HOUSEHOLDS = "B19001_001E"
# Official village median household income, for comparison
MEDIAN_INCOME = "B19013_001E"

# People living in households (everyone but group quarters), split by population.
# Divided by households for persons per household; checked against the official average.
HOUSEHOLD_POP = "B11002_001E"
AVG_HOUSEHOLD_SIZE = "B25010_001E"

# Housing tables, split among blocks by housing units like households.
# Keyed by the name of each table's total in the output.
HOUSING_TABLES = {
    # Occupied housing units by tenure
    "occupied_units": {
        "total": "B25003_001E",
        "groups": {"owner": ["B25003_002E"], "renter": ["B25003_003E"]},
    },
    # All housing units (occupied or vacant) by units in the building. Mobile homes
    # and boats/RVs (B25024_010E-011E) are in neither group; Oak Park has none.
    "housing_units": {
        "total": "B25024_001E",
        "groups": {
            "single_unit": ["B25024_002E", "B25024_003E"],  # 1 unit, detached or attached
            "multi_unit": [f"B25024_{n:03d}E" for n in range(4, 10)],  # 2 or more units
        },
    },
    # Households by type
    "type_households": {
        "total": "B11001_001E",
        "groups": {
            "married": ["B11001_003E"],  # Married-couple family
            "male_householder": ["B11001_005E"],  # Family: male householder, no spouse present
            "female_householder": ["B11001_006E"],  # Family: female householder, no spouse present
            "living_alone": ["B11001_008E"],  # Nonfamily: householder living alone
            "other_nonfamily": ["B11001_009E"],  # Nonfamily: householder not living alone
        },
    },
}


def median_from_brackets(counts):
    """Median of grouped household incomes, interpolating within the middle bracket.
    Returns (median, top_coded) where top_coded means it falls in the open-ended top bracket."""
    total = sum(counts)
    if not total:
        return None, False
    half, below = total / 2, 0
    for i, ((_, low), n) in enumerate(zip(INCOME_BRACKETS, counts)):
        if below + n >= half and n:
            if i == len(INCOME_BRACKETS) - 1:
                return low, True
            high = INCOME_BRACKETS[i + 1][1]
            return low + (half - below) / n * (high - low), False
        below += n


def get_json(url, params):
    with urllib.request.urlopen(url + "?" + urllib.parse.urlencode(params), timeout=120) as r:
        return json.load(r)


def acs(geo_for, geo_in, key, extra=()):
    """All variables used here for a geography, one request per table (the API takes up to 50 at a time)."""
    merged = {}
    requests = [[t["total"]] + [v for vs in t["groups"].values() for v in vs] for t in TABLES.values()]
    requests.append([HOUSEHOLDS, HOUSEHOLD_POP] + [v for v, _ in INCOME_BRACKETS] + list(extra))
    for table in HOUSING_TABLES.values():
        requests.append([table["total"]] + [v for vs in table["groups"].values() for v in vs])
    for variables in requests:
        header, *rows = get_json(ACS_URL, {"get": ",".join(variables), "for": geo_for, "in": geo_in, "key": key})
        for r in rows:
            row = dict(zip(header, r))
            merged.setdefault(tuple(row[k] for k in header[len(variables):]), {}).update(row)
    return list(merged.values())


def tigerweb(layer, bbox, fields):
    data = get_json(f"{TIGERWEB}/{layer}/query", {
        "geometry": ",".join(map(str, bbox)), "geometryType": "esriGeometryEnvelope", "inSR": 4326,
        "spatialRel": "esriSpatialRelIntersects", "outFields": ",".join(fields),
        "returnGeometry": "false", "f": "json",
    })
    assert not data.get("exceededTransferLimit"), f"TIGERweb layer {layer}: too many features"
    return [f["attributes"] for f in data["features"]]


def polygons(geometry):
    g = json.loads(geometry) if isinstance(geometry, str) else geometry
    return [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]


def contains(polys, x, y):
    """Point in (multi)polygon by ray casting; holes count as outside."""
    inside = False
    for poly in polys:
        for ring in poly:
            for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
                if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
                    inside = not inside
    return inside


def main():
    key = os.environ.get("CENSUS_API_KEY")
    assert key, "Set CENSUS_API_KEY (get one at https://api.census.gov/data/key_signup.html)"

    precincts = [(b["precinct"], polygons(b["geometry"])) for b in json.loads((ROOT / "data" / "precinct_boundaries.json").read_text())]
    coords = [pt for _, polys in precincts for poly in polys for ring in poly for pt in ring]
    pad = 0.002
    bbox = (min(x for x, _ in coords) - pad, min(y for _, y in coords) - pad, max(x for x, _ in coords) + pad, max(y for _, y in coords) + pad)

    # 2020 blocks near Oak Park, and the 2020 population and housing units of their block groups
    blocks = tigerweb(BLOCKS_LAYER, bbox, ["GEOID", "POP100", "HU100", "INTPTLON", "INTPTLAT"])
    bg_2020 = {g["GEOID"]: g for g in tigerweb(BLOCK_GROUPS_LAYER, bbox, ["GEOID", "POP100", "HU100"])}

    # ACS estimates for every Cook County block group
    bg_acs = {r["state"] + r["county"] + r["tract"] + r["block group"]: r for r in acs("block group:*", "state:17 county:031 tract:*", key)}

    totals = defaultdict(lambda: defaultdict(float))
    for b in blocks:
        if not (b["POP100"] or b["HU100"]):
            continue
        x, y = float(b["INTPTLON"]), float(b["INTPTLAT"])
        precinct = next((p for p, polys in precincts if contains(polys, x, y)), None)
        if precinct is None:
            continue
        bg = b["GEOID"][:12]
        est = bg_acs[bg]
        # People are split by population, households by housing units
        if b["POP100"]:
            share = b["POP100"] / bg_2020[bg]["POP100"]
            totals[precinct]["population"] += share * int(est[TOTAL])
            totals[precinct]["household_pop"] += share * int(est[HOUSEHOLD_POP])
            for table in TABLES.values():
                for group, variables in table["groups"].items():
                    totals[precinct][group] += share * sum(int(est[v]) for v in variables)
        if b["HU100"]:
            share = b["HU100"] / bg_2020[bg]["HU100"]
            for v, _ in INCOME_BRACKETS:
                totals[precinct][v] += share * int(est[v])
            for name, table in HOUSING_TABLES.items():
                totals[precinct][name] += share * int(est[table["total"]])
                for group, variables in table["groups"].items():
                    totals[precinct][group] += share * sum(int(est[v]) for v in variables)

    rows = []
    for precinct, _ in sorted(precincts):
        t = totals[precinct]
        row = {"precinct": precinct, "population": round(t["population"])}
        for group in (g for table in TABLES.values() for g in table["groups"]):
            row[group] = round(t[group])
            row[group + "_pct"] = round(t[group] / t["population"] * 100, 1) if t["population"] else 0
        brackets = [t[v] for v, _ in INCOME_BRACKETS]
        median, top_coded = median_from_brackets(brackets)
        row["households"] = round(sum(brackets))
        row["median_income"] = int(round(median, -2)) if median is not None else None
        if top_coded:
            row["median_income_top_coded"] = True
        for name, table in HOUSING_TABLES.items():
            row[name] = round(t[name])
            for group in table["groups"]:
                row[group] = round(t[group])
                row[group + "_pct"] = round(t[group] / t[name] * 100, 1) if t[name] else 0
        row["household_pop"] = round(t["household_pop"])
        row["persons_per_household"] = round(t["household_pop"] / t["type_households"], 2) if t["type_households"] else None
        rows.append(row)
    (ROOT / "data" / "demographics.json").write_text(json.dumps(rows, separators=(",", ":")))

    # Check against the village-wide ACS estimate
    village = acs(f"place:{OAK_PARK_PLACE}", "state:17", key, extra=[MEDIAN_INCOME, AVG_HOUSEHOLD_SIZE])[0]
    print(f"demographics: {len(rows)} precincts")
    checks = [("population", [TOTAL])] + [item for table in TABLES.values() for item in table["groups"].items()]
    for name, variables in checks:
        est = sum(r[name] for r in rows)
        official = sum(int(village[v]) for v in variables)
        print(f"  {name:11s} precincts {est:7,}  village ACS {official:7,}  ({(est - official) / official:+.1%})")
    housing_checks = [(name, [t["total"]]) for name, t in HOUSING_TABLES.items()] + [item for t in HOUSING_TABLES.values() for item in t["groups"].items()]
    for name, variables in [("households", [HOUSEHOLDS])] + housing_checks:
        est = sum(r[name] for r in rows)
        official = sum(int(village[v]) for v in variables)
        print(f"  {name:11s} precincts {est:7,}  village ACS {official:7,}  ({(est - official) / official:+.1%})")
    # The village median from summed precinct brackets, by the same interpolation, vs. the official median
    median, _ = median_from_brackets([sum(totals[p][v] for p, _ in precincts) for v, _ in INCOME_BRACKETS])
    official = int(village[MEDIAN_INCOME])
    print(f"  median household income: interpolated ${median:,.0f}  village ACS ${official:,}  ({(median - official) / official:+.1%})")
    size = sum(r["household_pop"] for r in rows) / sum(r["type_households"] for r in rows)
    official = float(village[AVG_HOUSEHOLD_SIZE])
    print(f"  persons per household: precincts {size:.2f}  village ACS {official:.2f}")


if __name__ == "__main__":
    main()
