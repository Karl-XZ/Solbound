# Cabin layout and task clarity

User requirements: remove overlapping cabin UI, match the original cream/ink/mustard style, remove emoji decoration, and replace vague survey wording with concrete actions. Preserve the confirmed original 3D console layout, tutorial and third-person EVA.

- [x] Reproduce crowded SOL 2 at desktop and mobile sizes in a browser regression.
- [x] Reserve header, scene and footer areas. Group resources and power in one footer. Keep labels clear of overlays. Remove redundant decorative furniture and idle speech.
- [x] Use the original palette, hard borders and simple resource markers. Remove pictographic emoji from player UI.
- [x] Name the survey task "扫描火箭旁的地面". Explain scan, save and science +6 in departure and task UI. Preserve the existing reward and once-per-day rule.
- [x] Verify clickable cabin objects, console navigation, full tutorial, survey completion, phone controls, model tests and screenshots.

Affected files: cabin HTML/CSS/SVG, expedition copy and task UI, player event cards, browser fixtures, AGENTS.md and README. Resource math, task rewards, stored samples and the original 3D console layout are outside this change.

Verification: the layout regression covers 2032×1024, 1280×720 and 390×844. Scene, header and footer do not overlap. Desktop labels reach their own click targets. Visible player UI contains no pictographic emoji. Purification and console entry work. Completed care actions close their popover so the next object remains reachable. The physical first-day route reached SOL 2 with oxygen 57.5 and water 62.5, without page errors. The scan task was completed through actual walking, scan and save actions, adding science 6. Original 3D console placement, mobile joystick, skip/event behavior, 14 model tests, syntax and whitespace checks passed. Screenshots: output/playwright/cabin-clean-2032.png, cabin-clean-1280.png and cabin-clean-390.png.
