'use strict';
/* sky.js — the real sun path for Lucknow, sky dome with drifting clouds, stars, weather, rain and the night pass */

const TIME = { mode: 'live', hour: 12, date: new Date(Date.now() + 5.5 * 3600e3), sunrise: 6, sunset: 18, noon: 12, night: 0, el: 0.8 };
const WEATHER = {
  clear: { name: 'Clear', cover: 0.12, fog: [650, 2100], haze: 0.08, sun: 1, hemi: 1, wet: 0, rain: 0 },
  haze: { name: 'Dusty haze', cover: 0.24, fog: [380, 1500], haze: 0.4, sun: 0.9, hemi: 1, wet: 0, rain: 0 },
  overcast: { name: 'Overcast', cover: 0.97, fog: [320, 1400], haze: 0.55, sun: 0.38, hemi: 1.2, wet: 0, rain: 0 },
  fog: { name: 'Winter fog', cover: 0.6, fog: [14, 240], haze: 0.92, sun: 0.3, hemi: 1.15, wet: 0.3, rain: 0 },
  rain: { name: 'Monsoon rain', cover: 1, fog: [90, 780], haze: 0.7, sun: 0.26, hemi: 1.1, wet: 1, rain: 1 },
};
const WET = [];        // ground materials that turn glossy in the rain: {mat, rough}
const ENVMATS = [];    // materials that reflect the sky
const istHour = () => { const d = new Date(); return (d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600 + 5.5) % 24; };

/* solar position for the precinct's latitude, IST clock time */
const _LAT = MAP.origin.lat * Math.PI / 180;
function solar(hour) {
  const d = TIME.date, doy = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5);
  const decl = -0.40928 * Math.cos(TAU * (doy + 10) / 365.24), b = TAU * (doy - 81) / 364;
  const eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
  const noon = 12 - eot / 60 + (82.5 - MAP.origin.lon) / 15;
  const H = (hour - noon) * 15 * Math.PI / 180;
  const el = Math.asin(Math.sin(_LAT) * Math.sin(decl) + Math.cos(_LAT) * Math.cos(decl) * Math.cos(H));
  const az = Math.atan2(-Math.sin(H), Math.tan(decl) * Math.cos(_LAT) - Math.sin(_LAT) * Math.cos(H));
  const ha = Math.acos(clamp(-Math.tan(_LAT) * Math.tan(decl), -1, 1)) * 12 / Math.PI;
  return { el, az, noon, sunrise: noon - ha, sunset: noon + ha };
}
{ const s = solar(12); TIME.sunrise = s.sunrise; TIME.sunset = s.sunset; TIME.noon = s.noon; TIME.hour = istHour(); }

/* sky dome */
const skyU = {
  top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() },
  cloudCol: { value: new THREE.Color() }, cover: { value: 0.3 }, time: { value: 0 }, night: { value: 0 },
};
const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(6000, 40, 20), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 v; void main(){ v = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `
    uniform vec3 top, hor, sunDir, sunCol, cloudCol; uniform float cover, time, night; varying vec3 v;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x), f.y); }
    float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*noise(p); p=p*2.03+vec2(17.,9.); a*=.5; } return s; }
    void main(){
      vec3 d = normalize(v);
      vec3 col = mix(hor, top, pow(clamp(d.y,0.,1.), .5));
      float sd = max(dot(d, sunDir), 0.);
      col += sunCol * (pow(sd, 420.) * 3. + pow(sd, 14.) * .2) * (1.-night) * (1.-cover*.75);
      if (d.y > 0.) {
        vec2 uv = d.xz / (d.y + .14) * 1.3 + vec2(time*.004, time*.0017);
        float c = fbm(uv);
        float m = smoothstep(1.02 - cover*1.02, 1.2 - cover*.72, c + .3) * smoothstep(0., .1, d.y);
        vec3 cc = mix(cloudCol*.6, cloudCol, fbm(uv*2.3+3.)) + sunCol*pow(sd,6.)*.22*(1.-night);
        col = mix(col, cc, m*.93);
      }
      gl_FragColor = vec4(col, 1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
skyMesh.renderOrder = -10; skyMesh.frustumCulled = false; scene.add(skyMesh);

const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.1, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
{
  const a = []; for (let i = 0; i < 1100; i++) { const u = rnd() * TAU, v = Math.acos(rr(0.04, 1)); a.push(5600 * Math.sin(v) * Math.cos(u), 5600 * Math.cos(v), 5600 * Math.sin(v) * Math.sin(u)); }
  const st = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(a, 3)), starMat); st.frustumCulled = false; scene.add(st);
}
const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('rgba(244,246,255,1)', 'rgba(190,205,255,.22)'), fog: false, depthWrite: false, transparent: true }));
moonSprite.scale.setScalar(380); scene.add(moonSprite);

/* a small sky probe so gilding, glass, wet cobbles and water have something to reflect */
const ENV = (() => {
  const pm = new THREE.PMREMGenerator(renderer), s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(40, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 v; void main(){ v = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'varying vec3 v; void main(){ vec3 d = normalize(v); vec3 c = d.y > 0. ? mix(vec3(.95,.9,.8), vec3(.28,.5,.9), pow(d.y,.55)) : mix(vec3(.6,.52,.42), vec3(.2,.17,.14), pow(-d.y,.5)); c += vec3(3.,2.6,2.) * pow(max(dot(d, normalize(vec3(.5,.55,.3))),0.), 60.); gl_FragColor = vec4(c,1.); }',
  })));
  const t = pm.fromScene(s, 0.03).texture; pm.dispose(); return t;
})();
[MAT.gold, MAT.copper, MAT.tin, MAT.glass, MAT.iron, propMatShiny].forEach(m => { m.envMap = ENV; ENVMATS.push(m); });

/* rain */
const RAIN_N = 2600, rainGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(RAIN_N * 6), 3));
const rainSeed = new Float32Array(RAIN_N * 3); for (let i = 0; i < RAIN_N * 3; i++) rainSeed[i] = Math.random();
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
  [-18, 0x050814, 0x0e1326, 0x8fa6ff, 0.34, 0.30, 1],
  [-8, 0x0c1230, 0x2b2749, 0x8fa6ff, 0.30, 0.34, 1],
  [-3, 0x2a2f5e, 0xdd6f5b, 0xff7a4a, 0.55, 0.48, 0.8],
  [1, 0x3d5a8c, 0xf0a46c, 0xffa066, 1.35, 0.62, 0.45],
  [7, 0x5a78b4, 0xf3c08c, 0xffbe84, 2.25, 0.84, 0.1],
  [18, 0x5e9bd6, 0xecdcc0, 0xffe4bc, 2.75, 0.94, 0],
  [45, 0x3f8fe0, 0xd2e3ee, 0xfff6e6, 3.1, 1.0, 0],
  [90, 0x3a88dc, 0xd2e3ee, 0xfffaf0, 3.15, 1.0, 0],
].map(k => [k[0], new THREE.Color(k[1]), new THREE.Color(k[2]), new THREE.Color(k[3]), k[4], k[5], k[6]]);
const sunVec = new THREE.Vector3(), moonVec = new THREE.Vector3(), lightDir = new THREE.Vector3(), _hz = new THREE.Color(0xd8c8a6), _gry = new THREE.Color(0x8d939b), _wht = new THREE.Color(0xc9cdd0);
let FOG_SCALE = 1;      // widened by the camera when it pulls far back
let curWeather = WEATHER[OPT.weather] || WEATHER.haze;
const wx = { cover: curWeather.cover, f0: curWeather.fog[0], f1: curWeather.fog[1], haze: curWeather.haze, sun: curWeather.sun, hemi: curWeather.hemi, wet: curWeather.wet, rain: curWeather.rain };
function setWeather(k) { if (!WEATHER[k]) return; OPT.weather = k; curWeather = WEATHER[k]; saveOptions(); }

function applyTime(dt, T) {
  // ease the weather so changes roll in instead of snapping
  const w = curWeather, k = Math.min(1, dt * 0.9);
  wx.cover += (w.cover - wx.cover) * k; wx.f0 += (w.fog[0] - wx.f0) * k; wx.f1 += (w.fog[1] - wx.f1) * k; wx.haze += (w.haze - wx.haze) * k;
  wx.sun += (w.sun - wx.sun) * k; wx.hemi += (w.hemi - wx.hemi) * k; wx.wet += (w.wet - wx.wet) * k; wx.rain += (w.rain - wx.rain) * k;

  const s = solar(TIME.hour), deg = s.el * 180 / Math.PI; TIME.el = s.el;
  let i = 0; while (i < SKYKEYS.length - 2 && deg >= SKYKEYS[i + 1][0]) i++;
  const a = SKYKEYS[i], b = SKYKEYS[i + 1], f = clamp((deg - a[0]) / (b[0] - a[0]), 0, 1);
  const night = a[6] + (b[6] - a[6]) * f; TIME.night = night;
  const top = skyU.top.value.lerpColors(a[1], b[1], f), hor = skyU.hor.value.lerpColors(a[2], b[2], f);
  const lum = 0.25 + 0.75 * (1 - night);
  hor.lerp(_hz.clone().multiplyScalar(lum), wx.haze * 0.55 * (1 - night * 0.8));
  top.lerp(_gry.clone().multiplyScalar(lum), wx.cover * wx.cover * 0.75); hor.lerp(_wht.clone().multiplyScalar(lum), wx.cover * wx.cover * 0.6);
  scene.fog.color.copy(hor); scene.fog.near = wx.f0 * FOG_SCALE; scene.fog.far = wx.f1 * FOG_SCALE;
  sun.color.lerpColors(a[3], b[3], f);
  const sunI = (a[4] + (b[4] - a[4]) * f); sun.intensity = sunI * lerp(1, wx.sun, 1 - night);
  hemi.intensity = (a[5] + (b[5] - a[5]) * f) * wx.hemi; hemi.color.copy(top).lerp(hor, 0.55); hemi.groundColor.set(0x8a7a60).multiplyScalar(0.6 + 0.4 * (1 - night));

  sunVec.set(Math.sin(s.az) * Math.cos(s.el), Math.sin(s.el), -Math.cos(s.az) * Math.cos(s.el));
  moonVec.set(-sunVec.x * 0.6 + 0.2, 0.72, -sunVec.z * 0.6 + 0.3).normalize();
  lightDir.copy(moonVec).lerp(sunVec, smooth((deg + 2.5) / 5)).normalize();
  if (lightDir.y < 0.08) { lightDir.y = 0.08; lightDir.normalize(); }
  skyU.sunDir.value.copy(sunVec); skyU.sunCol.value.copy(sun.color); skyU.cover.value = wx.cover; skyU.time.value = T; skyU.night.value = night;
  skyU.cloudCol.value.setRGB(1, 1, 1).lerp(sun.color, 0.35).multiplyScalar((0.16 + 0.84 * (1 - night)) * (1 - wx.cover * 0.42));
  moonSprite.position.copy(camera.position).addScaledVector(moonVec, 5200); moonSprite.material.opacity = night * (1 - wx.cover * 0.8);
  starMat.opacity = night * 0.9 * (1 - wx.cover);
  skyMesh.position.copy(camera.position);
  renderer.toneMappingExposure = 1.0 + night * 0.28;

  // night dressing
  for (const m of FLOOD) m.emissiveIntensity = night * 0.36;
  MAT.recessLit.emissiveIntensity = night * 1.25; MAT.gold.emissiveIntensity = night * 0.42; MAT.dial.emissiveIntensity = night * 1.05;
  MAT.stain.emissiveIntensity = MAT.stainR.emissiveIntensity = night * 0.9; MAT.glass.emissiveIntensity = night * 0.35;
  for (const m of ENVMATS) m.envMapIntensity = 0.1 + 0.9 * (1 - night);
  for (const q of WET) { q.mat.roughness = lerp(q.rough, 0.22, wx.wet * 0.9); q.mat.envMapIntensity = wx.wet * (0.15 + 0.6 * (1 - night)); }
  for (const fx of NIGHTFX) fx(night);
  rain.visible = wx.rain > 0.05; if (rain.visible) { rain.material.opacity = 0.42 * wx.rain; updateRain(T); }
}
/** hour for the named moments of today's real sun */
/** how busy Hussainabad is at an hour, 0 (empty) .. 1 (peak): quiet before dawn, a morning rush, a steady afternoon
    and the evening peak when the food street and the lit monuments draw everyone out */
const BUSY = {
  crowd: [[0, 0.1], [3, 0.04], [5, 0.06], [7, 0.28], [10, 0.55], [13, 0.6], [16, 0.75], [18.5, 1], [21, 0.95], [22.5, 0.6], [24, 0.1]],
  traffic: [[0, 0.12], [3, 0.05], [5, 0.1], [7, 0.45], [9.5, 0.95], [12, 0.7], [15, 0.75], [18, 1], [20.5, 0.85], [22.5, 0.45], [24, 0.12]],
};
function busyAt(kind, h) { const k = BUSY[kind]; h = ((h % 24) + 24) % 24; for (let i = 1; i < k.length; i++) if (h <= k[i][0]) { const a = k[i - 1], b = k[i], t = (h - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * (t * t * (3 - 2 * t)); } return k[0][1]; }
function presetHour(name) { return name === 'sunrise' ? TIME.sunrise + 0.25 : name === 'noon' ? TIME.noon : name === 'golden' ? TIME.sunset - 0.7 : name === 'dusk' ? TIME.sunset + 0.25 : 22; }
