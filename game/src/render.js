// NIGHTSHADE — drawing only: the world's state and the current screen in,
// pixels out. The 1280x720 playfield is drawn as-is and the page's CSS
// scales it to the window. Flat shapes, canvas text for the HUD and the
// panels, and nothing that allocates per frame beyond the obvious.

import {
  GUARD_CHASE,
  GUARD_INVESTIGATE,
  GUARD_PATROL,
} from './world.js';
import {
  RELICS_PER_LEVEL,
  VIEW_H,
  VIEW_W,
  VISION_HALF_ANGLE,
  VISION_RANGE,
} from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PALETTE = {
  floorA: '#20242e',
  floorB: '#1b1f28',
  wall: '#3a4152',
  wallTop: '#4d566c',
  shadow: 'rgba(6, 8, 16, 0.55)',
  relic: '#f2c94c',
  exitLocked: '#c0392b',
  exitOpen: '#2ecc71',
  guard: '#e74c3c',
  guardBody: '#8e2f26',
  player: '#2ec4b6',
  playerDark: '#1d7a72',
  text: '#eef1f5',
  muted: '#9aa3b2',
  panel: 'rgba(10, 12, 20, 0.82)',
};

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function createRenderer(canvas) {
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const ctx = canvas.getContext('2d');

  function drawFloor() {
    const tile = 80;
    for (let y = 0; y < VIEW_H; y += tile) {
      for (let x = 0; x < VIEW_W; x += tile) {
        ctx.fillStyle = ((x + y) / tile) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        ctx.fillRect(x, y, tile, tile);
      }
    }
  }

  function drawShadows(state) {
    for (const s of state.level.shadows) {
      ctx.fillStyle = PALETTE.shadow;
      ctx.beginPath();
      ctx.roundRect(s.x, s.y, s.w, s.h, 18);
      ctx.fill();
    }
  }

  function drawWalls(state) {
    for (const w of state.level.walls) {
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = PALETTE.wallTop;
      ctx.fillRect(w.x, w.y, w.w, 8);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w, w.h);
    }
  }

  function drawExit(state) {
    const e = state.level.exit;
    const glow = state.exitOpen ? PALETTE.exitOpen : PALETTE.exitLocked;
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = state.exitOpen ? 26 : 8;
    ctx.fillStyle = glow;
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.restore();
    ctx.fillStyle = '#10131a';
    // The door is narrow and tall, so its label reads bottom-to-top.
    ctx.save();
    ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = `bold 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(state.exitOpen ? 'EXIT' : 'LOCKED', 0, 5);
    ctx.restore();
  }

  function drawRelics(state) {
    const pulse = 0.7 + 0.3 * Math.sin(state.time * 3);
    for (const relic of state.relics) {
      if (relic.taken) continue;
      ctx.save();
      ctx.translate(relic.x, relic.y);
      ctx.shadowColor = PALETTE.relic;
      ctx.shadowBlur = 18 * pulse;
      ctx.fillStyle = PALETTE.relic;
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(10, 0);
      ctx.lineTo(0, 13);
      ctx.lineTo(-10, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function coneColor(mode) {
    if (mode === GUARD_CHASE) return 'rgba(255, 70, 60, 0.30)';
    if (mode === GUARD_INVESTIGATE) return 'rgba(255, 150, 50, 0.24)';
    return 'rgba(255, 205, 90, 0.16)';
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      // Vision cone.
      ctx.fillStyle = coneColor(guard.mode);
      ctx.beginPath();
      ctx.moveTo(guard.x, guard.y);
      ctx.arc(guard.x, guard.y, VISION_RANGE, guard.angle - VISION_HALF_ANGLE, guard.angle + VISION_HALF_ANGLE);
      ctx.closePath();
      ctx.fill();
      // Body: a guard in a dark uniform with a pale helmet.
      ctx.fillStyle = PALETTE.guardBody;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.guard;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, 9, 0, Math.PI * 2);
      ctx.fill();
      // Facing tick.
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(guard.x, guard.y);
      ctx.lineTo(guard.x + Math.cos(guard.angle) * 20, guard.y + Math.sin(guard.angle) * 20);
      ctx.stroke();
      // Suspicion meter above the head.
      if (guard.meter > 0.03) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(guard.x - 18, guard.y - 30, 36, 6);
        ctx.fillStyle = guard.meter >= 1 ? '#ff453a' : '#ffb020';
        ctx.fillRect(guard.x - 18, guard.y - 30, 36 * guard.meter, 6);
      }
      // A "!" when the guard is chasing.
      if (guard.mode === GUARD_CHASE) {
        ctx.fillStyle = '#ff453a';
        ctx.font = `bold 22px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('!', guard.x, guard.y - 36);
      }
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    ctx.save();
    if (p.crouch) ctx.globalAlpha = 0.85;
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = p.inShadow ? 0 : 14;
    ctx.fillStyle = p.inShadow ? PALETTE.playerDark : PALETTE.player;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.crouch ? 10 : 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Hood point showing which way the thief faces.
    ctx.fillStyle = '#0f2a28';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 7, p.y + Math.sin(p.angle) * 7, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawNoise(state) {
    for (const ring of state.noiseRings) {
      const progress = ring.age / 0.6;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * (1 - progress)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, 12 + progress * 70, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawHud(state, best) {
    ctx.fillStyle = 'rgba(8, 10, 16, 0.72)';
    ctx.fillRect(0, 0, VIEW_W, 44);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 17px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`${state.levelIndex + 1}. ${state.level.name}`, 16, 29);
    // Relic pips.
    const taken = state.relics.filter((r) => r.taken).length;
    for (let i = 0; i < RELICS_PER_LEVEL; i += 1) {
      const x = 560 + i * 30;
      ctx.fillStyle = i < taken ? PALETTE.relic : 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.moveTo(x, 18);
      ctx.lineTo(x + 8, 28);
      ctx.lineTo(x, 38);
      ctx.lineTo(x - 8, 28);
      ctx.closePath();
      ctx.fill();
    }
    // Lives as hearts, score on the right.
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff6b81';
    ctx.font = '18px sans-serif';
    ctx.fillText('♥'.repeat(state.lives) + '♡'.repeat(Math.max(0, 3 - state.lives)), 1010, 29);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText(`Score ${state.score}   Best ${best}`, 1264, 29);
    // Alarm bar when any guard is suspicious.
    const hottest = Math.max(0, ...state.guards.map((g) => g.meter));
    if (hottest > 0.03) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(VIEW_W / 2 - 110, 52, 220, 10);
      ctx.fillStyle = hottest >= 1 ? '#ff453a' : '#ffb020';
      ctx.fillRect(VIEW_W / 2 - 110, 52, 220 * hottest, 10);
      ctx.fillStyle = '#ffd166';
      ctx.font = `bold 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(hottest >= 1 ? 'SPOTTED — RUN!' : 'SUSPICION RISING', VIEW_W / 2, 78);
    }
    // Level intro banner.
    if (state.levelTime < 2.6) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (2.6 - state.levelTime) / 0.6);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `bold 30px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(state.level.name, VIEW_W / 2, 120);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `17px ${FONT}`;
      ctx.fillText(state.level.hint, VIEW_W / 2, 148);
      ctx.restore();
    }
    // Caught flash.
    if (state.caughtFlash > 0) {
      ctx.fillStyle = `rgba(200, 30, 30, ${state.caughtFlash * 0.35})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  function drawPanel(lines, prompt) {
    ctx.fillStyle = PALETTE.panel;
    const width = 640;
    const height = 150 + lines.length * 32;
    const x = (VIEW_W - width) / 2;
    const y = (VIEW_H - height) / 2;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.stroke();
    ctx.textAlign = 'center';
    lines.forEach((line, i) => {
      ctx.fillStyle = i === 0 ? PALETTE.text : PALETTE.muted;
      ctx.font = i === 0 ? `bold 34px ${FONT}` : `17px ${FONT}`;
      ctx.fillText(line, VIEW_W / 2, y + 62 + i * 32);
    });
    ctx.fillStyle = '#7ee0d2';
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText(prompt, VIEW_W / 2, y + height - 30);
  }

  function draw(state, screen, best) {
    drawFloor();
    drawShadows(state);
    drawWalls(state);
    drawExit(state);
    drawRelics(state);
    drawGuards(state);
    drawPlayer(state);
    drawNoise(state);
    if (screen !== SCREEN_TITLE) drawHud(state, best);
    if (screen === SCREEN_TITLE) {
      ctx.fillStyle = 'rgba(6, 8, 14, 0.62)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      drawPanel(
        ['NIGHTSHADE', 'A top-down stealth game in three rooms.', 'Lift every relic, then reach the exit unseen.', 'Move WASD / arrows · Shift runs (loud) · C sneaks in shadow', 'Click a spot to walk there. Guards patrol — mind their cones.'],
        'Press Enter to begin',
      );
    } else if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(6, 8, 14, 0.55)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      drawPanel(['Paused', 'The guards wait for no one — except now.'], 'Press P to keep sneaking');
    } else if (screen === SCREEN_OVER) {
      ctx.fillStyle = 'rgba(20, 4, 6, 0.6)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      drawPanel(['CAUGHT', `The museum keeps its relics. Score ${state.score}.`, `Best ${best}.`], 'Press Enter to try again');
    } else if (screen === SCREEN_WIN) {
      ctx.fillStyle = 'rgba(4, 14, 8, 0.55)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      drawPanel(['CLEAN GETAWAY', `All three rooms, every relic, never caught flat-footed. Score ${state.score}.`, `Best ${best}.`], 'Press Enter to play again');
    }
  }

  return { draw };
}
