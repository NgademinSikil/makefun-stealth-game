// NIGHTSHADE — the rules, with no drawing and no browser in it: the thief,
// the guards and their vision cones, shadows, noise, relics, the exit,
// score and lives. step() advances one fixed step and returns what happened
// as bit flags, so the caller can react without the world knowing about
// screens or sound. The sim is deterministic: same seed, same steps, same
// game — which is what makes the screenshots repeatable.

import {
  CHASE_MEMORY,
  CHASE_SPEED,
  CROUCH_SPEED,
  GUARD_TOUCH,
  HEARING_RANGE,
  INVESTIGATE_SPEED,
  LEVEL_BONUS,
  LOOK_AROUND_TIME,
  PATROL_SPEED,
  PLAYER_RADIUS,
  RELIC_SCORE,
  RELICS_PER_LEVEL,
  RUN_SPEED,
  SPOT_DECAY,
  SPOT_RATE,
  START_LIVES,
  VIEW_H,
  VIEW_W,
  VISION_HALF_ANGLE,
  VISION_RANGE,
  WALK_SPEED,
} from './config.js';
import { LEVELS } from './levels.js';

export const GUARD_PATROL = 0;
export const GUARD_INVESTIGATE = 1;
export const GUARD_CHASE = 2;
export const GUARD_RETURN = 3;

export const EVENT_SPOTTED = 1;
export const EVENT_RELIC = 2;
export const EVENT_LEVEL = 4;
export const EVENT_WIN = 8;
export const EVENT_CAUGHT = 16;

const GUARD_RADIUS = 14;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function pointInRect(x, y, rect) {
  return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
}

// True when the segment from (x0,y0) to (x1,y1) touches the rectangle:
// the slab test, which handles the segment starting inside the rect too.
function segmentHitsRect(x0, y0, x1, y1, rect) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let tMin = 0;
  let tMax = 1;
  const slabs = [
    [rect.x, rect.x + rect.w, dx, x0],
    [rect.y, rect.y + rect.h, dy, y0],
  ];
  for (const [low, high, d, origin] of slabs) {
    if (Math.abs(d) < 1e-9) {
      if (origin < low || origin > high) return false;
    } else {
      let t0 = (low - origin) / d;
      let t1 = (high - origin) / d;
      if (t0 > t1) [t0, t1] = [t1, t0];
      tMin = Math.max(tMin, t0);
      tMax = Math.min(tMax, t1);
      if (tMin > tMax) return false;
    }
  }
  return true;
}

export function createWorld() {
  const state = {
    levelIndex: 0,
    level: LEVELS[0],
    player: { x: 0, y: 0, angle: 0, crouch: false, running: false, moving: false, inShadow: false },
    guards: [],
    relics: [],
    exitOpen: false,
    lives: START_LIVES,
    score: 0,
    time: 0,
    levelTime: 0,
    caughtFlash: 0,
    won: false,
    over: false,
    noiseRings: [],
  };

  function loadLevel(index) {
    const level = LEVELS[index];
    state.levelIndex = index;
    state.level = level;
    state.player.x = level.start.x;
    state.player.y = level.start.y;
    state.player.angle = 0;
    state.player.crouch = false;
    state.player.running = false;
    state.player.moving = false;
    state.exitOpen = false;
    state.levelTime = 0;
    state.caughtFlash = 0;
    state.relics = level.relics.map((r) => ({ x: r.x, y: r.y, taken: false }));
    const speedMul = 1 + 0.15 * index; // later rooms, quicker guards
    state.guards = level.guards.map((g) => ({
      x: g.path[0][0],
      y: g.path[0][1],
      angle: 0,
      path: g.path,
      waypoint: 1 % g.path.length,
      pause: g.pause,
      pauseTimer: 0,
      mode: GUARD_PATROL,
      meter: 0,
      seenX: 0,
      seenY: 0,
      chaseTimer: 0,
      lookTimer: 0,
      targetX: 0,
      targetY: 0,
      speedMul,
    }));
  }

  function reset() {
    state.lives = START_LIVES;
    state.score = 0;
    state.time = 0;
    state.won = false;
    state.over = false;
    state.noiseRings = [];
    loadLevel(0);
  }

  function hitsWall(x, y, radius) {
    if (x < radius || x > VIEW_W - radius || y < radius || y > VIEW_H - radius) return true;
    for (const wall of state.level.walls) {
      const nearestX = clamp(x, wall.x, wall.x + wall.w);
      const nearestY = clamp(y, wall.y, wall.y + wall.h);
      const dx = x - nearestX;
      const dy = y - nearestY;
      if (dx * dx + dy * dy < radius * radius) return true;
    }
    return false;
  }

  // Move a circle one axis at a time so it slides along walls instead of
  // sticking on their corners.
  function moveCircle(body, dx, dy, radius) {
    const nextX = body.x + dx;
    if (!hitsWall(nextX, body.y, radius)) body.x = nextX;
    const nextY = body.y + dy;
    if (!hitsWall(body.x, nextY, radius)) body.y = nextY;
  }

  function sightBlocked(x0, y0, x1, y1) {
    for (const wall of state.level.walls) {
      if (segmentHitsRect(x0, y0, x1, y1, wall)) return true;
    }
    return false;
  }

  function inShadow(x, y) {
    return state.level.shadows.some((s) => pointInRect(x, y, s));
  }

  function guardSees(guard, x, y) {
    const dx = x - guard.x;
    const dy = y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist > VISION_RANGE) return false;
    if (Math.abs(angleDiff(Math.atan2(dy, dx), guard.angle)) > VISION_HALF_ANGLE) return false;
    return !sightBlocked(guard.x, guard.y, x, y);
  }

  function spotFactor(guard, dist) {
    const p = state.player;
    let rate = SPOT_RATE * (1.35 - 0.7 * (dist / VISION_RANGE));
    if (p.crouch) rate *= 0.55;
    if (p.inShadow) rate *= 0.45;
    if (p.running) rate *= 1.25;
    return rate;
  }

  function guardStep(guard, dt) {
    const p = state.player;
    const dist = Math.hypot(p.x - guard.x, p.y - guard.y);
    const sees = guardSees(guard, p.x, p.y);
    if (sees) {
      guard.seenX = p.x;
      guard.seenY = p.y;
      guard.meter = Math.min(1, guard.meter + spotFactor(guard, dist) * dt);
      if (guard.meter >= 1 && guard.mode !== GUARD_CHASE) {
        guard.mode = GUARD_CHASE;
        guard.chaseTimer = CHASE_MEMORY;
      } else if (guard.meter >= 0.5 && guard.mode === GUARD_PATROL) {
        guard.mode = GUARD_INVESTIGATE;
        guard.targetX = p.x;
        guard.targetY = p.y;
      }
      if (guard.mode === GUARD_CHASE) guard.chaseTimer = CHASE_MEMORY;
    } else {
      guard.meter = Math.max(0, guard.meter - SPOT_DECAY * dt);
      if (guard.mode === GUARD_CHASE) {
        guard.chaseTimer -= dt;
        if (guard.chaseTimer <= 0) {
          guard.mode = GUARD_INVESTIGATE;
          guard.targetX = guard.seenX;
          guard.targetY = guard.seenY;
        }
      }
    }

    if (guard.mode === GUARD_PATROL) {
      if (guard.pauseTimer > 0) {
        guard.pauseTimer -= dt;
      } else {
        const [tx, ty] = guard.path[guard.waypoint];
        walkToward(guard, tx, ty, PATROL_SPEED * guard.speedMul, dt);
        if (Math.hypot(tx - guard.x, ty - guard.y) < 6) {
          guard.waypoint = (guard.waypoint + 1) % guard.path.length;
          guard.pauseTimer = guard.pause;
        }
      }
    } else if (guard.mode === GUARD_INVESTIGATE) {
      walkToward(guard, guard.targetX, guard.targetY, INVESTIGATE_SPEED * guard.speedMul, dt);
      if (Math.hypot(guard.targetX - guard.x, guard.targetY - guard.y) < 10) {
        guard.lookTimer += dt;
        guard.angle += dt * 1.6; // scan the room while searching
        if (guard.lookTimer >= LOOK_AROUND_TIME || guard.meter <= 0) {
          guard.lookTimer = 0;
          guard.mode = GUARD_RETURN;
        }
      }
    } else if (guard.mode === GUARD_CHASE) {
      walkToward(guard, guard.seenX, guard.seenY, CHASE_SPEED, dt);
    } else if (guard.mode === GUARD_RETURN) {
      // Head back to the nearest patrol point, then resume the round.
      let best = 0;
      let bestDist = Infinity;
      guard.path.forEach(([wx, wy], i) => {
        const d = Math.hypot(wx - guard.x, wy - guard.y);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      const [tx, ty] = guard.path[best];
      walkToward(guard, tx, ty, PATROL_SPEED * guard.speedMul, dt);
      if (bestDist < 8) {
        guard.waypoint = (best + 1) % guard.path.length;
        guard.mode = GUARD_PATROL;
      }
    }
  }

  function walkToward(guard, tx, ty, speed, dt) {
    const dx = tx - guard.x;
    const dy = ty - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    const stepLen = Math.min(dist, speed * dt);
    const nx = (dx / dist) * stepLen;
    const ny = (dy / dist) * stepLen;
    moveCircle(guard, nx, ny, GUARD_RADIUS);
    guard.angle = Math.atan2(dy, dx);
  }

  // Grid pathfinding for the autopilot and click-to-move: walls block, and
  // cells inside a guard's live vision cone cost far more than open floor,
  // so the thief waits for a gap instead of strolling through a searchlight.
  const CELL = 40;
  const COLS = Math.ceil(VIEW_W / CELL);
  const ROWS = Math.ceil(VIEW_H / CELL);

  function cellBlocked(cx, cy) {
    const x = cx * CELL + CELL / 2;
    const y = cy * CELL + CELL / 2;
    return hitsWall(x, y, PLAYER_RADIUS + 2);
  }

  function cellInCone(cx, cy) {
    const x = cx * CELL + CELL / 2;
    const y = cy * CELL + CELL / 2;
    return state.guards.some((g) => guardSees(g, x, y));
  }

  function findPath(fromX, fromY, toX, toY) {
    const startX = clamp(Math.floor(fromX / CELL), 0, COLS - 1);
    const startY = clamp(Math.floor(fromY / CELL), 0, ROWS - 1);
    const goalX = clamp(Math.floor(toX / CELL), 0, COLS - 1);
    const goalY = clamp(Math.floor(toY / CELL), 0, ROWS - 1);
    const size = COLS * ROWS;
    const cost = new Float64Array(size).fill(Infinity);
    const prev = new Int32Array(size).fill(-1);
    const done = new Uint8Array(size);
    const at = (x, y) => y * COLS + x;
    cost[at(startX, startY)] = 0;
    for (let iter = 0; iter < size; iter += 1) {
      let best = -1;
      let bestCost = Infinity;
      for (let i = 0; i < size; i += 1) {
        if (!done[i] && cost[i] < bestCost) {
          bestCost = cost[i];
          best = i;
        }
      }
      if (best === -1 || bestCost === Infinity) break;
      done[best] = 1;
      if (best === at(goalX, goalY)) break;
      const bx = best % COLS;
      const by = Math.floor(best / COLS);
      const neighbours = [
        [bx + 1, by], [bx - 1, by], [bx, by + 1], [bx, by - 1],
        [bx + 1, by + 1], [bx + 1, by - 1], [bx - 1, by + 1], [bx - 1, by - 1],
      ];
      for (const [nx, ny] of neighbours) {
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        if (cellBlocked(nx, ny)) continue;
        const diagonal = nx !== bx && ny !== by;
        let stepCost = diagonal ? 1.5 : 1;
        if (cellInCone(nx, ny)) stepCost += 80;
        const next = at(nx, ny);
        const total = bestCost + stepCost;
        if (total < cost[next]) {
          cost[next] = total;
          prev[next] = best;
        }
      }
    }
    if (cost[at(goalX, goalY)] === Infinity) return null;
    const cells = [];
    let cursor = at(goalX, goalY);
    while (cursor !== -1) {
      cells.push(cursor);
      cursor = prev[cursor];
    }
    cells.reverse();
    return {
      points: cells.map((i) => ({ x: (i % COLS) * CELL + CELL / 2, y: Math.floor(i / COLS) * CELL + CELL / 2 })),
      danger: cost[at(goalX, goalY)],
    };
  }

  /**
   * One fixed step. `move` is a unit-ish {x, y} direction (0,0 to stand
   * still), `run` sprints loudly, `crouch` sneaks slowly and unseen.
   */
  function step(dt, move, run, crouch) {
    if (state.won || state.over) return 0;
    let events = 0;
    state.time += dt;
    state.levelTime += dt;
    if (state.caughtFlash > 0) state.caughtFlash = Math.max(0, state.caughtFlash - dt * 2);

    const p = state.player;
    const speed = crouch ? CROUCH_SPEED : run ? RUN_SPEED : WALK_SPEED;
    const moving = move.x !== 0 || move.y !== 0;
    p.moving = moving;
    p.crouch = crouch;
    p.running = run && moving;
    if (moving) {
      const len = Math.hypot(move.x, move.y) || 1;
      moveCircle(p, (move.x / len) * speed * dt, (move.y / len) * speed * dt, PLAYER_RADIUS);
      p.angle = Math.atan2(move.y, move.x);
    }
    p.inShadow = inShadow(p.x, p.y);

    // Running is loud: nearby guards come to look at the noise.
    if (p.running) {
      state.noiseRings.push({ x: p.x, y: p.y, age: 0 });
      for (const guard of state.guards) {
        if (guard.mode === GUARD_PATROL || guard.mode === GUARD_INVESTIGATE) {
          if (Math.hypot(guard.x - p.x, guard.y - p.y) < HEARING_RANGE) {
            guard.mode = GUARD_INVESTIGATE;
            guard.targetX = p.x;
            guard.targetY = p.y;
            guard.lookTimer = 0;
          }
        }
      }
    }
    for (const ring of state.noiseRings) ring.age += dt;
    state.noiseRings = state.noiseRings.filter((r) => r.age < 0.6);

    let spotted = false;
    for (const guard of state.guards) {
      const before = guard.meter;
      guardStep(guard, dt);
      if (guard.meter >= 1 && before < 1) spotted = true;
      if (guard.mode === GUARD_CHASE && Math.hypot(guard.x - p.x, guard.y - p.y) < GUARD_TOUCH) {
        state.lives -= 1;
        state.caughtFlash = 1;
        events |= EVENT_CAUGHT;
        if (state.lives <= 0) {
          state.over = true;
        } else {
          loadLevel(state.levelIndex);
        }
        return events;
      }
    }
    if (spotted) events |= EVENT_SPOTTED;

    for (const relic of state.relics) {
      if (!relic.taken && Math.hypot(relic.x - p.x, relic.y - p.y) < 26) {
        relic.taken = true;
        state.score += RELIC_SCORE;
        events |= EVENT_RELIC;
      }
    }
    if (!state.exitOpen && state.relics.every((r) => r.taken)) state.exitOpen = true;

    const exit = state.level.exit;
    if (state.exitOpen && pointInRect(p.x, p.y, exit)) {
      state.score += LEVEL_BONUS;
      if (state.levelIndex + 1 >= LEVELS.length) {
        state.won = true;
        events |= EVENT_WIN;
      } else {
        loadLevel(state.levelIndex + 1);
        events |= EVENT_LEVEL;
      }
    }
    return events;
  }

  reset();
  return { state, reset, step, findPath, guardSees };
}
