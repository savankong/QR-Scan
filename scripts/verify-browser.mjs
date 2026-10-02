// End-to-end checks in headless Chromium. Fills in a profile, then decodes
// every QR code the app draws with jsQR and checks the visitor page.
//
// Usage:
//   npm run build && npx vite preview --port 4173 &
//   npm i --no-save playwright && npx playwright install chromium
//   node scripts/verify-browser.mjs   # BASE_URL=... to test another address
//
// Screenshots are written to .verify-shots/.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.verify-shots');
const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
const JSQR = fs.readFileSync(path.join(ROOT, 'node_modules/jsqr/dist/jsQR.js'), 'utf8');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const results = [];
const errors = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);

/** A stand-in portrait photo: portrait orientation, face in the upper half. */
async function makePortrait() {
  const page = await browser.newPage();
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 900;
    c.height = 1200;
    const x = c.getContext('2d');
    x.fillStyle = '#94a3b8';
    x.fillRect(0, 0, 900, 1200);
    x.fillStyle = '#1e293b';
    x.beginPath();
    x.ellipse(450, 1150, 330, 330, 0, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#e0b48f';
    x.beginPath();
    x.ellipse(450, 470, 170, 210, 0, 0, Math.PI * 2);
    x.fill();
    return c.toDataURL('image/jpeg', 0.9).split(',')[1];
  });
  await page.close();
  return Buffer.from(b64, 'base64');
}

/** Decodes the QR code in a canvas, optionally downscaled to mimic a camera. */
async function decodeCanvas(page, selector, scale = 1) {
  await page.addScriptTag({ content: JSQR }).catch(() => {});
  return page.evaluate(
    ([sel, s]) => {
      const src = document.querySelector(sel);
      if (!src) return 'NO_CANVAS';
      const c = document.createElement('canvas');
      c.width = Math.round(src.width * s);
      c.height = Math.round(src.height * s);
      const x = c.getContext('2d');
      x.drawImage(src, 0, 0, c.width, c.height);
      const data = x.getImageData(0, 0, c.width, c.height);
      return window.jsQR(data.data, c.width, c.height)?.data ?? null;
    },
    [selector, scale],
  );
}

const mobile = await browser.newContext({ ...devices['iPhone 13'] });
const page = await mobile.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

// Profile
await page.goto(BASE);
await page.getByLabel('Name').fill('Savan Kong');
await page.getByLabel('Title').fill('Software Engineer');
await page.getByLabel('Company').fill('Acme Labs');
await page.getByLabel('Location').fill('Seattle, WA');
await page.getByLabel('Short bio').fill('I build friendly tools for people who ship.');
await page.getByLabel('Email').fill('savan@example.com');
await page.getByLabel('Phone').fill('+1 206 555 0142');
await page.getByLabel('LinkedIn handle or URL').fill('https://www.linkedin.com/in/savan-kong/');
await page.getByLabel('LinkedIn handle or URL').blur();
await page.getByLabel('GitHub handle or URL').fill('savankong');
await page.getByLabel('Website URL').fill('savan.dev');
await page.locator('input[type=file]').first().setInputFiles({ name: 'me.jpg', mimeType: 'image/jpeg', buffer: await makePortrait() });
await page.waitForTimeout(400);
check('LinkedIn URL normalized to handle', (await page.getByLabel('LinkedIn handle or URL').inputValue()) === 'savan-kong');
check('Photo uploaded', (await page.locator('.photo-button img').count()) === 1);
await page.screenshot({ path: `${OUT}/profile.png` });

// QR tab
await page.getByRole('link', { name: 'QR code', exact: true }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/qr.png` });
const instantUrl = await decodeCanvas(page, '.qr-canvas');
check('Instant QR decodes to a card link', typeof instantUrl === 'string' && instantUrl.startsWith(`${BASE}#/c/`));
for (const style of ['Square', 'Dots', 'Rounded']) {
  await page.getByRole('radio', { name: style, exact: true }).click();
  await page.waitForTimeout(150);
  check(`${style} style decodes`, (await decodeCanvas(page, '.qr-canvas')) === instantUrl);
}
await page.getByText('Photo in the middle').click();
await page.waitForTimeout(400);
check('Photo-in-middle QR decodes', (await decodeCanvas(page, '.qr-canvas')) === instantUrl);

await page.getByRole('radio', { name: 'Save contact' }).click();
await page.waitForTimeout(200);
const vcard = await decodeCanvas(page, '.qr-canvas');
check('vCard QR decodes', typeof vcard === 'string' && vcard.startsWith('BEGIN:VCARD') && vcard.includes('FN:Savan Kong'));

await page.getByRole('radio', { name: 'Open my card' }).click();
await page.getByRole('radio', { name: 'Short' }).click();
await page.waitForTimeout(400);
check('Short link QR decodes', (await decodeCanvas(page, '.qr-canvas')) === `${BASE}#/card`);
await page.getByRole('radio', { name: 'Instant' }).click();
await page.waitForTimeout(300);

// Wallpaper tab
await page.getByRole('link', { name: 'Wallpaper', exact: true }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/wallpaper.png` });
check('Wallpaper QR decodes at full size', (await decodeCanvas(page, '.phone-canvas', 1)) === instantUrl);
check('Wallpaper QR decodes at 40% size', (await decodeCanvas(page, '.phone-canvas', 0.4)) === instantUrl);
await page.getByRole('radio', { name: 'QR only' }).click();
await page.waitForTimeout(500);
check('QR-only wallpaper decodes', (await decodeCanvas(page, '.phone-canvas', 0.5)) === instantUrl);
{
  // Full-page screenshots reset Chromium's touch emulation, so use a fresh page.
  const fresh = await mobile.newPage();
  await fresh.goto(`${BASE}#/wallpaper`);
  await fresh.waitForTimeout(800);
  const size = await fresh.evaluate(() => {
    const c = document.querySelector('.phone-canvas');
    return `${c.width}x${c.height}`;
  });
  check('Wallpaper uses this phone resolution', size === '1170x2532', size);
  await fresh.close();
}

// Visitor page
const visitor = await mobile.newPage();
visitor.on('pageerror', (e) => errors.push(`visitor pageerror: ${e.message}`));
await visitor.goto(instantUrl);
await visitor.waitForSelector('.pcard h1');
check('Visitor page shows name', (await visitor.locator('.pcard h1').textContent()) === 'Savan Kong');
check('Visitor page links LinkedIn', (await visitor.locator('a[href="https://www.linkedin.com/in/savan-kong"]').count()) === 1);
await visitor.screenshot({ path: `${OUT}/visitor.png`, fullPage: true });
const [download] = await Promise.all([visitor.waitForEvent('download'), visitor.getByRole('button', { name: 'Save contact' }).click()]);
const vcf = fs.readFileSync(await download.path(), 'utf8');
check('Save contact downloads a vCard', download.suggestedFilename() === 'Savan Kong.vcf' && vcf.includes('item1.X-ABLabel:LinkedIn'));
await visitor.goto(`${BASE}#/c/zNOT-VALID`);
await visitor.waitForTimeout(300);
check('Broken link shows a friendly error', (await visitor.locator('.public-status').textContent()).includes('incomplete'));

// Stored profile survives another tab's reload
const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }));
const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const dpage = await desktop.newPage();
await dpage.goto(BASE);
await dpage.evaluate((s) => {
  for (const [k, v] of Object.entries(JSON.parse(s))) localStorage.setItem(k, v);
}, storage);
await dpage.reload();
await dpage.waitForTimeout(500);
check('Profile survives a reload in another tab', (await dpage.getByLabel('Name').inputValue()) === 'Savan Kong');
await dpage.screenshot({ path: `${OUT}/desktop-profile.png` });

await browser.close();
console.log(results.join('\n'));
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'No page errors');
process.exitCode = results.some((r) => r.startsWith('FAIL')) || errors.length ? 1 : 0;
