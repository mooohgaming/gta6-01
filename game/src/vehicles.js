// Cars: the player's arcade driving, the traffic that fills the roads, and
// the parked cars waiting to be stolen. Traffic follows the road grid:
// each car runs along one road, and at a junction it usually goes straight
// and sometimes turns onto the crossing road.
import { CAR, TRAFFIC, WORLD } from './config.js';
import { CAR_COLORS, resolveBuildingCollision, roadLines } from './city.js';

let nextCarId = 1;

export function makeCar(random, x, y, angle, opts = {}) {
  return {
    id: nextCarId++,
    x, y, angle,
    speed: 0,
    color: opts.color ?? random.pick(CAR_COLORS),
    model: opts.model ?? random.pick(['Sedan', 'Coupe', 'Van', 'Pickup', 'Taxi', 'Sport']),
    health: CAR.maxHealth,
    traffic: opts.traffic ?? false,
    police: opts.police ?? false,
    parked: opts.parked ?? false,
    // Traffic state: which road it runs on, which way, and its lane offset.
    roadVertical: opts.roadVertical ?? true,
    roadPos: opts.roadPos ?? 0,
    roadDir: opts.roadDir ?? 1,
    lane: opts.lane ?? 24,
    cruise: opts.cruise ?? TRAFFIC.speed,
    targetSpeed: opts.cruise ?? TRAFFIC.speed,
    brakeLight: false,
    siren: false,
    smoke: 0,
  };
}

/** Parked cars in the lots and along the kerb, ready to be stolen. */
export function spawnParkedCars(random, city) {
  const cars = [];
  for (const lot of city.lots) {
    const n = Math.min(lot.spots, random.int(2, 4));
    for (let i = 0; i < n; i += 1) {
      const x = lot.x + 20 + i * ((lot.w - 40) / Math.max(1, n - 1 || 1));
      cars.push(makeCar(random, x, lot.y + lot.h / 2, random.chance(0.5) ? 0 : Math.PI, { parked: true }));
    }
  }
  const { verticals, horizontals } = roadLines();
  for (let i = 0; i < 10; i += 1) {
    const vertical = random.chance(0.5);
    if (vertical) {
      const rx = random.pick(verticals);
      cars.push(makeCar(random, rx + 34, random.range(200, 1700), Math.PI / 2, { parked: true }));
    } else {
      const ry = random.pick(horizontals);
      cars.push(makeCar(random, random.range(200, 2300), ry + 34, 0, { parked: true }));
    }
  }
  return cars;
}

/** Traffic cars spread over the roads, already moving. */
export function spawnTraffic(random, count) {
  const cars = [];
  const { verticals, horizontals } = roadLines();
  for (let i = 0; i < count; i += 1) {
    const vertical = random.chance(0.5);
    if (vertical) {
      const rx = random.pick(verticals);
      const dir = random.chance(0.5) ? 1 : -1;
      cars.push(makeCar(random, rx + (dir === 1 ? -24 : 24), random.range(180, 1740), dir === 1 ? Math.PI / 2 : -Math.PI / 2, {
        traffic: true, roadVertical: true, roadPos: rx, roadDir: dir,
        lane: 24, cruise: TRAFFIC.speed * random.range(0.8, 1.1),
      }));
    } else {
      const ry = random.pick(horizontals);
      const dir = random.chance(0.5) ? 1 : -1;
      cars.push(makeCar(random, random.range(180, 2380), ry + (dir === 1 ? -24 : 24), dir === 1 ? 0 : Math.PI, {
        traffic: true, roadVertical: false, roadPos: ry, roadDir: dir,
        lane: 24, cruise: TRAFFIC.speed * random.range(0.8, 1.1),
      }));
    }
  }
  return cars;
}

/** One traffic step: cruise along its road, turn at junctions, brake for the car ahead. */
export function stepTrafficCar(car, dt, cars, random) {
  const { verticals, horizontals } = roadLines();
  // The car ahead on the same road and lane, if it is close.
  let ahead = Infinity;
  for (const other of cars) {
    if (other === car || other.parked) continue;
    if (other.roadVertical !== car.roadVertical || other.roadPos !== car.roadPos) continue;
    const along = car.roadVertical ? (other.y - car.y) * car.roadDir : (other.x - car.x) * car.roadDir;
    if (along > 0 && along < ahead) ahead = along;
  }
  car.targetSpeed = ahead < TRAFFIC.minGap ? 0 : car.cruise;
  car.speed += Math.max(-CAR.brake * dt, Math.min(CAR.accel * 0.6 * dt, car.targetSpeed - car.speed));
  car.brakeLight = car.targetSpeed === 0 && car.speed > 5;
  const move = car.speed * dt;
  if (car.roadVertical) car.y += move * car.roadDir;
  else car.x += move * car.roadDir;

  // At a junction, usually go straight, sometimes turn onto the crossing road.
  const junctions = car.roadVertical ? horizontals : verticals;
  const along = car.roadVertical ? car.y : car.x;
  for (const j of junctions) {
    const before = along - move * car.roadDir;
    if ((before - j) * (along - j) <= 0 && Math.abs(along - j) < 30) {
      if (random.next() < 0.3) {
        const dir = random.chance(0.5) ? 1 : -1;
        if (car.roadVertical) {
          car.roadVertical = false;
          car.roadPos = j;
          car.y = j + (dir === 1 ? -24 : 24);
          car.x = Math.max(180, Math.min(2380, car.x));
          car.angle = dir === 1 ? 0 : Math.PI;
          car.roadDir = dir;
        } else {
          car.roadVertical = true;
          car.roadPos = j;
          car.x = j + (dir === 1 ? -24 : 24);
          car.y = Math.max(180, Math.min(1740, car.y));
          car.angle = dir === 1 ? Math.PI / 2 : -Math.PI / 2;
          car.roadDir = dir;
        }
      } else if (car.roadVertical) {
        car.x = car.roadPos + (car.roadDir === 1 ? -24 : 24);
      } else {
        car.y = car.roadPos + (car.roadDir === 1 ? -24 : 24);
      }
      break;
    }
  }
  // Wrap around the city edge instead of driving off the map.
  if (car.roadVertical && (car.y < 140 || car.y > 1780)) car.y = car.y < 140 ? 1760 : 180;
  if (!car.roadVertical && (car.x < 140 || car.x > 2420)) car.x = car.x < 140 ? 2400 : 180;
}

/**
 * Drive the player's car: throttle, steering that bites with speed, a
 * little drift, and a hard stop against buildings. Returns the distance
 * driven this step (for the speedometer and skid marks).
 */
export function drivePlayerCar(car, input, dt, city) {
  // Steering: left turns the car counter-clockwise on screen (angle
  // decreases in canvas coordinates, where +y points down).
  const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (input.up) car.speed += CAR.accel * dt;
  else if (input.down) car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverseAccel) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  const turn = steer * CAR.steerRate * dt * Math.min(1, Math.abs(car.speed) / 140);
  car.angle += turn * Math.sign(car.speed || 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const oldX = car.x;
  const oldY = car.y;
  car.x = Math.max(60, Math.min(WORLD.width - 60, nx));
  car.y = Math.max(60, Math.min(WORLD.height - 60, ny));
  // Buildings stop the car; a hard hit costs health and leaves smoke.
  const probe = { x: car.x, y: car.y };
  if (resolveBuildingCollision(city, probe, CAR.length / 2)) {
    const hitSpeed = Math.abs(car.speed);
    car.x = oldX;
    car.y = oldY;
    car.speed *= -0.25;
    if (hitSpeed > CAR.damageSpeed) {
      car.health = Math.max(0, car.health - (hitSpeed - CAR.damageSpeed) / 12);
      car.smoke = 1;
    }
  }
  car.brakeLight = !!input.down && car.speed > 5;
  return Math.hypot(car.x - oldX, car.y - oldY);
}

/** Push two overlapping cars apart, softly, so traffic does not stack up. */
export function separateCars(cars) {
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      if (a.parked && b.parked) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = CAR.length * 0.8;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        if (!a.parked) { a.x -= nx * push; a.y -= ny * push; }
        if (!b.parked) { b.x += nx * push; b.y += ny * push; }
      }
    }
  }
}
