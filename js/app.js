const ELECTIONS = { '2026': '2026 Democratic primary', '2025': '2025 election', '2024': '2024 Democratic primary', '2023': '2023 election', composite: 'Progressive–conservative lean' };

const RACES = [
  { id: 'senate_2026', year: '2026', tab: 'U.S. Senate', office: 'U.S. senator', noun: 'U.S. Senate', date: 'March 17, 2026 Democratic primary', voteFor: 1, map: true, scope: 'Oak Park precincts only' },
  { id: 'comptroller_2026', year: '2026', tab: 'Comptroller', office: 'Illinois comptroller', noun: 'comptroller', date: 'March 17, 2026 Democratic primary', voteFor: 1, map: true, scope: 'Oak Park precincts only' },
  { id: 'congress7_2026', year: '2026', tab: '7th Congressional', office: 'U.S. representative, 7th District', noun: 'U.S. representative', date: 'March 17, 2026 Democratic primary', voteFor: 1, map: true, scope: 'Oak Park precincts only' },
  { id: 'staterep8_2026', year: '2026', tab: '8th State House', office: 'Illinois state representative, 8th District', noun: 'state representative', date: 'March 17, 2026 Democratic primary', voteFor: 1, map: true, scope: 'Oak Park precincts only' },
  { id: 'countypres_2026', year: '2026', tab: 'County Board President', office: 'Cook County Board president', noun: 'County Board president', date: 'March 17, 2026 Democratic primary', voteFor: 1, map: true, scope: 'Oak Park precincts only' },
  { id: 'assessor_2026', year: '2026', tab: 'County Assessor', office: 'Cook County assessor', noun: 'assessor', date: 'March 17, 2026 Democratic primary', voteFor: 1, map: true, scope: 'Oak Park precincts only' },
  { id: 'statecentral_2026', year: '2026', tab: 'State Central Committee', office: 'Democratic State Central Committeeperson, 7th District', noun: 'State Central Committee', date: 'March 17, 2026 Democratic primary', voteFor: 2, map: true, scope: 'Oak Park precincts only' },
  { id: 'trustee_2025', year: '2025', tab: 'Trustee', office: 'Village of Oak Park trustee', noun: 'trustee', date: 'April 1, 2025 consolidated election', voteFor: 3, map: true },
  { id: 'president_2025', year: '2025', tab: 'Village President', office: 'Village of Oak Park president', noun: 'village president', date: 'April 1, 2025 consolidated election', voteFor: 1, map: true },
  { id: 'library_2025', year: '2025', tab: 'Library Board', office: 'Oak Park Public Library trustee', noun: 'library trustee', date: 'April 1, 2025 consolidated election', voteFor: 4, map: true },
  { id: 'd97_2025', year: '2025', tab: 'District 97', office: 'Oak Park Elementary School District 97 board', noun: 'District 97 board', date: 'April 1, 2025 consolidated election', voteFor: 3, map: true },
  { id: 'd200_2025', year: '2025', tab: 'District 200', office: 'Oak Park and River Forest High School District 200 board', noun: 'District 200 board', date: 'April 1, 2025 consolidated election', voteFor: 4, map: true, scope: 'Oak Park precincts only; the district also includes River Forest' },
  { id: 'triton_2025', year: '2025', tab: 'Triton College', office: 'Triton College trustee', noun: 'Triton College trustee', date: 'April 1, 2025 consolidated election', voteFor: 3, map: true, scope: 'Oak Park precincts only; the college district covers much of western Cook County' },
  { id: 'congress7_2024', year: '2024', tab: '7th Congressional', office: 'U.S. representative, 7th District', noun: 'U.S. representative', date: 'March 19, 2024 Democratic primary', voteFor: 1, map: true, scope: 'Oak Park precincts only' },
  { id: 'statesattorney_2024', year: '2024', tab: 'State’s Attorney', office: 'Cook County state’s attorney', noun: 'state’s attorney', date: 'March 19, 2024 Democratic primary', voteFor: 1, map: true, scope: 'Oak Park precincts only' },
  { id: 'circuitclerk_2024', year: '2024', tab: 'Circuit Court Clerk', office: 'Clerk of the Circuit Court of Cook County', noun: 'circuit court clerk', date: 'March 19, 2024 Democratic primary', voteFor: 1, map: true, scope: 'Oak Park precincts only' },
  { id: 'boardofreview_2024', year: '2024', tab: 'Board of Review', office: 'Cook County Board of Review, 3rd District', noun: 'Board of Review', date: 'March 19, 2024 Democratic primary', voteFor: 1, map: true, scope: 'Oak Park precincts only' },
  { id: 'countyboard1_2024', year: '2024', tab: 'County Board 1st District', office: 'Cook County Board commissioner, 1st District (2-year term)', noun: 'County Board commissioner', date: 'March 19, 2024 Democratic primary', voteFor: 1, map: true, scope: 'Oak Park precincts only' },
  { id: 'trustee_2023', year: '2023', tab: 'Trustee', office: 'Village of Oak Park trustee', noun: 'trustee', date: 'April 4, 2023 consolidated election', voteFor: 3, map: true, join: 'precinct_2023' },
  { id: 'lean', year: 'composite', tab: 'Composite index', composite: true },
  { id: 'd200_2023', year: '2023', tab: 'District 200', office: 'Oak Park and River Forest High School District 200 board', noun: 'District 200 board', date: 'April 4, 2023 consolidated election', voteFor: 3, map: true, join: 'precinct_2023', scope: 'Oak Park precincts only; the district also includes River Forest' },
];

RACES.filter((r) => !r.composite).forEach((race) => {
  dash.calc('totals_' + race.id, {
    inputs: [race.id],
    title: race.year + ' ' + race.tab + ' totals',
    description: 'Each candidate’s votes summed over all precincts, and their share of all votes cast in the race.',
    fn: (results) => {
      const fixed = new Set(['precinct', 'registered_voters', 'ballots_cast', 'turnout_pct', 'total_votes', 'top_candidate']);
      const names = Object.keys(results[0] || {}).filter((k) => !fixed.has(k));
      const all = results.reduce((s, r) => s + Number(r.total_votes), 0);
      return names.map((candidate) => {
        const votes = results.reduce((s, r) => s + Number(r[candidate]), 0);
        return { candidate, votes, share: votes / all };
      }).sort((a, b) => b.votes - a.votes);
    },
  });
  dash.calc('leaders_' + race.id, {
    inputs: [race.id],
    title: race.year + ' ' + race.tab + ' precincts led',
    description: 'How many precincts each candidate got the most votes in (ties counted separately).',
    fn: (results) => {
      const n = {};
      results.forEach((r) => { n[r.top_candidate] = (n[r.top_candidate] || 0) + 1; });
      return Object.entries(n).map(([candidate, precincts_led]) => ({ candidate, precincts_led })).sort((a, b) => b.precincts_led - a.precincts_led);
    },
  });
  dash.calc('overall_' + race.id, {
    inputs: [race.id],
    title: race.year + ' ' + race.tab + ' turnout',
    description: 'Ballots cast over registered voters, summed over all precincts.',
    fn: (results) => {
      const registered = results.reduce((s, r) => s + Number(r.registered_voters), 0);
      const ballots_cast = results.reduce((s, r) => s + Number(r.ballots_cast), 0);
      return [{ registered, ballots_cast, turnout: ballots_cast / registered }];
    },
  });
});

window.opx = { sortKey: 'precinct', sortDir: 1, drawnOnce: false };
const fmt = d3.format(',');
const pct = d3.format('.1%');
const root = document.querySelector('.opx');
const resolve = (c) => { const el = document.createElement('span'); el.style.color = c; root.appendChild(el); const v = getComputedStyle(el).color; el.remove(); return v; };
// Distinct colors for the top 7 vote-getters; anyone further down is gray
const candColor = (i) => dash.colors[Math.min(i, dash.colors.length - 1)];
const SHORT_NAMES = { 'La Shawn K. Ford': 'Ford' };
const lastName = (n) => SHORT_NAMES[n] || n.replace(/\s*"[^"]*"/g, '').replace(/\s+[A-Z]\.?(?=\s)/g, '').split(' ').slice(1).join(' ') || n;
const geomOf = (g) => (typeof g === 'string' ? JSON.parse(g) : g);
const polysOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
const currentRace = () => RACES.find((r) => r.id === dash.params().race) || RACES[0];
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

// Election year tabs, then a tab for each race in the selected year
const yearsEl = document.getElementById('years');
const racesEl = document.getElementById('races');
const kindOf = (r) => r.id.replace(/_\d{4}$/, '');
const selectRace = (r) => { window.opx.sortKey = 'precinct'; window.opx.sortDir = 1; dash.setParams({ race: r.id, view: 'leader' }); dash.setLink('summary'); };
[...new Set(RACES.map((r) => r.year))].sort().forEach((year) => {
  const b = mk('button', '', ELECTIONS[year] || year + ' election'); b.type = 'button'; b.dataset.year = year;
  b.addEventListener('click', () => {
    const cur = currentRace();
    if (cur.year === year) return;
    // Stay on the same office if it was on the ballot that year
    selectRace(RACES.find((r) => r.year === year && kindOf(r) === kindOf(cur)) || RACES.find((r) => r.year === year));
  });
  yearsEl.appendChild(b);
});
RACES.forEach((r) => {
  const b = mk('button', '', r.tab); b.type = 'button'; b.dataset.race = r.id; b.dataset.year = r.year;
  b.addEventListener('click', () => selectRace(r));
  racesEl.appendChild(b);
});

function candidatesFor(race) {
  const t = dash.data('totals_' + race.id);
  return t.status === 'ok' ? t.data.map((r, i) => ({ name: r.candidate, i })) : [];
}

function drawNav(race) {
  yearsEl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.year === race.year)));
  racesEl.querySelectorAll('button').forEach((b) => { b.hidden = b.dataset.year !== race.year; b.setAttribute('aria-pressed', String(b.dataset.race === race.id)); });
  // When the row scrolls sideways (narrow screens), keep the selected race in view
  const sel = racesEl.querySelector('[aria-pressed="true"]');
  const left = sel.offsetLeft - racesEl.offsetLeft;
  if (left < racesEl.scrollLeft || left + sel.offsetWidth > racesEl.scrollLeft + racesEl.clientWidth) racesEl.scrollLeft = left - 16;
}

function drawHeader(race) {
  document.getElementById('ov').hidden = false;
  document.getElementById('race-title').textContent = race.year + ' ' + race.tab + ' results by precinct';
  document.getElementById('race-sub').textContent = race.date + ' · ' + race.office + ', vote for ' + race.voteFor + (race.scope ? ' · ' + race.scope : '');
  const o = dash.data('overall_' + race.id);
  const b = document.getElementById('ov-ballots'), t = document.getElementById('ov-turnout');
  [b, t].forEach((el) => { el.dataset.source = 'overall_' + race.id; el.dataset.field = el === b ? 'ballots_cast' : 'turnout'; });
  if (o.status === 'ok') {
    b.classList.remove('dash-skeleton'); t.classList.remove('dash-skeleton');
    b.textContent = fmt(o.data[0].ballots_cast); t.textContent = pct(o.data[0].turnout);
  } else { b.textContent = '—'; t.textContent = '—'; }

  const el = document.getElementById('takeaway');
  const l = dash.data('leaders_' + race.id);
  if (l.status !== 'ok') return;
  el.replaceChildren();
  const total = l.data.reduce((s, r) => s + r.precincts_led, 0);
  const num = (r) => { const s = mk('span', '', fmt(r.precincts_led)); s.dataset.source = 'leaders_' + race.id; s.dataset.field = 'precincts_led'; s.dataset.where = 'candidate=' + r.candidate.replace(/%/g, '%25').replace(/&/g, '%26').replace(/=/g, '%3D'); return s; };
  const winners = l.data.filter((r) => !r.candidate.startsWith('Tie'));
  const ties = l.data.filter((r) => r.candidate.startsWith('Tie'));
  const [first, ...rest] = winners;
  if (!first) return;
  el.append(first.candidate + ' got the most votes in ', num(first), ' of ' + total + ' precincts');
  rest.forEach((r, i) => { el.append((i === 0 ? '; ' : i === rest.length - 1 ? ' and ' : ', ') + r.candidate + ' led in ', num(r)); });
  ties.forEach((r) => { el.append('; ', num(r), ' ' + (r.precincts_led === 1 ? 'precinct was a tie' : 'precincts were ties') + ' between ' + r.candidate.replace('Tie: ', '').replace(' & ', ' and ')); });
  el.append('.');
}

function drawTiles(race) {
  const box = document.getElementById('totals');
  box.replaceChildren();
  const t = dash.data('totals_' + race.id);
  if (t.status !== 'ok') { for (let i = 0; i < 3; i++) { const d = mk('div', 'opx-tile'); d.append(mk('div', 'opx-tile-num dash-skeleton', '—')); box.appendChild(d); } return; }
  const src = 'totals_' + race.id;
  t.data.forEach((r, i) => {
    const d = mk('div', 'opx-tile');
    const n = mk('div', 'opx-tile-name'); const sw = mk('i', 'opx-sw'); sw.style.background = candColor(i); n.append(sw, r.candidate);
    const where = 'candidate=' + r.candidate;
    const v = mk('div', 'opx-tile-num', fmt(r.votes)); v.dataset.source = src; v.dataset.field = 'votes'; v.dataset.where = where;
    const s = mk('div', 'opx-tile-share', pct(r.share) + ' of votes'); s.dataset.source = src; s.dataset.field = 'share'; s.dataset.where = where;
    d.append(n, v, s); box.appendChild(d);
  });
}

const viewsEl = document.querySelector('.opx-views');
function drawMap(race, cands) {
  const box = document.querySelector('.opx-mapbox');
  const tip = box.querySelector('.opx-tip');
  const legend = document.getElementById('map-legend');
  box.querySelectorAll('svg, .opx-fail, .opx-nomap').forEach((n) => n.remove());
  legend.replaceChildren(); viewsEl.replaceChildren(); tip.hidden = true;

  if (!race.map) {
    box.removeAttribute('data-source'); box.classList.remove('dash-skeleton'); box.style.minHeight = '0';
    document.getElementById('map-title').textContent = 'Precinct map';
    document.getElementById('map-note').textContent = '';
    box.appendChild(mk('div', 'opx-nomap', 'Oak Park’s precinct lines were redrawn after 2023 (the 2023 precincts were numbered 1–35, with 7, 21 and 30 unused), so these results can’t be drawn on the current precinct map. The table below has every 2023 precinct.'));
    return;
  }
  box.dataset.source = 'boundaries ' + race.id;
  const d = dash.data(race.id), bd = dash.data('boundaries');
  if (d.status !== 'ok' || bd.status !== 'ok' || !cands.length) {
    if (d.status === 'error' || bd.status === 'error') { box.classList.remove('dash-skeleton'); box.appendChild(mk('div', 'opx-fail', 'Failed to load')); }
    else box.classList.add('dash-skeleton');
    return;
  }
  box.classList.remove('dash-skeleton');
  const byP = new Map(d.data.map((r) => [String(r.precinct), r]));
  const view = cands.some((c) => c.name === dash.params().view) ? dash.params().view : 'leader';
  const vc = cands.find((c) => c.name === view);

  [{ id: 'leader', label: race.voteFor === 1 ? 'Winner by precinct' : 'Leading candidate' }].concat(cands.map((c) => ({ id: c.name, label: c.name, i: c.i }))).forEach((v) => {
    const b = mk('button'); b.type = 'button'; b.setAttribute('aria-pressed', String(v.id === view));
    if (v.i !== undefined) { const sw = mk('i', 'opx-sw'); sw.style.background = candColor(v.i); b.appendChild(sw); }
    b.append(v.label);
    b.addEventListener('click', () => dash.setParams({ view: v.id }));
    viewsEl.appendChild(b);
  });

  document.getElementById('map-title').textContent = vc ? vc.name + '’s share of votes by precinct' : (race.voteFor === 1 ? 'Winner in each precinct' : 'Leading candidate in each precinct');
  document.getElementById('map-note').textContent = vc
    ? (race.voteFor === 1 ? 'Share of votes cast for ' + race.noun + ' in each precinct.' : 'Share of all ' + race.noun + ' votes cast in each precinct (each voter could pick up to ' + race.voteFor + ').') + ' Hover a precinct for its full results.'
    : 'Colored by the candidate with the most votes. Darker shading means a wider lead over second place; gray means a tie. Hover a precinct for its full results.';
  if (race.join) document.getElementById('map-note').textContent += ' Labels use 2023 precinct numbers; the lines are the same as today, renumbered in 2024.';
  if (d.data.length < bd.data.length) document.getElementById('map-note').textContent += ' Only ' + d.data.length + ' Oak Park precincts are in this district; the rest are left blank.';

  const ranked = (r) => cands.map((c) => ({ ...c, votes: Number(r[c.name]), share: Number(r[c.name]) / Number(r.total_votes) })).sort((a, b) => b.votes - a.votes);
  const jk = race.join || 'precinct';
  const shapes = bd.data.map((b) => ({ key: String(b[jk]), r: byP.get(String(b[jk])), polys: polysOf(geomOf(b.geometry)) }));
  const inShapes = shapes.filter((sh) => sh.r);
  const bg = resolve('var(--color-bg)');
  const colors = cands.map((c) => resolve(candColor(c.i)));
  let fillOf, ext;
  if (vc) {
    ext = d3.extent(inShapes, (sh) => Number(sh.r[vc.name]) / Number(sh.r.total_votes));
    const lo = d3.interpolateRgb(bg, colors[vc.i])(0.12);
    const ramp = d3.interpolateRgb(lo, colors[vc.i]);
    fillOf = (r) => ramp((Number(r[vc.name]) / Number(r.total_votes) - ext[0]) / ((ext[1] - ext[0]) || 1));
  } else {
    const margin = (r) => { const x = ranked(r); return (x[0].votes - x[1].votes) / Number(r.total_votes); };
    ext = d3.extent(inShapes, (sh) => margin(sh.r));
    fillOf = (r) => { const x = ranked(r); if (x[0].votes === x[1].votes) return resolve('var(--color-border-line)'); const t = 0.35 + 0.65 * ((margin(r) - ext[0]) / ((ext[1] - ext[0]) || 1)); return d3.interpolateRgb(bg, colors[x[0].i])(t); };
  }
  drawPrecincts(box, shapes, fillOf, showTip);

  function showTip(event, r) {
    tip.replaceChildren();
    tip.appendChild(mk('div', 'opx-tip-h', 'Precinct ' + r.precinct + ' · ' + fmt(Number(r.ballots_cast)) + ' ballots · ' + d3.format('.1f')(Number(r.turnout_pct)) + '% turnout'));
    const grid = mk('div', 'opx-tip-r');
    ranked(r).forEach((c) => {
      const sw = mk('i', 'opx-sw'); sw.style.background = candColor(c.i);
      const n = mk('span', '', c.name), v = mk('span', 'v', fmt(c.votes)), q = mk('span', 'p', pct(c.share));
      if (vc && c.name === vc.name) { n.style.fontWeight = '600'; v.style.fontWeight = '600'; }
      grid.append(sw, n, v, q);
    });
    tip.appendChild(grid);
    placeTip(box, tip, event, String(r.precinct));
  }

  if (vc) {
    const w = mk('span'); const ramp = mk('i', 'opx-ramp');
    ramp.style.background = `linear-gradient(90deg, ${d3.interpolateRgb(bg, colors[vc.i])(0.12)}, ${colors[vc.i]})`;
    w.append(pct(ext[0]), ramp, pct(ext[1])); legend.appendChild(w);
  } else {
    const led = new Set(inShapes.map((sh) => ranked(sh.r)[0].name));
    cands.forEach((c) => { if (!led.has(c.name)) return; const sp = mk('span'); const sw = mk('i', 'opx-sw'); sw.style.background = colors[c.i]; sp.append(sw, c.name); legend.appendChild(sp); });
    if (led.size < cands.length) legend.appendChild(mk('span', '', 'Others led no precincts'));
  }
}

// Draw the precinct map into box. shapes: [{ key, r, polys }]; precincts without r are left blank.
function drawPrecincts(box, shapes, fillOf, showTip) {
  const tip = box.querySelector('.opx-tip');
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  shapes.forEach((s) => s.polys.forEach((poly) => poly.forEach((ring) => ring.forEach(([x, y]) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }))));
  const k = Math.cos(((minY + maxY) / 2) * Math.PI / 180);
  const W = Math.max(280, box.clientWidth), pad = 8;
  const maxH = Math.max(420, Math.min(760, window.innerHeight * 0.85));
  const s = Math.min((W - 2 * pad) / ((maxX - minX) * k), (maxH - 2 * pad) / (maxY - minY));
  const H = (maxY - minY) * s + 2 * pad;
  const ox = (W - (maxX - minX) * k * s) / 2;
  const P = ([x, y]) => [ox + (x - minX) * k * s, pad + (maxY - y) * s];
  box.style.minHeight = H + 'px';

  const bg = resolve('var(--color-bg)'), fg = resolve('var(--color-fg)');
  const outside = resolve('var(--color-panel)'), edge = resolve('var(--color-border-line)'), muted = resolve('var(--color-fg-muted)');
  const svg = d3.select(box).insert('svg', '.opx-tip').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Map of Oak Park precincts');
  if (!window.opx.drawnOnce) { svg.classed('opx-in', true); window.opx.drawnOnce = true; }
  shapes.forEach((sh) => {
    let path = '', bestA = 0, best = null;
    sh.polys.forEach((poly) => {
      poly.forEach((ring) => { path += 'M' + ring.map((pt) => P(pt).map((v) => v.toFixed(1)).join(',')).join('L') + 'Z'; });
      const o = poly[0].map(P); let a = 0, cx = 0, cy = 0;
      for (let i = 0, j = o.length - 1; i < o.length; j = i++) { const f = o[j][0] * o[i][1] - o[i][0] * o[j][1]; a += f; cx += (o[j][0] + o[i][0]) * f; cy += (o[j][1] + o[i][1]) * f; }
      if (Math.abs(a) > bestA) { bestA = Math.abs(a); best = [cx / (3 * a), cy / (3 * a)]; }
    });
    sh.path = path; sh.c = best;
  });
  svg.append('g').selectAll('path').data(shapes).join('path')
    .attr('class', 'opx-pct').attr('d', (sh) => sh.path).attr('fill-rule', 'evenodd')
    .attr('fill', (sh) => (sh.r ? fillOf(sh.r) : outside)).attr('stroke', (sh) => (sh.r ? bg : edge)).attr('stroke-width', 1.2)
    .style('pointer-events', (sh) => (sh.r ? null : 'none'))
    .on('mouseenter', (event) => { d3.select(event.currentTarget).raise().attr('stroke', fg).attr('stroke-width', 2); })
    .on('mousemove', (event, sh) => showTip(event, sh.r))
    .on('mouseleave', (event) => { d3.select(event.currentTarget).attr('stroke', bg).attr('stroke-width', 1.2); tip.hidden = true; highlight(null); });
  const fs = Math.max(9, Math.min(12, W / 60));
  svg.append('g').attr('pointer-events', 'none').selectAll('text').data(shapes.filter((sh) => sh.c)).join('text')
    .attr('x', (sh) => sh.c[0]).attr('y', (sh) => sh.c[1]).attr('dy', '0.35em').attr('text-anchor', 'middle')
    .attr('font-size', fs).attr('font-family', 'var(--font-anthropic-sans)')
    .attr('fill', (sh) => (sh.r ? fg : muted)).attr('stroke', bg).attr('stroke-width', 2.5).attr('paint-order', 'stroke').attr('stroke-linejoin', 'round')
    .text((sh) => sh.key);
}

function placeTip(box, tip, event, key) {
  tip.hidden = false;
  const br = box.getBoundingClientRect();
  let x = event.clientX - br.left + 14, y = event.clientY - br.top + 14;
  if (x + tip.offsetWidth > br.width) x = Math.max(0, event.clientX - br.left - tip.offsetWidth - 14);
  if (y + tip.offsetHeight > br.height) y = Math.max(0, event.clientY - br.top - tip.offsetHeight - 14);
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
  highlight(key);
}

function highlight(key) { document.querySelectorAll('.opx-table tbody tr').forEach((tr) => tr.classList.toggle('hl', tr.dataset.key === key)); }

// Build sortable column headings; returns a function that sorts rows by the current column
function tableHeader(head, cols, redraw) {
  // A link or back button can switch races without resetting the sort
  if (!cols.some((c) => c.k === window.opx.sortKey)) { window.opx.sortKey = 'precinct'; window.opx.sortDir = 1; }
  const { sortKey, sortDir } = window.opx;
  cols.forEach((c) => {
    const th = mk('th'); th.dataset.field = c.k;
    th.setAttribute('aria-sort', c.k === sortKey ? (sortDir > 0 ? 'ascending' : 'descending') : 'none');
    const b = mk('button', '', c.label); b.type = 'button';
    b.addEventListener('click', () => {
      if (window.opx.sortKey === c.k) window.opx.sortDir *= -1;
      else { window.opx.sortKey = c.k; window.opx.sortDir = (c.k === 'precinct' || c.k === 'top_candidate') ? 1 : -1; }
      redraw();
    });
    th.appendChild(b); head.appendChild(th);
  });
  return (rows) => rows.slice().sort((a, b) => {
    const x = a[sortKey], y = b[sortKey], nx = Number(x), ny = Number(y);
    return (!isNaN(nx) && !isNaN(ny) ? nx - ny : String(x).localeCompare(String(y))) * sortDir;
  });
}

function drawTable(race, cands) {
  document.getElementById('table-title').textContent = 'Votes by precinct';
  document.getElementById('table-note').textContent = 'Select a column heading to sort. Bold marks the precinct’s top vote-getter.';
  const table = document.querySelector('.opx-table');
  table.dataset.source = race.id;
  const head = table.querySelector('thead tr'), tb = table.querySelector('tbody');
  head.replaceChildren(); tb.replaceChildren();
  const cols = [{ k: 'precinct', label: 'Precinct' }, { k: 'ballots_cast', label: 'Ballots' }, { k: 'turnout_pct', label: 'Turnout %' }]
    .concat(cands.map((c) => ({ k: c.name, label: lastName(c.name), cand: true }))).concat([{ k: 'top_candidate', label: 'Top vote-getter' }]);
  const sortRows = tableHeader(head, cols, () => drawTable(race, cands));
  const d = dash.data(race.id);
  if (d.status !== 'ok' || !cands.length) return;
  const rows = sortRows(d.data);
  rows.forEach((r) => {
    const tr = mk('tr'); tr.dataset.key = String(r.precinct);
    const top = Math.max(...cands.map((c) => Number(r[c.name])));
    cols.forEach((c) => {
      const v = r[c.k];
      const text = c.k === 'precinct' || c.k === 'top_candidate' ? String(v) : c.k === 'turnout_pct' ? d3.format('.1f')(Number(v)) : fmt(Number(v));
      const td = mk('td', c.cand && Number(v) === top ? 'win' : '', text);
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
}

// Composite progressive–conservative lean (computed by scripts/extract_results.py)
const signed = (f) => { const g = d3.format(f); return (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + g(Math.abs(v)); };
const fmtIndex = signed('.2f'), fmtPts = signed('.1f');
const LEAN_PROG = 'var(--c1)', LEAN_CONS = 'var(--c2)';
const shortName = (n) => (SHORT_NAMES[n] || n.replace(/\s*"[^"]*"/g, '').replace(/,? (Jr\.|Sr\.|II|III|IV)$/, '').split(' ').pop());
function leanRaces() {
  const d = dash.data('lean_races');
  return d.status === 'ok' ? d.data.map((l) => { const r = RACES.find((x) => x.id === l.race); return { ...l, label: r.tab + ' ’' + r.year.slice(2), title: r.year + ' ' + r.tab }; }) : [];
}
// Diverging fill: conservative color below 0, progressive above, scaled to the largest value either way
function leanFill(maxAbs) {
  const mid = resolve('var(--color-panel)'), prog = resolve(LEAN_PROG), cons = resolve(LEAN_CONS);
  return (v) => d3.interpolateRgb(mid, v >= 0 ? prog : cons)(Math.min(1, Math.abs(v) / maxAbs));
}

function drawLean(race) {
  const d = dash.data('lean'), lr = leanRaces();
  const rows = d.status === 'ok' ? d.data : [];
  const names = (l) => [l.progressive.length ? 'progressive ' + l.progressive.map(shortName).join(', ') : '', l.conservative.length ? 'conservative ' + l.conservative.map(shortName).join(', ') : ''].filter(Boolean).join('; ');

  // Header
  document.getElementById('ov').hidden = true;
  document.getElementById('race-title').textContent = 'Progressive–conservative lean by precinct';
  document.getElementById('race-sub').textContent = 'Composite of ' + lr.length + ' races, 2023–2026 · compared with the average Oak Park precinct';
  const byIndex = rows.slice().sort((a, b) => b.index - a.index);
  const take = document.getElementById('takeaway');
  take.replaceChildren();
  if (byIndex.length) {
    const nProg = rows.filter((r) => r.index > 0).length;
    take.textContent = 'Precinct ' + byIndex[0].precinct + ' leans the most progressive and precinct ' + byIndex[byIndex.length - 1].precinct + ' the most conservative; ' + nProg + ' of ' + rows.length + ' precincts lean more progressive than the average precinct.';
  }

  // Tiles: the ends of the scale, and what goes into it
  const box = document.getElementById('totals');
  box.replaceChildren();
  const tile = (color, name, num, sub) => { const t = mk('div', 'opx-tile'); const n = mk('div', 'opx-tile-name'); if (color) { const sw = mk('i', 'opx-sw'); sw.style.background = color; n.append(sw); } n.append(name); t.append(n, mk('div', 'opx-tile-num', num), mk('div', 'opx-tile-share', sub)); box.appendChild(t); };
  const top3 = byIndex.slice(0, 3), bot3 = byIndex.slice(-3).reverse();
  tile(LEAN_PROG, 'Most progressive precincts', top3.map((r) => r.precinct).join(', '), 'Index ' + top3.map((r) => fmtIndex(r.index)).join(', '));
  tile(LEAN_CONS, 'Most conservative precincts', bot3.map((r) => r.precinct).join(', '), 'Index ' + bot3.map((r) => fmtIndex(r.index)).join(', '));
  tile(null, 'Races in the index', String(lr.length), '2023 to 2026, weighted equally');

  // Map: the composite index, or one race's lean
  const mapBox = document.querySelector('.opx-mapbox'), tip = mapBox.querySelector('.opx-tip'), legend = document.getElementById('map-legend');
  mapBox.querySelectorAll('svg, .opx-fail, .opx-nomap').forEach((n) => n.remove());
  legend.replaceChildren(); viewsEl.replaceChildren(); tip.hidden = true;
  const bd = dash.data('boundaries');
  if (!rows.length || bd.status !== 'ok') { mapBox.classList.add('dash-skeleton'); return; }
  mapBox.classList.remove('dash-skeleton'); mapBox.dataset.source = 'boundaries lean';
  const vr = lr.find((l) => l.race === dash.params().view);
  [{ id: 'leader', label: 'Composite index' }].concat(lr.map((l) => ({ id: l.race, label: l.label }))).forEach((v) => {
    const b = mk('button', '', v.label); b.type = 'button'; b.setAttribute('aria-pressed', String(vr ? v.id === vr.race : v.id === 'leader'));
    b.addEventListener('click', () => dash.setParams({ view: v.id }));
    viewsEl.appendChild(b);
  });
  const key = vr ? vr.race : 'index';
  const fmtV = vr ? fmtPts : fmtIndex;
  document.getElementById('map-title').textContent = vr ? vr.title + ': lean by precinct' : 'Composite lean in each precinct';
  document.getElementById('map-note').textContent = vr
    ? 'The progressive candidates’ share of the vote minus the conservative candidates’ share (' + names(vr) + '), in points above or below the average precinct. Hover a precinct for its full breakdown.'
    : 'Blue precincts vote more progressive than the average Oak Park precinct and orange ones more conservative. For each race, the progressive candidates’ share minus the conservative candidates’ share is compared with the average precinct and scaled so every race counts equally; the index averages the ' + lr.length + ' races. Hover a precinct for its full breakdown.';
  const maxAbs = d3.max(rows, (r) => Math.abs(r[key])) || 1;
  const fill = leanFill(maxAbs);
  const byP = new Map(rows.map((r) => [String(r.precinct), r]));
  const shapes = bd.data.map((b) => ({ key: String(b.precinct), r: byP.get(String(b.precinct)), polys: polysOf(geomOf(b.geometry)) }));
  drawPrecincts(mapBox, shapes, (r) => fill(r[key]), (event, r) => {
    tip.replaceChildren();
    tip.appendChild(mk('div', 'opx-tip-h', 'Precinct ' + r.precinct + ' · index ' + fmtIndex(r.index)));
    const grid = mk('div', 'opx-tip-r');
    lr.forEach((l) => {
      const sw = mk('i', 'opx-sw'); sw.style.background = r[l.race] >= 0 ? LEAN_PROG : LEAN_CONS;
      const n = mk('span', '', l.title), v = mk('span', 'v', fmtPts(r[l.race])), q = mk('span', 'p', 'pts');
      if (vr && l.race === vr.race) { n.style.fontWeight = '600'; v.style.fontWeight = '600'; }
      grid.append(sw, n, v, q);
    });
    tip.appendChild(grid);
    placeTip(mapBox, tip, event, String(r.precinct));
  });
  const w = mk('span'); const ramp = mk('i', 'opx-ramp');
  ramp.style.background = `linear-gradient(90deg, ${fill(-maxAbs)}, ${fill(0)}, ${fill(maxAbs)})`;
  w.append('More conservative ' + fmtV(-maxAbs), ramp, fmtV(maxAbs) + ' More progressive'); legend.appendChild(w);

  // Table
  document.getElementById('table-title').textContent = 'Lean by precinct';
  document.getElementById('table-note').textContent = 'Index, then each race’s lean in points above (+) or below (−) the average precinct. Select a column heading to sort.';
  const table = document.querySelector('.opx-table');
  table.dataset.source = 'lean';
  const head = table.querySelector('thead tr'), tb = table.querySelector('tbody');
  head.replaceChildren(); tb.replaceChildren();
  const cols = [{ k: 'precinct', label: 'Precinct' }, { k: 'index', label: 'Index' }].concat(lr.map((l) => ({ k: l.race, label: l.label })));
  const sortRows = tableHeader(head, cols, () => drawLean(race));
  sortRows(rows).forEach((r) => {
    const tr = mk('tr'); tr.dataset.key = String(r.precinct);
    cols.forEach((c) => {
      const td = mk('td', c.k === 'index' ? 'win' : '', c.k === 'precinct' ? String(r.precinct) : c.k === 'index' ? fmtIndex(r.index) : fmtPts(r[c.k]));
      if (c.k !== 'precinct') td.style.color = r[c.k] > 0 ? 'var(--lean-prog-text)' : r[c.k] < 0 ? 'var(--lean-cons-text)' : '';
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
}

dash.onData(() => {
  const race = currentRace();
  drawNav(race);
  if (race.composite) { drawLean(race); return; }
  const cands = candidatesFor(race);
  drawHeader(race);
  drawTiles(race);
  drawMap(race, cands);
  drawTable(race, cands);
});
