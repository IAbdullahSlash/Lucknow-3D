'use strict';

/* Loaded in benchmark mode. The regular render loop still does all drawing,
   simulation and input work while the harness supplies a repeatable camera. */
window.measureLucknow = async ({ passMs = 20000, warmupMs = 5000, shops = false, onPhase = () => {} } = {}) => {
  const { renderer } = HUSSAINABAD;
  const navigation = performance.getEntriesByType('navigation')[0];
  const context = renderer.getContext();
  const debug = context.getExtension('WEBGL_debug_renderer_info');
  const gateLeg = PILOT_LEGS[1];
  if (!gateLeg) throw new Error('The route to Rumi Darwaza must be walkable to run the benchmark.');
  const frameTime = () => new Promise(resolve => requestAnimationFrame(resolve));
  const percentile = (values, fraction) => {
    values.sort((a, b) => a - b);
    return Math.round(values[Math.ceil(values.length * fraction) - 1] * 100) / 100;
  };
  const rumi = placeById('rumi'), tower = placeById('clock');
  const passes = [
    {
      name: 'Midday Explore',
      enter() { setTime('noon'); setWeather('clear'); flyTo(tower, 0); },
      begin() { flyTo(placeById('talab'), passMs / 1000); },
    },
    {
      name: 'Rumi Darwaza Walk',
      enter() { setTime('noon'); setWeather('clear'); enterWalk(...rumi.walk); },
      move(progress) {
        const [x, z, dx, dz] = polyAt(gateLeg, Math.max(0, gateLeg.len - 75 * (1 - progress)));
        const floor = floorAt(x, z, WALK.floor);
        if (floor === null) throw new Error('A waypoint became blocked during the Walk pass.');
        Object.assign(WALK, { x, z, floor, y: floor, yaw: Math.atan2(-dx, -dz), pitch: 0.12 });
      },
    },
    {
      name: 'Evening monsoon Tour',
      enter() { setTime('fixed', 18.5); setWeather('rain'); flyTo(rumi.views[1], 0); },
      begin() { flyTo(placeById('food'), passMs / 1000); },
    },
  ];
  if (shops) {
    const counter = placeById('tunday-kababi').views.find(view => view.name === SHOP_COPY.service);   // the counter view, whatever its order
    const enter = (time, weather) => {
      setTime(time);
      setWeather(weather);
      flyTo(counter, 0);
      applyTime(2, UI.T);
      updateShopService(3);
    };
    passes.push(
      { name: 'Tunday counter at midday', enter() { enter('noon', 'clear'); } },
      { name: 'Tunday counter in monsoon at dusk', enter() { enter('dusk', 'rain'); } },
    );
  }
  const metrics = [];
  for (const pass of passes) {
    onPhase(pass.name);
    pass.enter();
    const start = await frameTime();
    while (await frameTime() - start < warmupMs) {
      if (document.hidden) throw new Error('Keep the benchmark tab visible while it runs.');
    }
    pass.begin?.();
    let last = await frameTime();
    const intervals = [], calls = [], triangles = [];
    for (const first = last; last - first < passMs;) {
      const now = await frameTime();
      if (document.hidden) throw new Error('Keep the benchmark tab visible while it runs.');
      pass.move?.(Math.min(1, (now - first) / passMs));
      intervals.push(now - last);
      calls.push(renderer.info.render.calls);
      triangles.push(renderer.info.render.triangles);
      last = now;
    }
    metrics.push({
      name: pass.name, frames: intervals.length,
      frameMsMedian: percentile(intervals, 0.5), frameMsP95: percentile(intervals, 0.95),
      drawCallsMedian: percentile(calls, 0.5), trianglesMedian: percentile(triangles, 0.5),
    });
  }
  return {
    startupMs: Math.round(BENCHMARK.readyMs), stagesMs: BENCHMARK.stages,
    htmlTransferBytes: navigation?.transferSize, viewport: [innerWidth, innerHeight],
    drawingBuffer: [renderer.domElement.width, renderer.domElement.height],
    webglRenderer: context.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : context.RENDERER),
    passes: metrics,
  };
};
