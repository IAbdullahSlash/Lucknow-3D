'use strict';

(async () => {
  const load = document.getElementById('load');
  const message = document.getElementById('loadmsg');
  const fallback = document.getElementById('fallback');
  const ui = document.getElementById('ui');
  const bench = new URLSearchParams(location.search);
  // These overrides are used only by the local benchmark.
  if (bench.get('benchmark') === '1') {
    window.LUCKNOW_BENCHMARK = {
      quality: ['low', 'medium', 'high'].includes(bench.get('quality')) ? bench.get('quality') : 'medium',
      stages: {},
    };
  }
  const started = performance.now();
  let failed = false;

  function showGuide() {
    if (typeof renderItinerary === 'function') {
      renderItinerary(document.getElementById('fallbackStops'), document.getElementById('fallbackLanguage').value);
    }
  }

  function fail(error) {
    if (failed) return;
    failed = true;
    ui.inert = true;
    document.body.classList.remove('ready');
    document.body.classList.add('scene-failed');
    load.remove();
    fallback.hidden = false;
    document.getElementById('fallbackStatus').textContent = error?.message || 'The scene could not start.';
    showGuide();
    document.getElementById('retryScene').focus();
  }

  function loadScript(file) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = file + '?v=22';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Could not load ' + file + '.'));
      document.head.append(script);
    });
  }

  const startupError = e => fail(e.error || new Error(e.message || 'The scene could not start.'));
  window.addEventListener('error', startupError);
  window.addEventListener('scene-unavailable', e => fail(e.detail));
  document.getElementById('retryScene').onclick = () => location.reload();
  document.getElementById('fallbackLanguage').onchange = showGuide;

  try {
    for (const file of [
      'data/places.js', 'data/map.js', 'vendor/three-r160.js', 'src/core.js',
      'src/sky.js', 'src/city.js', 'src/monuments.js', 'src/life.js', 'src/navigation.js', 'src/ui.js',
    ]) {
      await loadScript(file);
      if (failed) return;
    }
    if (window.LUCKNOW_BENCHMARK) await loadScript('src/benchmark.js');
    if (window.LUCKNOW_BENCHMARK) LUCKNOW_BENCHMARK.stages.scripts = performance.now() - started;
    await startScene();
    if (failed) return;
    ui.inert = false;
    document.body.classList.add('ready');
    load.remove();
    if (window.LUCKNOW_BENCHMARK) LUCKNOW_BENCHMARK.readyMs = performance.now() - started;
  } catch (error) {
    fail(error);
  } finally {
    window.removeEventListener('error', startupError);
  }
})();
