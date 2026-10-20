# Oak Park election results by precinct

An interactive map and table of precinct-level results for three Village of Oak Park races:

- 2025 trustee (April 1, 2025 consolidated election)
- 2025 village president (April 1, 2025 consolidated election)
- 2023 trustee (April 4, 2023 consolidated election)

## Viewing it

`index.html` is a static page with no build step or internet connection needed. Open it directly in a browser, or publish it with GitHub Pages.

- `css/style.css`: page styles
- `js/d3.v7.9.0.min.js`: the D3 charting library (bundled locally)
- `js/data.js`: the results and precinct boundaries the page draws from
- `js/dash.js`: small runtime that serves the data and tracks the selected race and map view
- `js/app.js`: builds the race tabs, totals, map and table

## Publishing on GitHub Pages

1. Create a new public repository on GitHub.
2. Upload everything in this folder (keep `index.html` at the top level).
3. In the repository, go to **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to "Deploy from a branch", pick the `main` branch and the `/ (root)` folder, and save.
5. After a minute or two the site will be live at `https://<your-username>.github.io/<repository-name>/`.

## Data

The `data` folder holds the same data the page uses, for reuse elsewhere. The page does not read these files.

- `trustee_2025.json`, `president_2025.json`, `trustee_2023.json`: one row per precinct with registered voters, ballots cast, turnout, each candidate's votes, total votes and the top vote-getter.
- `precinct_boundaries.json`: the 32 current Oak Park precinct boundaries, with each precinct's current number and its 2023 number.
- `oak-park-2025-trustee-results.geojson`: 2025 trustee results joined to the precinct boundaries, for GIS tools.

## Sources and notes

- Results: Cook County Clerk precinct results spreadsheets for each race.
- Boundaries: Cook County suburban election precincts map.
- The 2023 election used the same precinct lines as today, under different numbers; precincts were renumbered 1–32 in 2024. 2023 precinct 33 is today's 30, 34 is today's 21, and 35 is today's 7; the rest kept their numbers.
- Trustee races were vote-for-3, so a candidate's percentage is their share of all trustee votes cast, not of voters.
