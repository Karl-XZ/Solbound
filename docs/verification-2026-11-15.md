# Solbound English edition verification — 2026-11-15

Source: `Solbound_3D_EN_Project.zip`. Previous main commit: `b1c8e52`.

## Delivered version

The runtime is English only, branded Solbound. There is no language selector. The original game values, third-person outdoor controls and 3D habitat are retained. Fredoka and Nunito are bundled with their licenses. Chinese screenshots from the previous build are replaced by the English submission screenshots; historical development notes remain in Git history and existing archive documents.

## Issues corrected or retained from the previous verification

- Retained the fixed local HTTP server, filesystem confinement, runtime-error test failure detection, reduced-motion support and compact landscape HUD. The archive supplied older versions of several of these files.
- Fixed partial overlaps between longer English cabin captions and the bottom dashboard. Scene geometry and camera placement are unchanged.
- Fixed English resource names/help buttons colliding with resource bars and forecast text wrapping into narrow columns.
- Fixed the phone Greenhouse plus button extending outside the card. All eight +/- controls are now tested against card and screen bounds.
- Moved the active phone tutorial below Outpost Status and above the power card. Added overlap assertions.
- Corrected English instructions, units, spacing and page labels. Archived solar flares are explicitly described as dated replays. Live NASA data, optional snapshots and the curated archive are distinguished.
- Replaced screenshot-byte equality in the motion test with assertions on shader time, transforms, visibility and glow. Screenshot readbacks varied at low pixel precision even with frozen render inputs. The new regression was verified to fail when reduced-motion support was temporarily removed, then passed with the implementation restored.

## Verification

- npm ci completed with locked Playwright 1.58.2.
- 27/27 logic, English-content, DONKI-state and HTTP/runner regression tests passed.
- 19/19 real Chrome browser scripts passed in the final complete run. The runner reported no page-script errors.
- Authored HTML/CSS/JS/data are scanned for untranslated Han text outside comments, including generated CSS labels and escaped Unicode. All nested data strings and generated flare text are checked.
- The offline browser test blocks external networking: bundled fonts load, seven item cards and the Console remain usable, source labels identify the archive, and no local assets fail.
- Runtime files and all four bundled font files served locally with HTTP 200 and bytes matching the working tree.
- JS/CJS syntax and Git whitespace checks passed.
- Full first-day flow reaches Sol 2 through actual walking, panel cleaning, plug repair, cabin return, filtering, drinking, power setup and sleep.
- The 30-sol run covers 15 event types, resources, science and dose accounting. Sampling, duplicate reward prevention, skips, storm locks, intro transitions, endings and restart pass.
- Viewports: 2032×1024, 1280×720, 844×390 and 390×844. Each cabin caption is checked at nine points; portrait checks scroll each label into view. Phone tests exercise touch movement and active-tutorial controls.

## Scope and limits

Chrome was run locally, including software WebGL rendering. Phone checks use device emulation, not physical phone hardware or frame-rate certification. The live NASA endpoint can be unavailable; its archived-data fallback is tested, and the optional bundled snapshot is empty. This Git update does not deploy the remote web server.

Raw results and screenshots: ignored `output/test-results.json`, `output/solbound-final-browser.log` and `output/playwright/`.

## Final browser scripts

- cabin-layout.pw.js: PASS (21.8 s)
- cabin-reduced-motion.pw.js: PASS (5.3 s)
- cabin3d-pick.pw.js: PASS (4.5 s)
- endings.pw.js: PASS (40.2 s)
- english-offline.pw.js: PASS (5.8 s)
- first-day.pw.js: PASS (36.9 s)
- intro-transition.pw.js: PASS (72.5 s)
- mobile.pw.js: PASS (11.8 s)
- multiday.pw.js: PASS (53.6 s)
- power-feedback.pw.js: PASS (3.0 s)
- sample-loop.pw.js: PASS (16.0 s)
- scene-console-mobile.pw.js: PASS (6.2 s)
- scene-console.pw.js: PASS (8.5 s)
- shared-station.pw.js: PASS (3.1 s)
- skip-events.pw.js: PASS (6.6 s)
- survey.pw.js: PASS (7.0 s)
- tutorial-allocation.pw.js: PASS (4.1 s)
- tutorial-evidence.pw.js: PASS (2.3 s)
- tutorial-order.pw.js: PASS (3.1 s)

Source ZIP SHA-256: `4bc5ce8ef0efb0310d2eba147eab7d07afc122ae3451ca50a3fa2c1cdd80fdf1`
