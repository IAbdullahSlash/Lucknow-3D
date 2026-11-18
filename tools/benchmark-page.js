'use strict';

const byId = id => document.getElementById(id);
const sceneView = byId('sceneView');
const status = byId('status');
const result = byId('result');
const save = byId('save');
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
const quick = new URLSearchParams(location.search).get('smoke') === '1';
let report;

async function openScene(quality, run) {
  sceneView.src = '../index.html?benchmark=1&quality=' + quality + '&run=' + run;
  const deadline = performance.now() + 120000;
  while (performance.now() < deadline) {
    await nextFrame();
    const win = sceneView.contentWindow;
    if (win.location.search.endsWith('&run=' + run)) {
      if (win.document.body?.classList.contains('scene-failed')) throw new Error(win.document.getElementById('fallbackStatus').textContent);
      if (win.document.body?.classList.contains('ready')) return win;
    }
  }
  throw new Error('The benchmark scene did not finish loading.');
}

byId('settings').onsubmit = async event => {
  event.preventDefault();
  const quality = byId('quality').value;
  sceneView.hidden = false;
  result.hidden = save.hidden = true;
  document.body.classList.add('running');
  const runs = [];
  const repeats = quick ? 1 : 3;
  try {
    for (let i = 1; i <= repeats; i++) {
      status.textContent = 'Opening scene for run ' + i + ' of ' + repeats + '…';
      const win = await openScene(quality, i);
      const options = {
        passMs: quick ? 1500 : 20000, warmupMs: quick ? 500 : 5000,
        onPhase(name) { status.textContent = 'Run ' + i + ' of ' + repeats + ' · ' + name; },
      };
      runs.push(await win.measureLucknow(options));
      if (i === repeats && byId('soak').checked && !quick) {
        status.textContent = 'Keeping the scene running for 10 minutes…';
        await new Promise(resolve => setTimeout(resolve, 600000));
        runs.push({ afterSoak: true, ...await win.measureLucknow(options) });
      }
    }
    report = { browser: navigator.userAgent, created: new Date().toISOString(), quality, smoke: quick, runs };
    result.textContent = JSON.stringify(report, null, 2);
    result.hidden = save.hidden = false;
    status.textContent = 'Benchmark complete.';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    sceneView.hidden = true;
    sceneView.src = 'about:blank';
    document.body.classList.remove('running');
  }
};
save.onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'lucknow-benchmark.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
