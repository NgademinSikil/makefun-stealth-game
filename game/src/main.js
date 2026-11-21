// NIGHTSHADE — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast
// one), and the renderer paints what is there. The game moves between five
// screens: title, play, paused, game over and win. A mouse click sets a
// walk target the thief pathfinds to; any key press takes over from it.
//
// ?seed=N fixes the world. ?shot=start|play|action|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CAUGHT, EVENT_LEVEL, EVENT_RELIC, EVENT_SPOTTED, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
const BEST_KEY = 'nightshade.best';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let clickPath = null;
  let replanIn = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each catch.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    clickPath = null;
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Three lives. Lift the relics, reach the exit unseen.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(won ? `Clean getaway. Score ${world.state.score}.` : `Caught. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    const keys = input.direction();
    const hasKeys = keys.x !== 0 || keys.y !== 0;
    let move = keys;
    let run = input.running();
    let crouch = input.crouching();
    if (!hasKeys) {
      const clicked = input.takeClickTarget();
      if (clicked) {
        const found = world.findPath(world.state.player.x, world.state.player.y, clicked.x, clicked.y);
        clickPath = found ? [...found.points, { x: clicked.x, y: clicked.y }] : null;
        replanIn = 0.5;
      }
    }
    if (!hasKeys && clickPath && clickPath.length > 0) {
      replanIn -= STEP;
      if (replanIn <= 0) {
        const target = clickPath[clickPath.length - 1];
        const found = world.findPath(world.state.player.x, world.state.player.y, target.x, target.y);
        clickPath = found ? found.points : null;
        replanIn = 0.5;
      }
      const p = world.state.player;
      while (clickPath && clickPath.length > 0 && Math.hypot(clickPath[0].x - p.x, clickPath[0].y - p.y) < 14) clickPath.shift();
      if (clickPath && clickPath.length > 0) {
        const next = clickPath[0];
        const dx = next.x - p.x;
        const dy = next.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        move = { x: dx / len, y: dy / len };
        crouch = world.state.guards.some((g) => world.guardSees(g, next.x, next.y));
      } else {
        clickPath = null;
      }
    } else if (hasKeys) {
      clickPath = null;
    }
    const events = world.step(STEP, move, run, crouch);
    if (world.state.player.moving) audio.footstep(run);
    if (events & EVENT_SPOTTED) {
      audio.spotted();
      announce('Spotted! Break line of sight!');
    }
    if (events & EVENT_RELIC) audio.relic();
    if (events & EVENT_LEVEL) {
      audio.level();
      announce(`Room cleared. ${world.state.level.name}.`);
    }
    if (events & EVENT_CAUGHT) {
      audio.caught();
      clickPath = null;
      if (world.state.over) endGame(false);
      else announce(world.state.lives === 1 ? 'Caught! One life left.' : `Caught! ${world.state.lives} lives left.`);
    }
    if (events & EVENT_WIN) {
      audio.win();
      endGame(true);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        if (screen === SCREEN_TITLE) world.step(STEP, { x: 0, y: 0 }, false, false);
        else step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Nightshade. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
