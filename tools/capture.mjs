// capture.mjs — headless verification + screenshot capture for PALMETTO HEAT.
// Uses puppeteer-core with the cached chrome-headless-shell (SwiftShader).
// Usage: node tools/capture.mjs [port]
// Captures the 4 submission shots as 1280x800 JPEGs into screenshots/ and
// fails loudly on any pageerror / console error / failed request.

import puppeteer from '/tmp/ph-tools/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.argv[2] || 8123);
const SHELL = process.env.HOME + '/.cache/puppeteer/chrome-headless-shell/linux-157.0.8103.78/chrome-headless-shell-linux64/chrome-headless-shell';

const server = spawn('node', ['serve.ts', '--port', String(port)], { cwd: root, stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 900));

const errors = [];
const browser = await puppeteer.launch({
  executablePath: SHELL,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'],
});
async function runPage(query, label) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${label}] console: ${m.text()}`); });
  page.on('requestfailed', (r) => errors.push(`[${label}] requestfailed: ${r.url()} ${r.failure()?.errorText}`));
  await page.goto(`http://127.0.0.1:${port}/${query}`, { waitUntil: 'load', timeout: 30000 });
  return page;
}

const shots = [
  ['1-hero.jpg', '?shot=hero'],
  ['2-foot.jpg', '?shot=foot'],
  ['3-chase.jpg', '?shot=chase'],
  ['4-mission.jpg', '?shot=mission'],
];
for (const [name, query] of shots) {
  const page = await runPage(query, name);
  await page.waitForFunction('window.__shotReady === true', { timeout: 150000 });
  await new Promise((r) => setTimeout(r, 350));
  const out = join(root, 'screenshots', name);
  await page.screenshot({ path: out, type: 'jpeg', quality: 82 });
  console.log(name, statSync(out).size, 'bytes');
  await page.close();
}

// Normal boot: title -> Enter -> walk forward, expect no errors.
{
  const page = await runPage('', 'boot');
  await new Promise((r) => setTimeout(r, 1200));
  await page.keyboard.press('Enter');
  await new Promise((r) => setTimeout(r, 600));
  await page.keyboard.down('KeyW');
  await new Promise((r) => setTimeout(r, 1200));
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyM');
  await new Promise((r) => setTimeout(r, 800));
  console.log('boot ok');
  await page.close();
}

await browser.close();
server.kill();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('ALL PAGES: zero JS errors');
for (const [name] of shots) {
  const p = join(root, 'screenshots', name);
  if (!existsSync(p) || statSync(p).size > 262144) { console.error('gate fail:', name); process.exit(1); }
}
console.log('screenshot size gate OK');
