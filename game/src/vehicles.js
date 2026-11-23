// The cars of Solmar Bay: 26 traffic cars driving the road grid, 11 parked cars
// (one of them the red Comet GT), and the arcade physics of the car the player
// drives. Traffic stays on road centres and turns only at intersections, so it
// never needs a building to get out of its way.
import {
  CAR,
  HORIZONTAL_ROADS,
  TRAFFIC_COUNT,
  TRAFFIC_SPEED,
  VERTICAL_ROADS,
  WORLD,
} from './config.js';
import { nearestRoadX, nearestRoadY, pointInBuilding, resolveSolid } from './city.js';
import { intBetween, pick } from './random.js';

const TRAFFIC_KINDS = ['sedan', 'sedan', 'sedan', 'taxi', 'van', 'sedan', 'taxi', 'sedan'];

function makeCar(random, x, y, angle, kind) {
  return {
    x, y, angle,
    speed: TRAFFIC_SPEED.min + random() * (TRAFFIC_SPEED.max - TRAFFIC_SPEED.min),
    kind,
    color: kind === 'taxi' ? 'taxi' : kind === 'comet' ? 'comet' : 'traffic',
    driven: false,
    lastTurn: '',
  };
}

/** Candidate parking spots along road edges, clear of buildings and mission points. */
function parkingSpots(city, random) {
  const spots = [{ x: 2240, y: 1330, angle: -Math.PI / 2, kind: 'comet' }];
  const tries = 200;
  for (let t = 0; t < tries && spots.length < 11; t += 1) {
    const vertical = random() < 0.5;
    let x;
    let y;
    let angle;
    if (vertical) {
      const road = pick(random, VERTICAL_ROADS);
      x = road + (random() < 0.5 ? 40 : -40);
      y = 120 + random() * (WORLD.height - 240);
      angle = random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const road = pick(random, HORIZONTAL_ROADS);
      y = road + (random() < 0.5 ? 40 : -40);
      x = 120 + random() * (WORLD.width - 240);
      angle = random() < 0.5 ? 0 : Math.PI;
    }
    if (pointInBuilding(city, x, y)) continue;
    if (spots.some((spot) => Math.hypot(spot.x - x, spot.y - y) < 160)) continue;
    spots.push({ x, y, angle, kind: 'sedan' });
  }
  return spots;
}

export function createVehicles(random, city) {
  const traffic = [];
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    const vertical = random() < 0.5;
    let x;
    let y;
    let angle;
    if (vertical) {
      x = pick(random, VERTICAL_ROADS);
      y = 100 + random() * (WORLD.height - 200);
      angle = random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      y = pick(random, HORIZONTAL_ROADS);
      x = 100 + random() * (WORLD.width - 200);
      angle = random() < 0.5 ? 0 : Math.PI;
    }
    traffic.push(makeCar(random, x, y, angle, pick(random, TRAFFIC_KINDS)));
  }
  const parked = parkingSpots(city, random).map((spot) => ({
    x: spot.x, y: spot.y, angle: spot.angle, speed: 0, kind: spot.kind,
    color: spot.kind === 'comet' ? 'comet' : 'traffic', driven: false, lastTurn: '',
  }));
  return { traffic, parked };
}

/** Keep a traffic car on its road: it only turns at an intersection, and turns around at the edge. */
function steerTraffic(car, random, dt) {
  const step = car.speed * dt;
  const alongX = Math.abs(Math.cos(car.angle)) > 0.7;
  if (alongX) {
    car.x += Math.cos(car.angle) * step;
    const road = nearestRoadX(car.x);
    if (Math.abs(car.x - road) < 26) {
      const key = `${road}:${Math.round(car.y)}`;
      if (car.lastTurn !== key) {
        car.lastTurn = key;
        const roll = random();
        if (roll < 0.18) car.angle = -Math.PI / 2;
        else if (roll < 0.36) car.angle = Math.PI / 2;
      }
    }
    if (car.x < 60) { car.x = 60; car.angle = 0; }
    if (car.x > WORLD.width - 60) { car.x = WORLD.width - 60; car.angle = Math.PI; }
  } else {
    car.y += Math.sin(car.angle) * step;
    const road = nearestRoadY(car.y);
    if (Math.abs(car.y - road) < 26) {
      const key = `${Math.round(car.x)}:${road}`;
      if (car.lastTurn !== key) {
        car.lastTurn = key;
        const roll = random();
        if (roll < 0.18) car.angle = 0;
        else if (roll < 0.36) car.angle = Math.PI;
      }
    }
    if (car.y < 60) { car.y = 60; car.angle = Math.PI / 2; }
    if (car.y > WORLD.height - 60) { car.y = WORLD.height - 60; car.angle = -Math.PI / 2; }
  }
}

export function updateTraffic(state, dt, city, random) {
  for (const car of state.traffic) {
    if (car.driven) continue;
    steerTraffic(car, random, dt);
  }
  // Simple separation so traffic does not pile up: the shove is sideways to the
  // first car's heading, so two cars meeting head-on slide past each other
  // instead of grinding nose to nose forever.
  const all = [...state.traffic, ...state.parked];
  for (let i = 0; i < all.length; i += 1) {
    for (let j = i + 1; j < all.length; j += 1) {
      const a = all[i];
      const b = all[j];
      if (a.driven || b.driven) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.01 && dist < 36) {
        const px = -Math.sin(a.angle);
        const py = Math.cos(a.angle);
        const side = dx * px + dy * py >= 0 ? 1 : -1;
        const push = 36 - dist;
        b.x += px * side * push;
        b.y += py * side * push;
      }
    }
  }
}

/**
 * Arcade car physics for the car the player drives. Returns true when the car
 * hit a wall this step. Steering scales with speed so the car cannot spin in
 * place, and a wall hit scrubs speed instead of stopping the car dead.
 */
export function stepPlayerCar(car, input, dt, city) {
  if (input.up) car.speed += CAR.accel * dt;
  if (input.down) car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverseAccel) * dt;
  if (input.handbrake) {
    car.speed -= Math.sign(car.speed) * CAR.handbrakeDecel * dt;
    if (Math.abs(car.speed) < 12) car.speed = 0;
  }
  car.speed -= car.speed * CAR.drag * dt;
  if (car.speed > CAR.maxSpeed) car.speed = CAR.maxSpeed;
  if (car.speed < -CAR.maxReverse) car.speed = -CAR.maxReverse;
  const grip = Math.min(1, Math.abs(car.speed) / 150);
  const turn = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  car.angle += turn * CAR.turnRate * grip * dt * (car.speed < 0 ? -1 : 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const hit = resolveSolid(city, car, CAR.radius);
  if (hit && Math.abs(car.speed) > 60) car.speed *= 0.6;
  return hit;
}

/**
 * The nearest car the player could get into, within 60 units, or null. A parked
 * car wins over a moving one: on foot you grab what is standing still, and it
 * keeps the Comet theft deterministic when traffic is passing the same spot.
 */
export function nearestCar(state, x, y) {
  const closest = (list) => {
    let best = null;
    let bestDist = 60;
    for (const car of list) {
      if (car.driven) continue;
      const dist = Math.hypot(car.x - x, car.y - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = car;
      }
    }
    return best;
  };
  return closest(state.parked) ?? closest(state.traffic);
}

export function carCount(state) {
  return state.traffic.length + state.parked.length;
}
