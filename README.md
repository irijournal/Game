# UP RUN — Political Rivalry Mode

A satirical, Subway Surfers–style endless runner set in a fictionalised Uttar Pradesh. It runs in the browser on phones and laptops.

You run as **Akhilesh Yadav**: red cap, white kurta-pajama. Dodge gundaraj warning boards, potholes, media vans and mountains of files. When you stumble, or when the satirical *Gundaraj Meter* fills up, **Yogi Adityanath** makes a dramatic entrance. A stylised **bulldozer** then chases you down the road shoulder until you escape.

> **Disclaimer.** UP RUN is a fan-made satirical arcade game. It is not affiliated with, endorsed by, or representing any political party, politician or government. Characters are cartoon caricatures. Nothing in the game is a claim about real events, and no real quotes are used. The bulldozer is a political *symbol* in the game. It never touches a character and only pushes aside unoccupied road debris.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173  (add ?nointro to skip the opening)
```

Production build (static files, works from any sub-folder):

```bash
npm run build        # → dist/
npm run preview      # http://localhost:4173
```

For a single self-contained HTML file that opens straight from disk with no server (scripts, styles and fonts inlined, about 1.2 MB):

```bash
npm run build:single # → dist-single/index.html
```

You can host `dist/` on any static web server (GitHub Pages, Netlify, S3, `npx serve dist`). There is no backend, no API key, no analytics and no tracking. Progress is saved only in the browser's `localStorage`.

Requirements: Node 18+ and a browser with WebGL (current Chrome, Edge, Firefox or Safari).

## Controls

| Action | Phone | Laptop |
|---|---|---|
| Change lane | swipe ← / → | `←` `→` (or `A` `D`) |
| Jump | swipe ↑ | `Space` / `↑` (or `W`) |
| Slide (in the air: fast-fall) | swipe ↓ | `↓` (or `S`) |
| Pause / resume | ❚❚ button | `Esc` / `P` |
| Skip a cinematic | tap / **Skip ▸** | any key / **Skip ▸** |

The chase uses exactly the same controls. Swipes fire as soon as your finger has moved far enough, and the page never scrolls while you play.

## Modes

- **A — Political Run.** Play as Akhilesh Yadav. Run, collect coins and survive. Your first recoverable collision, or a full Gundaraj Meter, triggers the Yogi + bulldozer entrance and a 20 s chase. Later chases in the same run use a short entrance (about 1.6 s).
- **B — Bulldozer Chase.** A 30-second timed chase challenge featuring Yogi Adityanath and the bulldozer, with three escalating stages. Survive it to complete the challenge.
- **C — Political Showdown.** Pick Akhilesh, Yogi or (once unlocked) the fictional *Ummeedwar-ji*. Everyone runs the same *course of the day* under identical rules. The results screen shows a local face-off and offers the same course with another character. When Yogi runs, the rival is Akhilesh on a giant cycle.

Starting a run from the menu plays a 1.5 s, skippable starting-line moment with each character's own gesture: Akhilesh adjusts his cap, Yogi makes his entrance and namaste, and Ummeedwar-ji waves. **Retry** skips it and starts instantly.

## How the signature sequence works

```
RUNNING ──collision (guard ready)──▶ STUMBLE (0.75 s slow-mo, comic burst)
   │                                    │
   └──Gundaraj Meter full──▶ EVENT_PENDING (waits ≤ 2.5 s for a clear road)
                                        ▼
                               CINEMATIC (4 s full / 1.6 s short, skippable)
                                        ▼
                               CHASE (timer; every dodge −0.6 s; tokens +2.5 s)
                               ├─ timer done ─▶ SUCCESS (bonus, road ahead cleared) ─▶ RUNNING
                               └─ collision ──▶ FAILURE (clean stop, sit-down) ─▶ GAME_OVER
```

- Every state has a timeout or an explicit exit, so no animation can freeze the run (`src/sim/simulation.ts`).
- The chaser always drives on the right **shoulder lane**, behind the runner. It has no collision.
- Control returns only after the road ahead has been cleared. The first obstacles after a chase starts are deliberately gentle.
- A **stumble guard** decides whether a collision is recoverable: one recoverable stumble, which recharges 10 s after a survived chase.

## Scoring

All points flow through `src/sim/scoring.ts`, and the results screen shows the breakdown.

| Source | Points |
|---|---|
| Distance | 1 per metre (×2 during a Speed Run) |
| Coin | 5 (coins count double during a chase) |
| Obstacle row passed | 10, or 15 if you jumped or slid over the obstacle in your lane |
| Chase survived | 500 + 25 per escape (+1000 for completing Mode B) |
| Time token in a chase | 150 |
| Mission completed | 250 points, plus its coin reward |
| New environment discovered | 250 |
| Cultural (heritage) token | 50 |

## Content and progression

- **Environments** rotate every 750 m: *Lucknow Streets*, *Heritage Route*, *Vikas Corridor* (modern) and *Festival Route*. Each one has its own palette, buildings, skyline, music and obstacle mix.
- **Obstacles** follow consistent rules. *Low* obstacles (yellow/black) can be jumped. *Overhead* banners and booms (red/white) need a slide. *Walls* (tall boards, vans, buses, trucks, file mountains, development barriers) need a lane change. *Road gaps* need a jump. Posters, shop signs and scenery are decorative and never collide.
- **Events** have cooldowns and never overlap a chase: Poster Alley, Development Route (with a dismissible "fictional scenario" card), Coin Rush and Speed Run (with a warning and timer). Power-ups are the Vote Magnet and the **Vikas Express**, a temporary fictional flyover with a speed boost and a coin trail.
- **Daily missions**: three per day, picked deterministically from a pool. They reset at local midnight.
- **Unlocks (coins only; no real-money purchases)**: outfits, trails, run styles, start route, and the fictional character Ummeedwar-ji (or run 2,000 m in one run).

## Architecture

```
src/
  sim/        Pure TypeScript game logic, no rendering (unit-tested in Node)
    simulation.ts   finite-state machine, scoring, spawning, missions, events
    player.ts       lanes / jump / slide physics (fixed 120 Hz steps)
    collision.ts    AABB contact classification: crash / side-bump / land
    generator.ts    procedural rows + route-validity checker + coin placement
    autopilot.ts    bot used by tests and the browser soak test
  save/save.ts    versioned, validated localStorage save (never throws)
  engine/       Three.js renderer, the single RAF loop, input, audio, camera
    view/         procedural characters, vehicles, obstacles, world, effects, cinematics
  ui/           React screens and the HUD
tests/e2e/      browser acceptance tests (Playwright, production build)
dev/            visual tools: rig preview page, deterministic screenshot drivers
docs/           STATUS.md (requirement report), BUG_REGISTER.md
```

Key decisions:

- **Simulation separated from rendering.** The sim advances in fixed 1/120 s steps, frame deltas are clamped to 0.1 s, and all movement uses elapsed time. 30, 60 and 120 fps therefore play the same, and a backgrounded tab cannot cause a jump.
- **One game loop.** The engine owns exactly one `requestAnimationFrame`. Restarting replaces the simulation, never the loop.
- **Fair generator.** Every chunk of obstacles is accepted only if a route exists from *every* starting lane. The check accounts for lane-change time, jump/slide recovery and obstacle length. A slower test cross-checks the validator against the real physics with an input search.
- **No external assets.** Characters, vehicles and scenery are built from primitives in code (merged and instanced to keep draw calls low). Text is drawn to canvas textures. Music and sound effects are synthesised with WebAudio, and the fonts are bundled. Nothing can fail to load from a CDN.
- **Characters share one rig and animation interface** (`CharacterRig`): idle, run, jump, slide, stumble, victory, sad, entrance, ride and pedal. To add a character, add an entry in `src/sim/characters.ts` and a builder in `src/engine/view/characterModels.ts`.

## Tests

```bash
npm run typecheck
npm test             # 72 unit + integration tests (~3 min; one physics cross-check is slow)
npm run build && npm run e2e   # 13 browser scenarios against the production build
```

The suite covers:

- Physics: jump arc, slide height, lane interpolation, and contact classification.
- The generator and route validator: 10,000 chunks, plus 10,000 unconstrained sequences for rejection.
- A real-physics route search over sampled chunks.
- Coins never placed inside collision volumes.
- Scoring.
- Save validation and migration: corrupted JSON, full storage, no storage.
- Frame-rate independence.
- The stumble → cinematic → chase → success and failure paths.
- Cinematic skipping.
- A fuzz test: no state outlives its timeout.
- A 15-minute object-count check.
- Restart determinism.

Browser scenarios cover:

- Intro → skip → start.
- Keyboard controls, plus pause freezing the score.
- Touch swipes on a phone viewport, with no page scroll and 44 px buttons.
- The full Yogi/bulldozer sequence, with the chaser checked to be on the shoulder behind the runner.
- Chase failure → Retry: a fresh run running at normal speed, which shows there is only one loop.
- Save persistence across refresh, and recovery from a corrupted save.
- Rotating the screen mid-run.
- Auto-pause on a hidden tab.
- Mode B completion and Mode C as Yogi.
- The no-WebGL error screen.
- An audio smoke test: every cue and music track plays without errors.
- A 15-game-minute soak that checks GPU resources and heap plateau.

See `docs/STATUS.md` for what is verified, and how. Real-device testing (iOS Safari, Android Chrome, Firefox, desktop Safari) has **not** been done yet: the automated runs use headless Chromium with software WebGL.
