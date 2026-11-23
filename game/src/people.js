// The people of Solmar Bay: pedestrians walking the sidewalks, foot cops who
// chase the player on foot, and the Vultures who hold the mall in mission five.
// Pedestrians stay on the sidewalk strips beside the roads; cops and Vultures
// steer straight at the player and slide along walls.
import { HORIZONTAL_ROADS, PEOPLE_COUNT, VERTICAL_ROADS, WORLD } from './config.js';
import { nearestRoadX, nearestRoadY, resolveSolid } from './city.js';
import { pick } from './random.js';

function makePedestrian(random) {
  const vertical = random() < 0.5;
  if (vertical) {
    const road = pick(random, VERTICAL_ROADS);
    return {
      x: road + (random() < 0.5 ? 44 : -44),
      y: 100 + random() * (WORLD.height - 200),
      angle: random() < 0.5 ? Math.PI / 2 : -Math.PI / 2,
      speed: 34 + random() * 26,
      kind: 'ped',
      health: 1,
      color: 'ped',
    };
  }
  const road = pick(random, HORIZONTAL_ROADS);
  return {
    x: 100 + random() * (WORLD.width - 200),
    y: road + (random() < 0.5 ? 44 : -44),
    angle: random() < 0.5 ? 0 : Math.PI,
    speed: 34 + random() * 26,
    kind: 'ped',
    health: 1,
    color: 'ped',
  };
}

export function createPeople(random) {
  const people = [];
  for (let i = 0; i < PEOPLE_COUNT; i += 1) people.push(makePedestrian(random));
  return people;
}

/** A pedestrian walks its sidewalk; at an intersection it sometimes turns. */
function stepPedestrian(person, random, dt, city) {
  const step = person.speed * dt;
  const alongX = Math.abs(Math.cos(person.angle)) > 0.7;
  if (alongX) {
    person.x += Math.cos(person.angle) * step;
    const road = nearestRoadX(person.x);
    if (Math.abs(person.x - road) < 24 && random() < 0.02) {
      person.angle = random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      person.y = nearestRoadY(person.y) + (random() < 0.5 ? 44 : -44);
    }
    if (person.x < 60) { person.x = 60; person.angle = 0; }
    if (person.x > WORLD.width - 60) { person.x = WORLD.width - 60; person.angle = Math.PI; }
  } else {
    person.y += Math.sin(person.angle) * step;
    const road = nearestRoadY(person.y);
    if (Math.abs(person.y - road) < 24 && random() < 0.02) {
      person.angle = random() < 0.5 ? 0 : Math.PI;
      person.x = nearestRoadX(person.x) + (random() < 0.5 ? 44 : -44);
    }
    if (person.y < 60) { person.y = 60; person.angle = Math.PI / 2; }
    if (person.y > WORLD.height - 60) { person.y = WORLD.height - 60; person.angle = -Math.PI / 2; }
  }
  resolveSolid(city, person, 8);
}

function stepChaser(person, target, speed, dt, city) {
  const dx = target.x - person.x;
  const dy = target.y - person.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return;
  person.angle = Math.atan2(dy, dx);
  person.x += (dx / dist) * speed * dt;
  person.y += (dy / dist) * speed * dt;
  resolveSolid(city, person, 10);
}

export function updatePeople(state, dt, city, random) {
  // Foot cops live in state.cops and are driven by the world step, not here.
  for (const person of state.people) {
    if (person.kind === 'ped') {
      dodgeCars(person, state, dt);
      stepPedestrian(person, random, dt, city);
    } else if (person.kind === 'vulture') {
      // A Vulture defends its turf: it chases the player only while it is
      // still close to where it spawned. Past the leash it walks back home,
      // so a running fight cannot drag the gang across the map.
      const fromHome = Math.hypot(person.x - person.homeX, person.y - person.homeY);
      if (fromHome > 400) stepChaser(person, { x: person.homeX, y: person.homeY }, 120, dt, city);
      else stepChaser(person, state.player, 120, dt, city);
    }
  }
}

/**
 * A pedestrian steps out of a car's path: when a car is bearing down on them
 * from ahead, they move sideways off its line at a run. It keeps a fast drive
 * along the roads from turning the sidewalks into a crime scene, while a driver
 * who aims straight at someone can still catch them.
 */
function dodgeCars(person, state, dt) {
  const cars = [];
  if (state.player.inCar) cars.push(state.player.inCar);
  for (const car of state.traffic) cars.push(car);
  for (const car of cars) {
    const dx = person.x - car.x;
    const dy = person.y - car.y;
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    if (ahead < 0 || ahead > 160) continue;
    const side = dx * -Math.sin(car.angle) + dy * Math.cos(car.angle);
    if (Math.abs(side) > 34) continue;
    const s = side >= 0 ? 1 : -1;
    person.x += -Math.sin(car.angle) * s * 220 * dt;
    person.y += Math.cos(car.angle) * s * 220 * dt;
    return;
  }
}

/** Spawn a foot cop on a road near the player. */
export function spawnCop(state, random) {
  const player = state.player;
  const roadX = nearestRoadX(player.x + (random() < 0.5 ? -260 : 260));
  const roadY = nearestRoadY(player.y + (random() < 0.5 ? -260 : 260));
  const onVertical = random() < 0.5;
  state.cops.push({
    x: onVertical ? roadX : player.x + (random() < 0.5 ? -260 : 260),
    y: onVertical ? player.y + (random() < 0.5 ? -260 : 260) : roadY,
    angle: 0, speed: 180, kind: 'cop', health: 3, color: 'cop', contact: 0, giveUp: 0,
  });
}

export function spawnVultures(state, random) {
  // On the open ground south of the mall, never inside its walls: a Vulture
  // inside the building could not be shot, and could not get out. Each one
  // remembers where it spawned: the gang defends its turf and walks home
  // once it has strayed too far, so a running fight cannot drag the whole
  // gang across the map and strand the player at the far edge.
  for (let i = 0; i < 8; i += 1) {
    const x = 1420 + random() * 360;
    const y = 1160 + random() * 50;
    state.people.push({
      x, y, homeX: x, homeY: y,
      angle: random() * Math.PI * 2, speed: 120, kind: 'vulture', health: 3, color: 'vulture',
      shootCooldown: 0.5 + random(),
    });
  }
}
