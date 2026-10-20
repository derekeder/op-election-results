// Simple password screen. This keeps casual visitors out; it is not real
// security, since the data files can still be fetched directly.
(function(){
  // SHA-256 of the password
  const HASH = '992db5e2595725ef68eb5066e014da8c7f6baca0afa96f1021b56b66782133f2';
  const KEY = 'opx-unlocked';
  const root = document.documentElement;
  const remembered = () => { try { return localStorage.getItem(KEY) === HASH; } catch (e) { return false; } };
  if (remembered()) return;
  root.classList.add('opx-locked');

  const sha256 = async (s) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.createElement('form');
    form.className = 'opx-gate';
    form.innerHTML = '<h1 class="opx-title">Oak Park Election Results</h1>'
      + '<label for="opx-pw">Enter the password to view this site</label>'
      + '<div class="opx-gate-row"><input id="opx-pw" type="password" autocomplete="current-password" required><button type="submit">View results</button></div>'
      + '<p class="opx-gate-err" role="alert" aria-live="polite"></p>';
    document.body.prepend(form);
    const input = form.querySelector('input'), err = form.querySelector('.opx-gate-err');
    input.focus();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (await sha256(input.value.trim().toLowerCase()) !== HASH) { err.textContent = 'That password isn’t right. Try again.'; input.select(); return; }
      try { localStorage.setItem(KEY, HASH); } catch (e2) { /* stays unlocked for this visit only */ }
      form.remove();
      root.classList.remove('opx-locked');
      // The page was hidden while locked, so redraw the map at its real width
      window.dash.refresh();
    });
  });
})();
