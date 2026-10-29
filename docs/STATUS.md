# UP RUN — requirement status report

Legend:

- **Tested (auto)**: implemented and covered by an automated test that passed. Unit/integration tests live in `src/sim/__tests__`; browser tests are in `tests/e2e/run.cjs` and run against the production build.
- **Verified (visual)**: implemented and checked by rendering it in headless Chromium and inspecting screenshots. No assertion covers it.
- **Partial**: implemented with a documented simplification.
- **Blocked**: cannot be verified in this environment.

All browser runs used headless Chromium with **software WebGL (SwiftShader)**. Frame rates there are meaningless for performance, and no physical phone, tablet, Safari or Firefox was available.

Starting point: the target repository was empty, so there was no earlier UP RUN codebase to integrate with. The endless runner, scoring, collectibles, responsive UI and local save system were built here as the base, with Political Rivalry Mode on top.

## Final acceptance criteria (spec §12 and Part II §10)

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Akhilesh Yadav can be selected and played | Tested (auto) | e2e "intro → skip → title → start (Akhilesh default)"; Mode A always uses Akhilesh |
| 2 | Yogi Adityanath appears in the designated special event | Tested (auto) | e2e "stumble → Yogi entrance…" checks the rival rig is visible during CINEMATIC/CHASE |
| 3 | Bulldozer chase starts and ends correctly | Tested (auto) | `simulation.test.ts` stumble/meter/skip/failure paths; e2e scenarios 4, 5, 9 |
| 4 | Every obstacle has a functioning collision boundary | Tested (auto) | `collision.test.ts` covers every class (crash, bump, land, gap); debug collision boxes toggle in Settings |
| 5 | Jumping and sliding work | Tested (auto) | player tests; physics search clears low/overhead/gap rows at 13–32.5 m/s; e2e keyboard + touch |
| 6 | Lane changes are responsive | Tested (auto) | lane-change time 0.15 s; e2e keyboard/touch lane checks |
| 7 | Stumble event does not freeze the game | Tested (auto) | fuzz test: no non-terminal state outlives its timeout (40 seeds, random inputs) |
| 8 | Chase survivable through movement | Tested (auto) | autopilot (inputs only) survives ≥ 9/10 chases; Mode B completed in e2e |
| 9 | Restart creates a fresh run | Tested (auto) | e2e Retry: distance resets, chase count 0, runs at normal speed (single loop) |
| 10 | Scores and coins update correctly | Tested (auto) | `scoring.test.ts`; coins counted once per id; save `applyRun` tests |
| 11 | Progress persists after refresh | Tested (auto) | e2e reload; `save.test.ts` |
| 12 | Works on a phone without a keyboard | Tested (auto) on an emulated phone; **Blocked** on real devices | e2e touch swipes via CDP touch events at 390×844 |
| 13 | Works on a laptop with keyboard | Tested (auto) | e2e keyboard scenario |
| 14 | Interface readable on small screens | Verified (visual) | portrait screenshots at 390×844 (menus, HUD, pause, results); buttons ≥ 44 px |
| 15 | No event blocks all routes unfairly | Tested (auto) | 10,000 generated chunks validated from every lane; physics search on 90 chunks × 3 lanes × 2 speeds |
| 16 | No critical runtime errors | Tested (auto) | every e2e scenario asserts zero page/console errors |
| — | Production build loads its assets | Tested (auto) | e2e runs against `vite preview` of `dist/`; no external assets |
| — | Responsive during extended play | Tested (auto) | soak: 15 game-minutes and 21 km; GPU geometries and textures plateau, heap flat, object counts bounded |
| — | Political narrative distinguishable from fact | Verified (visual) | every slogan, poster, banner, meter and card is labelled fictional/satire; no statistics or quotes in the game |

## Feature checklist

| Area | Feature | Status | Notes |
|---|---|---|---|
| Characters | Akhilesh: red cap, white kurta-pajama, run/jump/slide/stumble/recover/victory/sad, expressions | Verified (visual) | procedural rig, one canonical model; cap sized to read from behind |
| | Yogi: saffron robes, shawl, earrings, entrance, special victory (namaste → blessing), ride pose | Verified (visual) | |
| | Character system extensible (preview, description, unlock, select, shared animation) | Tested (auto) / Verified | third, fictional character Ummeedwar-ji included |
| | Outfits, run styles and trails (cosmetic) | Verified (visual) | |
| Opening | Aerial city → character adjusts cap → runs → title, subtitle, Start, tutorial; skippable; shown once | Tested (auto) skip / Verified (visual) | replay from Settings |
| World | 3 lanes, endless modular street, 4 themed environments with palette, music, obstacle mix | Verified (visual) | Lucknow-inspired gateway/domes/clock-tower silhouettes; all fictionalised |
| Obstacles | Gundaraj board (wall) + A-frame sign (low), potholes/gaps, barricades, construction zone, file pile/mountain, media van, traffic jam (bus/truck), rally banners, checkpoint booms, scaffolds | Tested (auto) collisions / Verified (visual) look | posters and shop signs are decoration only |
| Events | Poster Alley, Development Route (dismissible fictional card), Heritage tokens, Coin Rush, Speed Run (warning + timer), rival entrance; cooldowns | Tested (auto) planning; Verified (visual) | events never start during a chase |
| Power-ups | Vote Magnet, Vikas Express (fictional flyover, visually distinct from the chase) | Verified (visual) | |
| Gundaraj Meter | fills with chaos obstacles, triggers the event; labelled satire | Tested (auto) | |
| Chase | separate shoulder lane, dust, camera pull-back, timer bar, dodges shorten it, tokens extend it (2× coins), success bonus + route cleared, clean failure | Tested (auto) | the bulldozer never touches a character |
| Cycle variant | Akhilesh on a giant cycle when Yogi is the runner | Tested (auto) / Verified (visual) | same mechanics |
| Modes | A Political Run, B Bulldozer Chase (30 s, 3 stages), C Showdown (same daily course, face-off) | Tested (auto) | |
| Scoring | distance, coins, dodges, chase, missions, discoveries, tokens | Tested (auto) | |
| Missions | 3 daily from a pool; reset at local midnight; run/day scopes | Tested (auto) | |
| UI | menu, modes, characters, missions, unlocks, high scores (local only), settings, HUD, pause, results with breakdown | Verified (visual) | |
| Settings | music, SFX, reduced motion, short cinematics, quality, collision debug, replay intro, reset progress (confirm) | Verified (visual) | |
| Input | swipe (fires mid-gesture), keyboard, mouse menus, no page scroll | Tested (auto) | |
| Robustness | pause on hidden tab, blur and rotation; resize handling; clamp large frame deltas; WebGL missing / context lost message; React error boundary | Tested (auto) except context-loss (code path only) | |
| Performance | pooling, instancing, merged meshes, auto quality (lowers pixel ratio and particles if slow) | Tested (auto) resource plateau; **Blocked** real-device fps | ~180–330 draw calls during play |
| Audio | synthesised music per environment and for the chase, SFX, original entrance stinger | **Partial**: implemented, not listened to | headless tests cannot judge sound quality |
| Save | versioned schema, validation per field, v1 migration, storage-full / private-mode fallback | Tested (auto) | |

## Blocked / not verified here

1. **Real devices.** iOS Safari, Android Chrome, desktop Firefox and Safari have not been tested. Touch input was tested with emulated touch events in Chromium only.
2. **Real-world performance.** Frame rate on low-end phones is untested. The game drops pixel ratio and particle budget automatically if frames run slower than about 40 fps, and *Settings → Graphics → low* forces it.
3. **Audio.** Music and effects were not listened to. They are synthesised at runtime and fail silently, so a muted or broken audio context never affects gameplay.
4. **Likeness.** The characters are stylised caricatures built from primitives, recognisable by costume and silhouette (red Gandhi cap; saffron robes, shaved head, earrings), not by facial likeness. No photo-based assets are used.
