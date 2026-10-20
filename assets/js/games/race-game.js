/* ==========================================================================
   GJS ARCADE · JEU 2 : « Bad Practices Highway »
   Vue de dessus, route à 3 voies, vitesse croissante. Obstacles = mauvaises
   pratiques (stickers barrés de rubalise), bonus = bonnes pratiques (+100 et
   bouclier 3 s). Chaque rangée laisse au moins une voie libre, et l'écart
   entre rangées suit la vitesse (toujours le temps de changer de voie).
   Collision rectangle contre rectangle, zone de contact réduite (équitable).
   ========================================================================== */

import { createLoop, createCanvas, createInput, createPad, createParticles, saveBest, wrapText, roundRect, PALETTE, FONT_DISPLAY, FONT_TEXT, damp, pick, rand } from './utils.js';

const BAD = [
  ['Site non responsive', 'Plus de la moitié du trafic web est mobile : un site non responsive fait fuir la majorité de vos visiteurs.'],
  ['Chargement 8 s', 'Au-delà de 3 secondes d’attente, plus de la moitié des visiteurs mobiles abandonnent la page avant de l’avoir vue.'],
  ['Pop-up intrusive', 'Google pénalise les interstitiels intrusifs sur mobile, et vos visiteurs, eux, ferment simplement l’onglet.'],
  ['Keyword stuffing', 'Bourrer une page de mots-clés est sanctionné par Google : vous perdez des positions au lieu d’en gagner.'],
  ['Pas de HTTPS', 'Sans HTTPS, le navigateur affiche « Non sécurisé » : la confiance et le référencement s’effondrent.'],
  ['Cookies non conformes RGPD', 'La CNIL sanctionne les bandeaux où refuser est plus difficile qu’accepter, et les amendes font mal.'],
  ['Images de 5 Mo', 'Des images non optimisées plombent le chargement, le SEO et le forfait data de vos visiteurs.'],
  ['Achat de followers', 'Les faux abonnés n’achètent rien, écrasent votre taux d’engagement et peuvent faire suspendre le compte.'],
  ['Spam emailing', 'Envoyer sans consentement, c’est finir en spam et s’exposer à des sanctions au titre du RGPD.'],
  ['Campagne sans tracking', 'Sans suivi des conversions, impossible de savoir quelle campagne rapporte : vous payez pour deviner.'],
];
const GOOD = ['Core Web Vitals', 'Balises Hn', 'Alt text', 'Consentement RGPD', 'A/B test', 'Automatisation'];

const C = PALETTE;

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
    g.carY = g.h - g.carH - (api.touch ? 128 : Math.max(48, g.h * 0.1));
  };
  layout();
  view.canvas.onfit = layout;
  const laneX = (lane) => g.roadX + g.laneW * (lane + 0.5);

  const s = {
    lane: 1, x: 0, elapsed: 0, speed: 340, distance: 0, bonus: 0, shield: 0,
    nextSpawn: 120, dash: 0, objects: [], crashed: false, shake: 0, lastBad: '', hudT: 0, flash: 0,
  };
  s.x = laneX(1);
  // Bas-côtés : traits de vitesse (bitume et marquages), pas de décor « spatial »
  const marks = Array.from({ length: 46 }, () => ({ x: Math.random(), y: Math.random(), v: rand(0.4, 1), w: rand(1.5, 3.5) }));

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
      s.objects.push({ type: 'bad', lane: lanes[i], y: -h - 20, h, label: entry[0], info: entry[1], tilt: rand(-0.05, 0.05) });
    }
    // Bonus éventuel, toujours dans une voie libre
    if (Math.random() < 0.28) s.objects.push({ type: 'good', lane: lanes[2], y: -h - 20, h: h * 0.8, label: pick(GOOD), tilt: rand(-0.04, 0.04) });
    // Écart garanti : de quoi traverser deux voies à la vitesse courante
    s.nextSpawn = Math.max(230, s.speed * 0.52) + rand(0, 150);
  };

  const hud = () => {
    api.hud(`<span>Score <strong>${score()}</strong></span><span>${Math.round(s.speed / 4)} km/h</span>${s.shield > 0 ? `<span class="hud-shield">Bouclier ${s.shield.toFixed(1)} s</span>` : ''}`);
  };

  let endTimer = 0;
  const crash = (obj) => {
    s.crashed = true;
    s.shake = 0.5;
    s.flash = 1;
    sound.hit();
    particles.burst(s.x, g.carY + g.carH / 2, { count: api.reduced ? 20 : 90, colors: [C.lime, C.ink, C.cream], speed: 420, size: 8, life: 1.1 });
    const final = score();
    const isRecord = saveBest('race', final, `${final} pts`);
    api.alert(`Collision avec « ${obj.label} ».`);
    endTimer = setTimeout(() => {
      loop.stop();
      api.end({
        won: false,
        title: `Collision : <span class="hl">« ${obj.label} »</span>.`,
        detail: obj.info,
        score: final,
        scoreLabel: `Score : ${final} · ${(s.distance / 1000).toFixed(1)} km parcourus`,
        isRecord,
        message: 'GJS vous évite ça.',
        cta: { label: 'Demander un audit', href: 'contact.html?besoins=site,seo#formulaire' },
      });
    }, 1100);
  };

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
    marks.forEach((m) => { m.y += (step / g.h) * m.v * 0.9; if (m.y > 1) { m.y -= 1; m.x = Math.random(); } });

    // Zone de contact du joueur réduite (équité)
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
        particles.burst(laneX(o.lane), o.y + o.h / 2, { count: 30, colors: [C.lime, C.cream], speed: 260, size: 7, life: 0.8 });
        api.live(`Bonne pratique : ${o.label}. Plus 100 points et bouclier 3 secondes.`);
        s.objects.splice(i, 1);
      } else if (s.shield > 0) {
        s.bonus += 50;
        sound.blip();
        particles.burst(laneX(o.lane), o.y + o.h / 2, { count: 40, colors: [C.cream, C.ink, C.lime], speed: 300, size: 7, life: 0.8 });
        s.objects.splice(i, 1);
      } else {
        crash(o);
        return;
      }
    }
    s.hudT -= dt;
    if (s.hudT <= 0) { s.hudT = 0.2; hud(); }
  };

  const drawCar = (x, y) => {
    const w = g.carW;
    const h = g.carH;
    const left = x - w / 2;
    // Faisceaux des phares (crème translucide)
    const beam = ctx.createLinearGradient(0, y - h * 1.6, 0, y);
    beam.addColorStop(0, 'rgba(244,240,232,0)');
    beam.addColorStop(1, 'rgba(244,240,232,0.26)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(left + w * 0.18, y + 4);
    ctx.lineTo(left - w * 0.35, y - h * 1.6);
    ctx.lineTo(left + w * 1.35, y - h * 1.6);
    ctx.lineTo(left + w * 0.82, y + 4);
    ctx.fill();
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(left + w * 0.95, y + h * 0.12, left + w, y + h * 0.4, left + w * 0.92, y + h * 0.82);
      ctx.lineTo(left + w * 1.08, y + h);
      ctx.lineTo(left - w * 0.08, y + h);
      ctx.lineTo(left + w * 0.08, y + h * 0.82);
      ctx.bezierCurveTo(left, y + h * 0.4, left + w * 0.05, y + h * 0.12, x, y);
      ctx.closePath();
    };
    // Ombre dure crème (le sticker se détache du bitume), puis carrosserie citron
    ctx.save();
    ctx.translate(4, 4);
    body();
    ctx.fillStyle = C.cream;
    ctx.fill();
    ctx.restore();
    body();
    ctx.fillStyle = C.lime;
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Cockpit
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.ellipse(x, y + h * 0.3, w * 0.2, h * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    // GJS sur le capot
    ctx.fillStyle = C.ink;
    ctx.font = `400 ${Math.round(w * 0.36)}px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GJS', x, y + h * 0.62);
    // Phares et feux
    ctx.fillStyle = C.cream;
    ctx.fillRect(left + w * 0.2, y + h * 0.05, w * 0.15, 4);
    ctx.fillRect(left + w * 0.65, y + h * 0.05, w * 0.15, 4);
    ctx.fillStyle = C.ink;
    ctx.fillRect(left + w * 0.05, y + h - 6, w * 0.22, 4);
    ctx.fillRect(left + w * 0.73, y + h - 6, w * 0.22, 4);
    if (s.shield > 0) {
      const pulse = 0.55 + 0.45 * Math.sin(s.elapsed * 14);
      ctx.save();
      ctx.globalAlpha = s.shield < 1 ? pulse : 1;
      ctx.strokeStyle = C.lime;
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.ellipse(x, y + h / 2, w * 1.1, h * 0.75, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  };

  const drawObject = (o) => {
    const w = g.laneW * 0.86;
    const cx = laneX(o.lane);
    const cy = o.y + o.h / 2;
    const bad = o.type === 'bad';
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(o.tilt);
    const x = -w / 2;
    const y = -o.h / 2;
    const r = bad ? 4 : o.h / 2;
    // Ombre dure
    roundRect(ctx, x + 5, y + 5, w, o.h, r);
    ctx.fillStyle = bad ? C.ink2 : C.cream;
    ctx.fill();
    roundRect(ctx, x, y, w, o.h, r);
    ctx.fillStyle = bad ? C.cream : C.lime;
    ctx.fill();
    if (bad) {
      // Rubalise : bandes noires obliques sur les deux bords
      ctx.save();
      roundRect(ctx, x, y, w, o.h, r);
      ctx.clip();
      ctx.fillStyle = C.ink;
      const band = 14;
      [x, x + w - band].forEach((bx) => {
        for (let k = -o.h; k < o.h * 2; k += 12) {
          ctx.beginPath();
          ctx.moveTo(bx, y + k);
          ctx.lineTo(bx + band, y + k - band);
          ctx.lineTo(bx + band, y + k - band + 6);
          ctx.lineTo(bx, y + k + 6);
          ctx.closePath();
          ctx.fill();
        }
      });
      ctx.restore();
    }
    roundRect(ctx, x, y, w, o.h, r);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    const size = Math.max(11, Math.min(15, g.laneW / 10.5));
    ctx.font = `600 ${size}px ${FONT_TEXT}`;
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = bad ? o.label.toUpperCase() : `+ ${o.label}`;
    const lines = wrapText(ctx, text, w - (bad ? 38 : 22)).slice(0, 3);
    const lh = size * 1.22;
    lines.forEach((line, i) => ctx.fillText(line, 0, (i - (lines.length - 1) / 2) * lh + 1));
    ctx.restore();
  };

  const render = () => {
    ctx.save();
    if (s.shake > 0 && !api.reduced) ctx.translate(rand(-6, 6) * s.shake, rand(-6, 6) * s.shake);
    ctx.fillStyle = C.cream2;
    ctx.fillRect(-10, -10, g.w + 20, g.h + 20);
    // Bas-côtés : traits de vitesse
    marks.forEach((m) => {
      const x = m.x < 0.5 ? m.x * 2 * g.roadX : g.roadX + g.roadW + (m.x - 0.5) * 2 * g.roadX;
      ctx.fillStyle = `rgba(20,20,20,${0.08 + m.v * 0.16})`;
      ctx.fillRect(x, m.y * g.h, m.w, 10 + m.v * (s.speed / 40));
    });
    // Route : bitume noir, bordures crème, pointillés crème
    ctx.fillStyle = C.ink;
    ctx.fillRect(g.roadX, 0, g.roadW, g.h);
    ctx.fillStyle = C.cream;
    ctx.fillRect(g.roadX + 6, 0, 4, g.h);
    ctx.fillRect(g.roadX + g.roadW - 10, 0, 4, g.h);
    ctx.strokeStyle = 'rgba(244,240,232,0.7)';
    ctx.lineWidth = 3;
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
      ctx.fillStyle = `rgba(212,255,58,${s.flash * 0.35})`;
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
