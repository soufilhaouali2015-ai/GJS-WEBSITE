/* ==========================================================================
   GJS · VIDÉO DU HERO · ÉTAPE 3 : RENDU IMAGE PAR IMAGE
   Ouvre scene.html dans Chromium sans écran (WebGL logiciel SwiftShader :
   aucun GPU nécessaire), rend chaque image et l'enregistre en PNG dans
   out/<format>/f_0000.png. Reprend là où il s'était arrêté (images déjà
   présentes ignorées).

   Usage :
     node render.mjs --format desktop --w 1920 --h 1080 --spp 20
     node render.mjs --format mobile  --w 720  --h 1280 --spp 20
   Options : --from 0 --to 287 (bornes incluses), --frames 0,72,144 (liste),
             --steps 40 (pas de la fumée), --out out
   Playwright : variable PLAYWRIGHT_MODULE ou paquet « playwright » installé.
   ========================================================================== */

import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, all) => {
  if (v.startsWith('--')) acc.push([v.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']);
  return acc;
}, []));
const format = args.format || 'desktop';
const w = Number(args.w || (format === 'mobile' ? 720 : 1920));
const h = Number(args.h || (format === 'mobile' ? 1280 : 1080));
const spp = Number(args.spp || 20);
const steps = Number(args.steps || 40);
const outDir = join(here, args.out || 'out', format);
const TOTAL = 288;
const from = Number(args.from || 0);
const to = Math.min(TOTAL - 1, Number(args.to ?? TOTAL - 1));
const list = args.frames ? args.frames.split(',').map(Number) : Array.from({ length: to - from + 1 }, (_, i) => from + i);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([.][.][/\\])+/, '');
    const file = join(here, path === '/' ? 'scene.html' : path);
    if (!file.startsWith(here)) throw new Error('hors du dossier');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--disable-features=GpuWatchdog'],
});
const page = await browser.newPage({ viewport: { width: Math.min(w, 1920), height: Math.min(h, 1920) } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[page] ${m.text()}`); });
page.on('pageerror', (e) => console.log(`[page] ${e.message}`));
await page.goto(`http://127.0.0.1:${port}/scene.html?w=${w}&h=${h}&format=${format}&spp=${spp}&steps=${steps}${args.debug ? "&debug=1" : ""}`);
const info = await page.evaluate(() => window.GJS.ready);
console.log(`Scène prête : ${JSON.stringify(info)}`);

const exists = async (f) => access(f).then(() => true, () => false);
const started = Date.now();
let done = 0;
for (const i of list) {
  const file = join(outDir, `f_${String(i).padStart(4, '0')}.png`);
  if (await exists(file) && !args.force) continue;
  const t0 = Date.now();
  const url = await page.evaluate((n) => window.GJS.render(n), i);
  await writeFile(file, Buffer.from(url.split(',')[1], 'base64'));
  done += 1;
  const each = (Date.now() - started) / done / 1000;
  console.log(`image ${i} : ${((Date.now() - t0) / 1000).toFixed(1)} s (moyenne ${each.toFixed(1)} s)`);
}
await browser.close();
server.close();
console.log(`Terminé : ${done} image(s) dans ${outDir}`);
