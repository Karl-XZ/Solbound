# Visible tutorial evidence

The user reports that departure is styled like a checkbox and the tutorial describes invisible dirt and a loose connector. Correct the evidence chain, not just the wording.

- Make departure a clear yellow action button, with a matching primary action in the tutorial card.
- Before departure, describe only the visible low-power reading. The preparation dialog asks the child to inspect the panels.
- Add visible dust patches and an actual unplugged solar connector to the existing 3D array. Clean and repaired states update those same objects.
- At the work site, direct the child to inspect the board and connector. Keep task rewards and resource rules unchanged.
- Verify the departure card and physically complete the first-day clean/repair route. Inspect screenshots and check rendered mesh states and generation changes.

Implemented and verified: departure is a yellow button in the original bottom card, with a matching primary tutorial action. The opening case and departure step no longer diagnose invisible faults. Actual solar-panel meshes carry dust; the supply socket has a disconnected orange plug, which moves into place and turns green after repair. At-site labels attach to projected component positions and follow the active inspection step. A user-invoked view action turns toward the panels when the relevant component is outside the unobstructed view. Dust effects were reduced so they do not hide completed work.

The real browser route walks to the panels, uses the view action when required, cleans, reconnects, returns, purifies, drinks, allocates and sleeps. It reaches SOL 2 with oxygen 57.5, water 62.5 and no page errors. Assertions inspect the rendered dust-group visibility, plug position/color and increasing generation. Screenshots inspected: departure-guide-visible.png, at-solar.png, solar-clean-plug-loose.png and solar-repaired.png in output/playwright/. Fourteen model tests pass; resource costs and rewards are unchanged.
