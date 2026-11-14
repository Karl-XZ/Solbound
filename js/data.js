/* =====================================================================
   Real data layer
   - Every number that appears in the game has its source written here
   - real: real measurements or public data from NASA missions and papers
   - game: simplifications that keep the game fun (also labeled on the Data Sources page)
   ===================================================================== */
window.DATA = (function () {

  /* ---------- real constants for Mars and the mission ---------- */
  const facts = {
    solLength: '24 hours 39 minutes 35 seconds',
    gravity: 0.38,                 // 38% of Earth's
    sunlight: 0.43,                // sunlight at Mars is about 43% as strong as at Earth
    pressure: 'less than 1% of Earth’s',
    nightTemp: -80,                // Jezero Crater nights are about -80°C (Perseverance MEDA weather station)
    radSurface: 0.67,              // mSv per sol, measured by Curiosity RAD in Gale Crater (Hassler et al., 2014)
    radCruise: 1.84,               // mSv per day, measured by Curiosity on the way to Mars (Zeitlin et al., 2013)
    earthBackground: 2.4,          // mSv per year, average natural background radiation on Earth
    careerLimit: 600,              // mSv, NASA career dose limit for astronauts (NASA-STD-3001, 2022)
    o2PerPerson: 0.84,             // kg per person per day, NASA life-support design baseline
    moxieTotal: 122,               // grams, total oxygen made by Perseverance's MOXIE over 16 runs
    moxiePeak: 12,                 // grams per hour, MOXIE's best oxygen rate
    moxiePurity: 98,               // %
    issWater: 98,                  // %, water recovery reached on the International Space Station in 2023
    opportunityPlanned: 90,        // sols Opportunity was planned to work
    opportunityActual: 5111,       // sols Opportunity had worked by its last contact
    boneLoss: '1%–1.5% per month',       // how fast astronauts lose bone density in weightlessness
    jezero: { lat: 18.4, lon: 77.5, size: 'about 45 km wide' }
  };

  /* ---------- NASA DONKI archive: real solar storm events ----------
     dose: in-game dose (mSv) "if this event hit Mars while you were outside"
     doseKind: 'measured' converted from a real measurement;'estimate' game estimate */
  const flares = [
    { date: '2024-05-20', cls: 'X12', kind: 'Flare + coronal mass ejection',
      note: 'This storm hit Mars head-on. Curiosity’s RAD instrument measured 8,100 micrograys. NASA compared it to about 30 chest X-rays.',
      dose: 8.1, doseKind: 'measured', src: 'NASA DONKI; NASA/JPL news release (June 2024)' },
    { date: '2017-09-10', cls: 'X8.2', kind: 'Flare + solar energetic particle event',
      note: 'Radiation on the Mars surface more than doubled. The MAVEN orbiter saw auroras all over the planet.',
      dose: 4.0, doseKind: 'estimate', src: 'NASA DONKI; NASA MAVEN / Curiosity RAD news release (September 2017)' },
    { date: '2017-09-06', cls: 'X9.3', kind: 'Flare',
      note: 'This was the strongest flare of Solar Cycle 24. Four days later the same sunspot group made an X8.2 flare.',
      dose: 3.0, doseKind: 'estimate', src: 'NASA DONKI' },
    { date: '2024-10-03', cls: 'X9.0', kind: 'Flare',
      note: 'One of the strongest flares of Solar Cycle 25. The Sun was near the peak of its 11-year activity cycle.',
      dose: 3.0, doseKind: 'estimate', src: 'NASA DONKI' },
    { date: '2021-10-28', cls: 'X1.0', kind: 'Flare + ground level enhancement (GLE73)',
      note: 'This storm made high-energy particles. Neutron detectors on the ground on Earth noticed them too.',
      dose: 2.5, doseKind: 'estimate', src: 'NASA DONKI' },
    { date: '2012-07-23', cls: 'Super-fast CME', kind: 'Coronal mass ejection',
      note: 'STEREO-A measured it moving at about 3,000 km per second. Scientists estimate it could have hit Earth if it had erupted one week earlier.',
      dose: 6.0, doseKind: 'estimate', src: 'NASA DONKI; Baker et al. (2013), Space Weather' }
  ];

  /* ---------- live: NASA DONKI flares from the last 30 days ---------- */
  let live = { status: 'idle', flares: [], fetchedAt: null };
  const ymd = d => d.toISOString().slice(0, 10);
  function clsRank(c) { const m = { X: 4, M: 3, C: 2, B: 1, A: 0 }; return (m[c[0]] || 0) * 100 + parseFloat(c.slice(1) || 0); }
  async function fetchDonki() {
    if (live.status === 'ok' || live.status === 'loading') return live;
    live.status = 'loading';
    try {
      const cached = JSON.parse(localStorage.getItem('donki-cache') || 'null');
      if (cached && Date.now() - cached.t < 3600e3) { live = { status: 'ok', flares: cached.f, fetchedAt: new Date(cached.t) }; return live; }
    } catch (e) {}
    const end = new Date(), start = new Date(Date.now() - 30 * 864e5);
    const url = `https://api.nasa.gov/DONKI/FLR?startDate=${ymd(start)}&endDate=${ymd(end)}&api_key=DEMO_KEY`;
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch(url, { signal: ctl.signal }); clearTimeout(to);
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      const f = (Array.isArray(j) ? j : []).filter(x => x.classType).map(x => ({ cls: x.classType, peak: x.peakTime || x.beginTime, region: x.activeRegionNum }))
        .sort((a, b) => clsRank(b.cls) - clsRank(a.cls));
      live = { status: 'ok', flares: f, fetchedAt: new Date() };
      try { localStorage.setItem('donki-cache', JSON.stringify({ t: Date.now(), f })); } catch (e) {}
    } catch (e) { live = fromSnapshot() || { status: 'fail', flares: [], fetchedAt: null }; }
    return live;
  }
  // Offline fallback: a dated, unmodified download of the same DONKI FLR feed (data/donki-snapshot.js).
  // It is always labelled as a snapshot, never as live data.
  function fromSnapshot() {
    const s = window.DONKI_SNAPSHOT; if (!s || !Array.isArray(s.flares)) return null;
    const f = s.flares.filter(x => x.classType).map(x => ({ cls: x.classType, peak: x.peakTime || x.beginTime, region: x.activeRegionNum })).sort((a, b) => clsRank(b.cls) - clsRank(a.cls));
    return { status: 'snapshot', flares: f, fetchedAt: new Date(s.downloaded), range: [s.startDate, s.endDate], source: s.source };
  }
  // turn the strongest flare in the live data into a game event (only M5 or stronger counts)
  function liveFlareEvent() {
    if (!['ok', 'snapshot'].includes(live.status) || !live.flares.length) return null;
    const snapshot = live.status === 'snapshot';
    const f = live.flares[0]; const r = clsRank(f.cls);
    if (r < 305) return null;
    return { date: f.peak.slice(0, 10), cls: f.cls, kind: snapshot ? 'Flare (DONKI snapshot)' : 'Flare (live data)', live: !snapshot, snapshot,
      note: `This is the strongest flare NASA DONKI recorded in ${snapshot ? 'the saved snapshot (' + live.range.join(' to ') + ')' : 'the last 30 days'}. It happened on ${f.peak.slice(0, 10)}${f.region ? '. It came from sunspot region ' + f.region : ''}. The game imagines it is pointed at Mars.`,
      dose: r >= 400 ? Math.min(6, 2 + (r - 400) / 3) : 1.5, doseKind: 'estimate', src: snapshot ? `NASA DONKI FLR snapshot, downloaded ${live.fetchedAt.toISOString().slice(0, 10)}` : 'NASA DONKI live API (api.nasa.gov)' };
  }

  /* ---------- Earth–Mars distance: computed from JPL planetary orbital elements ----------
     Standish, "Keplerian Elements for Approximate Positions of the Major Planets" (JPL) */
  const EL = {
    earth: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0, 0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
    mars:  [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891, 0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]
  };
  function helio(e, T) {
    const r = Math.PI / 180;
    const a = e[0] + e[6] * T, ec = e[1] + e[7] * T, I = (e[2] + e[8] * T) * r, L = e[3] + e[9] * T, wb = e[4] + e[10] * T, O = (e[5] + e[11] * T) * r;
    const w = wb * r - O; let M = ((L - wb) % 360) * r;
    let E = M + ec * Math.sin(M); for (let i = 0; i < 8; i++) E = E - (E - ec * Math.sin(E) - M) / (1 - ec * Math.cos(E));
    const xp = a * (Math.cos(E) - ec), yp = a * Math.sqrt(1 - ec * ec) * Math.sin(E);
    const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(I), sI = Math.sin(I);
    return [(cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
            (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
            (sw * sI) * xp + (cw * sI) * yp];
  }
  function earthMars(date = new Date()) {
    const JD = date.getTime() / 864e5 + 2440587.5, T = (JD - 2451545) / 36525;
    const a = helio(EL.earth, T), b = helio(EL.mars, T);
    const au = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    return { au, km: au * 149597870.7, minutes: au * 499.004784 / 60 };
  }

  /* ---------- data source list (shown on the Data Sources page) ---------- */
  const sources = [
    { tag: 'Live + snapshot + archive', title: 'NASA DONKI Space Weather Database',
      body: 'Records of solar flares, coronal mass ejections and energetic particle events. Every solar storm in the game is a real event on its real date. When the page opens, it tries to load the last 30 days of flare records from NASA. If NASA is unavailable, it uses a dated snapshot when one is included, or the curated archive of past events. Each source is labelled.',
      link: 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/' },
    { tag: 'Real measurement', title: 'Curiosity RAD radiation detector',
      body: 'About 0.67 millisieverts (mSv) per sol on the Mars surface, and about 1.84 mSv per day on the way to Mars. It measured 8,100 micrograys during the solar storm of May 20, 2024.',
      link: 'https://science.nasa.gov/mission/msl-curiosity/science-instruments/' },
    { tag: 'Real measurement', title: 'Perseverance MOXIE oxygen experiment',
      body: 'It ran 16 times from 2021 to 2023. It made 122 grams of oxygen in total. Its best rate was 12 grams per hour, at 98% purity. One person needs about 0.84 kg of oxygen per day.',
      link: 'https://science.nasa.gov/mission/mars-2020-perseverance/' },
    { tag: 'Real record', title: 'Opportunity and the 2018 global dust storm',
      body: 'The dust blocked almost all sunlight. The optical depth τ went above 10. Opportunity lost contact on June 10, 2018. It was planned to work for 90 sols. It actually worked for 5,111 sols.',
      link: 'https://science.nasa.gov/mission/mer-opportunity/' },
    { tag: 'Real record', title: 'Dust devil “cleaning events”',
      body: 'Dust devils blew the dust off Spirit’s and Opportunity’s solar panels many times, and power went back up. The InSight lander ended its mission in 2022 because its panels were too dusty.',
      link: 'https://mars.nasa.gov/mer/' },
    { tag: 'Real research', title: 'NASA Twins Study · health in space',
      body: 'Scott Kelly lived on the space station for almost a year. Researchers compared him with his twin brother on Earth. Six months after he came home, about 7% of the gene-activity changes had still not gone back to normal. The study was published in Science in 2019. In weightlessness, bones lose 1%–1.5% of their density each month.',
      link: 'https://www.nasa.gov/humans-in-space/twins-study/' },
    { tag: 'Real record', title: 'Veggie space garden · station life support',
      body: 'Astronauts first ate red lettuce grown on the space station in August 2015. The station’s water recovery reached 98% in 2023.',
      link: 'https://www.nasa.gov/international-space-station/' },
    { tag: 'Real discovery', title: 'Jezero Crater and the “Cheyava Falls” rock',
      body: 'Jezero was once a lake. Perseverance found a spotted rock at the edge of the old river delta. NASA shared the research in September 2025. The rock may hold clues to ancient life. Scientists still need to confirm it.',
      link: 'https://science.nasa.gov/mission/mars-2020-perseverance/' },
    { tag: 'Live calculation', title: 'JPL planetary orbital elements',
      body: 'The Earth–Mars distance and signal time are calculated for today’s date, using orbital elements published by JPL.',
      link: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html' },
    { tag: 'Real measurement', title: 'InSight marsquake record',
      body: 'The InSight lander recorded more than 1,300 marsquakes. The biggest, on May 4, 2022, was about magnitude 4.7.',
      link: 'https://science.nasa.gov/mission/insight/' },
    { tag: 'Real research', title: 'Using local materials and 3D-printed habitats',
      body: 'NASA is studying how to print buildings from local soil, and has run design challenges about it. The game’s building task is based on this idea.',
      link: 'https://www.nasa.gov/prizes-challenges-and-crowdsourcing/centennial-challenges/3d-printed-habitat-challenge/' },
    { tag: 'Real data', title: 'Natural Earth 1:110m coastlines',
      body: 'Earth’s continent outlines in the intro come from public Natural Earth map data.',
      link: 'https://www.naturalearthdata.com/' },
    { tag: 'Standard', title: 'NASA-STD-3001 astronaut health standard',
      body: 'NASA limits an astronaut’s radiation dose to 600 mSv over a whole career.',
      link: 'https://www.nasa.gov/ochmo/' }
  ];

  const simplifications = [
    'Water, medicine and mood values are game rules. They are not real amounts of water or medicine.',
    'The game’s 30-sol radiation limit is 25 mSv. This is a training rule, not a real mission safety limit.',
    'The game counts power in “blocks”. A sunny day makes about 12 blocks. Sunlight on Mars is about 43% as strong as on Earth. Dusty solar panels make less power.',
    'Mars soil and water can block radiation. In the game, building the shield uses power to run a digger.',
    'Cosmic rays from deep space are hard to block. Solar storm particles are easier to block. So shielding works differently for each kind of radiation.',
    'The greenhouse in the game is ready to harvest in 3 sols. Real crops take longer.',
    'Solar storm doses marked “game estimate” are estimates. The May 20, 2024 event uses Curiosity’s real measurement.'
  ];

  return { facts, flares, sources, simplifications, fetchDonki, liveFlareEvent, earthMars, get live() { return live; } };
})();
