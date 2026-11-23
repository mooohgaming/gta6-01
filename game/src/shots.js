// The screenshot scenes behind ?shot=downtown|chase|beach|cafe. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a simple waypoint autopilot, so the frame is what a short game
// really looks like and the same seed always gives the same frame. The camera
// is fixed per scene, so the framing is repeatable too.

import { LANDMARKS, STEP } from './config.js';
import { autopilotDrive } from './vehicles.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const SCENES = {
  downtown: { seconds: 6, screen: SCREEN_TITLE, camera: { x: 700, y: 700 } },
  chase: { seconds: 9, screen: SCREEN_PLAY, camera: null },
  beach: { seconds: 7, screen: SCREEN_PLAY, camera: null },
  cafe: { seconds: 4, screen: SCREEN_PLAY, camera: { x: 1160, y: 1080 } },
};

/** Drive a car through waypoints in order, looping, like the test driver. */
function driveRoute(world, waypoints, seconds) {
  let leg = 0;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const car = world.state.player.inCar;
    if (!car) break;
    const target = waypoints[leg];
    if (Math.hypot(target.x - car.x, target.y - car.y) < 90) leg = (leg + 1) % waypoints.length;
    autopilotDrive(car, waypoints[leg].x, waypoints[leg].y, STEP, world.state.city);
    world.step(STEP, {});
    if (world.state.over) break;
  }
}

function putInCar(world, x, y) {
  const player = world.state.player;
  const car = world.state.parked.find((c) => !c.taken && Math.hypot(c.x - x, c.y - y) < 400)
    ?? world.state.parked.find((c) => !c.taken);
  if (!car) return false;
  player.x = car.x;
  player.y = car.y;
  car.taken = true;
  player.inCar = car;
  player.onFoot = false;
  player.angle = car.angle;
  player.speed = 0;
  player.radius = 21;
  return true;
}

/**
 * Set `world` to the named scene (downtown, chase, beach or cafe; any other
 * name is downtown) and return the screen to draw over it.
 */
export function stageShot(name, world) {
  const scene = SCENES[name] ?? SCENES.downtown;
  world.reset();
  if (name === 'downtown') {
    // A living city behind the title: traffic rolling, pedestrians out.
    for (let i = 0; i < scene.seconds / STEP; i += 1) world.step(STEP, {});
    world.state.camera = scene.camera;
    return { screen: scene.screen };
  }
  if (name === 'chase') {
    // Three stars, Interceptors on the tail, cutting through downtown.
    putInCar(world, 600, 520);
    world.crime(3);
    driveRoute(world, [
      { x: 200, y: 180 }, { x: 2200, y: 180 }, { x: 2200, y: 860 },
      { x: 600, y: 860 }, { x: 600, y: 520 }, { x: 1400, y: 520 },
    ], scene.seconds);
    world.state.camera = { x: world.state.player.x, y: world.state.player.y };
    return { screen: scene.screen };
  }
  if (name === 'beach') {
    // A cruise down the beach road toward the marina towers.
    putInCar(world, 2200, 180);
    driveRoute(world, [
      { x: 2200, y: 1880 }, { x: 2200, y: 1000 }, { x: 1800, y: 1000 },
    ], scene.seconds);
    world.state.camera = { x: world.state.player.x, y: world.state.player.y };
    return { screen: scene.screen };
  }
  // cafe: on foot outside Mama Rosa's, the safehouse of the story.
  world.state.player.x = LANDMARKS.cafe.x;
  world.state.player.y = LANDMARKS.cafe.y + 60;
  for (let i = 0; i < scene.seconds / STEP; i += 1) world.step(STEP, {});
  world.state.camera = scene.camera;
  return { screen: scene.screen };
}
