# Solbound — Junior Astronaut Mission Trainer

**Solbound** is a browser game for kids ages 7–12. You run a small outpost in Jezero Crater on Mars for 30 sols (a sol is one Mars day). Every day there is only so much power. Power you give to the oxygen maker cannot also grow food, build the radiation shield or do science. Solar storms from NASA's DONKI space-weather records, dust storms, broken machines and radio delays push you to make real engineering trade-offs.

It was built for the 2026 NASA Space Apps Challenge "Build a Junior Astronaut Mission Trainer".

## What you do

- **Share the power.** Each sol you split a limited number of power "blocks" between Oxygen, Greenhouse, Shield and Science. Leftover power charges the battery. Every choice has a cost.
- **Keep the crew alive.** Oxygen, food and radiation dose are the three core gauges. Water, medicine and mood add care decisions inside the habitat.
- **Plan ahead.** Greenhouse crops take 3 sols to harvest. Shield levels lower radiation every day after you build them. A dust storm cuts solar power to about 30%.
- **Go outside.** Walk the astronaut around the base in third person. Clean dusty solar panels, plug in a loose connector, scan the ground and collect rock samples. Each trip costs oxygen and adds radiation.
- **Face real space weather.** Solar storm events come from real NASA DONKI records. The game tries to load the latest DONKI flares when it starts.
- **Wait for Earth.** Earth–Mars distance and radio delay are calculated for today's date from JPL orbital elements. Asking Earth for help takes real minutes.
- **Learn from the ending.** Six endings and a mission report show which decisions changed your oxygen, food, radiation and science.

## Screenshots

Recorded from this build (Chrome, 1920×1080): `docs/screenshots/` — title screen, 3D habitat, Console power sharing, dusty and cleaned solar panels outside, a real DONKI solar-storm event, the Data Sources page and a 30-sol mission report.

## Quick start (Windows, macOS, Linux)

Playing needs only a browser and a static web server (Node.js or Python). No npm packages are needed to play.

1. Install Node.js 18 or newer from https://nodejs.org (or use any static web server, for example `python -m http.server 8765`).
2. Unzip the project and open a terminal in the folder that contains `package.json`.
3. Start the local server:

   ```powershell
   npm start
   # same as: node tools/serve.cjs 8765
   ```

4. Open http://127.0.0.1:8765/ in Chrome, Edge or Firefox. WebGL must be available.

Notes:
- Please use the local server. Opening `index.html` directly from the file system is blocked by browser security rules.
- Everything the game needs is in this folder: Three.js r128, D3, TopoJSON, Natural Earth map data and the Fredoka and Nunito fonts are all in `vendor/`. The game works offline.
- The only network call is optional: the live NASA DONKI request at start-up (`api.nasa.gov`, public `DEMO_KEY`). The shared DEMO_KEY is often rate-limited; when the call fails, the title screen says "Offline mode" and the game uses its archive of real DONKI events.
- There is no build step. The source files are the finished game.

## Controls

- Click (or tap) objects in the habitat: water recycler, water tank, food locker, first aid kit, radio, calendar, lab bench, bed and the astronaut.
- Click the Console or the power card to open the 3D base view and share power with the − / + buttons.
- Outside: WASD or arrow keys to move, drag to look around, walk to a yellow marker and press E (or tap the action button). Phones and tablets get an on-screen joystick.
- Click the bed (or "End the Day" on the Console) to see tonight's gains and losses and start the next sol.
- Sol 1 has an optional guided tutorial. You can skip it at any time.

## NASA data and how it is used

Open **Data Sources & Notes** on the title screen or the Console to see every source inside the game.

| Data | Where it is used | Type |
|---|---|---|
| NASA DONKI flares (live, `api.nasa.gov/DONKI/FLR`) | Strongest flare of the last 30 days becomes a solar-storm event; title screen and Data Sources show the live status | Live when available |
| Optional DONKI snapshot slot (`data/donki-snapshot.js`) | If a dated, unmodified DONKI FLR download is placed here, it is used only when the live request fails and is labelled "snapshot (not live)". This build ships the slot empty. Without live access or a snapshot, it uses the curated archive. | Optional, empty in this build |
| Curated DONKI archive events (2012, 2017, 2021, 2024) | Solar-storm events with real dates; the May 20, 2024 storm uses Curiosity RAD's measured dose | Stored real events |
| Curiosity RAD, Perseverance MOXIE and MEDA, InSight, Opportunity, Spirit, Veggie, Twins Study, NASA-STD-3001 | Facts, numbers and comparisons in cards, events and the mission report | Published NASA results |
| JPL approximate planetary orbital elements | Earth–Mars distance and radio delay for today's date | Live calculation |

The game also clearly lists what is simplified: power "blocks", the 25 mSv mission limit, water, medicine and mood values, and how fast crops grow are game rules, not real mission numbers. Solar-storm doses marked "game estimate" are estimates.

## Testing

```powershell
npm ci                 # installs the only dev dependency (Playwright), pinned by package-lock.json
npm run browsers       # downloads Playwright's Chromium once (about 150 MB)
npm test               # 27 logic, English-content and server tests + 19 browser scripts
```

- Logic tests only: `npm run test:logic` (no install needed).
- One browser script: `node tests/run-tests.cjs first-day`.
- To use an installed Chrome instead of downloading Chromium (PowerShell): `$env:CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"; npm run test:browser`.
- `tests/run-tests.cjs` starts its own static server on port 8766, runs `tests/browser/*.pw.js`, writes `output/test-results.json` and screenshots to `output/playwright/`.

## Project structure

```text
index.html            page structure and title/HUD styles
css/                  habitat, Console, expedition, notebook and cabin theme styles
js/data.js            real data layer: constants with sources, DONKI archive, live DONKI + snapshot fallback, JPL distance
js/game.js            game state, daily resource settlement, events, interface
js/world.js           Three.js Mars surface, base, intro and endings (toon shading, ink outlines, halftone)
js/cabin3d.js         real-time 3D habitat rendered with the same pipeline
js/habitat.js         habitat hotspots, item cards and accessibility labels
js/expedition.js      trips outside: departure check, tasks, tutorial guide
js/expedition-model.js, js/astronaut.js   task state machine and movement (unit tested)
js/audio.js           all sound is synthesized live with Web Audio (no audio files)
data/donki-snapshot.js  optional dated DONKI FLR snapshot slot (empty in this build; never shown as live)
vendor/               Three.js r128, D3, TopoJSON, Natural Earth data, fonts (with licenses)
tools/serve.cjs       zero-dependency local server (npm start)
tests/                logic tests and Playwright browser scripts (tests/run-tests.cjs)
deploy/mars.conf      example nginx config for hosting under /mars/
docs/screenshots/     recorded gameplay screenshots
```

## Credits and licenses

- Three.js (MIT), D3 and TopoJSON (ISC), Natural Earth (public domain) — see `vendor/`.
- Fredoka and Nunito fonts — SIL Open Font License 1.1, see `vendor/fonts/OFL-*.txt`.
- NASA data is used as public information and cited in the game. Solbound is not made or endorsed by NASA, and it does not use NASA logos or mission insignia.
- Super Intelligence (SI) disclosure: the game code, art (procedural 3D and SVG) and text were written with the help of an AI coding assistant (Claude) under the team's direction. All sounds are synthesized in code at runtime.

## Import verification (2026-11-15)

This English-only build replaces the Chinese runtime on `main`. The previous fixes for malformed local-server URLs, filesystem confinement, browser-test error reporting, reduced motion and short landscape screens are retained. English resource names and 3D captions were checked for overlap at desktop, portrait-phone and landscape-phone sizes.

English-content tests reject untranslated Chinese in authored runtime HTML, CSS, JavaScript and data. NASA tests distinguish live data, dated snapshots and the curated archive. An offline browser test blocks all external requests, checks the bundled English fonts, opens item cards and verifies source labels.

See `docs/verification-2026-11-15.md` for the final checks and limitations. The game contains no language selector; archived development documents may retain their original language.
