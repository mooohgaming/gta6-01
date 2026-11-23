// People: pedestrians strolling the sidewalks, the Vultures of the turf war,
// foot cops who arrest the player, and police Interceptors that ram and shoot
// at three stars and up. A pursuer that loses sight of the player stops in
// place and gives up after twelve seconds, so a fast getaway really works.

import { HORIZONTAL, PLAYER, ROAD_HALF, VERTICAL, WANTED } from './config.js';

function sidewalkPoint(random) {
  if (random() < 0.5) {
    const x = VERTICAL[Math.floor(random() * VERTICAL.length)] + (random() < 0.5 ? -ROAD_HALF - 12 : ROAD_HALF + 12);
    return { x, y: 60 + random() * 1960 };
  }
  const y = HORIZONTAL[Math.floor(random() * HORIZONTAL.length)] + (random() < 0.5 ? -ROAD_HALF - 12 : ROAD_HALF + 12);
  return { x: 60 + random() * 2440, y };
}

export function createPeople(random) {
  const people = [];
  for (let i = 0; i < 24; i += 1) {
    const p = sidewalkPoint(random);
    const target = sidewalkPoint(random);
    people.push({
      kind: 'pedestrian', x: p.x, y: p.y, tx: target.x, ty: target.y,
      speed: 38 + random() * 34, radius: 10, down: 0, homeX: p.x, homeY: p.y,
    });
  }
  return people;
}

function moveToward(person, tx, ty, speed, dt) {
  const dx = tx - person.x;
  const dy = ty - person.y;
  const d = Math.hypot(dx, dy);
  if (d < 6) return true;
  person.x += (dx / d) * speed * dt;
  person.y += (dy / d) * speed * dt;
  return false;
}

export function updatePeople(people, dt, random, player) {
  for (const person of people) {
    if (person.kind !== 'pedestrian') continue;
    if (person.down > 0) {
      person.down -= dt;
      continue;
    }
    // A pedestrian steps aside from a car bearing down on them, so a turn
    // that swings onto the sidewalk does not run them over.
    if (player && player.inCar) {
      const d = Math.hypot(player.x - person.x, player.y - person.y);
      if (d < 80) {
        const a = Math.atan2(person.y - player.y, person.x - player.x);
        person.x += Math.cos(a) * 170 * dt;
        person.y += Math.sin(a) * 170 * dt;
        continue;
      }
    }
    if (moveToward(person, person.tx, person.ty, person.speed, dt)) {
      const next = sidewalkPoint(random);
      person.tx = next.x;
      person.ty = next.y;
    }
  }
}

/** The eight Vultures of the turf war, spawned at the mall. */
export function spawnVultures(people, x, y, random) {
  for (let i = 0; i < 8; i += 1) {
    const hx = x + (random() - 0.5) * 160;
    const hy = y + (random() - 0.5) * 120;
    people.push({
      kind: 'vulture', x: hx, y: hy, tx: hx, ty: hy,
      speed: 95 + random() * 25, radius: 12, health: 100,
      homeX: hx, homeY: hy, shootTimer: 1 + random(),
    });
  }
}

/**
 * Vultures chase the player while he is near their turf, but each one is on
 * a 400 px leash to its own spawn point: past the leash it walks home instead
 * of chasing, so the fight stays at the mall.
 */
export function updateVultures(people, player, dt, enemyBullets, random) {
  for (const v of people) {
    if (v.kind !== 'vulture') continue;
    const dPlayer = Math.hypot(player.x - v.x, player.y - v.y);
    const dHome = Math.hypot(v.homeX - v.x, v.homeY - v.y);
    if (dPlayer < 420 && dHome < 400) {
      moveToward(v, player.x, player.y, v.speed, dt);
      v.shootTimer -= dt;
      if (v.shootTimer <= 0 && dPlayer < 380) {
        v.shootTimer = 1.4 + random() * 0.8;
        const a = Math.atan2(player.y - v.y, player.x - v.x);
        enemyBullets.push({ x: v.x, y: v.y, vx: Math.cos(a) * 460, vy: Math.sin(a) * 460, life: 1.6, damage: 8, from: 'vulture' });
      }
    } else if (dHome > 8) {
      moveToward(v, v.homeX, v.homeY, v.speed, dt);
    }
  }
}

export function spawnCop(cops, x, y) {
  cops.push({ x, y, radius: 12, speed: 128, giveUp: 0, bustTimer: 0 });
}

/** Foot cops run at the player; close in for 0.6 s and the player is busted. */
export function updateCops(cops, player, dt, state) {
  for (let i = cops.length - 1; i >= 0; i -= 1) {
    const cop = cops[i];
    const d = Math.hypot(player.x - cop.x, player.y - cop.y);
    if (d > WANTED.sightRange) {
      // Out of sight: the cop stops where he is and the give-up timer runs.
      cop.giveUp += dt;
      if (cop.giveUp >= WANTED.giveUpSeconds) {
        cops.splice(i, 1);
        continue;
      }
    } else {
      cop.giveUp = 0;
      moveToward(cop, player.x, player.y, cop.speed, dt);
    }
    const d2 = Math.hypot(player.x - cop.x, player.y - cop.y);
    // A foot cop can only arrest the player on foot: a car, moving or
    // stopped, is the Interceptors' job — they ram and shoot instead.
    if (d2 < WANTED.bustRange && player.onFoot) {
      cop.bustTimer += dt;
      if (cop.bustTimer >= WANTED.bustSeconds) state.over = 'busted';
    } else {
      cop.bustTimer = 0;
    }
  }
}

export function spawnInterceptor(interceptors, x, y) {
  interceptors.push({ x, y, angle: 0, speed: 0, radius: 20, giveUp: 0, shootTimer: 1, color: '#1d2f7a' });
}

/**
 * Interceptors chase at 520, ram the player's car, and shoot at three stars
 * and up. Like foot cops they give up after twelve seconds out of sight.
 */
export function updateInterceptors(interceptors, player, dt, state, city, enemyBullets) {
  for (let i = interceptors.length - 1; i >= 0; i -= 1) {
    const car = interceptors[i];
    const d = Math.hypot(player.x - car.x, player.y - car.y);
    if (d > WANTED.sightRange) {
      car.giveUp += dt;
      car.speed = Math.max(0, car.speed - 600 * dt);
      if (car.giveUp >= WANTED.giveUpSeconds) {
        interceptors.splice(i, 1);
        continue;
      }
    } else {
      car.giveUp = 0;
      const want = Math.atan2(player.y - car.y, player.x - car.x);
      let diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff * 2.4 * dt));
      car.speed = Math.min(520, car.speed + 420 * dt);
    }
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    city.resolveSolid(car);
    // A ram: a hard hit that shoves the player and hurts. Each Interceptor can
    // ram at most once every 1.5 s, so two of them cannot stun-lock the player.
    const d2 = Math.hypot(player.x - car.x, player.y - car.y);
    car.ramTimer = Math.max(0, (car.ramTimer || 0) - dt);
    if (d2 < car.radius + PLAYER.carRadius && Math.abs(car.speed) > 120 && car.ramTimer <= 0) {
      car.ramTimer = 1.5;
      const a = Math.atan2(player.y - car.y, player.x - car.x);
      player.x += Math.cos(a) * 26;
      player.y += Math.sin(a) * 26;
      if (player.inCar) player.inCar.speed *= 0.75;
      state.damagePlayer(9);
      car.speed *= 0.5;
    }
    if (state.player.wanted >= 3 && d2 < 420) {
      car.shootTimer -= dt;
      if (car.shootTimer <= 0) {
        car.shootTimer = 1.6;
        const a = Math.atan2(player.y - car.y, player.x - car.x);
        enemyBullets.push({ x: car.x, y: car.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, life: 1.4, damage: 7, from: 'cop' });
      }
    }
  }
}
