// Keyboard and mouse input. Held keys give a steering direction; one-shot
// presses (enter a car, shoot, reload, pause, start) are queued and taken once
// per frame, so a press between two frames is never lost and never counted
// twice. The mouse aims in world coordinates through the toWorld function the
// main loop supplies. Space is the handbrake while driving and the confirm
// key on the menus; the loop decides which by the screen it is on.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_CONTINUE = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(target, toWorld) {
  const held = { up: false, down: false, left: false, right: false, space: false };
  let actions = 0;
  let enter = false;
  let shoot = false;
  let reload = false;
  let aimX = 0;
  let aimY = 0;
  let aimActive = false;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (event.code === 'Space') {
      held.space = true;
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (event.code === 'KeyE') { if (!event.repeat) enter = true; }
    else if (event.code === 'KeyF') { if (!event.repeat) shoot = true; }
    else if (event.code === 'KeyR') { if (!event.repeat) reload = true; }
    else if (event.code === 'KeyM') { if (!event.repeat) actions |= ACTION_MUTE; }
    else if (event.code === 'KeyC') { if (!event.repeat) actions |= ACTION_CONTINUE; }
    else if (event.code === 'Enter') { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (event.code === 'Space') held.space = false;
  });
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = held.space = false;
  });
  target.addEventListener('pointermove', (event) => {
    const p = toWorld(event.clientX, event.clientY);
    aimX = p.x;
    aimY = p.y;
    aimActive = true;
  });
  target.addEventListener('pointerdown', (event) => {
    const p = toWorld(event.clientX, event.clientY);
    aimX = p.x;
    aimY = p.y;
    aimActive = true;
    if (event.button === 0) shoot = true;
    else actions |= ACTION_CONFIRM;
  });

  return {
    /** The driving/walking input for this frame, shaped like the world's step input. */
    read() {
      const input = {
        up: held.up, down: held.down, left: held.left, right: held.right,
        handbrake: held.space,
        enter, shoot, reload, aimX, aimY, aimActive,
      };
      enter = false;
      shoot = false;
      reload = false;
      return input;
    },
    /** The one-shot menu presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
