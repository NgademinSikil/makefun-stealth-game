// NIGHTSHADE — the screenshot scenes behind ?shot=start|play|action|end.
// Each one plays the real rules forward from a fresh world, steered by an
// autopilot that pathfinds around walls and waits out vision cones, so the
// frame is what a real game looks like and the same seed always gives the
// same frame. The autopilot is also what the logic test drives.

import { STEP } from './config.js';
import { EVENT_CAUGHT, EVENT_LEVEL, EVENT_RELIC, EVENT_WIN } from './world.js';
import { SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const END_LIMIT_SECONDS = 900;
const REPLAN_EVERY = 0.4;
// A path this costly means crossing live cones: wait for a gap instead.
const DANGER_PER_STEP = 4;
const WAIT_TOO_LONG = 5.0;

export function createAutopilot() {
  let plan = null;
  let planAge = Infinity;
  let targetKey = '';
  let waiting = 0;

  function currentTarget(world) {
    const state = world.state;
    const open = state.relics.filter((r) => !r.taken);
    if (open.length > 0) {
      let best = open[0];
      let bestDist = Infinity;
      for (const relic of open) {
        const d = Math.hypot(relic.x - state.player.x, relic.y - state.player.y);
        if (d < bestDist) {
          bestDist = d;
          best = relic;
        }
      }
      return { x: best.x, y: best.y, key: `relic-${best.x}-${best.y}` };
    }
    const e = state.level.exit;
    return { x: e.x + e.w / 2, y: e.y + e.h / 2, key: 'exit' };
  }

  // Returns {move, run, crouch} for this step.
  function drive(world, dt) {
    const state = world.state;
    const p = state.player;
    planAge += dt;
    const target = currentTarget(world);
    if (!plan || plan.length === 0 || planAge >= REPLAN_EVERY || target.key !== targetKey) {
      const found = world.findPath(p.x, p.y, target.x, target.y);
      // Walk the cells, then step onto the exact target (a relic, the door).
      plan = found ? [...found.points, { x: target.x, y: target.y }] : null;
      planAge = 0;
      targetKey = target.key;
      if (found && found.danger > found.points.length * DANGER_PER_STEP) {
        waiting += dt;
      } else {
        waiting = 0;
      }
    }
    // Nothing to walk, or the way is covered by cones: crouch and wait.
    if (!plan || plan.length === 0) return { move: { x: 0, y: 0 }, run: false, crouch: true };
    if (waiting > 0 && waiting < WAIT_TOO_LONG) return { move: { x: 0, y: 0 }, run: false, crouch: true };
    while (plan.length > 0 && Math.hypot(plan[0].x - p.x, plan[0].y - p.y) < 14) plan.shift();
    if (plan.length === 0) return { move: { x: 0, y: 0 }, run: false, crouch: true };
    const next = plan[0];
    const dx = next.x - p.x;
    const dy = next.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    // Crouch through a cone; walk everywhere else.
    const inCone = world.state.guards.some((g) => world.guardSees(g, next.x, next.y));
    return { move: { x: dx / len, y: dy / len }, run: false, crouch: inCone || waiting >= WAIT_TOO_LONG };
  }

  return { drive };
}

/**
 * Set `world` to the named scene (start, play, action or end; any other name
 * is start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    const pilot = createAutopilot();
    for (let i = 0; i < 120 / STEP; i += 1) {
      const { move, run, crouch } = pilot.drive(world, STEP);
      const events = world.step(STEP, move, run, crouch);
      if (events & EVENT_RELIC) {
        // A few more steps so the relic glow has faded and the scene breathes.
        for (let j = 0; j < 30; j += 1) {
          const d = pilot.drive(world, STEP);
          world.step(STEP, d.move, d.run, d.crouch);
        }
        break;
      }
      if (events & EVENT_CAUGHT) break;
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'action') {
    // Stage a live chase: put the thief in the open ahead of a guard and let
    // the real suspicion meter fill until the guard gives chase.
    const state = world.state;
    const guard = state.guards[0];
    guard.x = 300;
    guard.y = 600;
    guard.angle = 0;
    guard.mode = 0;
    guard.meter = 0;
    guard.pauseTimer = 5; // stand still, facing the thief, while suspicion fills
    state.player.x = 450;
    state.player.y = 600;
    for (let i = 0; i < 2.5 / STEP; i += 1) {
      world.step(STEP, { x: 0, y: 0 }, false, false);
      if (guard.mode === 2) break;
    }
    // The thief flees a few steps so the frame catches the chase mid-stride —
    // away from the guard, to the right and down.
    for (let i = 0; i < 0.5 / STEP; i += 1) {
      world.step(STEP, { x: 1, y: 0.4 }, true, false);
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    const pilot = createAutopilot();
    for (let i = 0; i < END_LIMIT_SECONDS / STEP; i += 1) {
      const { move, run, crouch } = pilot.drive(world, STEP);
      const events = world.step(STEP, move, run, crouch);
      if (events & EVENT_WIN) break;
      if (events & EVENT_CAUGHT) {
        // A fresh attempt from the level's start keeps the scene honest: the
        // pilot re-plans and tries again rather than giving up.
        pilot.drive(world, STEP);
      }
    }
    return { screen: world.state.won ? SCREEN_WIN : SCREEN_PLAY, best: world.state.score };
  }
  // Start: the title over a live, patrolling first room.
  for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, { x: 0, y: 0 }, false, false);
  return { screen: SCREEN_TITLE, best: 0 };
}
