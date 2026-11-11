# Restore scene console

User requirement: opening the cabin console switches directly to the 3D base. The user's reference screenshot fixes the layout: resources on the left, environment on the right, original four allocation controls in a card at the bottom center, full-screen 3D background. The diary stores records, not allocation controls. Preserve the tutorial and playable third-person EVA.

- [x] Add a browser regression for the console route and bottom panel.
- [x] Move existing resource and allocation DOM out of notebook pages. Reuse their IDs, handlers, forecasts and costs.
- [x] Route console inspection and all allocation links to the 3D view. Keep tutorial progression and physical EVA separate.
- [x] Match the original HUD positions and card styling. Check desktop and mobile layouts.
- [x] Update affected browser scripts and documentation. Run the full tutorial and model tests.

Affected modules: index.html, game.js, habitat.js, expedition.js, scene CSS, browser fixtures. Resource rules, world rendering and task rewards stay unchanged. Rollback uses the preceding local commit. Main regression risks: tutorial navigation, pointer targets and missing resource IDs.

Verification: 14 model tests passed. The full physical first-day route reached SOL 2 with water 62.5, oxygen 57.5 and no page errors. Desktop browser checks cover original card placement, all four allocation controls, diary remaining closed, no departure charge for viewing the console, and returning from the sleep review to the console. Mobile checks cover the bottom allocation card and reachable controls. Power feedback and mobile joystick flows were also exercised. Screenshots are in output/playwright/scene-console-*.png.
