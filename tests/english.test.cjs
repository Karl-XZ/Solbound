const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// Keep quoted content, including URLs. Remove only source comments.
function withoutComments(source, lineComments) {
  let result = '', quote = '';
  for (let i = 0; i < source.length; i++) {
    const char = source[i], next = source[i + 1];
    if (quote) {
      result += char;
      if (char === '\\') result += source[++i] || '';
      else if (char === quote) quote = '';
    } else if ('\'"`'.includes(char)) {
      quote = char;
      result += char;
    } else if (char === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      assert.notEqual(end, -1, 'Source block comment must close');
      result += source.slice(i, end + 2).replace(/[^\n]/g, ' ');
      i = end + 1;
    } else if (lineComments && char === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      result += '\n';
    } else result += char;
  }
  return result;
}

function authoredFiles(directory) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true })
    .flatMap(entry => {
      const file = path.join(directory, entry.name);
      return entry.isDirectory() ? authoredFiles(file) : /\.(js|css)$/.test(file) ? [file] : [];
    });
}

function readableSource(file) {
  const source = read(file);
  if (file.endsWith('.html')) {
    return source.replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/gi,
        (_, tag, body) => withoutComments(body, tag.toLowerCase() === 'script'));
  }
  return withoutComments(source, file.endsWith('.js'));
}

test('authored runtime content has no untranslated Chinese, including CSS labels', () => {
  const failures = [];
  for (const file of ['index.html', ...authoredFiles('js'), ...authoredFiles('css'), ...authoredFiles('data')]) {
    const source = readableSource(file).replace(/\\u(?:\{([\da-f]+)\}|([\da-f]{4}))/gi,
      (_, full, short) => String.fromCodePoint(parseInt(full || short, 16)));
    source.split('\n').forEach((line, index) => {
      if (/\p{Script=Han}/u.test(line)) failures.push(`${file}:${index + 1}: ${line.trim().slice(0, 180)}`);
    });
  }
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('English document declares its language and keeps canonical player terms', () => {
  assert.match(read('index.html'), /<html\b[^>]*\blang=["']en["']/i);
  const corpus = ['index.html', 'js/game.js', 'js/habitat.js', 'js/expedition.js']
    .map(readableSource).join('\n');
  for (const term of ['Console', 'Habitat', 'Base View', 'Go Outside', 'Go In',
    'Finish Power Plan', 'End the Day', 'Oxygen', 'Food', 'Radiation dose', 'Science', 'Battery', 'Shield', 'Sol']) {
    assert.ok(corpus.includes(term), `Missing canonical player term: ${term}`);
  }
});

test('all nested DATA text and generated live flare text are English', () => {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(read('js/data.js'), context);
  const data = context.window.DATA;
  function check(value, location) {
    if (typeof value === 'string') assert.doesNotMatch(value, /\p{Script=Han}/u, location);
    else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) check(child, `${location}.${key}`);
    }
  }
  check(data, 'DATA');
  data.live.status = 'ok';
  data.live.flares.push({ cls: 'X6.0', peak: '2026-11-12T00:00Z', region: 123 });
  const event = data.liveFlareEvent();
  assert.ok(event, 'Live flare fixture must produce an event');
  check(event, 'liveFlareEvent');
});

function loadData(options = {}) {
  const context = {
    window: { DONKI_SNAPSHOT: options.snapshot },
    localStorage: { getItem: () => null, setItem: () => {} },
    AbortController, clearTimeout,
    setTimeout: (callback, delay) => { const timer = setTimeout(callback, delay); timer.unref(); return timer; },
    fetch: options.fetch || (async () => { throw new Error('Offline fixture'); })
  };
  vm.createContext(context);
  vm.runInContext(read('js/data.js'), context);
  return context.window.DATA;
}

test('offline fallback labels the dated snapshot and its event as recorded, never live', async () => {
  const data = loadData({ snapshot: {
    downloaded: '2026-11-01T12:00:00Z', startDate: '2026-10-01', endDate: '2026-10-31',
    source: 'NASA DONKI FLR',
    flares: [
      { classType: 'M5.0', peakTime: '2026-10-12T08:00:00Z' },
      { classType: 'X2.0', peakTime: '2026-10-15T09:00:00Z', activeRegionNum: 1234 }
    ]
  } });
  const result = await data.fetchDonki();
  assert.equal(result.status, 'snapshot');
  assert.equal(result.flares[0].cls, 'X2.0');
  const event = data.liveFlareEvent();
  assert.equal(event.live, false);
  assert.equal(event.snapshot, true);
  assert.equal(event.date, '2026-10-15');
  assert.match(event.kind, /snapshot/);
  assert.match(event.note, /2026-10-01 to 2026-10-31/);
  assert.match(event.src, /snapshot, downloaded 2026-11-01/);
  assert.equal(event.doseKind, 'estimate');
});

test('NASA success stays live and only M5 or stronger creates a game event', async () => {
  const data = loadData({ fetch: async () => ({ ok: true, json: async () => [
    { classType: 'C9.0', peakTime: '2026-11-12T00:00:00Z' },
    { classType: 'M4.9', peakTime: '2026-11-13T00:00:00Z' }
  ] }) });
  assert.equal((await data.fetchDonki()).status, 'ok');
  assert.equal(data.liveFlareEvent(), null);
  data.live.flares[0].cls = 'M5.0';
  const event = data.liveFlareEvent();
  assert.equal(event.live, true);
  assert.equal(event.snapshot, false);
  assert.equal(event.dose, 1.5);
  assert.equal(event.doseKind, 'estimate');
  assert.match(event.src, /live API/);
});

test('without NASA access or a bundled snapshot, the archive remains the fallback', async () => {
  const data = loadData();
  assert.equal((await data.fetchDonki()).status, 'fail');
  assert.equal(data.liveFlareEvent(), null);
  assert.equal(data.flares.length, 6);
  assert.ok(data.flares.every(event => event.date && event.note && event.src));
});
