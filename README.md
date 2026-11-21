# NIGHTSHADE

[![make.fun](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/NgademinSikil/makefun-stealth-game/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/NgademinSikil/makefun-stealth-game/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard)

An entry for the make.fun bounty [best-stealth-game-20261121-1759](https://make.fun/bounty/best-stealth-game-20261121-1759). The bounty closes **Sun 22 Nov 2026 13:59 WITA** and has a **$50 pool split among the 10 highest-ranked entries, with 1st place taking $12**.

## The game

NIGHTSHADE is a top-down stealth game in three rooms — the Gallery, the Vault Hall, and the Rooftop Garden. You are a thief in the dark. Each room hides three relics behind patrolling guards; lift them all to unlock the exit, then slip out unseen.

Guards sweep their vision cones across the floor. Stand in a cone and their suspicion climbs — faster up close, slower when you crouch, slower still in the dark corners. A full meter means a chase, and a chasing guard who catches you costs a life. Running is faster but loud: guards in earshot come to investigate the noise. Patience is a mechanic — wait for a patrol to turn, then move.

## How to play

- **Move:** WASD or arrow keys. **Click** a spot to walk there.
- **Shift:** run (fast, but noisy — guards hear it).
- **C:** crouch / sneak (slow, harder to spot, safest in shadow).
- **P / Esc:** pause. **Enter:** start / restart.

Lift all 3 relics in a room to open its exit. You have 3 lives; finish all three rooms for the clean getaway.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Or open `game/index.html` directly from the folder — the game is plain static files and needs no network.

## Files

- `main.ts` — the entrypoint: copies the game and screenshots to `/output` and writes `dossier.json`
- `game/index.html` — the page that loads the game
- `game/src/config.js` — every tuning number in one place
- `game/src/random.js` — the seeded random generator
- `game/src/levels.js` — the three rooms (walls, shadows, relics, patrols, exits)
- `game/src/world.js` — the rules: movement, vision cones, suspicion, noise, relics, lives
- `game/src/render.js` — all drawing: floor, cones, guards, thief, HUD and screens
- `game/src/input.js` — keyboard and click-to-move
- `game/src/audio.js` — tiny WebAudio bleeps (footsteps, relic chime, alarm)
- `game/src/shots.js` — the screenshot scenes and the autopilot that plays them
- `game/src/main.js` — boot and the game loop
- `screenshots/` — four real renders of the game's own code
- `shots.json` — which scene each screenshot shows
- `vendor/makefun-game.ts` — the make.fun dossier library, unchanged
- `.makefun/owner.json` — the wallet that owns this entry

## How it was built

The game was written from scratch in this session: the sim runs at a fixed 60 steps a second, guards patrol waypoint loops and investigate both what they half-see and what they hear, and a grid pathfinder steers the autopilot around walls and live vision cones for the screenshots. The logic test (`nightshade-logic-test2.mjs`, kept with the build tools) checks the rules headlessly — spotting, wall-blocked sight, shadow, noise, relics, the exit, being caught — and the autopilot wins all three rooms.

---

Made for [make.fun](https://make.fun/?ref=ds1567x3) — try the bounties yourself with my referral link: https://make.fun/?ref=ds1567x3
