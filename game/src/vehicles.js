// Cars: the 26 traffic cars that keep the roads alive, the 11 parked cars
// (one of them the red Comet GT the third mission steals), and the player's
// own driving physics — acceleration, steering that scales with speed, a
// handbrake, and a speed controller the autopilot uses to slow for corners.

import { COMET_SPOT, HORIZONTAL, PLAYER, ROAD_HALF, VERTICAL } from './config.js';

const CAR_COLORS = ['#c8ccd4', '#8fa3b8', '#b8a58f', '#7fa38f', '#a38f9a', '#d8d2c0', '#6b7a90'];
const TRAFFIC_KINDS = ['sedan', 'hatch', 'taxi', 'van', 'pickup'];

function lanePoint(random, axis) {
  // A point on a road: a random road line, a random spot along it, and a lane
  // offset so cars keep to one side of the road.
  if (axis === 'v') {
    const x = VERTICAL[Math.floor(random() * VERTICAL.length)] + (random() < 0.5 ? -14 : 14);
    return { x, y: 40 + random() * 2000, angle: random() < 0.5 ? Math.PI / 2 : -Math.PI / 2 };
  }
  const y = HORIZONTAL[Math.floor(random() * HORIZONTAL.length)] + (random() < 0.5 ? -14 : 14);
  return { x: 40 + random() * 2480, y, angle: random() < 0.5 ? 0 : Math.PI };
}

export function createTraffic(random) {
  const cars = [];
  for (let i = 0; i < 26; i += 1) {
    const axis = random() < 0.5 ? 'v' : 'h';
    const p = lanePoint(random, axis);
    cars.push({
      kind: TRAFFIC_KINDS[Math.floor(random() * TRAFFIC_KINDS.length)],
      x: p.x, y: p.y, angle: p.angle,
      speed: 150 + random() * 110, radius: 20, color: CAR_COLORS[Math.floor(random() * CAR_COLORS.length)],
      axis, road: axis === 'v' ? Math.round(p.x / 10) * 10 : Math.round(p.y / 10) * 10,
    });
  }
  return cars;
}

export function createParked(random) {
  const cars = [];
  // The Comet GT, parked on the road where the third mission finds it.
  cars.push({ kind: 'comet', x: COMET_SPOT.x, y: COMET_SPOT.y, angle: Math.PI / 2, speed: 0, radius: 20, color: '#d21f3c', taken: false });
  const spots = [];
  for (let i = 0; i < 10; i += 1) {
    const axis = random() < 0.5 ? 'v' : 'h';
    let x; let y; let angle;
    if (axis === 'v') {
      x = VERTICAL[Math.floor(random() * VERTICAL.length)] + (random() < 0.5 ? -ROAD_HALF + 14 : ROAD_HALF - 14);
      y = 120 + random() * 1840;
      angle = random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      y = HORIZONTAL[Math.floor(random() * HORIZONTAL.length)] + (random() < 0.5 ? -ROAD_HALF + 14 : ROAD_HALF - 14);
      x = 120 + random() * 2320;
      angle = random() < 0.5 ? 0 : Math.PI;
    }
    if (Math.hypot(x - COMET_SPOT.x, y - COMET_SPOT.y) < 120) continue;
    spots.push({ kind: 'sedan', x, y, angle, speed: 0, radius: 20, color: CAR_COLORS[Math.floor(random() * CAR_COLORS.length)], taken: false });
  }
  return cars.concat(spots);
}

/** Traffic keeps its lane and speed, wrapping around the city edge. */
export function updateTraffic(cars, dt) {
  for (const car of cars) {
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (car.x < -60) car.x = 2620;
    if (car.x > 2620) car.x = -60;
    if (car.y < -60) car.y = 2140;
    if (car.y > 2140) car.y = -60;
  }
}

/**
 * The player's car: accelerate, brake and reverse, steer more at low speed
 * and less at high speed, handbrake to stop fast. Walls stop the car; other
 * cars only slow it, so traffic never traps the player.
 */
export function driveCar(car, input, dt, city) {
  if (input.up) car.speed += PLAYER.accel * dt;
  if (input.down) car.speed -= (car.speed > 20 ? PLAYER.brake : PLAYER.accel * 0.55) * dt;
  if (input.handbrake) car.speed -= Math.sign(car.speed) * PLAYER.handbrake * dt;
  car.speed -= car.speed * 0.35 * dt;
  if (Math.abs(car.speed) < 4 && !input.up && !input.down) car.speed = 0;
  car.speed = Math.max(-PLAYER.reverseMax, Math.min(PLAYER.topSpeed, car.speed));
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  if (steer !== 0 && Math.abs(car.speed) > 5) {
    const grip = Math.max(0.35, 1 - Math.abs(car.speed) / PLAYER.topSpeed * 0.65);
    car.angle += steer * PLAYER.steer * grip * dt * Math.sign(car.speed);
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // A wall only pushes the car out of the wall (resolveSolid, along the axis
  // of least penetration); it never eats the car's speed, so the along-wall
  // part of the motion carries the car around the building instead of the car
  // grinding to a stop against it.
  city.resolveSolid(car);
  return car;
}

/**
 * The autopilot's speed controller: full speed on a straight, town speed
 * (~110) within 220 px of a waypoint, so a fast car turning swings wide.
 */
export function autopilotDrive(car, tx, ty, dt, city) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const distance = Math.hypot(tx - car.x, ty - car.y);
  const desired = distance < 220 ? 110 : 560;
  const speed = Math.abs(car.speed);
  const input = { up: false, down: false, left: false, right: false, handbrake: false };
  input.up = speed < desired && (Math.abs(diff) < 0.9 || speed < 100);
  input.down = speed > desired + 40 || (Math.abs(diff) > 1.2 && speed > 200);
  input.left = diff < -0.08;
  input.right = diff > 0.08;
  return driveCar(car, input, dt, city);
}
