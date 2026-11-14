const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');

async function startServer(t) {
  const reservation = http.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, ['tools/serve.cjs', String(port)], { cwd: root, windowsHide: true });
  t.after(() => child.kill());
  await new Promise((resolve, reject) => {
    child.stdout.once('data', resolve);
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`Server exited: ${code}`)));
  });
  return requestPath => new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: requestPath }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => body += chunk);
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    req.on('error', reject);
  });
}

test('malformed URL returns 400 and leaves server available', async t => {
  const get = await startServer(t);
  for (const malformed of ['/%ZZ', '/%00']) {
    const response = await get(malformed).catch(error => ({ status: error.code }));
    assert.equal(response.status, 400);
  }
  assert.equal((await get('/index.html?debug')).status, 200);
});

test('sibling with repository prefix cannot expose source', async t => {
  const sibling = fs.mkdtempSync(root + '-server-test-');
  t.after(() => fs.rmSync(sibling, { recursive: true, force: true }));
  fs.writeFileSync(path.join(sibling, 'secret.js'), 'private source sentinel');
  const get = await startServer(t);
  for (const separator of ['/', '%2f', '%5c']) {
    const response = await get(`/..${separator}${path.basename(sibling)}${separator}secret.js`);
    assert.equal(response.status, 403);
    assert.ok(!response.body.includes('private source sentinel'));
  }
});

test('query strings do not change file lookup', async t => {
  const get = await startServer(t);
  const response = await get('/index.html?debug&asset=1');
  assert.equal(response.status, 200);
  assert.equal(response.body, fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
  assert.equal((await get('/does-not-exist.html')).status, 404);
});

test('links inside the repository cannot expose outside source', async t => {
  const sibling = fs.mkdtempSync(root + '-server-test-');
  const link = path.join(root, `server-test-link-${path.basename(sibling)}`);
  t.after(() => { fs.unlinkSync(link); fs.rmSync(sibling, { recursive: true, force: true }); });
  fs.writeFileSync(path.join(sibling, 'secret.js'), 'private source sentinel');
  fs.symlinkSync(sibling, link, process.platform === 'win32' ? 'junction' : 'dir');
  const response = await (await startServer(t))(`/${path.basename(link)}/secret.js`);
  assert.equal(response.status, 403);
  assert.ok(!response.body.includes('private source sentinel'));
});

function runnerFixture(t) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'mars-runner-test-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  for (const directory of ['tools', 'tests/browser', 'node_modules/playwright']) fs.mkdirSync(path.join(fixture, directory), { recursive: true });
  for (const file of ['tools/static-files.cjs', 'tests/run-tests.cjs']) fs.copyFileSync(path.join(root, file), path.join(fixture, file));
  fs.writeFileSync(path.join(fixture, 'tests/browser/fixture.pw.js'), 'async page => "finished"');
  return fixture;
}

test('browser runner fails on page errors even when script resolves', t => {
  const fixture = runnerFixture(t);
  fs.writeFileSync(path.join(fixture, 'node_modules/playwright/index.js'), `
    module.exports = { chromium: { launch: async () => ({
      newContext: async () => ({
        newPage: async () => ({ on(event, callback) { this[event] = callback; }, async goto() { this.pageerror(new Error('fixture page failure')); } }),
        close: async () => {}
      }), close: async () => {}
    }) } };
  `);
  const result = spawnSync(process.execPath, ['tests/run-tests.cjs'], { cwd: fixture, env: { ...process.env, PORT: '0' }, encoding: 'utf8', timeout: 5000, windowsHide: true });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /FAIL.*fixture\.pw\.js/);
  assert.match(result.stdout, /fixture page failure/);
});

test('browser launch failure exits without leaving the server running', t => {
  const fixture = runnerFixture(t);
  fs.writeFileSync(path.join(fixture, 'node_modules/playwright/index.js'), 'module.exports = { chromium: { launch: async () => { throw new Error("fixture launch failure"); } } };');
  const result = spawnSync(process.execPath, ['tests/run-tests.cjs'], { cwd: fixture, env: { ...process.env, PORT: '0' }, encoding: 'utf8', timeout: 5000, windowsHide: true });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /fixture launch failure/);
});

test('occupied port makes both server entry points exit nonzero', async t => {
  const reservation = http.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => reservation.close(resolve)));
  const port = reservation.address().port;
  const fixture = runnerFixture(t);
  fs.copyFileSync(path.join(root, 'tools/serve.cjs'), path.join(fixture, 'tools/serve.cjs'));
  fs.writeFileSync(path.join(fixture, 'node_modules/playwright/index.js'), 'module.exports = {};');
  for (const script of ['tools/serve.cjs', 'tests/run-tests.cjs']) {
    const result = spawnSync(process.execPath, [script, String(port)], { cwd: fixture, env: { ...process.env, PORT: String(port) }, encoding: 'utf8', timeout: 5000, windowsHide: true });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /EADDRINUSE/);
  }
});
