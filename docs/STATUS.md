# UP RUN: Development vs. Gundaraj — requirement status

Legend:

- **Tested (auto)**: implemented and covered by an automated test that passed. Unit and integration tests are in `src/sim/__tests__`; browser tests are in `tests/e2e/run.cjs` and run against the production build.
- **Verified (visual)**: implemented and checked by rendering it in headless Chromium and inspecting screenshots. No assertion covers it.
- **Partial**: implemented with a documented simplification.
- **Blocked**: cannot be verified in this environment.

All browser runs used headless Chromium with **software WebGL (SwiftShader)**. Frame rates there say nothing about real performance, and no physical phone, tablet, Safari or Firefox was available.

This is a rebuild of the first version (*Political Rivalry Mode*) on the same engine. Its earlier verification is kept where the code is unchanged (physics, generator, collision, state machine, persistence); everything listed here was re-run on the new build.

## Quality gate (from the brief)

| Requirement | Status | Evidence |
|---|---|---|
| All levels playable | Tested (auto) | e2e "all 8 campaign levels": each level is started from the campaign map, driven by input-only bot inputs to the finish, and must show the reward screen, award its badge and offer the next level. Unit: each level's fixed course is completable and spawns ≥ 1.8× its token goal. |
| Rivalry event and bulldozer sequence reliable | Tested (auto) | e2e "Rivalry": warning caption → scripted stumble → hero entrance (rig visible) → "GOVERNANCE SHOWDOWN!" → showdown → escape → stage 2. Unit: rivalry flow test, plus a fuzz test over 40 seeds in which no state outlives its timeout. |
| Chase winnable and losable | Tested (auto) | e2e "Rivalry" (escaped) and "showdown lost → results → retry". Unit: the bot survives ≥ 9/10 showdowns; doing nothing always gets caught. |
| No decorative or broken buttons | Tested (auto) | e2e "menus: every button works": every main-menu button opens a working screen, and Back returns. The other scenarios drive the remaining buttons (Play, Start level, Next level, Replay, Retry, Resume, Main menu, Manifesto Mayhem Play / Fly again, touch buttons, filters, source links). |
| Mobile and desktop | Tested (auto) on emulated phone and desktop; **Blocked** on real devices | e2e keyboard (desktop), swipes and touch buttons (390×844), rotation to landscape mid-level; phone and desktop screenshots. |
| Restart without refresh | Tested (auto) | e2e Retry gives a fresh run at normal speed (one loop). The 8-level scenario moves from level to level without reloading. |
| No uncaught errors | Tested (auto) | Every e2e scenario asserts zero page errors and zero console errors. |

## Content and fairness rules

| Rule | Status | Evidence |
|---|---|---|
| Facts typed as verified / government-reported / political claim / fictional, with source and date | Tested (auto) | `content.test.ts` checks every fact has a type, every verified/government entry has a source URL, and every level and quiz question references existing facts. The Evidence board filters by type (e2e). Full list: `docs/SOURCES.md`. |
| No fabricated quotes; dialogue labelled fictional | Verified (visual) + content test | Jokes, fictional promises and slogans live in `content/` and are labelled "fictional" in the UI (e2e checks the Manifesto Mayhem disclaimer). |
| No points for accusations | Tested (auto) | Scoring buckets (`scoring.ts`) cover only distance, coins, dodges, showdowns, tokens, gates, challenges, levels, missions and discoveries. Quiz answers are facts or media-literacy questions. |
| Negative roles only fictional | Verified (visual) | Obstacles are fictional signs ("GUNDARAJ?", "DELAYED", "UNFINISHED PROJECT"), each labelled fictional or a game slogan. No character is shown as a criminal. |
| Bulldozer: no people, no homes, due process implied by absence | Tested (auto) | e2e power-up scenario: the helper bulldozer stays ahead of the runner on the carriageway (abs(x) < 3.7 m; crowds stand beyond 8 m) and clears only debris kinds (unit test). The showdown chaser stays on the shoulder behind the runner (e2e). |
| Player keeps control; cinematic has a fixed length and a guaranteed exit | Tested (auto) | Full entrance 4 s, short 1.6 s, skippable after 0.35 s; fuzz test on timeouts. |
| Political symbols: no logos or official emblems; no endorsement | Verified (visual) | Only colours (saffron/white/green) and plain saffron pennants are used. The About text and every disclaimer say "not an official app". |
| SP-era projects credited; "not all built by BJP" | Tested (auto) (content) | Notes on the Agra–Lucknow Expressway, Purvanchal and Lucknow Metro entries; quiz question on who inaugurated the Agra–Lucknow Expressway (answer: Akhilesh Yadav). |
| Game scores labelled fictional | Verified (visual) | Results, scoreboard, level intro, board and Mayhem screens show the note (e2e checks the scoreboard). |

## Feature checklist

| Area | Feature | Status | Notes |
|---|---|---|---|
| Characters | Yogi-inspired hero: saffron, entrance + namaste, blessing victory pose, talk animation | Verified (visual) | Default playable character |
| | Akhilesh-inspired rival: red cap; playable in Rivalry and Free Run; races, Red Cap Challenge, Mayhem cycle-copter pilot | Tested (auto) / Verified (visual) | Never shown as a criminal; pilots the Mayhem cycle-copter and runs the race |
| | Karyakarta-ji (fictional volunteer, saffron scarf; rally-cap outfit) | Verified (visual) | Unlock at 2,000 m in one run or with coins |
| | Fictional cheering citizens: farmers, workers, engineers, police, students, shopkeepers, pilgrims | Verified (visual) | Instanced crowds that bounce along the roadside, and at the finish arch |
| Levels | 8 levels, each with its own environment, palette, skyline, music, obstacles, mission, token, progress bar, reward screen and replay | Tested (auto) / Verified (visual) | Environment tour screenshots of all 8 |
| | Stars (finish / token goal / no collisions), badges with perks, level unlock order, Free Run routes unlock | Tested (auto) | `save.test.ts`, e2e 8-level scenario |
| Rivalry system | Red Cap Challenge, Promises vs Performance, Accountability Gate, Manifesto Mayhem, Development Race, Governance Showdown, slogans | Tested (auto) | `campaign.test.ts`; e2e for gates, rivalry, race and Mayhem |
| Evidence board | Achievements (12), badges (8), evidence board with type filter and sources, slogans labelled as claims | Tested (auto) / Verified (visual) | e2e menus scenario |
| Satire layer | Ribbon Race finish, four satirical obstacles (Parivaar Meeting, Kaam Bolta Hai?, Free Laptop 2012, Alliance Parking), UP RUN News flashes and menu ticker, hero/rival one-liners, Manifesto Mayhem mode (cycle-copter drops fictional-promise crates onto validated spots), 8 new sourced quiz questions | Tested (auto) / Verified (visual) | `content.test.ts` (promise labels; joke numbers match facts); `campaign.test.ts` (Mayhem completable, mostly crates, no showdowns); e2e Mayhem scenario (crates fall with parachutes, manifesto empties, win saved); screenshots |
| Governance Room | Decision mode: 5 fictional cases from a deck of 8, four meters (safety, rule of law, trust, development), consequences, hero reactions, report card with 5 ratings, evidence-board context, coins, Rule of Law Champion achievement; link from the Level 6 reward screen | Tested (auto) | `governance.test.ts` (one due-process best answer per case; shortcuts always cost rule of law; ratings checked on all 56 possible shifts; no real party, politician or place in a negative role; no home demolished); e2e Governance scenario (full shift → 3-star report, saved); phone screenshot |
| Hinglish language toggle | Menu 🗣️ button and Settings → Language; covers menus, how-to-play, Manifesto Mayhem, pause, result screens and the Governance Room. Facts, quiz and evidence board stay in English to match their sources | Tested (auto) | e2e Governance scenario (switch, labels change, setting survives reload, switch back); `governance.test.ts` (setting validated) |
| Scoreboard | Personal bests per mode, distance, tokens, missions, obstacles avoided, challenges, gates, races, Mayhem wins, promises dodged, stage | Verified (visual) | "Performance is the real scoreboard" |
| Controls | Arrows / A D / Space / W / ↓ / S / Esc; swipes; optional on-screen buttons | Tested (auto) | e2e keyboard and phone scenarios |
| Tech | Fixed-step sim, single loop, fair generator, reserved windows for gates and the finish | Tested (auto) | Generator: 10,000 chunks validated from every lane; physics cross-check |
| Robustness | Resize and rotation, hidden-tab pause, no time jump, corrupt save recovery, v2→v3 save migration, storage-full fallback, no-WebGL message | Tested (auto) | e2e + `save.test.ts` |
| Performance | Pooling (obstacles, pickups, gates), instancing, merged meshes, auto quality | Tested (auto) for resource plateau; **Blocked** for real-device fps | Draw calls ~160–330 across the 8 environments. Soak (15 game-minutes, 21 km through every environment): GPU geometries plateau at ~470–475 after the first full rotation, textures 166→173 over the last 5 minutes, heap flat (26 MB) |
| Audio | 8 level tracks, chase and Mayhem tracks, new cues (correct / wrong / fanfare) | Tested (auto) for errors; **Partial** for quality | Not listened to |

## Blocked / not verified here

1. **Real devices.** No iOS Safari, Android Chrome, desktop Firefox or Safari testing. Touch was tested with emulated touch events in Chromium only.
2. **Real-world performance.** Frame rate on low-end phones is untested. The game lowers pixel ratio and particle budget automatically when frames run slower than about 40 fps.
3. **Audio quality.** The audio is synthesised and has not been listened to.
4. **Likeness.** The characters are stylised caricatures built from primitives, recognisable by costume and silhouette, not by facial likeness. No photo-based assets are used.
5. **Facts drift.** Real-world entries were checked on 2026-10-29 and should be re-checked before publishing (see WATCH-4).
6. **Difficulty with humans.** Star thresholds and token goals were tuned with the input-only bot, not with players.
