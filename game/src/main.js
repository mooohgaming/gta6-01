// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between screens: title,
// play, paused, busted, wasted, and story complete.
//
// ?seed=N fixes the city. ?shot=start|downtown|chase|beach|cafe (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { PLAYER, STEP } from './config.js';
import { createRandom } from './random.js';
import { applyArrest, applyHospital, buildLayer, createWorld, stepWorld } from './world.js';
import {
  ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, ACTION_RELOAD,
  createInput,
} from './input.js';
import {
  SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';
import { createAudio } from './audio.js';
import { loadGame, saveGame } from './save.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
const BEST_KEY = 'solmar-bay-best';
const SAVE_INTERVAL = 5;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const state = createWorld(seed);
buildLayer(state);
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
    // Storage can be off (private windows): the best take then lasts this visit only.
  }
}

/** Apply a saved game: cash, progress, and where Rico stands. */
function applySave(data) {
  const p = state.player;
  p.cash = data.cash;
  p.missionsDone = data.missionsDone;
  p.health = data.health ?? 100;
  p.x = data.x;
  p.y = data.y;
  state.camera.x = data.x;
  state.camera.y = data.y;
  const m = state.missions.manager;
  m.index = data.missionIndex ?? data.missionsDone;
  if (data.storyDone) {
    m.done = true;
    m.objective = 'Story complete. Solmar Bay is yours — free roam, Rico.';
  } else {
    m.objective = `Job ${m.index + 1} of 6 ready. Press E to start it.`;
  }
}

function runShot(name) {
  const scene = stageShot(name, state);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, scene.best);
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
  let saveTimer = 0;
  let audioUnlocked = false;

  const saved = loadGame();
  if (saved) applySave(saved);

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    audio.unlock();
    audio.startMusic();
  }

  function startGame() {
    unlockAudio();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Steal a car, run jobs for Mama Rosa, dodge the law.');
  }

  function nearCar() {
    const p = state.player;
    for (const car of [...state.cars, ...state.chaseCars]) {
      if (Math.hypot(car.x - p.x, car.y - p.y) < 64) return true;
    }
    return false;
  }

  function handleEvents(events) {
    for (const e of events) {
      if (e.type === 'shot') audio.shot();
      else if (e.type === 'punch') audio.punch();
      else if (e.type === 'pickup') audio.pickup();
      else if (e.type === 'mission') {
        audio.mission();
        announce(`Mission complete: ${e.name}. +$${e.reward}.`);
        if (state.player.cash > best) {
          best = state.player.cash;
          saveBest(best);
        }
      } else if (e.type === 'missionFailed') {
        audio.fail();
        announce(`Mission failed: ${e.reason}`);
      } else if (e.type === 'wanted') {
        announce(e.stars > 0 ? `${e.stars} stars. The Bayview PD is on you — ${e.reason}.` : 'The heat died down. You are clean.');
      } else if (e.type === 'enterCar') {
        announce(`You took the ${e.model}.`);
      } else if (e.type === 'explosion') {
        announce('A car blew up.');
      }
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_BUSTED || screen === SCREEN_WASTED || screen === SCREEN_COMPLETE) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACTION_ENTER) {
      const m = state.missions.manager;
      const p = state.player;
      if (!m.active && !m.done && p.onFoot && !nearCar()) {
        state.missions.startMission(m.index);
        audio.mission();
        announce(`Job ${m.index + 1}: ${state.missions.manager.objective}`);
        return;
      }
    }
    // The world step reads these as this frame's one-off actions.
    input.pending = {
      enter: !!(actions & ACTION_ENTER),
      punch: !!(actions & ACTION_PUNCH),
      reload: !!(actions & ACTION_RELOAD),
    };
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      state.viewW = renderer.viewW;
      state.viewH = renderer.viewH;
      state.zoom = renderer.zoom;
      stepWorld(state, STEP, { up: false, down: false, left: false, right: false, run: false, shoot: false });
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    state.viewW = renderer.viewW;
    state.viewH = renderer.viewH;
    state.zoom = renderer.zoom;
    const pending = input.pending ?? { enter: false, punch: false, reload: false };
    input.pending = { enter: false, punch: false, reload: false };
    const stepInput = { ...input.read(), enter: pending.enter, punch: pending.punch };
    if (pending.reload && state.player.ammo < PLAYER.pistolAmmo && state.player.reserve > 0 && state.player.reloadTimer <= 0) {
      state.player.ammo = 0;
      state.player.reloadTimer = PLAYER.reloadSeconds;
    }
    const events = stepWorld(state, STEP, stepInput);
    handleEvents(events);
    audio.setEngine(state.player.car ? state.player.car.speed : 0, 560);
    audio.setSiren(state.player.stars > 0 && state.chaseCars.length > 0);
    if (state.flags.busted) {
      applyArrest(state);
      screen = SCREEN_BUSTED;
      announce('Busted. The Bayview PD took your cash and your ride.');
    } else if (state.flags.wasted) {
      applyHospital(state);
      screen = SCREEN_WASTED;
      announce('Wasted. You woke up at Solmar General with a hospital bill.');
    } else if (state.missions.manager.done && screen === SCREEN_PLAY) {
      screen = SCREEN_COMPLETE;
      announce('Story complete. The Golden Palm is yours.');
    }
    saveTimer += STEP;
    if (saveTimer >= SAVE_INTERVAL || state.saveDirty) {
      saveTimer = 0;
      state.saveDirty = false;
      saveGame(state);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
      step();
      accumulator -= STEP;
    }
    if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) accumulator = 0;
    renderer.draw(state, screen, best);
  }

  // Leaving the tab pauses a running game and saves it.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
      saveGame(state);
    }
  });
  window.addEventListener('beforeunload', () => saveGame(state));
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });

  announce(saved
    ? `Solmar Bay. Welcome back, Rico — $${state.player.cash}, ${state.player.missionsDone} jobs done. Press Space or click to play.`
    : 'Solmar Bay. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
