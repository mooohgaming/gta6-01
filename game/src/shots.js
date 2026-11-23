// The screenshot scenes behind ?shot=start|downtown|chase|beach|cafe.
// Each one plays the real rules forward from a fresh world for a fixed
// number of steps — a short drive, a chase, a walk on the beach — so the
// frame is what the game really looks like and the same seed always gives
// the same frame. No scene is staged by hand-drawing pixels.
import { STEP } from './config.js';
import { stepWorld } from './world.js';
import { makeCar } from './vehicles.js';
import { addWanted, makeGangMember, spawnChaseCar } from './people.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const DOWNTOWN_SECONDS = 2;
const CHASE_SECONDS = 2;
const BEACH_SECONDS = 3;
const CAFE_SECONDS = 3;
const SAMPLE = STEP;
/** The viewport the screenshots are taken at: the camera clamp uses it. */
const SHOT_VIEW_W = 1280;
const SHOT_VIEW_H = 720;
const SHOT_ZOOM = Math.max(SHOT_VIEW_W / 1100, SHOT_VIEW_H / 760);

function setShotView(state) {
  state.viewW = SHOT_VIEW_W;
  state.viewH = SHOT_VIEW_H;
  state.zoom = SHOT_ZOOM;
}

function casinoCentre(state) {
  const b = state.city.buildings.find((x) => x.kind === 'casino');
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

function cafeCentre(state) {
  const b = state.city.buildings.find((x) => x.kind === 'cafe');
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/** Drive along `roadY` at heading `targetAngle`, steering gently back onto the line. */
function driveAutopilot(state, roadY, targetAngle) {
  const p = state.player;
  const car = p.car;
  if (!car) return { up: false, down: false, left: false, right: false, run: false, shoot: false };
  const desired = targetAngle + Math.max(-0.4, Math.min(0.4, (roadY - car.y) * 0.003));
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return {
    up: true, down: false, run: false, shoot: false,
    left: diff < -0.05,
    right: diff > 0.05,
  };
}

function idleInput() {
  return { up: false, down: false, left: false, right: false, run: false, shoot: false };
}

/** Put Rico in a red Comet GT on the road south of the Golden Palm, driving up to the casino doors with the law behind him. */
function stageDowntown(state) {
  setShotView(state);
  const p = state.player;
  const casino = casinoCentre(state);
  const car = makeCar(state.random, 1150, 1120, 0, { color: '#c23b2e', model: 'Comet GT', parked: false });
  state.cars.push(car);
  p.car = car;
  p.onFoot = false;
  p.x = car.x;
  p.y = car.y;
  p.angle = 0;
  addWanted(state, 2, 'casino chase');
  spawnChaseCar(state.random, state);
  spawnChaseCar(state.random, state);
  for (let i = 0; i < 3; i += 1) {
    state.gang.push(makeGangMember(state.random, casino.x + state.random.range(-140, 140), 1060 + state.random.range(-20, 20)));
  }
  for (let i = 0; i < DOWNTOWN_SECONDS / SAMPLE; i += 1) {
    stepWorld(state, SAMPLE, driveAutopilot(state, 1120, 0));
  }
}

/** A three-star chase along the beachfront road, heading west into town. */
function stageChase(state) {
  setShotView(state);
  const p = state.player;
  const car = makeCar(state.random, 2100, 1760, Math.PI, { color: '#c23b2e', model: 'Comet GT', parked: false });
  car.speed = 380;
  state.cars.push(car);
  p.car = car;
  p.onFoot = false;
  p.x = car.x;
  p.y = car.y;
  p.angle = Math.PI;
  addWanted(state, 3, 'beachfront chase');
  spawnChaseCar(state.random, state);
  spawnChaseCar(state.random, state);
  spawnChaseCar(state.random, state);
  // The pursuit is right on Rico's tail: three Interceptors fanned out behind him.
  state.chaseCars.forEach((c, i) => {
    c.x = p.x + 350;
    c.y = 1760 + (i - 1) * 40;
    c.angle = Math.PI;
    c.speed = 480;
  });
  for (let i = 0; i < CHASE_SECONDS / SAMPLE; i += 1) {
    stepWorld(state, SAMPLE, driveAutopilot(state, 1760, Math.PI));
  }
}

/** Rico on foot on the beach at sunset. */
function stageBeach(state) {
  setShotView(state);
  const p = state.player;
  p.x = 1200;
  p.y = 1800;
  p.angle = -Math.PI / 2;
  state.camera.x = 1200;
  state.camera.y = 1800;
  for (let i = 0; i < BEACH_SECONDS / SAMPLE; i += 1) {
    stepWorld(state, SAMPLE, idleInput());
  }
}

/** Rico on foot outside Mama Rosa's cafe, the Vultures closing in. */
function stageCafe(state) {
  setShotView(state);
  const p = state.player;
  const cafe = cafeCentre(state);
  p.x = cafe.x;
  p.y = cafe.y + 90;
  p.angle = -Math.PI / 2;
  state.camera.x = p.x;
  state.camera.y = p.y;
  state.missions.startMission(4);
  for (let i = 0; i < CAFE_SECONDS / SAMPLE; i += 1) {
    stepWorld(state, SAMPLE, idleInput());
  }
}

/**
 * Set `state` to the named scene (downtown, chase, beach, cafe, or start)
 * and return the screen to draw over it and the best take to show.
 */
export function stageShot(name, state) {
  if (name === 'downtown') {
    stageDowntown(state);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'chase') {
    stageChase(state);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'beach') {
    stageBeach(state);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'cafe') {
    stageCafe(state);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  for (let i = 0; i < START_SECONDS / SAMPLE; i += 1) {
    stepWorld(state, SAMPLE, idleInput());
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
