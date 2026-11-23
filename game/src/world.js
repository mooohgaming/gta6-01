// The simulation: one fixed step advances the player, the traffic, the people,
// the police, the bullets and the missions. No DOM in here — the headless test
// runs this module in plain Node — and no Math.random or clock, so the same seed
// and the same inputs always give the same world.
import {
  BUSTED_FINE,
  CAR,
  PICKUP_CASH,
  PICKUP_COUNT,
  PLAYER,
  RESPAWN,
  START_CASH,
  WANTED,
  WASTED_BILL,
} from './config.js';
import { createCity, nearestRoadX, nearestRoadY, pointInBuilding, resolveSolid } from './city.js';
import { createRandom, pick } from './random.js';
import { createGun, startReload, tryShoot, updateBullets, updateEnemyBullets, updateEnemyFire, updateGun } from './combat.js';
import { createMissions, updateMissions } from './missions.js';
import { createPeople, spawnCop, spawnVultures, updatePeople } from './people.js';
import { createVehicles, nearestCar, stepPlayerCar, updateTraffic } from './vehicles.js';

function placePickups(random, city) {
  const kinds = [];
  for (let i = 0; i < 12; i += 1) kinds.push('cash');
  for (let i = 0; i < 5; i += 1) kinds.push('health');
  for (let i = 0; i < 3; i += 1) kinds.push('ammo');
  const roadsX = [200, 600, 1000, 1400, 1800, 2200];
  const roadsY = [180, 520, 860, 1200, 1540, 1880];
  const pickups = [];
  let guard = 0;
  while (pickups.length < PICKUP_COUNT && guard < 400) {
    guard += 1;
    const vertical = random() < 0.5;
    const x = vertical
      ? pick(random, roadsX) + (random() < 0.5 ? 44 : -44)
      : 120 + random() * 2320;
    const y = vertical
      ? 120 + random() * 1840
      : pick(random, roadsY) + (random() < 0.5 ? 44 : -44);
    if (pointInBuilding(city, x, y)) continue;
    if (pickups.some((other) => Math.hypot(other.x - x, other.y - y) < 90)) continue;
    pickups.push({ x, y, kind: kinds[pickups.length], taken: false });
  }
  return pickups;
}

export function createWorld(seed) {
  let random = createRandom(seed);
  const state = {};

  /** Build a fresh state in place, so a reference saved earlier stays valid. */
  function init() {
    random = createRandom(seed);
    const city = createCity(random);
    const vehicles = createVehicles(random, city);
    const fresh = {
      city,
      time: 0,
      over: null,
      screen: 'title',
      player: {
        x: 1400, y: 1200, angle: -Math.PI / 2, speed: 0,
        health: PLAYER.health, cash: START_CASH, wanted: 0, lastCrime: -100,
        inCar: null, onFoot: true,
      },
      traffic: vehicles.traffic,
      parked: vehicles.parked,
      people: createPeople(random),
      pickups: placePickups(random, city),
      cops: [],
      interceptors: [],
      gun: createGun(),
      bullets: [],
      enemyBullets: [],
      missions: createMissions(),
      decayTimer: 0,
    };
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, fresh);
  }

  init();

  /** Raise the heat, remember when, and send the law after the player. */
  function crime(n) {
    const player = state.player;
    if (state.over) return;
    player.wanted = Math.min(5, player.wanted + n);
    player.lastCrime = state.time;
    const wantCops = Math.min(player.wanted, 3);
    while (state.cops.length < wantCops) spawnCop(state, random);
    ensureInterceptors();
  }

  /** Set the heat to an exact level (a mission start, the vault): same law, no adding. */
  function setWanted(n) {
    const player = state.player;
    if (state.over) return;
    player.wanted = n;
    player.lastCrime = state.time;
    const wantCops = Math.min(n, 3);
    while (state.cops.length < wantCops) spawnCop(state, random);
    ensureInterceptors();
  }

  function ensureInterceptors() {
    const player = state.player;
    const want = player.wanted >= 3 ? Math.min(player.wanted - 2, WANTED.maxInterceptors) : 0;
    while (state.interceptors.length < want) {
      const onVertical = random() < 0.5;
      state.interceptors.push({
        x: onVertical ? nearestRoadX(player.x + (random() < 0.5 ? -420 : 420)) : player.x + (random() < 0.5 ? -420 : 420),
        y: onVertical ? player.y + (random() < 0.5 ? -420 : 420) : nearestRoadY(player.y + (random() < 0.5 ? -420 : 420)),
        angle: 0, speed: 200, kind: 'interceptor',
        shootCooldown: 1 + random(), giveUp: 0, color: 'interceptor',
      });
    }
  }

  function exitCar() {
    const player = state.player;
    const car = player.inCar;
    car.speed = 0;
    car.driven = false;
    const side = car.angle + Math.PI / 2;
    player.x = car.x + Math.cos(side) * 30;
    player.y = car.y + Math.sin(side) * 30;
    resolveSolid(state.city, player, PLAYER.radius);
    player.inCar = null;
    player.onFoot = true;
    player.speed = 0;
    // A stolen traffic car stays where it was left, as a parked car.
    const index = state.traffic.indexOf(car);
    if (index !== -1) {
      state.traffic.splice(index, 1);
      state.parked.push(car);
    }
  }

  function updateCops(dt) {
    const player = state.player;
    for (let i = state.cops.length - 1; i >= 0; i -= 1) {
      const cop = state.cops[i];
      const dx = player.x - cop.x;
      const dy = player.y - cop.y;
      const dist = Math.hypot(dx, dy);
      if (dist > WANTED.sightRange) {
        // Lost sight of the suspect: the cop stops and searches in place
        // instead of sprinting blindly after them. A runner who broke line
        // of sight can actually get away, and a cop can no longer run down
        // a player who is pinned against the map edge while the give-up
        // timer is still counting.
        cop.giveUp += dt;
        if (cop.giveUp > WANTED.giveUpSeconds) {
          state.cops.splice(i, 1);
          continue;
        }
      } else {
        cop.giveUp = 0;
        if (dist > 1) {
          cop.angle = Math.atan2(dy, dx);
          cop.x += (dx / dist) * cop.speed * dt;
          cop.y += (dy / dist) * cop.speed * dt;
          resolveSolid(state.city, cop, 10);
        }
      }
      if (player.onFoot && dist < 42) {
        cop.contact += dt;
        if (cop.contact > 0.8) {
          state.over = 'busted';
          return;
        }
      } else {
        cop.contact = 0;
      }
    }
  }

  function updateInterceptors(dt) {
    const player = state.player;
    for (let i = state.interceptors.length - 1; i >= 0; i -= 1) {
      const car = state.interceptors[i];
      const dx = player.x - car.x;
      const dy = player.y - car.y;
      const dist = Math.hypot(dx, dy);
      const want = Math.atan2(dy, dx);
      let diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.speed = Math.min(470, car.speed + 380 * dt);
      car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (resolveSolid(state.city, car, CAR.radius)) car.speed *= 0.7;
      if (dist < 36 && !state.over) {
        player.health -= WANTED.ramDamagePerSecond * dt;
        if (player.health <= 0) {
          player.health = 0;
          state.over = 'wasted';
          return;
        }
      }
      if (dist > WANTED.giveUpRange) car.giveUp += dt;
      else car.giveUp = 0;
      if (car.giveUp > WANTED.giveUpSeconds) state.interceptors.splice(i, 1);
    }
  }

  function updateWanted(dt) {
    const player = state.player;
    if (player.wanted <= 0) {
      state.cops.length = 0;
      state.interceptors.length = 0;
      state.decayTimer = 0;
      return;
    }
    const seen = state.cops.some((cop) => Math.hypot(cop.x - player.x, cop.y - player.y) < WANTED.sightRange)
      || state.interceptors.some((car) => Math.hypot(car.x - player.x, car.y - player.y) < WANTED.sightRange);
    if (!seen && state.time - player.lastCrime > WANTED.decayDelay) {
      state.decayTimer += dt;
      if (state.decayTimer >= WANTED.decaySeconds) {
        player.wanted -= 1;
        state.decayTimer = 0;
      }
    } else {
      state.decayTimer = 0;
    }
  }

  function step(dt, input) {
    // Behind a busted/wasted/complete panel the city idles on.
    if (state.over) {
      updateTraffic(state, dt, state.city, random);
      updatePeople(state, dt, state.city, random);
      return;
    }
    state.time += dt;
    const player = state.player;

    if (input.enter) {
      if (player.inCar) exitCar();
      else {
        const car = nearestCar(state, player.x, player.y);
        if (car) {
          player.inCar = car;
          car.driven = true;
          player.onFoot = false;
        }
      }
    }

    if (player.inCar) {
      const car = player.inCar;
      stepPlayerCar(car, input, dt, state.city);
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      player.speed = car.speed;
      // Running a pedestrian over at speed is a crime.
      for (let i = state.people.length - 1; i >= 0; i -= 1) {
        const person = state.people[i];
        if (person.kind !== 'ped') continue;
        if (Math.hypot(person.x - player.x, person.y - player.y) < 26 && Math.abs(car.speed) > 80) {
          state.people.splice(i, 1);
          crime(1);
        }
      }
      // Shove other cars aside instead of driving through them. The shove is
      // sideways to the player's heading, so a head-on car is pushed out of the
      // way instead of grinding nose to nose forever.
      for (const other of [...state.traffic, ...state.parked]) {
        if (other === car || other.driven) continue;
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.01 && dist < 36) {
          const px = -Math.sin(car.angle);
          const py = Math.cos(car.angle);
          const side = dx * px + dy * py >= 0 ? 1 : -1;
          const push = 36 - dist;
          other.x += px * side * push;
          other.y += py * side * push;
          other.speed *= 0.7;
          car.speed *= 0.95;
        }
      }
    } else {
      const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      const len = Math.hypot(dx, dy);
      if (len > 0) {
        player.x += (dx / len) * PLAYER.walkSpeed * dt;
        player.y += (dy / len) * PLAYER.walkSpeed * dt;
        player.angle = Math.atan2(dy, dx);
        player.speed = PLAYER.walkSpeed;
      } else {
        player.speed = 0;
      }
      resolveSolid(state.city, player, PLAYER.radius);
    }

    if (input.shoot) {
      const aimX = input.aimActive ? input.aimX : player.x + Math.cos(player.angle) * 100;
      const aimY = input.aimActive ? input.aimY : player.y + Math.sin(player.angle) * 100;
      tryShoot(state, aimX, aimY);
    }
    if (input.reload) startReload(state.gun);
    updateGun(state.gun, dt);
    const kills = updateBullets(state, dt, state.city);
    for (let i = 0; i < kills.ped; i += 1) crime(1);
    for (let i = 0; i < kills.cop; i += 1) crime(2);

    updateTraffic(state, dt, state.city, random);
    updatePeople(state, dt, state.city, random);
    updateCops(dt);
    updateInterceptors(dt);
    updateEnemyFire(state, dt, state.city, random);
    updateEnemyBullets(state, dt, state.city);
    if (state.over) return;

    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      if (Math.hypot(pickup.x - player.x, pickup.y - player.y) < 34) {
        pickup.taken = true;
        if (pickup.kind === 'cash') player.cash += PICKUP_CASH;
        else if (pickup.kind === 'health') player.health = Math.min(PLAYER.health, player.health + 30);
        else if (pickup.kind === 'ammo') state.gun.ammo = state.gun.mag;
      }
    }

    updateWanted(dt);
    updateMissions(state, dt, {
      onMissionStart(index) {
        if (index === 3) setWanted(3);
        else if (index === 4) spawnVultures(state, random);
      },
      onVaultCracked() {
        setWanted(4);
      },
    });

    if (player.health <= 0 && !state.over) {
      player.health = 0;
      state.over = 'wasted';
    }
  }

  function respawn() {
    const player = state.player;
    if (state.over === 'busted') {
      player.cash = Math.max(0, player.cash - BUSTED_FINE);
      player.x = RESPAWN.busted.x;
      player.y = RESPAWN.busted.y;
    } else if (state.over === 'wasted') {
      player.cash = Math.max(0, player.cash - WASTED_BILL);
      player.x = RESPAWN.wasted.x;
      player.y = RESPAWN.wasted.y;
    } else {
      return;
    }
    player.inCar = null;
    player.onFoot = true;
    player.health = PLAYER.health;
    player.wanted = 0;
    player.angle = -Math.PI / 2;
    player.speed = 0;
    state.cops.length = 0;
    state.interceptors.length = 0;
    state.enemyBullets.length = 0;
    state.bullets.length = 0;
    state.over = null;
  }

  /** Resume a saved game: cash, spot and mission, with that mission's setup. */
  function continueGame(save) {
    const player = state.player;
    player.cash = save.cash;
    player.x = save.x;
    player.y = save.y;
    player.angle = -Math.PI / 2;
    player.speed = 0;
    player.inCar = null;
    player.onFoot = true;
    const runner = state.missions.runner;
    runner.index = Math.min(save.mission, 5);
    runner.stage = 0;
    runner.channel = 0;
    runner.stop = 0;
    if (runner.index === 3) crime(3);
    else if (runner.index === 4) spawnVultures(state, random);
    state.over = null;
  }

  return { state, step, reset: init, crime, respawn, continueGame };
}
