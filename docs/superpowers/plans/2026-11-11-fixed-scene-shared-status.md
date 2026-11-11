# Fixed scene, shared status and allocation tutorial

The user corrected the layout: preserve the original full-size 2D scene, allow floating tutorials, use the term 控制台 consistently, and show the same station status inside and outside.

Reproduced: the allocation guide continued to say 打开控制台 after the panel was open. Its card did not explain the minimum or provide a completion action. The screenshot allocation 8/2/1/2 is valid. The old full-day test only used the bottom completion button at the default allocation.

Changes: one completion handler serves the tutorial card and bottom button; guide copy changes with view and current allocation; one station-status DOM is shared across all views; the original SVG viewBox and full-screen bounds are restored; tutorial classes no longer move or resize the scene. Resource and power calculations stay unchanged.

Verification targets: screenshot allocation through both buttons, actual first day through the tutorial card, invariant scene bounds before/after skipping, state identity and live battery/O2 changes across views, desktop/phone layouts, and existing model tests.

Verified: screenshot allocation 8/2/1/2 completes from either button. Starting at 2 oxygen power cannot advance; adding one power then completes. The actual first-day browser route uses the tutorial card to complete allocation and reaches SOL 2 with O2 57.5, water 62.5, and no page errors. A DOM identity check confirms the same meter component survives cabin, overview and EVA transitions. Cabin purification updates battery to 4; departure updates oxygen to 57 in that same component. Fixed-scene and layout checks pass at 2032×1024, 1280×720 and 390×844. All 14 model tests pass.
