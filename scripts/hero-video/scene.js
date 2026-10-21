/* ==========================================================================
   GJS · VIDÉO DU HERO · ÉTAPE 2 : LA SCÈNE (Three.js, rendue hors ligne)

   Trois lettres monumentales G J S en acier brossé, posées sur un sol de béton
   ciré, dans un studio noir empli de fumée. Une lumière rasante balaie les
   faces et révèle le brossage ; un contre-jour perce la fumée entre les
   lettres (rayons). Caméra lente, profondeur de champ courte. Noir et blanc.

   Rendu « hors ligne » : chaque image est la moyenne de N passes (anticrénelage,
   vraie profondeur de champ par échantillonnage de l'ouverture, fumée
   volumétrique bruitée qui se lisse en moyenne). Aucun GPU requis : la page
   tourne dans Chromium avec SwiftShader, piloté par render.mjs.

   Boucle parfaite de 12 s : tout ce qui bouge est périodique (caméra, lumière,
   poussières) et la fumée défile d'exactement une tuile de bruit par boucle.

   Paramètres d'URL : w, h, format (desktop | mobile), spp (passes par image).
   API : await window.GJS.ready ; window.GJS.render(indexImage) → PNG (data URL).
   ========================================================================== */

import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

const LOOP = 12; // secondes
const FPS = 24;
const TAU = Math.PI * 2;

const params = new URLSearchParams(location.search);
const W = Number(params.get('w') || 960);
const H = Number(params.get('h') || 540);
const FORMAT = params.get('format') || 'desktop';
const SPP = Number(params.get('spp') || 8);
const VOLUME_STEPS = Number(params.get('steps') || 40);
const DEBUG = params.get('debug') === '1';

/* ---------- Hasard reproductible --------------------------------------------- */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Suite de Halton : échantillons bien répartis (ouverture, sous-pixel)
function halton(i, b) {
  let f = 1;
  let r = 0;
  let n = i;
  while (n > 0) { f /= b; r += f * (n % b); n = Math.floor(n / b); }
  return r;
}

/* ---------- Bruits périodiques (textures qui se répètent sans couture) ------- */

function periodicValueNoise3D(size, periods, seed) {
  // fbm de bruit de valeur périodique, normalisé dans [0, 1]
  const rand = mulberry32(seed);
  const lattices = periods.map((p) => {
    const g = new Float32Array(p * p * p);
    for (let i = 0; i < g.length; i += 1) g[i] = rand();
    return { p, g };
  });
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const out = new Float32Array(size * size * size);
  let min = Infinity;
  let max = -Infinity;
  for (let z = 0; z < size; z += 1) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        let v = 0;
        let amp = 1;
        let norm = 0;
        for (const { p, g } of lattices) {
          const fx = (x / size) * p;
          const fy = (y / size) * p;
          const fz = (z / size) * p;
          const x0 = Math.floor(fx); const y0 = Math.floor(fy); const z0 = Math.floor(fz);
          const tx = fade(fx - x0); const ty = fade(fy - y0); const tz = fade(fz - z0);
          const at = (i, j, k) => g[((k % p) * p + (j % p)) * p + (i % p)];
          const c00 = at(x0, y0, z0) * (1 - tx) + at(x0 + 1, y0, z0) * tx;
          const c10 = at(x0, y0 + 1, z0) * (1 - tx) + at(x0 + 1, y0 + 1, z0) * tx;
          const c01 = at(x0, y0, z0 + 1) * (1 - tx) + at(x0 + 1, y0, z0 + 1) * tx;
          const c11 = at(x0, y0 + 1, z0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1, z0 + 1) * tx;
          const c0 = c00 * (1 - ty) + c10 * ty;
          const c1 = c01 * (1 - ty) + c11 * ty;
          v += (c0 * (1 - tz) + c1 * tz) * amp;
          norm += amp;
          amp *= 0.52;
        }
        v /= norm;
        out[(z * size + y) * size + x] = v;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
  }
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i += 1) bytes[i] = Math.round(((out[i] - min) / (max - min)) * 255);
  return bytes;
}

function periodicNoise2D(size, periods, seed) {
  const rand = mulberry32(seed);
  const lattices = periods.map((p) => {
    const g = new Float32Array(p * p);
    for (let i = 0; i < g.length; i += 1) g[i] = rand();
    return { p, g };
  });
  const fade = (t) => t * t * (3 - 2 * t);
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let v = 0;
      let amp = 1;
      let norm = 0;
      for (const { p, g } of lattices) {
        const fx = (x / size) * p;
        const fy = (y / size) * p;
        const x0 = Math.floor(fx); const y0 = Math.floor(fy);
        const tx = fade(fx - x0); const ty = fade(fy - y0);
        const at = (i, j) => g[(j % p) * p + (i % p)];
        const a = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
        const b = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
        v += (a * (1 - ty) + b * ty) * amp;
        norm += amp;
        amp *= 0.55;
      }
      out[y * size + x] = v / norm;
    }
  }
  return out;
}

/* ---------- Textures procédurales -------------------------------------------- */

function brushedTexture() {
  // Brossage horizontal : milliers de rayures fines, de longueurs et d'intensités variées
  const size = 1024;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgb(128,128,128)';
  ctx.fillRect(0, 0, size, size);
  const rand = mulberry32(7);
  for (let i = 0; i < 26000; i += 1) {
    const y = rand() * size;
    const x = rand() * size;
    const len = 40 + rand() ** 2 * 900;
    const light = rand() < 0.5;
    const a = 0.02 + rand() * 0.09;
    ctx.strokeStyle = light ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    ctx.lineWidth = 0.6 + rand() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
    if (x + len > size) { ctx.beginPath(); ctx.moveTo(x - size, y); ctx.lineTo(x + len - size, y); ctx.stroke(); }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function concreteTextures() {
  // Béton ciré : grandes nuances + fin grain + quelques micro-taches ; rugosité qui varie
  const size = 1024;
  const big = periodicNoise2D(size, [4, 8, 16], 11);
  const fine = periodicNoise2D(size, [64, 128, 256], 23);
  const rand = mulberry32(5);
  const albedo = new Uint8Array(size * size * 4);
  const rough = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    const speck = rand() < 0.004 ? -0.25 * rand() : 0;
    const a = 0.16 + (big[i] - 0.5) * 0.10 + (fine[i] - 0.5) * 0.08 + speck;
    const v = Math.max(0, Math.min(1, a));
    albedo.set([v * 255, v * 255, v * 255, 255], i * 4);
    // Zones plus lisses (cirées) et plus mates
    const r = 0.38 + (big[(i * 7) % (size * size)] - 0.5) * 0.5 + (fine[i] - 0.5) * 0.18;
    const rv = Math.max(0.12, Math.min(0.95, r));
    rough.set([0, rv * 255, 0, 255], i * 4);
  }
  const make = (data, srgb) => {
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  };
  return { albedo: make(albedo, true), roughness: make(rough, false) };
}

function contactShadowTexture(layout, depth) {
  // Ombre de contact douce sous chaque lettre (vue de dessus), floutée
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.filter = 'blur(14px)';
  ctx.fillStyle = 'rgba(0,0,0,0.92)';
  const span = 2.4; // mètres couverts par la texture
  const toPx = (m) => (m / span + 0.5) * size;
  layout.forEach(({ x0, x1 }) => {
    const pad = 0.025;
    ctx.fillRect(toPx(x0 + pad), toPx(-depth / 2 - 0.02), toPx(x1 - pad) - toPx(x0 + pad), toPx(depth / 2 + 0.02) - toPx(-depth / 2 - 0.02));
  });
  ctx.filter = 'blur(40px)';
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(toPx(layout[0].x0 - 0.1), toPx(-depth / 2 - 0.12), toPx(layout[layout.length - 1].x1 + 0.1) - toPx(layout[0].x0 - 0.1), toPx(depth / 2 + 0.24) - toPx(-depth / 2 - 0.12));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  return { tex, span };
}

/* ---------- Lettres ------------------------------------------------------------ */

function glyphShape(commands) {
  const path = new THREE.ShapePath();
  commands.forEach((c) => {
    if (c.type === 'M') path.moveTo(c.x, c.y);
    else if (c.type === 'L') path.lineTo(c.x, c.y);
    else if (c.type === 'Q') path.quadraticCurveTo(c.x1, c.y1, c.x, c.y);
    else if (c.type === 'C') path.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
  });
  return path.toShapes(false);
}

// Sens du brossage : horizontal sur les faces avant et arrière, le long du
// contour sur les flancs (tangentes explicites : aucun artefact de dérivées)
function addBrushTangents(geo) {
  // Faces avant et arrière parfaitement planes : leurs normales ne sont pas
  // moyennées avec le chanfrein (sinon l'ombrage dessine les triangles)
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const f = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    f.crossVectors(b.clone().sub(a), c.clone().sub(a));
    if (f.lengthSq() < 1e-14) continue;
    f.normalize();
    if (Math.abs(f.z) > 0.9995) for (let k = 0; k < 3; k += 1) nrm.setXYZ(i + k, 0, 0, Math.sign(f.z));
  }
  nrm.needsUpdate = true;
  const n = geo.attributes.normal;
  const t = new Float32Array(n.count * 4);
  const v = new THREE.Vector3();
  const side = new THREE.Vector3();
  const z = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < n.count; i += 1) {
    v.fromBufferAttribute(n, i);
    side.crossVectors(v, z);
    const k = THREE.MathUtils.smoothstep(Math.abs(v.z), 0.55, 0.95);
    const tx = side.lengthSq() > 1e-6 ? side.normalize() : new THREE.Vector3(1, 0, 0);
    const out = new THREE.Vector3(1, 0, 0).multiplyScalar(k).add(tx.multiplyScalar(1 - k));
    // projeté dans le plan tangent
    out.addScaledVector(v, -out.dot(v)).normalize();
    t.set([out.x, out.y, out.z, 1], i * 4);
  }
  geo.setAttribute('tangent', new THREE.BufferAttribute(t, 4));
}

/* ---------- Shaders plein écran ------------------------------------------------ */

const FULLSCREEN_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const VOLUME_FRAG = /* glsl */`
  precision highp float;
  precision highp sampler3D;
  varying vec2 vUv;
  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform sampler3D tNoise;
  uniform mat4 uProjInv;
  uniform mat4 uViewInv;
  uniform vec3 uCam;
  uniform float uLoop;
  uniform float uSeed;
  uniform float uHaze;
  uniform float uSmoke;
  uniform float uAmbient;
  uniform float uMaxDist;
  uniform vec3 uKPos; uniform vec3 uKDir; uniform vec2 uKCone; uniform float uKInt;
  uniform mat4 uKMat; uniform sampler2D tKDist;
  uniform vec3 uBPos; uniform vec3 uBDir; uniform vec2 uBCone; uniform float uBInt;
  uniform mat4 uBMat; uniform sampler2D tBDist;

  const int STEPS = ${VOLUME_STEPS};

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float density(vec3 p) {
    // Deux couches de bruit périodique : chacune avance d'une tuile entière par boucle
    float a = texture(tNoise, p * vec3(0.26, 0.34, 0.26) + vec3(uLoop, 0.0, 0.17)).r;
    float b = texture(tNoise, p * vec3(0.72, 0.72, 0.72) + vec3(-uLoop, uLoop, 0.53)).r;
    float n = a * 0.64 + b * 0.36;
    float low = exp(-max(p.y, 0.0) * 1.4);
    float smoke = smoothstep(0.5, 0.84, n) * low;
    return uHaze + uSmoke * smoke;
  }

  float hg(float c, float g) {
    float g2 = g * g;
    return (1.0 - g2) / (12.566 * pow(max(1e-4, 1.0 + g2 - 2.0 * g * c), 1.5));
  }

  float visible(mat4 m, sampler2D distMap, vec3 lightPos, vec3 p) {
    vec4 c = m * vec4(p, 1.0);
    if (c.w <= 0.0) return 0.0;
    vec2 uv = c.xy / c.w * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 1.0;
    float stored = texture(distMap, uv).r;
    if (stored < 0.001) return 1.0; // rien entre la lumière et ce point
    return step(length(p - lightPos), stored + 0.03);
  }

  vec3 light(vec3 p, vec3 rd, vec3 pos, vec3 dir, vec2 cone, float intensity, mat4 m, sampler2D distMap, float g) {
    vec3 l = pos - p;
    float d2 = dot(l, l);
    vec3 ln = l * inversesqrt(d2);
    float spot = smoothstep(cone.x, cone.y, dot(-ln, dir));
    if (spot <= 0.0) return vec3(0.0);
    float vis = visible(m, distMap, pos, p);
    return vec3(intensity * spot * vis / d2 * mix(hg(dot(ln, rd), g), 0.08, 0.25));
  }

  void main() {
    float depth = texture(tDepth, vUv).r;
    vec4 clip = vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    vec4 view = uProjInv * clip;
    view /= view.w;
    vec3 world = (uViewInv * view).xyz;
    vec3 ray = world - uCam;
    float dist = length(ray);
    vec3 rd = ray / dist;
    float tMax = depth >= 1.0 ? uMaxDist : min(dist, uMaxDist);
    float dt = tMax / float(STEPS);
    float t = dt * fract(hash12(gl_FragCoord.xy) + uSeed);
    float T = 1.0;
    vec3 L = vec3(0.0);
    for (int i = 0; i < STEPS; i++) {
      vec3 p = uCam + rd * t;
      float sigma = density(p);
      vec3 S = light(p, rd, uKPos, uKDir, uKCone, uKInt, uKMat, tKDist, 0.35)
             + light(p, rd, uBPos, uBDir, uBCone, uBInt, uBMat, tBDist, 0.62)
             + vec3(uAmbient);
      float tr = exp(-sigma * dt);
      L += T * S * (1.0 - tr);
      T *= tr;
      t += dt;
    }
    gl_FragColor = vec4(L.r, T, tMax, 1.0);
  }
`;

// Recomposition pleine résolution : la fumée (calculée à mi-résolution) est
// reprise avec un filtre qui respecte les bords des lettres (profondeur)
const COMPOSITE_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform sampler2D tVol;
  uniform vec2 uVolSize;
  uniform mat4 uProjInv;
  uniform mat4 uViewInv;
  uniform vec3 uCam;
  uniform float uMaxDist;
  void main() {
    float depth = texture(tDepth, vUv).r;
    vec4 clip = vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    vec4 view = uProjInv * clip;
    view /= view.w;
    float d = depth >= 1.0 ? uMaxDist : min(length((uViewInv * view).xyz - uCam), uMaxDist);
    vec2 p = vUv * uVolSize - 0.5;
    vec2 f = fract(p);
    vec2 base = (floor(p) + 0.5) / uVolSize;
    vec2 L = vec2(0.0);
    float wsum = 0.0;
    for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
      vec4 v = texture(tVol, base + vec2(i, j) / uVolSize);
      float bw = (i == 0 ? 1.0 - f.x : f.x) * (j == 0 ? 1.0 - f.y : f.y);
      float w = bw / (0.02 + abs(v.b - d) / max(d, 0.5)) + 1e-5;
      L += v.rg * w;
      wsum += w;
    }
    L /= wsum;
    gl_FragColor = vec4(texture(tColor, vUv).rgb * L.y + vec3(L.x), 1.0);
  }
`;

const ACCUM_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tPrev;
  uniform sampler2D tSample;
  void main() { gl_FragColor = texture(tPrev, vUv) + texture(tSample, vUv); }
`;

const BRIGHT_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tSrc;
  uniform float uScale;
  uniform vec2 uTexel;
  void main() {
    vec3 c = vec3(0.0);
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) c += texture(tSrc, vUv + vec2(x, y) * uTexel).rgb;
    c *= uScale / 9.0;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    gl_FragColor = vec4(c * smoothstep(0.55, 1.6, l), 1.0);
  }
`;

const BLUR_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tSrc;
  uniform vec2 uDir;
  void main() {
    float w[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
    vec3 c = texture(tSrc, vUv).rgb * w[0];
    for (int i = 1; i < 5; i++) {
      c += texture(tSrc, vUv + uDir * float(i)).rgb * w[i];
      c += texture(tSrc, vUv - uDir * float(i)).rgb * w[i];
    }
    gl_FragColor = vec4(c, 1.0);
  }
`;

const FINAL_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tAccum;
  uniform sampler2D tBloom;
  uniform float uScale;
  uniform float uExposure;
  uniform float uBloom;
  uniform float uGrain;
  uniform float uFrame;
  uniform vec2 uRes;
  uniform float uVignette;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  vec3 aces(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }
  float toSRGB(float c) { return c <= 0.0031308 ? 12.92 * c : 1.055 * pow(c, 1.0 / 2.4) - 0.055; }

  void main() {
    vec3 hdr = texture(tAccum, vUv).rgb * uScale;
    hdr += texture(tBloom, vUv).rgb * uBloom;
    float l = dot(hdr, vec3(0.2126, 0.7152, 0.0722)) * uExposure;
    // Vignette optique
    vec2 q = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
    l *= mix(1.0, smoothstep(1.25, 0.25, length(q)), uVignette);
    float m = aces(vec3(l)).r;
    // Courbe « tirage argentique » : noirs denses, hautes lumières douces
    m = m * m * (3.0 - 2.0 * m) * 0.35 + m * 0.65;
    float s = toSRGB(m);
    // Grain fin, plus présent dans les tons moyens
    vec2 cell = floor(gl_FragCoord.xy / 1.25);
    float n = (hash12(cell + uFrame * 17.13) + hash12(cell * 1.7 + uFrame * 9.71) - 1.0);
    s += n * uGrain * (0.35 + 0.65 * (1.0 - abs(2.0 * s - 1.0)));
    gl_FragColor = vec4(vec3(clamp(s, 0.0, 1.0)), 1.0);
  }
`;

const DIST_VERT = /* glsl */`
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const DIST_FRAG = /* glsl */`
  precision highp float;
  varying vec3 vWorld;
  uniform vec3 uLightPos;
  void main() { gl_FragColor = vec4(length(vWorld - uLightPos), 0.0, 0.0, 1.0); }
`;

/* ---------- Montage ------------------------------------------------------------- */

async function setup() {
  const glyphs = await (await fetch('./glyphs.json')).json();
  const canvas = document.getElementById('view');
  canvas.width = W;
  canvas.height = H;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const gl = renderer.getContext();
  const floatOK = Boolean(gl.getExtension('EXT_color_buffer_float'));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  /* Lettres */
  const DEPTH = 0.26;
  const letterMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.55, 0.55, 0.55),
    metalness: 1,
    roughness: 0.46,
    anisotropy: 0.85,
    anisotropyRotation: 0,
    envMapIntensity: 1,
  });
  const brushed = brushedTexture();
  brushed.repeat.set(1.6, 2.2);
  letterMat.roughnessMap = brushed;
  const letters = new THREE.Group();
  const layout = [];
  const x0 = -glyphs.width / 2;
  glyphs.letters.forEach((l) => {
    const shapes = glyphShape(l.commands);
    let geo = new THREE.ExtrudeGeometry(shapes, {
      depth: DEPTH - 0.036,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.011,
      bevelSegments: 6,
      curveSegments: 56,
    });
    geo.translate(0, 0, -(DEPTH - 0.036) / 2);
    geo = toCreasedNormals(geo, THREE.MathUtils.degToRad(32));
    addBrushTangents(geo);
    geo.computeBoundingBox();
    const mesh = new THREE.Mesh(geo, letterMat);
    mesh.position.set(x0 + l.x, -geo.boundingBox.min.y, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    letters.add(mesh);
    layout.push({ x0: x0 + l.x, x1: x0 + l.x + l.width });
  });
  scene.add(letters);

  /* Sol */
  const concrete = concreteTextures();
  concrete.albedo.repeat.set(5, 5);
  concrete.roughness.repeat.set(5, 5);
  const contact = contactShadowTexture(layout, DEPTH);
  const floorMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: concrete.albedo,
    roughnessMap: concrete.roughness,
    roughness: 1,
    metalness: 0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.32,
    envMapIntensity: 0.6,
  });
  const reflUniforms = {
    tRefl: { value: null },
    uReflMat: { value: new THREE.Matrix4() },
    uReflStrength: { value: 0.55 },
    tContact: { value: contact.tex },
    uContactSpan: { value: contact.span },
  };
  floorMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, reflUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uReflMat;\nout vec4 vReflCoord;\nout vec3 vFloorWorld;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvec4 fw = modelMatrix * vec4( transformed, 1.0 );\nvFloorWorld = fw.xyz;\nvReflCoord = uReflMat * fw;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tRefl;\nuniform float uReflStrength;\nuniform sampler2D tContact;\nuniform float uContactSpan;\nin vec4 vReflCoord;\nin vec3 vFloorWorld;')
      .replace('#include <opaque_fragment>', `
        vec2 cuv = vFloorWorld.xz / uContactSpan + 0.5;
        float contactAO = (cuv.x > 0.0 && cuv.x < 1.0 && cuv.y > 0.0 && cuv.y < 1.0) ? texture2D(tContact, cuv).r : 1.0;
        outgoingLight *= mix(0.12, 1.0, contactAO);
        vec3 V = normalize(cameraPosition - vFloorWorld);
        float fres = 0.04 + 0.96 * pow(1.0 - clamp(V.y, 0.0, 1.0), 5.0);
        float glossy = 1.0 - smoothstep(0.15, 0.7, roughnessFactor);
        vec3 refl = texture2D(tRefl, vReflCoord.xy / vReflCoord.w).rgb;
        outgoingLight += refl * uReflStrength * fres * glossy * contactAO;
        #include <opaque_fragment>`);
  };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  /* Environnement : studio noir avec trois boîtes à lumière (reflets du métal) */
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0.004, 0.004, 0.004);
  const panel = (w, h, intensity, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity), side: THREE.DoubleSide }));
    m.position.copy(pos);
    m.lookAt(look);
    envScene.add(m);
  };
  panel(5, 1.6, 1.2, new THREE.Vector3(0, 5, 0.5), new THREE.Vector3(0, 0, 0));
  panel(0.6, 4, 9, new THREE.Vector3(-5.5, 1.6, 2.5), new THREE.Vector3(0, 0.8, 0));
  panel(0.4, 3.5, 3.5, new THREE.Vector3(5, 2, -2.5), new THREE.Vector3(0, 0.8, 0));
  panel(6, 0.25, 1.4, new THREE.Vector3(0, 0.35, 7), new THREE.Vector3(0, 0.5, 0));
  // Grande bande verticale derrière la caméra : son reflet balaie les faces avant
  panel(0.6, 7, 9, new THREE.Vector3(2.3, 1.2, 8), new THREE.Vector3(0, 0.6, 0));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(envScene, 0, 0.1, 50);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.5;

  /* Lumières */
  const key = new THREE.SpotLight(0xffffff, 90, 0, THREE.MathUtils.degToRad(24), 0.7, 2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.01;
  key.shadow.radius = 5;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 16;
  scene.add(key, key.target);

  const back = new THREE.SpotLight(0xffffff, 80, 0, THREE.MathUtils.degToRad(21), 0.6, 2);
  back.castShadow = true;
  back.shadow.mapSize.set(2048, 2048);
  back.shadow.bias = -0.0003;
  back.shadow.normalBias = 0.01;
  back.shadow.radius = 3;
  back.shadow.camera.near = 0.5;
  back.shadow.camera.far = 16;
  scene.add(back, back.target);

  /* Caméra */
  const aspect = W / H;
  const camera = new THREE.PerspectiveCamera(FORMAT === 'mobile' ? 44 : 25, aspect, 0.1, 80);

  /* Cibles de rendu */
  const halfType = THREE.HalfFloatType;
  const sceneRT = new THREE.WebGLRenderTarget(W, H, { type: halfType, depthTexture: new THREE.DepthTexture(W, H, THREE.FloatType) });
  sceneRT.depthTexture.format = THREE.DepthFormat;
  const sampleRT = new THREE.WebGLRenderTarget(W, H, { type: halfType, depthBuffer: false });
  const VW = Math.round(W / 2);
  const VH = Math.round(H / 2);
  const volRT = new THREE.WebGLRenderTarget(VW, VH, { type: halfType, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const accType = floatOK ? THREE.FloatType : halfType;
  const accA = new THREE.WebGLRenderTarget(W, H, { type: accType, depthBuffer: false });
  const accB = new THREE.WebGLRenderTarget(W, H, { type: accType, depthBuffer: false });
  const reflRT = new THREE.WebGLRenderTarget(W / 2, H / 2, { type: halfType });
  const reflBlur = new THREE.WebGLRenderTarget(W / 2, H / 2, { type: halfType, depthBuffer: false });
  const bw = Math.round(W / 4);
  const bh = Math.round(H / 4);
  const bloomA = new THREE.WebGLRenderTarget(bw, bh, { type: halfType, depthBuffer: false });
  const bloomB = new THREE.WebGLRenderTarget(bw, bh, { type: halfType, depthBuffer: false });
  const distRT = (size) => new THREE.WebGLRenderTarget(size, size, { type: floatOK ? THREE.FloatType : halfType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const keyDist = distRT(1024);
  const backDist = distRT(1024);

  /* Bruit 3D de la fumée */
  const NOISE = 72;
  const noiseTex = new THREE.Data3DTexture(periodicValueNoise3D(NOISE, [3, 6, 12, 24], 42), NOISE, NOISE, NOISE);
  noiseTex.format = THREE.RedFormat;
  noiseTex.type = THREE.UnsignedByteType;
  noiseTex.minFilter = THREE.LinearFilter;
  noiseTex.magFilter = THREE.LinearFilter;
  noiseTex.wrapS = THREE.RepeatWrapping;
  noiseTex.wrapT = THREE.RepeatWrapping;
  noiseTex.wrapR = THREE.RepeatWrapping;
  noiseTex.unpackAlignment = 1;
  noiseTex.needsUpdate = true;

  /* Passes plein écran */
  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  quadScene.add(quad);
  const pass = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
  const draw = (mat, target) => {
    quad.material = mat;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, quadCam);
  };

  const volumeMat = pass(VOLUME_FRAG, {
    tColor: { value: sceneRT.texture }, tDepth: { value: sceneRT.depthTexture }, tNoise: { value: noiseTex },
    uProjInv: { value: new THREE.Matrix4() }, uViewInv: { value: new THREE.Matrix4() }, uCam: { value: new THREE.Vector3() },
    uLoop: { value: 0 }, uSeed: { value: 0 }, uHaze: { value: 0.018 }, uSmoke: { value: 2.6 }, uAmbient: { value: 0.0012 }, uMaxDist: { value: 16 },
    uKPos: { value: new THREE.Vector3() }, uKDir: { value: new THREE.Vector3() }, uKCone: { value: new THREE.Vector2() }, uKInt: { value: 0 },
    uKMat: { value: new THREE.Matrix4() }, tKDist: { value: keyDist.texture },
    uBPos: { value: new THREE.Vector3() }, uBDir: { value: new THREE.Vector3() }, uBCone: { value: new THREE.Vector2() }, uBInt: { value: 0 },
    uBMat: { value: new THREE.Matrix4() }, tBDist: { value: backDist.texture },
  });
  const compositeMat = pass(COMPOSITE_FRAG, {
    tColor: { value: sceneRT.texture }, tDepth: { value: sceneRT.depthTexture }, tVol: { value: volRT.texture }, uVolSize: { value: new THREE.Vector2(VW, VH) },
    uProjInv: volumeMat.uniforms.uProjInv, uViewInv: volumeMat.uniforms.uViewInv, uCam: volumeMat.uniforms.uCam, uMaxDist: volumeMat.uniforms.uMaxDist,
  });
  const accumMat = pass(ACCUM_FRAG, { tPrev: { value: null }, tSample: { value: sampleRT.texture } });
  const brightMat = pass(BRIGHT_FRAG, { tSrc: { value: null }, uScale: { value: 1 }, uTexel: { value: new THREE.Vector2(1 / W, 1 / H) } });
  const blurMat = pass(BLUR_FRAG, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
  const finalMat = pass(FINAL_FRAG, {
    tAccum: { value: null }, tBloom: { value: bloomA.texture }, uScale: { value: 1 }, uExposure: { value: 1.12 }, uBloom: { value: 0.22 },
    uGrain: { value: Number(params.get('grain') || 0) }, uFrame: { value: 0 }, uRes: { value: new THREE.Vector2(W, H) }, uVignette: { value: 0.55 },
  });

  const distMat = new THREE.ShaderMaterial({ vertexShader: DIST_VERT, fragmentShader: DIST_FRAG, uniforms: { uLightPos: { value: new THREE.Vector3() } }, side: THREE.DoubleSide });

  /* Animation : tout est périodique sur LOOP secondes */
  const focus = new THREE.Vector3();
  const camTarget = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  function animate(time) {
    const u = time / LOOP;
    const a = TAU * u;
    // Caméra en orbite lente autour des lettres ; la cible est décalée dans le
    // repère de la caméra : le mot garde sa place à l'image pendant tout le plan
    const mobile = FORMAT === 'mobile';
    const az = THREE.MathUtils.degToRad(mobile ? -8 + 6 * Math.sin(a) : -12 + 6 * Math.sin(a));
    // Mobile : plan plus large et plus plongeant, le mot reste dans le haut de l'image
    // (le titre du hero se pose dessous, sur le sol sombre)
    const dist = mobile ? 6.5 + 0.14 * Math.cos(a) : 5.2 + 0.16 * Math.cos(a);
    const offset = mobile ? 0 : 0.1;
    const pivot = mobile ? -1.45 : 0.11;
    const height = mobile ? 1.05 : 0.85;
    camPos.set(Math.sin(az) * dist, height + 0.05 * Math.sin(a + 1.1), Math.cos(az) * dist);
    camTarget.set(-Math.cos(az) * offset, pivot, Math.sin(az) * offset);
    // Mise au point qui glisse lentement d'une lettre à l'autre
    focus.set(0.34 * Math.sin(a + 0.6), 0.5, 0.13);

    // Lumière rasante qui balaie les faces (aller-retour)
    const phi = THREE.MathUtils.degToRad(-85 + 11 * Math.sin(a + 0.4));
    key.position.set(Math.sin(phi) * 4.8, 1.05 + 0.15 * Math.sin(a), Math.cos(phi) * 4.8);
    key.target.position.set(0.25, 0.48, 0.1);
    back.position.set(1.6, 3.4, -4.0);
    back.target.position.set(FORMAT === 'mobile' ? 0.35 : 0.95, 0.15, 0.9);
    // Les reflets des boîtes à lumière glissent sur le métal
    scene.environmentRotation.set(0, 0.3 * Math.sin(a + 0.9), 0);
    key.target.updateMatrixWorld();
    back.target.updateMatrixWorld();
  }

  function lightUniforms(light, prefix, uniforms) {
    const dir = new THREE.Vector3().subVectors(light.target.position, light.position).normalize();
    uniforms[`u${prefix}Pos`].value.copy(light.position);
    uniforms[`u${prefix}Dir`].value.copy(dir);
    uniforms[`u${prefix}Cone`].value.set(Math.cos(light.angle), Math.cos(light.angle * (1 - light.penumbra)));
  }

  function renderDistance(light, rt, uniforms, prefix) {
    const cam = new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(light.angle) * 2.1, 1, 0.3, 20);
    cam.position.copy(light.position);
    cam.lookAt(light.target.position);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    distMat.uniforms.uLightPos.value.copy(light.position);
    floor.visible = false;
    scene.overrideMaterial = distMat;
    renderer.setRenderTarget(rt);
    renderer.render(scene, cam);
    scene.overrideMaterial = null;
    floor.visible = true;
    uniforms[`u${prefix}Mat`].value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  }

  // Caméra décalée sur l'ouverture (profondeur de champ) avec frustum excentré :
  // le plan de mise au point reste exactement fixe d'une passe à l'autre
  const tmpRight = new THREE.Vector3();
  const tmpUp = new THREE.Vector3();
  const tmpFwd = new THREE.Vector3();
  function placeCamera(s) {
    const fstop = FORMAT === 'mobile' ? 0.022 : 0.03; // rayon d'ouverture (m)
    const r = Math.sqrt(halton(s + 1, 2)) * fstop;
    const th = halton(s + 1, 3) * TAU;
    const ox = Math.cos(th) * r;
    const oy = Math.sin(th) * r;
    camera.position.copy(camPos);
    camera.up.set(0, 1, 0);
    camera.lookAt(camTarget);
    camera.updateMatrixWorld();
    tmpRight.setFromMatrixColumn(camera.matrixWorld, 0);
    tmpUp.setFromMatrixColumn(camera.matrixWorld, 1);
    tmpFwd.setFromMatrixColumn(camera.matrixWorld, 2).negate();
    const focusDist = Math.max(1, focus.clone().sub(camPos).dot(tmpFwd));
    camera.position.addScaledVector(tmpRight, ox).addScaledVector(tmpUp, oy);
    camera.updateMatrixWorld();
    const near = camera.near;
    const top = near * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const right = top * camera.aspect;
    const shiftX = -ox * near / focusDist;
    const shiftY = -oy * near / focusDist;
    // Décalage sous-pixel (anticrénelage)
    const jx = (halton(s + 1, 5) - 0.5) * (2 * right / W);
    const jy = (halton(s + 1, 7) - 0.5) * (2 * top / H);
    camera.projectionMatrix.makePerspective(-right + shiftX + jx, right + shiftX + jx, top + shiftY + jy, -top + shiftY + jy, near, camera.far);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }

  const mirror = new THREE.PerspectiveCamera();
  const reflBias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const mirrorLook = new THREE.Vector3();
  function renderReflection() {
    // Caméra symétrique sous le sol (vraie rotation, pas d'inversion des faces) :
    // elle voit les lettres par en dessous, exactement comme le reflet
    tmpFwd.setFromMatrixColumn(camera.matrixWorld, 2).negate();
    mirror.position.set(camera.position.x, -camera.position.y, camera.position.z);
    mirrorLook.copy(camera.position).add(tmpFwd);
    mirrorLook.y = -mirrorLook.y;
    mirror.up.set(0, -1, 0);
    mirror.lookAt(mirrorLook);
    mirror.updateMatrixWorld();
    mirror.projectionMatrix.copy(camera.projectionMatrix);
    mirror.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    floor.visible = false;
    renderer.setRenderTarget(reflRT);
    renderer.render(scene, mirror);
    floor.visible = true;
    reflUniforms.uReflMat.value.copy(reflBias).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
    // Flou (béton ciré, pas un miroir)
    blurMat.uniforms.tSrc.value = reflRT.texture;
    blurMat.uniforms.uDir.value.set(2.2 / (W / 2), 0);
    draw(blurMat, reflBlur);
    blurMat.uniforms.tSrc.value = reflBlur.texture;
    blurMat.uniforms.uDir.value.set(0, 2.2 / (H / 2));
    draw(blurMat, reflRT);
    reflUniforms.tRefl.value = reflRT.texture;
  }

  async function renderFrame(index) {
    const tStart = performance.now();
    const time = (index / FPS) % LOOP;
    animate(time);
    renderer.shadowMap.needsUpdate = true;
    lightUniforms(key, 'K', volumeMat.uniforms);
    lightUniforms(back, 'B', volumeMat.uniforms);
    volumeMat.uniforms.uKInt.value = key.intensity * 0.09;
    volumeMat.uniforms.uBInt.value = back.intensity * 0.12;
    volumeMat.uniforms.uLoop.value = time / LOOP;
    const tA = performance.now();
    renderDistance(key, keyDist, volumeMat.uniforms, 'K');
    renderDistance(back, backDist, volumeMat.uniforms, 'B');
    if (DEBUG) { const f = new Float32Array(4); renderer.readRenderTargetPixels(backDist, 0, 0, 1, 1, f); console.warn('cartes de distance + ombres (ms)', Math.round(performance.now() - tA)); }

    let src = accA;
    let dst = accB;
    renderer.setRenderTarget(accA);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    const times = { refl: 0, scene: 0, volume: 0 };
    const px = new Uint8Array(4);
    const sync = () => { const t = renderer.getRenderTarget(); if (t && t.texture.type !== THREE.UnsignedByteType) { const f = new Float32Array(4); renderer.readRenderTargetPixels(t, 0, 0, 1, 1, f); } else gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
    const tick = () => { if (DEBUG) sync(); return performance.now(); };
    for (let s = 0; s < SPP; s += 1) {
      placeCamera(s + index * 0); // même motif d'échantillons à chaque image : pas de scintillement
      let t0 = tick();
      renderReflection();
      let t1 = tick(); times.refl += t1 - t0;
      renderer.setRenderTarget(sceneRT);
      renderer.render(scene, camera);
      renderer.shadowMap.needsUpdate = false;
      t0 = tick(); times.scene += t0 - t1;
      volumeMat.uniforms.uProjInv.value.copy(camera.projectionMatrixInverse);
      volumeMat.uniforms.uViewInv.value.copy(camera.matrixWorld);
      volumeMat.uniforms.uCam.value.copy(camera.position);
      volumeMat.uniforms.uSeed.value = halton(s + 1, 11);
      draw(volumeMat, volRT);
      draw(compositeMat, sampleRT);
      t1 = tick(); times.volume += t1 - t0;
      accumMat.uniforms.tPrev.value = src.texture;
      draw(accumMat, dst);
      [src, dst] = [dst, src];
      if (s % 2 === 1) await new Promise((r) => setTimeout(r, 0));
    }
    // Halo des hautes lumières (bloom), à 1/4 de résolution
    brightMat.uniforms.tSrc.value = src.texture;
    brightMat.uniforms.uScale.value = 1 / SPP;
    draw(brightMat, bloomA);
    for (let i = 0; i < 3; i += 1) {
      const k = 1 + i * 1.5;
      blurMat.uniforms.tSrc.value = bloomA.texture;
      blurMat.uniforms.uDir.value.set(k / bw, 0);
      draw(blurMat, bloomB);
      blurMat.uniforms.tSrc.value = bloomB.texture;
      blurMat.uniforms.uDir.value.set(0, k / bh);
      draw(blurMat, bloomA);
    }
    finalMat.uniforms.tAccum.value = src.texture;
    finalMat.uniforms.uScale.value = 1 / SPP;
    finalMat.uniforms.uFrame.value = index;
    draw(finalMat, null);
    const tDraw = tick();
    const png = canvas.toDataURL('image/png');
    if (DEBUG) console.warn('temps (ms)', JSON.stringify({ ...Object.fromEntries(Object.entries(times).map(([k, v]) => [k, Math.round(v)])), total: Math.round(tDraw - tStart), png: Math.round(performance.now() - tDraw) }));
    return png;
  }

  return { renderFrame, info: { W, H, FORMAT, SPP, floatOK, frames: LOOP * FPS } };
}

window.GJS = { ready: setup().then((api) => { window.GJS.render = api.renderFrame; window.GJS.info = api.info; return api.info; }) };
