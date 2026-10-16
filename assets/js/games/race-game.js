/* ==========================================================================
   GJS ARCADE — JEU 2 : « Bad Practices Highway »
   Vue de dessus, route 3 voies, vitesse croissante. Obstacles = mauvaises
   pratiques (libellé visible), bonus = bonnes pratiques (+100 et bouclier 3 s).
   Génération : chaque rangée laisse au moins une voie libre, et l'écart entre
   rangées est proportionnel à la vitesse (toujours le temps de changer de voie).
   Collision AABB avec hitbox réduite pour rester équitable.
   ========================================================================== */

import { createLoop, createCanvas, createInput, createPad, createParticles, saveBest, wrapText } from './utils.js';
import { damp, pick, rand } from '../core/utils.js';

const BAD = [
  ['Site non responsive', 'Plus de la moitié du trafic web est mobile : un site non responsive fait fuir la majorité de vos visiteurs.'],
  ['Chargement 8 s', 'Au-delà de 3 secondes d’attente, plus de la moitié des visiteurs mobiles abandonnent la page avant de l’avoir vue.'],
  ['Pop-up intrusive', 'Google pénalise les interstitiels intrusifs sur mobile — et vos visiteurs, eux, ferment simplement l’onglet.'],
  ['Keyword stuffing', 'Bourrer une page de mots-clés est sanctionné par Google : vous perdez des positions au lieu d’en gagner.'],
  ['Pas de HTTPS', 'Sans HTTPS, le navigateur affiche « Non sécurisé » : la confiance et le référencement s’effondrent.'],
  ['Cookies non conformes RGPD', 'La CNIL sanctionne les bandeaux où refuser est plus difficile qu’accepter — et les amendes font mal.'],
  ['Images de 5 Mo', 'Des images non optimisées plombent le chargement, le SEO et le forfait data de vos visiteurs.'],
  ['Achat de followers', 'Les faux abonnés n’achètent rien, écrasent votre taux d’engagement et peuvent faire suspendre le compte.'],
  ['Spam emailing', 'Envoyer sans consentement, c’est finir en spam — et s’exposer à des sanctions au titre du RGPD.'],
  ['Campagne sans tracking', 'Sans suivi des conversions, impossible de savoir quelle campagne rapporte : vous payez pour deviner.'],
];
const GOOD = ['Core Web Vitals', 'Balises Hn', 'Alt text', 'Consentement RGPD', 'A/B test', 'Automatisation'];

const C = {
  bg: '#000000', road: '#050913', line: 'rgba(255,255,255,0.75)', dash: 'rgba(91,133,255,0.55)',
  bad: '#FF6B5B', badFill: '#1C0707', good: '#5B85FF', goodFill: '#07112E', white: '#FFFFFF', car: '#03060F',
};

export function create(api) {
  const { stage, sound } = api;
  stage.classList.add('race-stage');
  const view = createCanvas(stage, 'race-canvas');
  const { ctx } = view;
  const particles = createParticles();

  // Géométrie (recalculée au redimensionnement)
  const g = { w: 0, h: 0, roadX: 0, roadW: 0, laneW: 0, carW: 0, carH: 0, carY: 0 };
  const layout = () => {
    g.w = view.size.w;
    g.h = view.size.h;
    g.roadW = Math.min(g.w * 0.94, 560);
    g.laneW = g.roadW / 3;
    g.roadX = (g.w - g.roadW) / 2;
    g.carW = g.laneW * 0.42;
    g.carH = g.carW * 1.75;
    g.carY = g.h - g.carH - (api.touch ? 118 : Math.max(48, g.h * 0.1));
  };
  layout();
  view.canvas.onfit = layout;
  const laneX = (lane) => g.roadX + g.laneW * (lane + 0.5);

  const s = {
    lane: 1, x: 0, elapsed: 0, speed: 340, distance: 0, bonus: 0, shield: 0,
    nextSpawn: 120, dash: 0, objects: [], crashed: false, shake: 0, lastBad: '', hudT: 0, flash: 0,
  };
  s.x = laneX(1);
  const stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), v: rand(0.3, 1) }));

  const objH = () => Math.max(52, g.laneW * 0.46);
  const score = () => Math.floor(s.distance / 10) + s.bonus;

  const spawnRow = () => {
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
    const nBad = s.elapsed < 8 ? 1 : (Math.random() < 0.55 ? 2 : 1);
    const h = objH();
    for (let i = 0; i < nBad; i += 1) {
      let entry = pick(BAD);
      if (entry[0] === s.lastBad) entry = pick(BAD);
      s.lastBad = entry[0];
      s.objects.push({ type: 'bad', lane: lanes[i], y: -h - 20, h, label: entry[0], info: entry[1] });
    }
    // Bonus éventuel, toujours dans une voie libre
    if (Math.random() < 0.28) s.objects.push({ type: 'good', lane: lanes[2], y: -h - 20, h: h * 0.8, label: pick(GOOD) });
    // Écart garanti : de quoi traverser deux voies à la vitesse courante
    s.nextSpawn = Math.max(230, s.speed * 0.52) + rand(0, 150);
  };

  const hud = () => {
    api.hud(`<span>Score <strong>${score()}</strong></span><span>${Math.round(s.speed / 4)} km/h</span>${s.shield > 0 ? `<span class="hud-shield">Bouclier ${s.shield.toFixed(1)} s</span>` : ''}`);
  };

  const crash = (obj) => {
    s.crashed = true;
    s.shake = 0.5;
    s.flash = 1;
    sound.hit();
    particles.burst(s.x, g.carY + g.carH / 2, { count: api.reduced ? 20 : 90, colors: ['#FF6B5B', '#FFFFFF', '#5B85FF'], speed: 420, size: 4, life: 1.1 });
    const final = score();
    const isRecord = saveBest('race', final, `${final} pts`);
    api.alert(`Collision avec « ${obj.label} ».`);
    endTimer = setTimeout(() => {
      loop.stop();
      api.end({
        won: false,
        title: `Collision : <em class="serif">« ${obj.label} »</em>.`,
        detail: obj.info,
        score: final,
        scoreLabel: `Score : ${final} — ${(s.distance / 1000).toFixed(1)} km parcourus`,
        isRecord,
        message: 'GJS vous évite ça.',
        cta: { label: 'Demander un audit', href: 'contact.html?besoins=site&objectif=visibilite' },
      });
    }, 1100);
  };

  let endTimer = 0;

  const update = (dt) => {
    particles.update(dt);
    s.shake = Math.max(0, s.shake - dt);
    s.flash = Math.max(0, s.flash - dt * 2.5);
    if (s.crashed) return;
    s.elapsed += dt;
    s.speed = Math.min(980, 340 + s.elapsed * 14);
    const step = s.speed * dt;
    s.distance += step;
    s.dash = (s.dash + step) % 60;
    s.x += (laneX(s.lane) - s.x) * damp(16, dt);
    s.shield = Math.max(0, s.shield - dt);
    s.nextSpawn -= step;
    if (s.nextSpawn <= 0) spawnRow();
    stars.forEach((st) => { st.y += (step / g.h) * st.v * 0.6; if (st.y > 1) { st.y -= 1; st.x = Math.random(); } });

    // Hitbox joueur réduite (équité)
    const pw = g.carW * 0.7;
    const ph = g.carH * 0.78;
    const px = s.x - pw / 2;
    const py = g.carY + (g.carH - ph) / 2;
    for (let i = s.objects.length - 1; i >= 0; i -= 1) {
      const o = s.objects[i];
      o.y += step;
      if (o.y > g.h + 40) { s.objects.splice(i, 1); continue; }
      const ow = g.laneW * 0.86 * 0.88;
      const oh = o.h * 0.82;
      const ox = laneX(o.lane) - ow / 2;
      const oy = o.y + (o.h - oh) / 2;
      const hit = px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy;
      if (!hit) continue;
      if (o.type === 'good') {
        s.bonus += 100;
        s.shield = 3;
        sound.coin();
        particles.burst(laneX(o.lane), o.y + o.h / 2, { count: 30, colors: ['#5B85FF', '#FFFFFF'], speed: 260, size: 3, life: 0.8 });
        api.live(`Bonne pratique : ${o.label}. Plus 100 points et bouclier 3 secondes.`);
        s.objects.splice(i, 1);
      } else if (s.shield > 0) {
        s.bonus += 50;
        sound.blip();
        particles.burst(laneX(o.lane), o.y + o.h / 2, { count: 40, colors: ['#FF6B5B', '#FFFFFF'], speed: 300, size: 3, life: 0.8 });
        s.objects.splice(i, 1);
      } else {
        crash(o);
        return;
      }
    }
    s.hudT -= dt;
    if (s.hudT <= 0) { s.hudT = 0.2; hud(); }
  };

  const roundRect = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  const drawCar = (x, y) => {
    const w = g.carW;
    const h = g.carH;
    const left = x - w / 2;
    // Faisceaux des phares
    const beam = ctx.createLinearGradient(0, y - h * 1.6, 0, y);
    beam.addColorStop(0, 'rgba(91,133,255,0)');
    beam.addColorStop(1, 'rgba(91,133,255,0.32)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(left + w * 0.18, y + 4);
    ctx.lineTo(left - w * 0.35, y - h * 1.6);
    ctx.lineTo(left + w * 1.35, y - h * 1.6);
    ctx.lineTo(left + w * 0.82, y + 4);
    ctx.fill();
    // Carrosserie GJS : flèche effilée, ailerons arrière
    ctx.fillStyle = C.car;
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(left + w * 0.95, y + h * 0.12, left + w, y + h * 0.4, left + w * 0.92, y + h * 0.82);
    ctx.lineTo(left + w * 1.08, y + h);
    ctx.lineTo(left - w * 0.08, y + h);
    ctx.lineTo(left + w * 0.08, y + h * 0.82);
    ctx.bezierCurveTo(left, y + h * 0.4, left + w * 0.05, y + h * 0.12, x, y);
    ctx.fill();
    ctx.stroke();
    // Cockpit
    ctx.fillStyle = 'rgba(91,133,255,0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y + h * 0.36, w * 0.2, h * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Ligne centrale + phares
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.55);
    ctx.lineTo(x, y + h * 0.92);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.good;
    ctx.shadowColor = C.good;
    ctx.shadowBlur = 12;
    ctx.fillRect(left + w * 0.22, y + h * 0.06, w * 0.14, 3);
    ctx.fillRect(left + w * 0.64, y + h * 0.06, w * 0.14, 3);
    ctx.shadowBlur = 0;
    ctx.fillStyle = C.bad;
    ctx.fillRect(left + w * 0.05, y + h - 4, w * 0.2, 3);
    ctx.fillRect(left + w * 0.75, y + h - 4, w * 0.2, 3);
    if (s.shield > 0) {
      const pulse = 0.55 + 0.45 * Math.sin(s.elapsed * 14);
      ctx.strokeStyle = `rgba(91,133,255,${s.shield < 1 ? pulse : 0.9})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = C.good;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.ellipse(x, y + h / 2, w * 1.1, h * 0.75, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  };

  const drawObject = (o) => {
    const w = g.laneW * 0.86;
    const x = laneX(o.lane) - w / 2;
    const bad = o.type === 'bad';
    ctx.fillStyle = bad ? C.badFill : C.goodFill;
    ctx.strokeStyle = bad ? C.bad : C.good;
    ctx.lineWidth = 1.5;
    if (!bad) { ctx.shadowColor = C.good; ctx.shadowBlur = 16; }
    roundRect(x, o.y, w, o.h, bad ? 2 : o.h / 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    const size = Math.max(10, Math.min(14, g.laneW / 11));
    ctx.font = `500 ${size}px "JetBrains Mono", monospace`;
    ctx.fillStyle = C.white;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = bad ? o.label.toUpperCase() : `+ ${o.label}`;
    const lines = wrapText(ctx, text, w - 16).slice(0, 3);
    const lh = size * 1.25;
    lines.forEach((line, i) => ctx.fillText(line, x + w / 2, o.y + o.h / 2 + (i - (lines.length - 1) / 2) * lh));
    if (bad) {
      ctx.fillStyle = C.bad;
      ctx.fillRect(x, o.y, 4, o.h);
      ctx.fillRect(x + w - 4, o.y, 4, o.h);
    }
  };

  const render = () => {
    ctx.save();
    if (s.shake > 0 && !api.reduced) ctx.translate(rand(-6, 6) * s.shake, rand(-6, 6) * s.shake);
    ctx.fillStyle = C.bg;
    ctx.fillRect(-10, -10, g.w + 20, g.h + 20);
    // Bas-côtés : traînées d'étoiles
    stars.forEach((st) => {
      const x = st.x < 0.5 ? st.x * 2 * g.roadX : g.roadX + g.roadW + (st.x - 0.5) * 2 * g.roadX;
      ctx.fillStyle = `rgba(255,255,255,${0.15 + st.v * 0.35})`;
      ctx.fillRect(x, st.y * g.h, 1, 4 + st.v * (s.speed / 60));
    });
    // Route
    ctx.fillStyle = C.road;
    ctx.fillRect(g.roadX, 0, g.roadW, g.h);
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(g.roadX + 0.5, 0); ctx.lineTo(g.roadX + 0.5, g.h);
    ctx.moveTo(g.roadX + g.roadW - 0.5, 0); ctx.lineTo(g.roadX + g.roadW - 0.5, g.h);
    ctx.stroke();
    ctx.strokeStyle = C.dash;
    ctx.setLineDash([28, 32]);
    ctx.lineDashOffset = -s.dash;
    ctx.beginPath();
    for (let i = 1; i < 3; i += 1) {
      const x = g.roadX + g.laneW * i;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, g.h);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    s.objects.forEach(drawObject);
    if (!s.crashed || Math.floor(s.flash * 20) % 2 === 0) drawCar(s.x, g.carY);
    particles.render(ctx);
    if (s.flash > 0) {
      ctx.fillStyle = `rgba(255,107,91,${s.flash * 0.25})`;
      ctx.fillRect(-10, -10, g.w + 20, g.h + 20);
    }
    ctx.restore();
  };

  const loop = createLoop(update, render);

  const move = (dir) => {
    if (s.crashed || !loop.running) return;
    if (dir === 'left') s.lane = Math.max(0, s.lane - 1);
    if (dir === 'right') s.lane = Math.min(2, s.lane + 1);
  };
  const offInput = createInput(stage, { onDir: move });
  const offPad = api.touch ? createPad(stage, ['left', 'right'], move) : () => {};

  render();
  hud();

  return {
    start() { loop.start(); api.live('C’est parti. Gauche et droite pour changer de voie.'); },
    pause() { loop.stop(); },
    resume() { loop.start(); },
    destroy() {
      clearTimeout(endTimer);
      loop.stop();
      offInput();
      offPad();
      view.destroy();
      stage.classList.remove('race-stage');
      stage.innerHTML = '';
    },
  };
}
