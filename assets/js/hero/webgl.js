/* ==========================================================================
   GJS · HERO WEBGL (ordinateur uniquement, chargé après le premier affichage)
   Un plan Three.js affiche la vidéo :
     · ondulation liquide qui suit la souris (distorsion par shader) ;
     · décalage « citron / noir » quand on scrolle vite (version palette du
       décalage RVB : aucune couleur hors charte) ;
     · pliage 3D, coins arrondis, bordure 3 px et ombre dure dessinés dans le
       shader : aucune couture entre la 3D et la page ;
     · titre crème rendu dans le shader, en coordonnées écran, à l'exact
       emplacement du titre noir de la page : la frontière entre les deux
       couleurs suit le contour réel de la carte, au pixel près.
   ========================================================================== */

import {
  WebGLRenderer, Scene, PerspectiveCamera, PlaneGeometry, ShaderMaterial, Mesh,
  VideoTexture, CanvasTexture, Vector2, Vector3, Vector4, Color, LinearFilter,
} from '../../vendor/three/three-hero.min.js';

const DISTANCE = 1400; // distance caméra en px (perspective)
const INK = new Color('#141414');
const CREAM = new Color('#F4F0E8');
const LIME = new Color('#D4FF3A');
// Couleurs utilisées telles quelles (pas de conversion linéaire) : rendu identique au CSS
[INK, CREAM, LIME].forEach((c) => c.convertLinearToSRGB?.());

const VERTEX = /* glsl */`
  uniform float uBend;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float bx = p.x * 2.0;
    p.z -= uBend * bx * bx;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const SDF = /* glsl */`
  float sdRound(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
`;

const CARD_FRAGMENT = /* glsl */`
  precision highp float;
  uniform sampler2D uVideo;
  uniform vec2 uVideoRes;
  uniform vec2 uSize;
  uniform float uRadius;
  uniform float uBorder;
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uHover;
  uniform float uVel;
  uniform vec3 uVeil;
  uniform sampler2D uTitle;
  uniform vec4 uLineRect[3];
  uniform vec4 uLineUV[3];
  uniform vec2 uViewport;
  uniform float uDpr;
  uniform float uTitleOn;
  uniform vec3 uInk;
  uniform vec3 uLime;
  varying vec2 vUv;
  ${SDF}
  float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
  vec2 cover(vec2 uv) {
    float ra = uSize.x / uSize.y;
    float rv = uVideoRes.x / uVideoRes.y;
    vec2 s = ra > rv ? vec2(1.0, rv / ra) : vec2(ra / rv, 1.0);
    return (uv - 0.5) * s + 0.5;
  }
  void main() {
    vec2 px = (vUv - 0.5) * uSize;
    float d = sdRound(px, uSize * 0.5, uRadius);
    float aa = max(fwidth(d), 0.6);
    float alpha = 1.0 - smoothstep(-aa, aa, d);
    if (alpha <= 0.001) discard;

    // Ondulation liquide autour du curseur + léger courant permanent
    vec2 m = vUv - uMouse;
    m.x *= uSize.x / uSize.y;
    float dist = length(m);
    float wave = sin(dist * 34.0 - uTime * 4.2) * exp(-dist * 5.5);
    vec2 dir = m / max(dist, 1e-4);
    vec2 flow = vec2(sin(vUv.y * 9.0 + uTime * 0.7), cos(vUv.x * 7.0 - uTime * 0.6)) * 0.0022;
    vec2 off = dir * wave * 0.016 * uHover + flow * (0.35 + uHover);

    float l = lum(texture2D(uVideo, cover(vUv + off)).rgb);
    vec3 col = vec3(l);

    // Décalage selon la vitesse de scroll, dans la palette (citron d'un côté, noir de l'autre)
    float k = clamp(abs(uVel), 0.0, 1.0);
    if (k > 0.002) {
      float sh = uVel * 0.014;
      float lu = lum(texture2D(uVideo, cover(vUv + off + vec2(0.0, sh))).rgb);
      float ld = lum(texture2D(uVideo, cover(vUv + off - vec2(0.0, sh))).rgb);
      col = mix(col, uLime * (0.45 + 0.55 * lu), clamp((lu - l) * 3.5, 0.0, 1.0) * k);
      col = mix(col, uInk, clamp((l - ld) * 3.5, 0.0, 1.0) * k * 0.85);
    }

    // Voile calculé pour la lisibilité du titre (bas-gauche → haut-droite)
    float t = clamp((vUv.x + vUv.y) * 0.5, 0.0, 1.0);
    float a = t < 0.5 ? mix(uVeil.x, uVeil.y, t / 0.5) : mix(uVeil.y, uVeil.z, (t - 0.5) / 0.5);
    col = mix(col, uInk, a);

    // Titre crème (espace écran : se superpose exactement au titre noir de la page)
    if (uTitleOn > 0.5) {
      vec2 sp = vec2(gl_FragCoord.x, uViewport.y * uDpr - gl_FragCoord.y) / uDpr;
      for (int i = 0; i < 3; i++) {
        vec4 r = uLineRect[i];
        vec2 q = (sp - r.xy) / r.zw;
        if (q.x >= 0.0 && q.x <= 1.0 && q.y >= 0.0 && q.y <= 1.0) {
          vec4 u = uLineUV[i];
          vec4 g = texture2D(uTitle, vec2(u.x + q.x * u.z, u.y + q.y * u.w));
          col = mix(col, g.rgb, g.a);
        }
      }
    }

    // Bordure noire franche
    float b = smoothstep(-uBorder - aa, -uBorder + aa, d);
    col = mix(col, uInk, b * step(0.05, uBorder));

    gl_FragColor = vec4(col * alpha, alpha);
  }
`;

const SHADOW_FRAGMENT = /* glsl */`
  precision highp float;
  uniform vec2 uSize;
  uniform float uRadius;
  uniform float uOpacity;
  uniform vec3 uInk;
  varying vec2 vUv;
  ${SDF}
  void main() {
    vec2 px = (vUv - 0.5) * uSize;
    float d = sdRound(px, uSize * 0.5, uRadius);
    float aa = max(fwidth(d), 0.6);
    float alpha = (1.0 - smoothstep(-aa, aa, d)) * uOpacity;
    if (alpha <= 0.001) discard;
    gl_FragColor = vec4(uInk * alpha, alpha);
  }
`;

/* ---- Titre : atlas de 3 lignes dessiné en Canvas 2D ------------------------ */

function buildTitleAtlas(lines, dpr) {
  // lines : [{ rect:{x,y,w,h}, fontSize, segments:[{text,x,color,block?:{x,y,w,h}}] }]
  const pad = 4;
  const width = Math.ceil(Math.max(...lines.map((l) => l.rect.w)) * dpr + pad * 2);
  const rowH = (l) => (l.rect.h + l.extTop + l.extBottom) * dpr;
  const height = Math.ceil(lines.reduce((s, l) => s + rowH(l) + pad * 2, 0));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const uvs = [];
  let top = 0;
  lines.forEach((line) => {
    const rowTop = top + pad;
    const fs = line.fontSize * dpr;
    ctx.font = `400 ${fs}px "Bebas Neue"`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${0.005 * fs}px`;
    ctx.textBaseline = 'alphabetic';
    const metrics = ctx.measureText('H');
    const asc = metrics.fontBoundingBoxAscent;
    const desc = metrics.fontBoundingBoxDescent;
    const boxTop = rowTop + line.extTop * dpr; // haut de la boîte de ligne CSS
    const baseline = boxTop + (line.rect.h * dpr - (asc + desc)) / 2 + asc;
    line.segments.forEach((seg) => {
      if (seg.block) {
        const b = seg.block;
        ctx.save();
        ctx.fillStyle = '#D4FF3A';
        ctx.translate(pad + (b.x + b.w / 2) * dpr, boxTop + (b.y + b.h / 2) * dpr);
        ctx.rotate((-1.5 * Math.PI) / 180);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect((-b.w / 2) * dpr, (-b.h / 2) * dpr, b.w * dpr, b.h * dpr, 3 * dpr);
        else ctx.rect((-b.w / 2) * dpr, (-b.h / 2) * dpr, b.w * dpr, b.h * dpr);
        ctx.fill();
        ctx.restore();
      }
    });
    line.segments.forEach((seg) => {
      ctx.fillStyle = seg.color;
      ctx.fillText(seg.text, pad + seg.x * dpr, baseline);
    });
    uvs.push(new Vector4(pad / width, rowTop / height, (line.rect.w * dpr) / width, rowH(line) / height));
    top += rowH(line) + pad * 2;
  });
  return { canvas, uvs };
}

/* ---- Scène ------------------------------------------------------------------ */

export async function createHeroGL({ canvas, video, veil }) {
  let renderer;
  try {
    // Ni profondeur ni stencil : l'ordre d'affichage vient de renderOrder (économise la mémoire vidéo)
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, depth: false, stencil: false, premultipliedAlpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 1, 6000);
  camera.position.set(0, 0, DISTANCE);

  const videoTex = new VideoTexture(video);
  videoTex.minFilter = LinearFilter;
  videoTex.magFilter = LinearFilter;
  videoTex.generateMipmaps = false;

  const emptyTitle = document.createElement('canvas');
  emptyTitle.width = 2;
  emptyTitle.height = 2;
  let titleTex = new CanvasTexture(emptyTitle);
  titleTex.flipY = false;

  const geometry = new PlaneGeometry(1, 1, 64, 32);

  const cardMat = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: CARD_FRAGMENT,
    transparent: true,
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uVideo: { value: videoTex },
      uVideoRes: { value: new Vector2(video.videoWidth || 1280, video.videoHeight || 720) },
      uSize: { value: new Vector2(1, 1) },
      uRadius: { value: 0 },
      uBorder: { value: 0 },
      uBend: { value: 0 },
      uTime: { value: 0 },
      uMouse: { value: new Vector2(0.5, 0.5) },
      uHover: { value: 0 },
      uVel: { value: 0 },
      uVeil: { value: new Vector3(...veil) },
      uTitle: { value: titleTex },
      uLineRect: { value: [new Vector4(), new Vector4(), new Vector4()] },
      uLineUV: { value: [new Vector4(), new Vector4(), new Vector4()] },
      uViewport: { value: new Vector2(1, 1) },
      uDpr: { value: dpr },
      uTitleOn: { value: 0 },
      uInk: { value: INK },
      uLime: { value: LIME },
    },
  });

  const shadowMat = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: SHADOW_FRAGMENT,
    transparent: true,
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uSize: { value: new Vector2(1, 1) },
      uRadius: { value: 0 },
      uBend: { value: 0 },
      uOpacity: { value: 0 },
      uInk: { value: INK },
    },
  });

  const shadow = new Mesh(geometry, shadowMat);
  const card = new Mesh(geometry, cardMat);
  shadow.renderOrder = 0;
  card.renderOrder = 1;
  scene.add(shadow, card);

  let W = 1;
  let H = 1;
  const corner = new Vector3();

  function resize(width, height) {
    W = width;
    H = height;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.fov = (2 * Math.atan(H / 2 / DISTANCE) * 180) / Math.PI;
    camera.updateProjectionMatrix();
    cardMat.uniforms.uViewport.value.set(W, H);
  }

  /** Changement de densité de pixels (écran Retina, zoom du navigateur). */
  function setDpr(next) {
    dpr = Math.min(next || 1, 2);
    renderer.setPixelRatio(dpr);
    cardMat.uniforms.uDpr.value = dpr;
    renderer.setSize(W, H, false);
  }

  function setTitle(lines) {
    const { canvas: atlas, uvs } = buildTitleAtlas(lines, dpr);
    titleTex.dispose();
    titleTex = new CanvasTexture(atlas);
    titleTex.flipY = false;
    titleTex.minFilter = LinearFilter;
    titleTex.generateMipmaps = false;
    cardMat.uniforms.uTitle.value = titleTex;
    lines.forEach((l, i) => cardMat.uniforms.uLineUV.value[i].copy(uvs[i]));
    cardMat.uniforms.uTitleOn.value = 1;
    return lines;
  }

  function place(mesh, s, dx = 0, dy = 0, dz = 0) {
    mesh.position.set(s.cx - W / 2 + dx, -(s.cy - H / 2) - dy, dz);
    mesh.rotation.set((-s.rx * Math.PI) / 180, (s.ry * Math.PI) / 180, (-s.rz * Math.PI) / 180, 'XYZ');
    mesh.scale.set(s.w, s.h, 1);
  }

  /** Projette un coin de la carte (u,v dans [-0.5, 0.5]) en px écran. */
  function project(u, v) {
    corner.set(u, v, 0).applyMatrix4(card.matrixWorld).project(camera);
    return { x: (corner.x * 0.5 + 0.5) * W, y: (-corner.y * 0.5 + 0.5) * H };
  }

  function render(s, fx) {
    const u = cardMat.uniforms;
    place(card, s);
    place(shadow, s, s.shadowOff, s.shadowOff, -1);
    u.uSize.value.set(s.w, s.h);
    u.uRadius.value = s.radius;
    u.uBorder.value = s.border;
    u.uBend.value = s.bend;
    u.uTime.value = fx.time;
    u.uMouse.value.set(fx.mouse.x, fx.mouse.y);
    u.uHover.value = fx.hover;
    u.uVel.value = fx.vel;
    if (video.videoWidth) u.uVideoRes.value.set(video.videoWidth, video.videoHeight);
    fx.lines.forEach((r, i) => u.uLineRect.value[i].set(r.x, r.y, r.w, r.h));
    shadowMat.uniforms.uSize.value.set(s.w, s.h);
    shadowMat.uniforms.uRadius.value = s.radius;
    shadowMat.uniforms.uBend.value = s.bend;
    shadowMat.uniforms.uOpacity.value = s.shadowAlpha;
    renderer.render(scene, camera);
    card.updateMatrixWorld();
    return { tr: project(0.5, 0.5), br: project(0.5, -0.5), bl: project(-0.5, -0.5) };
  }

  let lost = false;
  const onLost = (e) => { e.preventDefault(); lost = true; };
  canvas.addEventListener('webglcontextlost', onLost);

  function dispose() {
    canvas.removeEventListener('webglcontextlost', onLost);
    geometry.dispose();
    cardMat.dispose();
    shadowMat.dispose();
    videoTex.dispose();
    titleTex.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return { resize, setDpr, setTitle, render, dispose, get lost() { return lost; } };
}
