(function(){
  const datasets = window.OPX_DATASETS; const calcs = {}; const L = [];
  // The selected race and map view live in the URL (?race=…&view=…) so views can be linked to
  const defaults = { race: 'trustee_2023', view: 'leader' };
  const fromURL = () => { const q = new URLSearchParams(location.search); return { race: q.get('race') || defaults.race, view: q.get('view') || defaults.view }; };
  const toURL = () => {
    const q = new URLSearchParams({ race: params.race });
    if (params.view !== defaults.view) q.set('view', params.view);
    const url = '?' + q + location.hash;
    if (url !== location.search + location.hash) { try { history.pushState(null, '', url); } catch (e) { /* some browsers block this on file:// pages */ } }
  };
  let params = fromURL();
  window.addEventListener('popstate', () => { params = fromURL(); run(); });
  const get = (id) => datasets[id] || (calcs[id] ? (calcs[id].cache ||= calcs[id].fn(...calcs[id].inputs.map(get))) : null);
  const run = () => L.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  window.dash = { colors: ['var(--c1)','var(--c2)','var(--c3)','var(--c4)','var(--c5)','var(--c6)','var(--c7)','var(--c8)'],
    data: (id) => { const d = get(id); return d ? { status: 'ok', data: d, rows: d, refreshing: false, meta: [] } : { status: 'missing', data: [], meta: [] }; },
    calc: (id, s) => { calcs[id] = { fn: s.fn, inputs: s.inputs }; }, loader: () => {},
    onData: (fn) => { L.push(fn); if (document.readyState !== 'loading') fn(); },
    params: () => ({ ...params }), setParams: (p) => { params = { ...params, ...p }; toURL(); run(); },
    resetParams: () => { params = { ...defaults }; toURL(); run(); }, setLink: () => {}, refresh: run };
  let w = window.innerWidth, t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if (window.innerWidth !== w) { w = window.innerWidth; run(); } }, 120); });
  document.addEventListener('DOMContentLoaded', run);
})();
