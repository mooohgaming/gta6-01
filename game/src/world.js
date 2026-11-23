// The world: everything the game simulates, with no drawing and no browser
// in it, so the same code runs headless in Node for tests and in the browser
// for play. step() advances one fixed step and the caller reacts to what it
// finds in the state.

import { CITY, LANDMARKS, PLAYER, SPAWN, WANTED } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { createParked, createTraffic, driveCar, updateTraffic } from './vehicles.js';
import { createPeople, spawnCop, spawnInterceptor, spawnVultures, updateCops, updateInterceptors, updatePeople, updateVultures } from './people.js';
import { collectPickups, createGun, createPickups, fireGun, updateBullets, updateEnemyBullets, updateGun } from './combat.js';
import { createMissions, startMission, updateMissions } from './missions.js';

export function createWorld(seed) {
  const random = createRandom(seed);
  const city = createCity(random);
  const traffic = createTraffic(random);
  const parked = createParked(random);
  const people = createPeople(random);
  const pickups = createPickups(random, city);

  const player = {
    x: SPAWN.x, y: SPAWN.y, angle: Math.PI / 2, speed: 0,
    health: PLAYER.health, cash: PLAYER.startCash, wanted: 0,
    lastCrime: -999, outOfSight: 0, inCar: null, onFoot: true, radius: PLAYER.radius,
  };

  const state = {
    city, traffic, parked, people, pickups,
    cops: [], interceptors: [], bullets: [], enemyBullets: [],
    gun: createGun(), missions: createMissions(),
    player, time: 0, over: false, screen: 'title',
    damagePlayer: null,
  };

  function damagePlayer(amount) {
    if (state.over) return;
    player.health -= amount;
    if (player.health <= 0) {
      player.health = 0;
      state.over = 'wasted';
    }
  }
  state.damagePlayer = damagePlayer;

  function crime(stars) {
    player.wanted = Math.max(player.wanted, Math.min(WANTED.maxStars, stars));
    player.lastCrime = state.time;
    player.outOfSight = 0;
    // Foot cops arrive on the nearest road, a short run from the player.
    const near = city.nearestRoadPoint(player.x, player.y);
    for (let i = 0; i < Math.max(1, stars); i += 1) {
      const a = random() * Math.PI * 2;
      spawnCop(state.cops, near.x + Math.cos(a) * 170, near.y + Math.sin(a) * 170);
    }
    if (stars >= 3) {
      while (state.interceptors.length < 2) {
        const a = random() * Math.PI * 2;
        spawnInterceptor(state.interceptors, player.x + Math.cos(a) * 340, player.y + Math.sin(a) * 340);
      }
    }
  }

  function respawn() {
    if (state.over === 'busted') {
      player.cash = Math.max(0, player.cash - WANTED.bustedFine);
      player.x = LANDMARKS.hq.x;
      player.y = LANDMARKS.hq.y;
    } else if (state.over === 'wasted') {
      player.cash = Math.max(0, player.cash - WANTED.wastedBill);
      player.x = LANDMARKS.hospital.x;
      player.y = LANDMARKS.hospital.y;
    }
    player.angle = Math.PI / 2;
    player.speed = 0;
    player.health = PLAYER.health;
    player.wanted = 0;
    player.inCar = null;
    player.onFoot = true;
    player.radius = PLAYER.radius;
    state.cops.length = 0;
    state.interceptors.length = 0;
    state.enemyBullets.length = 0;
    state.over = false;
  }

  function reset() {
    player.x = SPAWN.x;
    player.y = SPAWN.y;
    player.angle = Math.PI / 2;
    player.speed = 0;
    player.health = PLAYER.health;
    player.cash = PLAYER.startCash;
    player.wanted = 0;
    player.lastCrime = -999;
    player.outOfSight = 0;
    player.inCar = null;
    player.onFoot = true;
    player.radius = PLAYER.radius;
    state.cops.length = 0;
    state.interceptors.length = 0;
    state.bullets.length = 0;
    state.enemyBullets.length = 0;
    state.gun = createGun();
    state.missions = createMissions();
    state.time = 0;
    state.over = false;
    for (const car of parked) car.taken = false;
    for (const p of pickups) p.taken = false;
  }

  function enterExitCar() {
    if (player.onFoot) {
      let best = null;
      let bestD = 80;
      for (const car of parked) {
        if (car.taken) continue;
        const d = Math.hypot(car.x - player.x, car.y - player.y);
        if (d < bestD) { bestD = d; best = car; }
      }
      // Any car on the street can be stolen — a moving traffic car included.
      // A stolen traffic car leaves the traffic flow and becomes a parked car.
      let stolen = null;
      if (!best) {
        for (const car of traffic) {
          const d = Math.hypot(car.x - player.x, car.y - player.y);
          if (d < bestD) { bestD = d; stolen = car; }
        }
      }
      if (stolen) {
        const at = traffic.indexOf(stolen);
        if (at !== -1) traffic.splice(at, 1);
        stolen.speed = 0;
        parked.push(stolen);
        best = stolen;
      }
      if (best) {
        best.taken = true;
        player.inCar = best;
        player.onFoot = false;
        player.x = best.x;
        player.y = best.y;
        player.angle = best.angle;
        player.speed = best.speed;
        player.radius = PLAYER.carRadius;
      }
    } else if (player.inCar) {
      const car = player.inCar;
      car.speed = 0;
      car.taken = false;
      player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
      player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
      city.resolveSolid(player);
      player.inCar = null;
      player.onFoot = true;
      player.speed = 0;
      player.radius = PLAYER.radius;
    }
  }

  function stepPlayer(dt, input) {
    if (player.onFoot) {
      let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        dx /= len;
        dy /= len;
        player.angle = Math.atan2(dy, dx);
        player.x += dx * PLAYER.walkSpeed * dt;
        player.y += dy * PLAYER.walkSpeed * dt;
        city.resolveSolid(player);
      }
      player.speed = 0;
    } else if (player.inCar) {
      driveCar(player.inCar, input, dt, city);
      player.x = player.inCar.x;
      player.y = player.inCar.y;
      player.angle = player.inCar.angle;
      player.speed = player.inCar.speed;
      // A soft bump with traffic: it slows both cars, it never traps the player.
      for (const car of traffic) {
        const d = Math.hypot(car.x - player.x, car.y - player.y);
        if (d < car.radius + player.radius && d > 0.01) {
          const a = Math.atan2(player.y - car.y, player.x - car.x);
          player.x += Math.cos(a) * 6;
          player.y += Math.sin(a) * 6;
          player.inCar.x = player.x;
          player.inCar.y = player.y;
          player.inCar.speed *= 0.82;
        }
      }
    }
    if (input.enter) enterExitCar();
    if (input.shoot) fireGun(state.gun, player, state.bullets, input.aimX || 0, input.aimY || 0, Boolean(input.aimActive));
    if (input.reload && !state.gun.reloading && state.gun.ammo < 12) {
      state.gun.reloading = true;
      state.gun.reloadTimer = 1.2;
    }
  }

  /** Traffic brakes for anyone on foot ahead of it, so it never runs the player over. */
  function updateTrafficSafe(dt) {
    for (const car of traffic) {
      const fx = car.x + Math.cos(car.angle) * 56;
      const fy = car.y + Math.sin(car.angle) * 56;
      let blocked = false;
      if (player.onFoot && Math.hypot(fx - player.x, fy - player.y) < 42) blocked = true;
      if (!blocked) {
        for (const person of people) {
          if (person.kind === 'pedestrian' && Math.hypot(fx - person.x, fy - person.y) < 38) { blocked = true; break; }
        }
      }
      const target = blocked ? 0 : car.cruise ?? car.speed;
      if (car.cruise === undefined) car.cruise = car.speed;
      car.speed += (target - car.speed) * Math.min(1, 4 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (car.x < -60) car.x = 2620;
      if (car.x > 2620) car.x = -60;
      if (car.y < -60) car.y = 2140;
      if (car.y > 2140) car.y = -60;
    }
  }

  function step(dt, input) {
    state.time += dt;
    if (!state.over) stepPlayer(dt, input || {});
    updateTrafficSafe(dt);
    updatePeople(people, dt, random, player);
    updateVultures(people, player, dt, state.enemyBullets, random);
    updateCops(state.cops, player, dt, state);
    updateInterceptors(state.interceptors, player, dt, state, city, state.enemyBullets);
    updateGun(state.gun, dt);
    updateBullets(state.bullets, dt, city, people, state.cops, state.interceptors, damagePlayer);
    updateEnemyBullets(state.enemyBullets, dt, city, player, damagePlayer);
    // Running a pedestrian over is a crime — and it puts them down for a while.
    if (player.inCar) {
      for (const person of people) {
        if (person.kind === 'pedestrian' && person.down <= 0 && Math.hypot(person.x - player.x, person.y - player.y) < 30) {
          person.down = 3;
          if (player.wanted < 1) crime(1);
        }
      }
    }
    player.cash += collectPickups(pickups, player, state.gun);
    // The heat dies only while no pursuer can see the player.
    const seen = state.cops.some((c) => Math.hypot(c.x - player.x, c.y - player.y) < WANTED.sightRange)
      || state.interceptors.some((c) => Math.hypot(c.x - player.x, c.y - player.y) < WANTED.sightRange);
    if (!seen && player.wanted > 0) {
      player.outOfSight += dt;
      if (player.outOfSight >= WANTED.decaySeconds) {
        player.wanted -= 1;
        player.outOfSight = 0;
      }
    } else {
      player.outOfSight = 0;
    }
    if (!state.over) {
      updateMissions(state, {
        crime,
        spawnVultures: () => spawnVultures(people, LANDMARKS.mall.x, LANDMARKS.mall.y, random),
        onMissionComplete: null,
      }, dt);
    }
    return 0;
  }

  return { state, step, reset, crime, respawn };
}
