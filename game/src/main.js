// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between six screens: title, play, paused,
// busted, wasted and story complete.
//
// ?seed=N fixes the city. ?shot=downtown|chase|beach|cafe (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createWorld } from './world.js';
import {
  SCREEN_BUSTED,
  SCREEN_COMPLETE,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WASTED,
  createRenderer,
} from './render.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_NEWGAME, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { clearSave, loadSave, writeSave } from './save.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
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
const input = createInput(canvas, (clientX, clientY) => {
  const camera = renderer.camera();
  const ratio = window.devicePixelRatio || 1;
  return {
    x: camera.x - 640 + (clientX * ratio - camera.ox) / camera.scale,
    y: camera.y - 360 + (clientY * ratio - camera.oy) / camera.scale,
  };
});

let screen = SCREEN_TITLE;
let lastMission = 0;
let sirenTimer = 0;
let savedGame = loadSave();

// A read-only handle on the live game, for tests and for the curious.
Object.defineProperty(window, '__solmar', {
  value: {
    get state() {
      return world.state;
    },
    get screen() {
      return screen;
    },
  },
});

// Screen readers (and anyone watching the page's text) hear the screen changes.
function announce(message) {
  status.textContent = message;
}

function setScreen(next) {
  screen = next;
  world.state.screen = next;
  if (next === SCREEN_TITLE) {
    announce(savedGame
      ? 'Solmar Bay. Press Space to continue your game, or N for a new game.'
      : 'Solmar Bay. Press Space or click to start.');
  } else if (next === SCREEN_PLAY) announce('Playing Solmar Bay.');
  else if (next === SCREEN_PAUSED) announce('Paused.');
  else if (next === SCREEN_BUSTED) announce('Busted. Press Space to get back out there.');
  else if (next === SCREEN_WASTED) announce('Wasted. Press Space to get back out there.');
  else if (next === SCREEN_COMPLETE) announce('Story complete. Press Space to play again.');
}

function emptyInput() {
  return {
    up: false, down: false, left: false, right: false, handbrake: false,
    enter: false, shoot: false, reload: false, aimX: 0, aimY: 0, aimActive: false,
  };
}

function startGame() {
  if (savedGame) {
    world.continueGame(savedGame);
    savedGame = null;
  } else {
    world.reset();
  }
  lastMission = world.state.missions.runner.index;
  setScreen(SCREEN_PLAY);
}

function runShot(name) {
  const scene = stageShot(name, world);
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
  let accumulator = 0;
  let last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    const frameDt = Math.min((now - last) / 1000, MAX_FRAME);
    accumulator += frameDt;
    last = now;
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) audio.toggleMute();

    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        startGame();
      } else if (actions & ACTION_NEWGAME) {
        audio.unlock();
        clearSave();
        savedGame = null;
        startGame();
      }
      // The city idles behind the title.
      world.step(STEP, emptyInput());
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        setScreen(SCREEN_PAUSED);
      } else {
        while (accumulator >= STEP) {
          world.step(STEP, input.state());
          accumulator -= STEP;
          if (world.state.over === 'busted') {
            setScreen(SCREEN_BUSTED);
            audio.busted();
            break;
          }
          if (world.state.over === 'wasted') {
            setScreen(SCREEN_WASTED);
            audio.busted();
            break;
          }
          if (world.state.over === 'complete') {
            setScreen(SCREEN_COMPLETE);
            audio.mission();
            clearSave();
            savedGame = null;
            break;
          }
        }
        if (world.state.missions.runner.index !== lastMission) {
          lastMission = world.state.missions.runner.index;
          writeSave(world.state);
          audio.mission();
        }
        audio.setEngine(world.state.player.inCar ? Math.abs(world.state.player.speed) / 560 : 0);
        if (world.state.player.wanted > 0) {
          sirenTimer -= frameDt;
          if (sirenTimer <= 0) {
            audio.sirenTick();
            sirenTimer = 1.2;
          }
        }
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) setScreen(SCREEN_PLAY);
    } else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        world.respawn();
        setScreen(SCREEN_PLAY);
      }
    } else if (screen === SCREEN_COMPLETE) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        world.reset();
        lastMission = 0;
        setScreen(SCREEN_TITLE);
      }
    }
    renderer.draw(world.state, screen);
  }

  setScreen(SCREEN_TITLE);
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
