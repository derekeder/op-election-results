(function(){
  const datasets = window.OPX_DATASETS; const calcs = {}; let params = { race: 'trustee_2025', view: 'leader' }; const L = [];
  const get = (id) => datasets[id] || (calcs[id] ? (calcs[id].cache ||= calcs[id].fn(...calcs[id].inputs.map(get))) : null);
  const run = () => L.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  window.dash = { colors: ['var(--c1)','var(--c2)','var(--c3)','var(--c4)','var(--c5)','var(--c6)','var(--c7)','var(--c8)'],
    data: (id) => { const d = get(id); return d ? { status: 'ok', data: d, rows: d, refreshing: false, meta: [] } : { status: 'missing', data: [], meta: [] }; },
    calc: (id, s) => { calcs[id] = { fn: s.fn, inputs: s.inputs }; }, loader: () => {},
    onData: (fn) => { L.push(fn); if (document.readyState !== 'loading') fn(); },
    params: () => ({ ...params }), setParams: (p) => { params = { ...params, ...p }; run(); },
    resetParams: () => { params = { race: 'trustee_2025', view: 'leader' }; run(); }, setLink: () => {}, refresh: () => {} };
  let w = window.innerWidth, t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if (window.innerWidth !== w) { w = window.innerWidth; run(); } }, 120); });
  document.addEventListener('DOMContentLoaded', run);
})();
