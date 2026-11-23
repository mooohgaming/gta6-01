// The screenshot scenes behind ?shot=downtown|chase|beach|cafe. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, so the frame
// is what a short game really looks like and the same seed always gives the same
// frame. The driving scenes use a simple autopilot: steer at the next waypoint
// and slow to town speed within 220 units of it, so the car corners cleanly
// instead of swinging wide off the road.
import { STEP } from './config.js';

const EMPTY = { up: false, down: false, left: false, right: false, handbrake: false, enter: false, shoot: false, reload: false, aimX: 0, aimY: 0, aimActive: false };

const DOWNTOWN_LOOP = [
  { x: 1400, y: 1200 }, { x: 1400, y: 520 }, { x: 600, y: 520 }, { x: 600, y: 1200 },
  { x: 1000, y: 1200 }, { x: 1000, y: 860 }, { x: 1800, y: 860 }, { x: 1800, y: 1540 },
  { x: 1000, y: 1540 }, { x: 1000, y: 1200 },
];

function autopilotInput(world, waypoint) {
  const player = world.state.player;
  const dx = waypoint.x - player.x;
  const dy = waypoint.y - player.y;
  const dist = Math.hypot(dx, dy);
  const want = Math.atan2(dy, dx);
  let diff = want - player.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const desired = dist < 220 ? 110 : 560;
  const speed = Math.abs(player.speed);
  return {
    up: speed < desired && (Math.abs(diff) < 0.9 || speed < 100),
    down: speed > desired + 40 || (Math.abs(diff) > 1.2 && speed > 200),
    left: diff < -0.08,
    right: diff > 0.08,
    handbrake: false, enter: false, shoot: false, reload: false, aimX: 0, aimY: 0, aimActive: false,
  };
}

/** Put the player in the parked car nearest to a point. */
function takeNearestCar(world, x, y) {
  const state = world.state;
  let best = null;
  let bestDist = Infinity;
  for (const car of state.parked) {
    const dist = Math.hypot(car.x - x, car.y - y);
    if (dist < bestDist) {
      bestDist = dist;
      best = car;
    }
  }
  if (!best) return;
  best.driven = true;
  state.player.inCar = best;
  state.player.onFoot = false;
  state.player.x = best.x;
  state.player.y = best.y;
  state.player.angle = best.angle;
  state.player.speed = 0;
}

function driveLoop(world, waypoints, seconds) {
  let leg = 0;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (world.state.over) return;
    const player = world.state.player;
    const target = waypoints[leg];
    if (Math.hypot(target.x - player.x, target.y - player.y) < 60) {
      leg = (leg + 1) % waypoints.length;
      continue;
    }
    world.step(STEP, autopilotInput(world, waypoints[leg]));
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Any name other than the four is downtown.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'chase') {
    takeNearestCar(world, 1400, 1200);
    world.crime(3);
    driveLoop(world, DOWNTOWN_LOOP, 12);
    return { screen: 'play' };
  }
  if (name === 'beach') {
    const car = world.state.parked[0];
    car.x = 1350;
    car.y = 2010;
    car.angle = 0;
    world.state.player.x = 1280;
    world.state.player.y = 2010;
    world.state.player.angle = Math.PI / 2;
    for (let i = 0; i < 3 / STEP; i += 1) world.step(STEP, EMPTY);
    return { screen: 'play' };
  }
  if (name === 'cafe') {
    const car = world.state.parked[0];
    car.x = 1260;
    car.y = 1140;
    car.angle = 0;
    world.state.player.x = 1160;
    world.state.player.y = 1150;
    world.state.player.angle = -Math.PI / 2;
    for (let i = 0; i < 3 / STEP; i += 1) world.step(STEP, EMPTY);
    return { screen: 'play' };
  }
  takeNearestCar(world, 1400, 1200);
  driveLoop(world, DOWNTOWN_LOOP, 25);
  return { screen: 'play' };
}
