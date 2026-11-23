// Keyboard and pointer input. Held keys give the driving direction; one-shot
// presses (start, pause, enter a car, shoot, reload, mute) are queued as bit
// flags and taken once by the loop, so a press between two frames is never lost
// and never counted twice. The mouse aims: its client position is converted to
// world coordinates by the function the boot code supplies.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_NEWGAME = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(target, toWorld) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let handbrake = false;
  let actions = 0;
  let enterPressed = false;
  let shootPressed = false;
  let reloadPressed = false;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (event.code === 'Space') {
      handbrake = true;
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyE') {
      if (!event.repeat) enterPressed = true;
    } else if (event.code === 'KeyF') {
      if (!event.repeat) shootPressed = true;
    } else if (event.code === 'KeyR') {
      if (!event.repeat) reloadPressed = true;
    } else if (event.code === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (event.code === 'KeyN') {
      if (!event.repeat) actions |= ACTION_NEWGAME;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (event.code === 'Space') handbrake = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    up = false;
    down = false;
    left = false;
    right = false;
    handbrake = false;
    mouseDown = false;
  });
  target.addEventListener('pointermove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
  });
  target.addEventListener('pointerdown', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    mouseDown = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  return {
    /**
     * The input for one fixed step. One-shot presses are consumed here, so a
     * frame that runs several steps only fires them once.
     */
    state() {
      const aim = toWorld(mouseX, mouseY);
      const input = {
        up, down, left, right, handbrake,
        enter: enterPressed,
        shoot: shootPressed || mouseDown,
        reload: reloadPressed,
        aimX: aim.x, aimY: aim.y, aimActive: true,
      };
      enterPressed = false;
      shootPressed = false;
      reloadPressed = false;
      return input;
    },
    /** The one-shot actions since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
