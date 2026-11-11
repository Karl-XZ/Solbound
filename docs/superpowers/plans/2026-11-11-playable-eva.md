# Playable EVA and first-day tutorial implementation plan

> **For agentic workers:** Use superpowers:executing-plans for inline implementation and one fresh whole-change review.

**Goal:** Balance direct cabin interactions with third-person outdoor work and a skippable case-based first day.
**Architecture:** Keep Three.js rendering and the existing resource state in game.js. Add a pure expedition task model, a controller for camera-relative movement, and an expedition UI/tutorial coordinator; resource mutations remain in game.js.
**Tech Stack:** Native browser JS/CSS, existing Three.js r128, Node built-in assert tests, real Chromium verification.
**Spec:** ../specs/2026-11-11-interior-eva-tutorial-design.md

## Global constraints
- Ages 7–12; no time-based oxygen drain, speed challenge, or precise aiming requirement.
- Preserve all 15 event types and all alternatives; no blanket two-option truncation.
- Tutorial is SOL 01 and skippable at entry and midway; skipping neither resets resources nor completes tasks.
- No new runtime dependencies, remote push, or server deployment.

## Impact and interfaces
- index.html loads new scripts before game.js and adds the control UI stylesheet.
- expedition-model.js owns tasks, unique completion IDs, samples and the tutorial sequence; CommonJS export also permits dependency-free tests.
- astronaut.js owns input and movement. World calls controller.update(dt, position, blockers), consumes yaw and movement, and provides setPlayerActive/getPlayer/resetPlayer/setMarkers APIs.
- expedition.js calls game adapters for resource mutations and World for location, using task state from ExpeditionModel. init(adapter), newDay(state), render(state), enter(), leave(), pause(), notify(action), reset().
- game.js replaces automatic daily EVA rewards, starts events before planning, defers physical event choices to actual work, exposes adapters to expedition.js, and retains journal/report functionality.
- habitat.js adds drawn cabin door, power console, bed and sample bench plus water/food/sample visual feedback.
- Tests cover resource and task invariants; browser verification covers visual changes, movement/camera, collision, first day, skip paths and event alternatives.
- No serialized saved-game schema or production service changes. Rollback is the previous local commit; original ZIP remains untouched.

## Review focus
- Holding a movement key while opening UI or losing focus must not keep moving.
- Repeated confirmation, retries and reopening work must not duplicate costs/rewards.
- Skip during any tutorial phase must release UI and allow normal play.
- Event task work must not execute before reaching its target or bypass missing resources.
- Restart and day transitions must clear per-day state while retaining real pending tasks/samples.

## Task 1: Task model and controllable astronaut
- [x] Write Node assert tests for one-shot task completion, sample custody, tutorial skip, collision sliding, normalized diagonal movement and input clear on pause; watch them fail.
- [x] Implement ExpeditionModel.create(), task lifecycle, sample states and skip/advance functions; implement AstronautController movement/input without engine-specific dependencies.
- [x] Integrate controller into World surface character and camera. Build actual building blockers and reachable target markers. Add pointer view rotation and camera recenter.
- [x] Run model/controller tests and JS syntax checks; commit.

## Task 2: Outdoor work and cabin feedback
- [x] Write failing tests for repeated completion/return/analysis, cancelled work and resource insufficiency.
- [x] Add expedition UI with task list, nearby interaction, touch controls, cleaning drag surface, repair part placement, sampling sequence, help return and clear resource receipts.
- [x] Integrate one-shot sortie costs and physical event choices with game.js. Move scheduled events to day start. Remove daily checkbox EVA path and present every event choice.
- [x] Add cabin door, control console, bed and specimen bench. Show actual water level, resource stocks and specimen state. Make bed lead to reviewed daily settlement.
- [x] Run tests and verify desktop movement, collision, nearby work, return and next day in Chromium; commit.

## Task 3: Guided SOL 01 and final verification
- [x] Write failing tutorial transition/skip/restart checks, then implement one-action-at-a-time guide with an entry choice and persistent skip button.
- [x] Set safe common day-one conditions for both guided/skipped modes and create cleaning plus loose-connector tasks.
- [x] Verify complete tutorial, skip at start and midway, ordinary scan/sample analysis, hazard alternatives, paused input, mobile joystick, restart, multi-day economy and endings.
- [x] Update README controls and verification evidence; fresh reviewer inspects full diff and address important findings; final tests and local playable URL.

## Execution ledger
User approved design and explicitly requested implementation; execute inline without another plan approval round.
Native managed-worktree creation did not return and produced no worktree/artifact; cancelled the pending call. Implementation stayed in the existing checkout on codex/playable-eva, leaving main at 0847dc9.
Ruling: use the local feature branch when managed-worktree creation is unresponsive — this keeps the change reviewable and reversible; the active local preview serves that branch.
Ruling: keep the existing engine and page loading; no runtime dependencies or deployment changes.
Pre-flight: controller -> World -> expedition UI -> game adapters share explicit APIs from this plan; no incompatible consumers found.
Task 1: complete — task/model/controller tests watched RED then GREEN; diagonal movement, collision and pause checks pass.
Task 2: complete — actual browser travel, cleaning, repair, sample custody, analysis and return all exercised; UI occlusion fixes verified through normal clicks.
Task 3: complete — guided first day, skip at entry/midway, mobile power controls/joystick and ending/restart verified. Fixed-event 30-day economy reached SOL30 with all 15 event types and science 113.
Final review: fresh read-only reviewer found two important issues; both fixed with RED -> GREEN tests: per-trip conjunction risk and stale maintenance jobs.
Additional regression fixes: no-cost maintenance under a power deficit; out-of-order tutorial actions; reset of event UI; ending HUD cleanup; repeated maintenance after subsequent dust buildup.
Validation: 14/14 Node behavior tests; authored JS syntax and 16 local asset references pass; git diff whitespace check passes.
Commits consolidated after integration verification because renderer, UI and game adapters must be delivered together as a playable change.
Remaining validation: no physical mobile device or child playtest; 30-day simulation is one fixed event scenario, not exhaustive random-seed balancing.
Integration: local feature branch retained for the playable preview; no remote push or production deployment.


## 2026-11-11 tutorial and child-copy revision

- User required short literal copy, close subject/verb placement, no object personification, and fewer clauses/commas. Persisted in root AGENTS.md.
- Tutorial now follows one cause chain: inspect power -> depart -> move -> clean -> repair -> return -> purify -> drink -> allocate -> finish day.
- Added a simple fault explanation before departure. Closing it does not advance the guide.
- Guided actions and the only visible marker follow the current step. The return arrow now points to the door rather than the next optional survey.
- Completing allocation closes the notebook. The player then clicks the bed. Skipping restores ordinary controls immediately.
- Rewrote object cards, events, logs, opening captions, report text and science explanations. Renamed crew/morale labels to familiar child-facing terms.
- Fresh review found a survey instruction naming the wrong scan button. Browser test reproduced the mismatch, then passed after the conditional instruction fix.
- Verified 14 Node tests, actual full first-day flow into SOL02, entry/midway skip, mobile viewport/control flow, power feedback, and survey completion.
