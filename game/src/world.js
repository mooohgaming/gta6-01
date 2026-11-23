// Solmar Bay's world: the one state, and the one step that moves it.
// Player on foot or in a car, traffic, pedestrians, police, the wanted
// level, bullets, pickups, missions, and the camera — everything the
// renderer draws comes from here, and nothing else mutates it.
import { CAR, MISSIONS, PLAYER, STEP, WANTED, WORLD } from './config.js';
import { createCityLayer, generateCity, isOnRoad, resolveBuildingCollision } from './city.js';
import { createRandom } from './random.js';
import { drivePlayerCar, makeCar, separateCars, spawnParkedCars, spawnTraffic, stepTrafficCar } from './vehicles.js';
import {
  addWanted, decayWanted, makeFootCop, makePedestrian, spawnChaseCar, spawnPedestrians,
  stepChaseCar, stepFootCop, stepGangMember, stepPedestrian, wantedChaseCount,
} from './people.js';
import { collectPickups, fireBullet, punch, spawnPickup, stepBullets } from './combat.js';
import { createMissionManager } from './missions.js';

export const EVENT_NONE = 0;

function witnessesNear(state, x, y) {
  for (const ped of state.peds) {
    if (!ped.dead && Math.hypot(ped.x - x, ped.y - y) < WANTED.witnessRadius) return true;
  }
  for (const cop of state.cops) {
    if (Math.hypot(cop.x - x, cop.y - y) < WANTED.sightRadius) return true;
  }
  return false;
}

export function createWorld(seed) {
  const random = createRandom(seed);
  const city = generateCity(random);
  const state = {
    seed,
    random,
    city,
    layer: null,
    time: 0,
    events: [],
    bullets: [],
    particles: [],
    pickups: [],
    cars: [],
    peds: [],
    cops: [],
    gang: [],
    chaseCars: [],
    bustTimer: 0,
    saveDirty: false,
    flags: { busted: false, wasted: false },
    camera: { x: city.spawn.x, y: city.spawn.y, shake: 0 },
    player: {
      x: city.spawn.x, y: city.spawn.y,
      angle: 0, vx: 0, vy: 0,
      health: PLAYER.health,
      cash: MISSIONS.startCash,
      stars: 0,
      lastCrime: -100,
      hiddenTimer: 0,
      crimeLog: [],
      missionsDone: 0,
      car: null,
      ammo: PLAYER.pistolAmmo,
      reserve: PLAYER.pistolReserve,
      reloadTimer: 0,
      fireTimer: 0,
      punchTimer: 0,
      onFoot: true,
    },
    missions: null,
  };
  state.missions = createMissionManager(state);
  state.layer = null; // Built lazily in the browser, where document exists.
  state.cars.push(...spawnParkedCars(random, city));
  state.cars.push(...spawnTraffic(random, 26));
  state.peds.push(...spawnPedestrians(random, 34));
  // A few pickups scattered around the city.
  for (let i = 0; i < 6; i += 1) {
    spawnPickup(state, random.range(200, 2360), random.range(200, 1700), i % 2 === 0 ? 'health' : 'ammo', i % 2 === 0 ? 25 : 12);
  }
  for (let i = 0; i < 5; i += 1) {
    spawnPickup(state, random.range(200, 2360), random.range(200, 1700), 'cash', random.int(20, 60));
  }
  return state;
}

/** Build the pre-rendered city layer (browser only; call once). */
export function buildLayer(state) {
  if (!state.layer) state.layer = createCityLayer(state.city);
  return state.layer;
}

export function resetWorld(state) {
  const fresh = createWorld(state.seed);
  for (const key of Object.keys(fresh)) state[key] = fresh[key];
  state.missions = createMissionManager(state);
}

function nearestCar(state, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  for (const car of state.chaseCars) {
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** The player steals or enters a car: witnesses make it a crime. */
export function enterCar(state) {
  const p = state.player;
  const car = nearestCar(state, p.x, p.y, 64);
  if (!car) return false;
  if (car.traffic && car.speed > 30) return false;
  // A traffic car has a driver: they run off, and the theft is a crime.
  if (car.traffic) {
    car.traffic = false;
    car.parked = false;
    const driver = makePedestrian(state.random, car.x, car.y);
    driver.state = 'flee';
    driver.scared = 4;
    state.peds.push(driver);
  }
  if (car.police) {
    addWanted(state, 2, 'stole a police car');
  } else if (witnessesNear(state, car.x, car.y)) {
    addWanted(state, 1, 'stole a car');
  }
  car.parked = false;
  car.speed = 0;
  p.car = car;
  p.onFoot = false;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  state.events.push({ type: 'enterCar', model: car.model });
  return true;
}

/** The player steps out of the car, beside it. */
export function exitCar(state) {
  const p = state.player;
  if (!p.car) return;
  const car = p.car;
  car.speed = 0;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  p.angle = car.angle;
  p.car = null;
  p.onFoot = true;
}

function stepPlayerOnFoot(state, dt, input) {
  const p = state.player;
  const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    mx /= len;
    my /= len;
    p.angle = Math.atan2(my, mx);
    p.x += mx * speed * dt;
    p.y += my * speed * dt;
  }
  p.x = Math.max(30, Math.min(WORLD.width - 30, p.x));
  p.y = Math.max(30, Math.min(WORLD.height - 30, p.y));
  resolveBuildingCollision(state.city, p, PLAYER.radius);
  // Aiming follows the mouse; shooting spends ammo and makes noise.
  if (input.aimX !== undefined) {
    const wx = state.camera.x + (input.aimX - state.viewW / 2) / state.zoom;
    const wy = state.camera.y + (input.aimY - state.viewH / 2) / state.zoom;
    if (Math.hypot(wx - p.x, wy - p.y) > 30) p.angle = Math.atan2(wy - p.y, wx - p.x);
  }
  p.fireTimer -= dt;
  p.reloadTimer -= dt;
  p.punchTimer -= dt;
  if (p.reloadTimer <= 0 && p.ammo === 0 && p.reserve > 0) {
    p.reloadTimer = PLAYER.reloadSeconds;
  }
  if (p.reloadTimer > 0 && p.reloadTimer - dt <= 0) {
    const take = Math.min(PLAYER.pistolAmmo, p.reserve);
    p.ammo = take;
    p.reserve -= take;
  }
  if (input.shoot && p.fireTimer <= 0 && p.reloadTimer <= 0 && p.ammo > 0) {
    p.fireTimer = PLAYER.fireInterval;
    p.ammo -= 1;
    fireBullet(state, p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, p.angle, 'player', PLAYER.bulletDamage);
    state.events.push({ type: 'shot', x: p.x, y: p.y, loud: true });
    state.camera.shake = Math.max(state.camera.shake, 2);
  }
  if (input.punch && p.punchTimer <= 0) {
    p.punchTimer = 0.45;
    if (punch(state)) state.events.push({ type: 'punch' });
  }
}

function stepPlayerInCar(state, dt, input) {
  const p = state.player;
  const car = p.car;
  const driven = drivePlayerCar(car, input, dt, state.city);
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  // Skid marks at speed, and dust behind the wheels.
  if (Math.abs(car.speed) > 300 && (input.left || input.right) && state.random.next() < 0.5) {
    state.particles.push({
      x: car.x - Math.cos(car.angle) * 24, y: car.y - Math.sin(car.angle) * 24,
      vx: 0, vy: 0, life: 0.5, maxLife: 0.5, color: '#2e2b2a', size: 7, skid: true,
    });
  }
  // Running over a pedestrian is a crime, and it is always seen.
  for (const ped of state.peds) {
    if (ped.dead) continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 30 && Math.abs(car.speed) > 60) {
      ped.dead = true;
      addWanted(state, 1, 'hit a pedestrian');
      state.events.push({ type: 'pedDown', x: ped.x, y: ped.y });
      state.camera.shake = Math.max(state.camera.shake, 5);
    }
  }
  if (car.health <= 0) {
    explodeCar(state, car);
    exitCar(state);
    p.health = Math.max(10, p.health - 20);
  }
  return driven;
}

export function explodeCar(state, car) {
  for (let i = 0; i < 26; i += 1) {
    state.particles.push({
      x: car.x, y: car.y,
      vx: state.random.range(-160, 160), vy: state.random.range(-160, 160),
      life: state.random.range(0.3, 0.9), maxLife: 0.9,
      color: state.random.pick(['#ff9a3d', '#ff5a2e', '#3a3a3a', '#ffd94d']),
      size: state.random.range(4, 10),
    });
  }
  state.camera.shake = 10;
  state.events.push({ type: 'explosion', x: car.x, y: car.y });
  state.cars = state.cars.filter((c) => c !== car);
  state.chaseCars = state.chaseCars.filter((c) => c !== car);
}

/** Keep the police presence matched to the wanted level. */
function maintainPolice(state, dt) {
  const p = state.player;
  const want = wantedChaseCount(p.stars);
  while (state.chaseCars.length < want) {
    const car = spawnChaseCar(state.random, state);
    car.cruise = 520;
  }
  while (state.chaseCars.length > want) state.chaseCars.pop();
  // Foot cops on patrol near the player while wanted.
  if (p.stars > 0 && state.cops.length < 3) {
    const hq = state.city.buildings.find((b) => b.kind === 'police');
    const hx = hq ? hq.x + hq.w / 2 : 1200;
    const hy = hq ? hq.y + hq.h + 60 : 200;
    state.cops.push(makeFootCop(state.random, hx + state.random.range(-120, 120), hy + state.random.range(-40, 40)));
  }
  if (p.stars === 0 && state.cops.length > 0) {
    state.cops = state.cops.filter((c) => Math.hypot(c.x - p.x, c.y - p.y) < 800);
  }
}

function stepParticles(state, dt) {
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
}

/** Advance the world one fixed step. Input: {up,down,left,right,run,shoot,aimX,aimY,punch,enter}. */
export function stepWorld(state, dt, input) {
  state.time += dt;
  const p = state.player;

  if (input.enter) {
    if (p.car) exitCar(state);
    else enterCar(state);
  }
  if (p.car) stepPlayerInCar(state, dt, input);
  else stepPlayerOnFoot(state, dt, input);

  for (const car of state.cars) {
    if (car.traffic) stepTrafficCar(car, dt, state.cars, state.random);
  }
  separateCars([...state.cars, ...state.chaseCars]);
  for (const car of state.chaseCars) {
    // A chase car that loses the player for too long gives up and despawns.
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d > 1400) car.giveUp = (car.giveUp ?? 0) + dt;
    else car.giveUp = 0;
  }
  state.chaseCars = state.chaseCars.filter((c) => (c.giveUp ?? 0) < 5);

  const danger = p.car && Math.abs(p.car.speed) > 200 ? { x: p.x, y: p.y } : null;
  for (const ped of state.peds) {
    stepPedestrian(ped, dt, danger, state.random);
  }
  state.peds = state.peds.filter((ped) => !ped.dead || state.random.next() < 0.995);
  // The city never empties: a few new pedestrians wander in.
  if (state.peds.filter((ped) => !ped.dead).length < 20) {
    state.peds.push(makePedestrian(state.random, p.x + state.random.range(-500, 500), p.y + state.random.range(-400, 400)));
  }

  for (const cop of state.cops) stepFootCop(cop, dt, state);
  state.cops = state.cops.filter((c) => c.health > 0);
  for (const car of state.chaseCars) stepChaseCar(car, dt, state);
  for (const g of state.gang) stepGangMember(g, dt, state);
  state.gang = state.gang.filter((g) => g.health > 0);

  stepBullets(state, dt);
  collectPickups(state);
  decayWanted(state, dt);
  maintainPolice(state, dt);
  state.missions.update(dt);

  // Slow health regen out of combat.
  if (state.time - p.lastCrime > 10 && p.health < PLAYER.health) p.health = Math.min(PLAYER.health, p.health + 2 * dt);

  if (p.health <= 0) state.flags.wasted = true;
  if (state.bustTimer > WANTED.bustSeconds) state.flags.busted = true;

  stepParticles(state, dt);

  // Camera follows the player, with a little lookahead and shake — and it
  // never shows past the edge of the world.
  const tx = p.x + Math.cos(p.angle) * 40;
  const ty = p.y + Math.sin(p.angle) * 40;
  state.camera.x += (tx - state.camera.x) * Math.min(1, 5 * dt);
  state.camera.y += (ty - state.camera.y) * Math.min(1, 5 * dt);
  state.camera.shake = Math.max(0, state.camera.shake - 30 * dt);
  const viewW = state.viewW ?? 1280;
  const viewH = state.viewH ?? 720;
  const zoom = state.zoom ?? 1.16;
  const halfW = viewW / 2 / zoom;
  const halfH = viewH / 2 / zoom;
  state.camera.x = Math.max(halfW, Math.min(WORLD.width - halfW, state.camera.x));
  state.camera.y = Math.max(halfH, Math.min(WORLD.height - halfH, state.camera.y));

  const events = state.events;
  state.events = [];
  return events;
}

/** What the world looked like when the player got busted or wasted. */
export function applyArrest(state) {
  const p = state.player;
  const fine = Math.min(p.cash, MISSIONS.bustFine);
  p.cash -= fine;
  p.stars = 0;
  p.hiddenTimer = 0;
  state.chaseCars = [];
  state.cops = [];
  const hq = state.city.buildings.find((b) => b.kind === 'police');
  p.x = hq ? hq.x + hq.w / 2 : 1200;
  p.y = hq ? hq.y + hq.h + 80 : 300;
  if (p.car) {
    p.car = null;
    p.onFoot = true;
  }
  state.bustTimer = 0;
  state.flags.busted = false;
  state.missions.failMission('Busted by the Bayview PD.');
  state.saveDirty = true;
}

export function applyHospital(state) {
  const p = state.player;
  const bill = Math.min(p.cash, MISSIONS.hospitalBill);
  p.cash -= bill;
  p.stars = 0;
  p.health = PLAYER.health;
  state.chaseCars = [];
  state.cops = [];
  const hosp = state.city.buildings.find((b) => b.kind === 'hospital');
  p.x = hosp ? hosp.x + hosp.w / 2 : 400;
  p.y = hosp ? hosp.y + hosp.h + 80 : 1400;
  if (p.car) {
    p.car = null;
    p.onFoot = true;
  }
  state.flags.wasted = false;
  state.missions.failMission('Wasted. You woke up at Solmar General.');
  state.saveDirty = true;
}
