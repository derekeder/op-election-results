const RACES = [
  { id: 'trustee_2025', tab: '2025 Trustee', office: 'Village of Oak Park trustee', date: 'April 1, 2025 consolidated election', voteFor: 3, map: true },
  { id: 'president_2025', tab: '2025 Village President', office: 'Village of Oak Park president', date: 'April 1, 2025 consolidated election', voteFor: 1, map: true },
  { id: 'trustee_2023', tab: '2023 Trustee', office: 'Village of Oak Park trustee', date: 'April 4, 2023 consolidated election', voteFor: 3, map: true, join: 'precinct_2023' },
];

RACES.forEach((race) => {
  dash.calc('totals_' + race.id, {
    inputs: [race.id],
    title: race.tab + ' totals',
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
    title: race.tab + ' precincts led',
    description: 'How many precincts each candidate got the most votes in (ties counted separately).',
    fn: (results) => {
      const n = {};
      results.forEach((r) => { n[r.top_candidate] = (n[r.top_candidate] || 0) + 1; });
      return Object.entries(n).map(([candidate, precincts_led]) => ({ candidate, precincts_led })).sort((a, b) => b.precincts_led - a.precincts_led);
    },
  });
  dash.calc('overall_' + race.id, {
    inputs: [race.id],
    title: race.tab + ' turnout',
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
const candColor = (i) => dash.colors[i % dash.colors.length];
const lastName = (n) => n.replace(/\s+[A-Z]\.\s+/, ' ').split(' ').slice(1).join(' ') || n;
const geomOf = (g) => (typeof g === 'string' ? JSON.parse(g) : g);
const polysOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
const currentRace = () => RACES.find((r) => r.id === dash.params().race) || RACES[0];
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

// Race tabs
const racesEl = document.getElementById('races');
RACES.forEach((r) => {
  const b = mk('button', '', r.tab); b.type = 'button'; b.dataset.race = r.id;
  b.addEventListener('click', () => { window.opx.sortKey = 'precinct'; window.opx.sortDir = 1; dash.setParams({ race: r.id, view: 'leader' }); dash.setLink('summary'); });
  racesEl.appendChild(b);
});

function candidatesFor(race) {
  const t = dash.data('totals_' + race.id);
  return t.status === 'ok' ? t.data.map((r, i) => ({ name: r.candidate, i })) : [];
}

function drawHeader(race) {
  racesEl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.race === race.id)));
  document.getElementById('race-title').textContent = race.tab + ' results by precinct';
  document.getElementById('race-sub').textContent = race.date + ' · ' + race.office + ', vote for ' + race.voteFor;
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
    ? (race.voteFor === 1 ? 'Share of votes cast for village president in each precinct.' : 'Share of all trustee votes cast in each precinct (each voter could pick up to 3).') + ' Hover a precinct for its full results.'
    : 'Colored by the candidate with the most votes. Darker shading means a wider lead over second place; gray means a tie. Hover a precinct for its full results.';
  if (race.join) document.getElementById('map-note').textContent += ' Labels use 2023 precinct numbers; the lines are the same as today, renumbered in 2024.';

  const ranked = (r) => cands.map((c) => ({ ...c, votes: Number(r[c.name]), share: Number(r[c.name]) / Number(r.total_votes) })).sort((a, b) => b.votes - a.votes);
  const jk = race.join || 'precinct';
  const shapes = bd.data.map((b) => ({ key: String(b[jk]), r: byP.get(String(b[jk])), polys: polysOf(geomOf(b.geometry)) })).filter((s) => s.r);
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
  const colors = cands.map((c) => resolve(candColor(c.i)));
  let fillOf, ext;
  if (vc) {
    ext = d3.extent(shapes, (sh) => Number(sh.r[vc.name]) / Number(sh.r.total_votes));
    const lo = d3.interpolateRgb(bg, colors[vc.i])(0.12);
    const ramp = d3.interpolateRgb(lo, colors[vc.i]);
    fillOf = (r) => ramp((Number(r[vc.name]) / Number(r.total_votes) - ext[0]) / ((ext[1] - ext[0]) || 1));
  } else {
    const margin = (r) => { const x = ranked(r); return (x[0].votes - x[1].votes) / Number(r.total_votes); };
    ext = d3.extent(shapes, (sh) => margin(sh.r));
    fillOf = (r) => { const x = ranked(r); if (x[0].votes === x[1].votes) return resolve('var(--color-border-line)'); const t = 0.35 + 0.65 * ((margin(r) - ext[0]) / ((ext[1] - ext[0]) || 1)); return d3.interpolateRgb(bg, colors[x[0].i])(t); };
  }

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
    .attr('fill', (sh) => fillOf(sh.r)).attr('stroke', bg).attr('stroke-width', 1.2)
    .on('mouseenter', (event) => { d3.select(event.currentTarget).raise().attr('stroke', fg).attr('stroke-width', 2); })
    .on('mousemove', (event, sh) => showTip(event, sh.r))
    .on('mouseleave', (event) => { d3.select(event.currentTarget).attr('stroke', bg).attr('stroke-width', 1.2); tip.hidden = true; highlight(null); });
  const fs = Math.max(9, Math.min(12, W / 60));
  svg.append('g').attr('pointer-events', 'none').selectAll('text').data(shapes.filter((sh) => sh.c)).join('text')
    .attr('x', (sh) => sh.c[0]).attr('y', (sh) => sh.c[1]).attr('dy', '0.35em').attr('text-anchor', 'middle')
    .attr('font-size', fs).attr('font-family', 'var(--font-anthropic-sans)')
    .attr('fill', fg).attr('stroke', bg).attr('stroke-width', 2.5).attr('paint-order', 'stroke').attr('stroke-linejoin', 'round')
    .text((sh) => sh.key);

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
    tip.appendChild(grid); tip.hidden = false;
    const br = box.getBoundingClientRect();
    let x = event.clientX - br.left + 14, y = event.clientY - br.top + 14;
    if (x + tip.offsetWidth > br.width) x = Math.max(0, event.clientX - br.left - tip.offsetWidth - 14);
    if (y + tip.offsetHeight > br.height) y = Math.max(0, event.clientY - br.top - tip.offsetHeight - 14);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
    highlight(String(r.precinct));
  }

  if (vc) {
    const w = mk('span'); const ramp = mk('i', 'opx-ramp');
    ramp.style.background = `linear-gradient(90deg, ${d3.interpolateRgb(bg, colors[vc.i])(0.12)}, ${colors[vc.i]})`;
    w.append(pct(ext[0]), ramp, pct(ext[1])); legend.appendChild(w);
  } else {
    const led = new Set(shapes.map((sh) => ranked(sh.r)[0].name));
    cands.forEach((c) => { if (!led.has(c.name)) return; const sp = mk('span'); const sw = mk('i', 'opx-sw'); sw.style.background = colors[c.i]; sp.append(sw, c.name); legend.appendChild(sp); });
    if (led.size < cands.length) legend.appendChild(mk('span', '', 'Others led no precincts'));
  }
}

function highlight(key) { document.querySelectorAll('.opx-table tbody tr').forEach((tr) => tr.classList.toggle('hl', tr.dataset.key === key)); }

function drawTable(race, cands) {
  const table = document.querySelector('.opx-table');
  table.dataset.source = race.id;
  const head = table.querySelector('thead tr'), tb = table.querySelector('tbody');
  head.replaceChildren(); tb.replaceChildren();
  const cols = [{ k: 'precinct', label: 'Precinct' }, { k: 'ballots_cast', label: 'Ballots' }, { k: 'turnout_pct', label: 'Turnout %' }]
    .concat(cands.map((c) => ({ k: c.name, label: lastName(c.name), cand: true }))).concat([{ k: 'top_candidate', label: 'Top vote-getter' }]);
  const { sortKey, sortDir } = window.opx;
  cols.forEach((c) => {
    const th = mk('th'); th.dataset.field = c.k;
    th.setAttribute('aria-sort', c.k === sortKey ? (sortDir > 0 ? 'ascending' : 'descending') : 'none');
    const b = mk('button', '', c.label); b.type = 'button';
    b.addEventListener('click', () => {
      if (window.opx.sortKey === c.k) window.opx.sortDir *= -1;
      else { window.opx.sortKey = c.k; window.opx.sortDir = (c.k === 'precinct' || c.k === 'top_candidate') ? 1 : -1; }
      drawTable(race, cands);
    });
    th.appendChild(b); head.appendChild(th);
  });
  const d = dash.data(race.id);
  if (d.status !== 'ok' || !cands.length) return;
  const rows = d.data.slice().sort((a, b) => {
    const x = a[sortKey], y = b[sortKey], nx = Number(x), ny = Number(y);
    return (!isNaN(nx) && !isNaN(ny) ? nx - ny : String(x).localeCompare(String(y))) * sortDir;
  });
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

dash.onData(() => {
  const race = currentRace();
  const cands = candidatesFor(race);
  drawHeader(race);
  drawTiles(race);
  drawMap(race, cands);
  drawTable(race, cands);
});
