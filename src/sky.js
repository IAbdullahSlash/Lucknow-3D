'use strict';
/* sky.js — the real sun path for Lucknow, sky dome with drifting clouds, stars, weather, rain and the night pass */

const BENCHMARK_INSTANT = Date.UTC(2026, 10, 18, 12);
const TIME = { mode: 'live', preset: null, hour: 12, day: NaN, night: 0, lamps: 0, el: 0.8 };
const WEATHER = {
  clear: { name: 'Clear', cover: 0.12, fog: [650, 2100], haze: 0.08, sun: 1, hemi: 1, wet: 0, rain: 0 },
  haze: { name: 'Dusty haze', cover: 0.24, fog: [380, 1500], haze: 0.4, sun: 0.9, hemi: 1, wet: 0, rain: 0 },
  overcast: { name: 'Overcast', cover: 0.97, fog: [320, 1400], haze: 0.55, sun: 0.38, hemi: 1.2, wet: 0, rain: 0 },
  fog: { name: 'Winter fog', cover: 0.6, fog: [14, 240], haze: 0.92, sun: 0.3, hemi: 1.15, wet: 0.3, rain: 0 },
  rain: { name: 'Monsoon rain', cover: 1, fog: [90, 780], haze: 0.7, sun: 0.26, hemi: 1.1, wet: 1, rain: 1 },
};
const WET = [];        // ground materials that turn glossy in the rain: {mat, rough}
const ENVMATS = [];    // materials that reflect the sky
function updateSceneClock(instant = BENCHMARK ? BENCHMARK_INSTANT : Date.now()) {
  const { day, hour } = lucknowClock(instant);
  if (day !== TIME.day) {
    TIME.day = day;
    TIME.solar = solarDay(day, MAP.origin);
    if (TIME.preset) TIME.hour = presetHour(TIME.preset);
  }
  if (TIME.mode === 'live') TIME.hour = hour;
}
function presetHour(name) {
  switch (name) {
    case 'sunrise': case 'noon': case 'golden': case 'dusk':
      return TIME.solar[name];
    default:
      return 22;
  }
}
updateSceneClock();

/* sky dome */
const skyU = {
  top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) },
  sunCol: { value: new THREE.Color() }, twilight: { value: new THREE.Color() }, disk: { value: 1 },
  cloudCol: { value: new THREE.Color() }, cover: { value: 0.3 }, time: { value: 0 },
};
const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(6000, 40, 20), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 v; void main(){ v = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `
    uniform vec3 top, hor, sunDir, sunCol, twilight, cloudCol; uniform float cover, time, disk; varying vec3 v;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x), f.y); }
    float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*noise(p); p=p*2.03+vec2(17.,9.); a*=.5; } return s; }
    void main(){
      vec3 d = normalize(v);
      vec3 col = mix(hor, top, pow(clamp(d.y,0.,1.), .5));
      float sd = max(dot(d, sunDir), 0.);
      float towardsSun = max(dot(normalize(d.xz + vec2(1.e-5)), normalize(sunDir.xz + vec2(1.e-5))), 0.);
      col += twilight * pow(towardsSun, 3.) * exp(-max(d.y, 0.) * 5.4);
      float limb = smoothstep(.999986, .999992, sd) * smoothstep(-.003, .0005, d.y);
      col += sunCol * ((pow(sd, 165.) * .34 + limb * 3.8) * disk) * (1. - cover * .87);
      if (d.y > 0.) {
        vec2 uv = d.xz / (d.y + .14) * 1.3 + vec2(time*.004, time*.0017);
        float c = fbm(uv);
        float m = smoothstep(1.02 - cover*1.02, 1.2 - cover*.72, c + .3) * smoothstep(0., .1, d.y);
        vec3 cc = mix(cloudCol*.7, cloudCol, fbm(uv*2.3+3.)) + twilight * pow(sd, 6.) * .45;
        col = mix(col, cc, m*.93);
      }
      gl_FragColor = vec4(col, 1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
skyMesh.renderOrder = -10; skyMesh.frustumCulled = false; scene.add(skyMesh);

const starMat = new THREE.PointsMaterial({ color: 0xf1f3ff, size: 1.35, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
{
  const a = []; for (let i = 0; i < 1100; i++) { const u = rnd() * TAU, v = Math.acos(rr(0.04, 1)); a.push(5600 * Math.sin(v) * Math.cos(u), 5600 * Math.cos(v), 5600 * Math.sin(v) * Math.sin(u)); }
  const st = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(a, 3)), starMat);
  st.frustumCulled = false;
  skyMesh.add(st);
}
// A decorative moon placed across the sky from the sun. It is not an ephemeris
// and casts no light; night lighting comes from the ambient term below.
const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('rgba(244,246,255,1)', 'rgba(190,205,255,.22)'), fog: false, depthWrite: false, transparent: true, opacity: 0 }));
moonSprite.scale.setScalar(380);
moonSprite.renderOrder = -9;
scene.add(moonSprite);
const moonVec = new THREE.Vector3();

/* Diffuse sky probe with no baked sun. The directional light supplies the
   moving specular highlight, and the scene controls ambient reflection strength. */
const ENV = (() => {
  const pm = new THREE.PMREMGenerator(renderer), s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(40, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 v; void main(){ v = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'varying vec3 v; void main(){ vec3 d = normalize(v); vec3 c = d.y > 0. ? mix(vec3(.81,.84,.88), vec3(.37,.52,.72), pow(d.y,.55)) : mix(vec3(.43,.41,.36), vec3(.16,.17,.18), pow(-d.y,.5)); gl_FragColor = vec4(c,1.); }',
  })));
  const t = pm.fromScene(s, 0.03).texture; pm.dispose(); return t;
})();
[MAT.gold, MAT.copper, MAT.tin, MAT.glass, MAT.iron, propMatShiny].forEach(m => { m.envMap = ENV; ENVMATS.push(m); });

/* rain */
const RAIN_N = OPT.quality === 'low' ? 680 : OPT.quality === 'high' ? 2300 : 1350;
const rainGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(RAIN_N * 6), 3));
const rainSeed = Float32Array.from({ length: RAIN_N * 3 }, tr);
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xc3d2e0, transparent: true, opacity: 0.42, depthWrite: false })); rain.frustumCulled = false; rain.visible = false; scene.add(rain);
function updateRain(t) {
  const p = rainGeo.attributes.position, cx = camera.position.x, cy = camera.position.y, cz = camera.position.z, R = 34, H = 30;
  for (let i = 0; i < RAIN_N; i++) {
    const x = cx + rainSeed[i * 3] * 2 * R - R, z = cz + rainSeed[i * 3 + 1] * 2 * R - R;
    const y = cy - 6 + H - ((t * (24 + rainSeed[i * 3 + 2] * 10) + rainSeed[i * 3 + 2] * H) % H);
    p.setXYZ(i * 2, x, y, z); p.setXYZ(i * 2 + 1, x + 0.12, y + 0.95, z + 0.05);
  }
  p.needsUpdate = true;
}

/* sky colour as a function of the sun's elevation (degrees) */
const SKYKEYS = [
  //  el    zenith    horizon   light     lightI hemiI night
  [-18, 0x080f22, 0x25334d, 0x869bcc, 0, 0.40, 1],
  [-8, 0x182e52, 0x50617d, 0x97a9d1, 0, 0.56, 0.91],
  [-3, 0x304e7c, 0x8390aa, 0xe6b1a3, 0, 0.72, 0.52],
  [1, 0x456b9f, 0xa6acc2, 0xffc8a3, 1.05, 0.88, 0.24],
  [7, 0x5a85ba, 0xd3c7b9, 0xffd2a3, 2.35, 1.04, 0.02],
  [18, 0x619ad1, 0xd8dce3, 0xffe9ca, 2.78, 1.13, 0],
  [45, 0x3f8fe0, 0xd2e3ee, 0xfff6e6, 3.1, 1.0, 0],
  [90, 0x3a88dc, 0xd2e3ee, 0xfffaf0, 3.15, 1.0, 0],
].map(k => [k[0], new THREE.Color(k[1]), new THREE.Color(k[2]), new THREE.Color(k[3]), k[4], k[5], k[6]]);
const sunVec = new THREE.Vector3();
const hazeTint = new THREE.Color(0xc7baa5), cloudTint = new THREE.Color(0xa3afbe), fogTint = new THREE.Color(0xbac3ca);
const dawnTint = new THREE.Color(0xffc398), eveningTint = new THREE.Color(0xff9974);
const skyScratch = new THREE.Color(), ambientDay = new THREE.Color(0xe3eaf4), ambientNight = new THREE.Color(0x7b9bd1);
let FOG_SCALE = 1;      // widened by the camera when it pulls far back
let curWeather = WEATHER[OPT.weather] || WEATHER.haze;
const wx = { cover: curWeather.cover, f0: curWeather.fog[0], f1: curWeather.fog[1], haze: curWeather.haze, sun: curWeather.sun, hemi: curWeather.hemi, wet: curWeather.wet, rain: curWeather.rain };
function setWeather(k) { if (!WEATHER[k]) return; OPT.weather = k; curWeather = WEATHER[k]; saveOptions(); }

function applyTime(dt, T) {
  // ease the weather so changes roll in instead of snapping
  const w = curWeather, k = Math.min(1, dt * 0.9);
  wx.cover += (w.cover - wx.cover) * k; wx.f0 += (w.fog[0] - wx.f0) * k; wx.f1 += (w.fog[1] - wx.f1) * k; wx.haze += (w.haze - wx.haze) * k;
  wx.sun += (w.sun - wx.sun) * k; wx.hemi += (w.hemi - wx.hemi) * k; wx.wet += (w.wet - wx.wet) * k; wx.rain += (w.rain - wx.rain) * k;

  const s = sunPosition(TIME.solar, TIME.hour), deg = s.el / SOLAR_RAD;
  TIME.el = s.el;
  let i = 0; while (i < SKYKEYS.length - 2 && deg >= SKYKEYS[i + 1][0]) i++;
  const a = SKYKEYS[i], b = SKYKEYS[i + 1], f = clamp((deg - a[0]) / (b[0] - a[0]), 0, 1);
  const night = lerp(a[6], b[6], f);
  TIME.night = night;
  TIME.lamps = 1 - smooth((deg + 7) / 14 - wx.cover * 0.14);
  const top = skyU.top.value.lerpColors(a[1], b[1], f), hor = skyU.hor.value.lerpColors(a[2], b[2], f);
  const lum = 0.18 + 0.82 * (1 - night);
  hor.lerp(skyScratch.copy(hazeTint).multiplyScalar(lum), wx.haze * 0.43 * (1 - night * 0.78));
  top.lerp(skyScratch.copy(cloudTint).multiplyScalar(lum), wx.cover ** 2 * 0.86);
  hor.lerp(skyScratch.copy(fogTint).multiplyScalar(lum), wx.cover ** 2 * 0.76);
  scene.fog.color.copy(hor); scene.fog.near = wx.f0 * FOG_SCALE; scene.fog.far = wx.f1 * FOG_SCALE;
  sun.color.lerpColors(a[3], b[3], f).lerp(skyScratch.set(0xf2f2f4), wx.cover * 0.52);
  sun.intensity = lerp(a[4], b[4], f) * smooth(deg / 6) * wx.sun;
  sun.castShadow = sun.intensity > 0.18;
  hemi.intensity = lerp(a[5], b[5], f) * wx.hemi;
  hemi.color.lerpColors(ambientDay, ambientNight, night);
  hemi.groundColor.set(0xa59c89).lerp(skyScratch.set(0x505566), night);

  // Approximate atmospheric refraction at the horizon for the visible disk.
  const refracted = s.el + 0.56 * SOLAR_RAD * (1 - smooth((deg + 0.83) / 5));
  sunVec.set(Math.sin(s.az) * Math.cos(refracted), Math.sin(refracted), -Math.cos(s.az) * Math.cos(refracted));
  skyU.sunDir.value.copy(sunVec); skyU.sunCol.value.copy(sun.color); skyU.cover.value = wx.cover; skyU.time.value = T;
  const rising = TIME.hour < TIME.solar.noon;
  const twilight = smooth((deg + 15) / 11) * (1 - smooth((deg - 1) / 19)) * (1 - wx.cover * 0.9);
  skyU.twilight.value.copy(rising ? dawnTint : eveningTint).multiplyScalar(twilight * (rising ? 0.47 : 0.60));
  skyU.disk.value = smooth((deg + 2) / 1.15);
  skyU.cloudCol.value.copy(cloudTint).lerp(sun.color, 0.21 * (1 - wx.cover)).multiplyScalar(lum * (1 - wx.cover * .28));
  starMat.opacity = (1 - smooth((deg + 15) / 8)) * 0.74 * (1 - wx.cover) ** 2;
  moonVec.set(-sunVec.x * 0.6 + 0.2, 0.72, -sunVec.z * 0.6 + 0.3).normalize();
  moonSprite.position.copy(camera.position).addScaledVector(moonVec, 5200);
  moonSprite.material.opacity = (1 - smooth((deg + 8) / 8)) * (1 - wx.cover * 0.8);
  moonSprite.visible = moonSprite.material.opacity > 0.01;
  skyMesh.position.copy(camera.position);
  renderer.toneMappingExposure = 1.0 + night * 0.17;

  // night dressing
  for (const m of FLOOD) m.emissiveIntensity = TIME.lamps * 0.11;
  MAT.recessLit.emissiveIntensity = TIME.lamps * 0.65; MAT.gold.emissiveIntensity = night * 0.17; MAT.dial.emissiveIntensity = TIME.lamps * 0.92;
  MAT.stain.emissiveIntensity = MAT.stainR.emissiveIntensity = night * 0.68; MAT.glass.emissiveIntensity = night * 0.20;
  for (const m of ENVMATS) m.envMapIntensity = lerp(0.84, 0.12, night) * (1 - 0.3 * wx.cover);
  for (const q of WET) {
    q.mat.roughness = lerp(q.rough, 0.29, wx.wet * 0.92);
    q.mat.envMapIntensity = wx.wet * lerp(0.62, 0.15, night);
  }
  for (const fx of NIGHTFX) fx(night);
  rain.visible = wx.rain > 0.05; if (rain.visible) { rain.material.opacity = 0.42 * wx.rain; updateRain(T); }
}
/** hour for the named moments of today's real sun */
/** how busy Hussainabad is at an hour, 0 (empty) .. 1 (peak): quiet before dawn, a morning rush, a steady afternoon
    and the evening peak when the food street and the lit monuments draw everyone out */
const BUSY = {
  crowd: [[0, 0.1], [3, 0.04], [5, 0.07], [7, 0.34], [10, 0.66], [13, 0.72], [16, 0.86], [18.5, 1], [21, 0.96], [22.5, 0.62], [24, 0.1]],
  traffic: [[0, 0.12], [3, 0.05], [5, 0.1], [7, 0.45], [9.5, 0.95], [12, 0.7], [15, 0.75], [18, 1], [20.5, 0.85], [22.5, 0.45], [24, 0.12]],
};
function busyAt(kind, h) { const k = BUSY[kind]; h = ((h % 24) + 24) % 24; for (let i = 1; i < k.length; i++) if (h <= k[i][0]) { const a = k[i - 1], b = k[i], t = (h - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * (t * t * (3 - 2 * t)); } return k[0][1]; }
// A scene schedule, shared by the food-court customers and their sound.
function marketActivity(hour) {
  return smooth((hour - 11) / 3) * (1 - smooth((hour - 21.5) / 1.5));
}
