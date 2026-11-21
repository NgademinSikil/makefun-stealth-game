// NIGHTSHADE — keyboard and pointer input. Held keys give a steering
// direction; one-shot presses (start, pause) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost and
// never counted twice. A mouse click sets a walk target the loop pathfinds
// to; any key press cancels it.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const CROUCH = new Set(['KeyC', 'ControlLeft', 'ControlRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let clickTarget = null;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if ([...UP, ...DOWN, ...LEFT, ...RIGHT, ...RUN, ...CROUCH].some((code) => code === event.code)) {
      held.add(event.code);
      clickTarget = null;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of
  // everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    clickTarget = {
      x: ((event.clientX - rect.left) / rect.width) * 1280,
      y: ((event.clientY - rect.top) / rect.height) * 720,
    };
  });

  function hasAny(codes) {
    for (const code of codes) if (held.has(code)) return true;
    return false;
  }

  return {
    /** {x, y} steering: -1..1 on each axis, 0,0 when no key is held. */
    direction() {
      const x = (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0);
      const y = (hasAny(DOWN) ? 1 : 0) - (hasAny(UP) ? 1 : 0);
      return { x, y };
    },
    running() {
      return hasAny(RUN);
    },
    crouching() {
      return hasAny(CROUCH);
    },
    /** The click-to-move target, if the player clicked one and no key overrode it. */
    takeClickTarget() {
      const target = clickTarget;
      clickTarget = null;
      return target;
    },
    peekClickTarget() {
      return clickTarget;
    },
    clearClickTarget() {
      clickTarget = null;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
