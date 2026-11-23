// Keyboard and mouse. WASD or arrows move, Shift runs, E enters a car or
// starts a job, Space or click confirms, P or Escape pauses, R reloads, F
// punches, M mutes. The mouse aims the pistol.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_RELOAD = 16;
export const ACTION_MUTE = 32;

const KEYS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false, moved: false };
  let actions = 0;

  function onKeyDown(e) {
    if (e.repeat) return;
    held.add(e.code);
    pressed.add(e.code);
    if (e.code === 'Space' || e.code === 'Enter') {
      actions |= ACTION_CONFIRM;
      e.preventDefault();
    }
    if (e.code === 'KeyP' || e.code === 'Escape') actions |= ACTION_PAUSE;
    if (e.code === 'KeyE') actions |= ACTION_ENTER;
    if (e.code === 'KeyF') actions |= ACTION_PUNCH;
    if (e.code === 'KeyR') actions |= ACTION_RELOAD;
    if (e.code === 'KeyM') actions |= ACTION_MUTE;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  }

  function onKeyUp(e) {
    held.delete(e.code);
  }

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.moved = true;
  }

  function onMouseDown(e) {
    onMouseMove(e);
    mouse.down = true;
    mouse.clicked = true;
  }

  function onMouseUp() {
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    mouse,
    direction() {
      return {
        up: held.has('KeyW') || held.has('ArrowUp'),
        down: held.has('KeyS') || held.has('ArrowDown'),
        left: held.has('KeyA') || held.has('ArrowLeft'),
        right: held.has('KeyD') || held.has('ArrowRight'),
        run: held.has('ShiftLeft') || held.has('ShiftRight'),
      };
    },
    /** Directions in the same shape the world step takes. Aim follows the mouse only once it has moved. */
    read() {
      const d = this.direction();
      return {
        up: d.up, down: d.down, left: d.left, right: d.right, run: d.run,
        shoot: mouse.down,
        aimX: mouse.moved ? mouse.x : undefined,
        aimY: mouse.moved ? mouse.y : undefined,
      };
    },
    takeActions() {
      const a = actions;
      actions = 0;
      if (mouse.clicked) {
        mouse.clicked = false;
        return a | ACTION_CONFIRM;
      }
      return a;
    },
    consumePress(code) {
      if (pressed.has(code)) {
        pressed.delete(code);
        return true;
      }
      return false;
    },
    clearPresses() {
      pressed.clear();
    },
  };
}
