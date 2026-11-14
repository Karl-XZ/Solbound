#!/usr/bin/env node
/* Self-contained test runner: static server + Playwright browser scripts in tests/browser/*.pw.js.
   Usage: node tests/run-tests.cjs [filter]      (run from the project root)
   Env:   CHROME_PATH=/path/to/chrome  (optional: use an installed Chrome instead of Playwright's bundled browser)
          PORT=8766 */
const http = require('http'), fs = require('fs'), path = require('path');
const staticFiles = require('../tools/static-files.cjs');
const root = path.resolve(__dirname, '..'), PORT = +(process.env.PORT || 8766), filter = process.argv[2] || '';
let pw; for (const name of ['playwright', 'playwright-core', process.env.PLAYWRIGHT_CORE].filter(Boolean)) { try { pw = require(name); break; } catch (e) {} }
if (!pw) { console.error('Playwright not found. Run "npm install" (and "npx playwright install chromium") first.'); process.exit(2); }
const server = http.createServer(staticFiles(root));
let browser;
(async () => {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(PORT, '127.0.0.1', resolve); });
  fs.mkdirSync(path.join(root, 'output/playwright'), { recursive: true }); process.chdir(root);
  const launch = { headless: true, args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  browser = await pw.chromium.launch(launch);
  const files = fs.readdirSync(path.join(root, 'tests/browser')).filter(f => f.endsWith('.pw.js') && f.includes(filter)).sort();
  const results = [];
  // Scripts that do not set their own viewport expect the device the original Playwright CLI session used.
  const CONTEXT = { 'mobile.pw.js': { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } };
  const DEFAULT = { viewport: { width: +(process.env.VW || 1280), height: +(process.env.VH || 720) } };
  for (const f of files) {
    const ctx = await browser.newContext(CONTEXT[f] || DEFAULT), page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const t0 = Date.now(); let ok = false, detail = '', timeout;
    try {
      await page.goto(`http://127.0.0.1:${PORT}/?debug`, { waitUntil: 'load' });
      const fn = new Function('return (' + fs.readFileSync(path.join(root, 'tests/browser', f), 'utf8') + ')')();
      const out = await Promise.race([fn(page), new Promise((_, rej) => { timeout = setTimeout(() => rej(new Error('timeout 300s')), 300000); })]);
      ok = true; detail = JSON.stringify(out ?? null).slice(0, 220);
    } catch (e) { detail = String(e && e.message || e).split('\n').filter(Boolean).slice(0, process.env.VERBOSE ? 12 : 1).join(' / ').slice(0, process.env.VERBOSE ? 2000 : 300); }
    finally { clearTimeout(timeout); }
    if (errors.length) { ok = false; detail += ' | pageerrors: ' + errors.slice(0, 3).join(' ; ').slice(0, 200); }
    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${f}  (${sec}s)  ${detail}`); results.push({ f, ok, sec, detail });
    await ctx.close();
  }
  const pass = results.filter(r => r.ok).length; console.log(`\n${pass}/${results.length} browser scripts passed`);
  fs.writeFileSync(path.join(root, 'output/test-results.json'), JSON.stringify(results, null, 2));
  process.exitCode = pass === results.length ? 0 : 1;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  try { if (browser) await browser.close(); }
  finally { server.closeAllConnections(); server.close(); }
});
