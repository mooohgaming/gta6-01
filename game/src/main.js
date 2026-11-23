// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens: title,
// play, paused, busted, wasted and story complete. The save is written every
// time a mission pays out.
//
// ?seed=N fixes the city. ?shot=downtown|chase|beach|cafe (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_CONTINUE, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { createAudio } from './audio.js';
import { loadBest, loadSave, writeBest, writeSave } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();
const input = createInput(canvas, (x, y) => renderer.toWorld(x, y));

const save = loadSave();
world.state.save = save;
world.state.best = loadBest();
let lastCash = world.state.player.cash;
let lastMission = 0;

/** The read-only handle the browser tests watch: live state and screen. */
window.__solmar = { state: world.state };
Object.defineProperty(window.__solmar, 'screen', { get: () => world.state.screen });

function announce(message) {
  status.textContent = message;
}

function startGame(fromSave) {
  if (fromSave && save) {
    world.reset();
    world.state.missions.runner.index = Math.min(save.mission, 5);
    world.state.player.cash = save.cash;
  } else {
    world.reset();
  }
  lastCash = world.state.player.cash;
  lastMission = world.state.missions.runner.index;
  world.state.screen = SCREEN_PLAY;
  world.state.camera = null;
  announce('Playing. Mission 1: Cafe Job.');
}

function runShot(name) {
  const scene = stageShot(name, world);
  world.state.screen = scene.screen;
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  function setScreen(next) {
    screen = next;
    world.state.screen = next;
  }

  function endRun(over) {
    if (over === 'busted') {
      audio.busted();
      setScreen(SCREEN_BUSTED);
      announce('Busted. The police took $150.');
    } else if (over === 'wasted') {
      audio.wasted();
      setScreen(SCREEN_WASTED);
      announce('Wasted. The hospital bill was $100.');
    } else if (over === 'complete') {
      audio.mission();
      setScreen(SCREEN_COMPLETE);
      const cash = world.state.player.cash;
      if (cash > world.state.best) {
        world.state.best = cash;
        writeBest(cash);
      }
      try { window.localStorage.removeItem(SAVE_KEY); } catch { /* no storage */ }
      announce(`Story complete. Final cash $${cash}.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONTINUE && screen === SCREEN_TITLE && save) {
      audio.unlock();
      startGame(true);
      setScreen(SCREEN_PLAY);
      return;
    }
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_COMPLETE) {
        startGame(false);
        setScreen(SCREEN_PLAY);
      } else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
        world.respawn();
        setScreen(SCREEN_PLAY);
        announce('Back on the streets.');
      } else if (screen === SCREEN_PAUSED) {
        setScreen(SCREEN_PLAY);
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        setScreen(SCREEN_PAUSED);
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        setScreen(SCREEN_PLAY);
        announce('Playing.');
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The title's backdrop: traffic and pedestrians, no player, no scoring.
      world.step(STEP, {});
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const frameInput = input.read();
    world.step(STEP, frameInput);
    audio.setEngine(world.state.player.speed, Boolean(world.state.player.inCar));
    if (frameInput.shoot && world.state.gun.ammo > 0) audio.shot();
    // A mission just paid out: save the progress and play the jingle.
    if (world.state.player.cash !== lastCash || world.state.missions.runner.index !== lastMission) {
      if (world.state.missions.runner.index !== lastMission) {
        audio.mission();
        writeSave(world.state.missions.runner.index, world.state.player.cash);
        announce(`Mission complete. Cash $${world.state.player.cash}.`);
      }
      lastCash = world.state.player.cash;
      lastMission = world.state.missions.runner.index;
    }
    if (world.state.over) endRun(world.state.over);
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
    renderer.draw(world.state, screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      setScreen(SCREEN_PAUSED);
      announce('Paused.');
    }
  });

  announce('Solmar Bay. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
