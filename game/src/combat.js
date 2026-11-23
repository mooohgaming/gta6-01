// Combat and pickups: the pistol (12-round mag, reload, aim with the mouse
// or the facing direction), its bullets and the enemy's, and the cash, health
// and ammo pickups scattered around the city.

import { GUN } from './config.js';

export function createGun() {
  return { ammo: GUN.mag, reserve: 999, reloading: false, reloadTimer: 0, cooldown: 0 };
}

export function createPickups(random, city) {
  const pickups = [];
  const kinds = ['cash', 'cash', 'cash', 'cash', 'cash', 'cash', 'cash', 'cash', 'cash', 'cash', 'cash', 'cash', 'health', 'health', 'health', 'health', 'ammo', 'ammo', 'ammo', 'ammo'];
  for (let i = 0; i < 20; i += 1) {
    let x; let y; let tries = 0;
    do {
      const p = city.nearestRoadPoint(100 + random() * 2360, 100 + random() * 1880);
      x = p.x + (random() - 0.5) * 40;
      y = p.y + (random() - 0.5) * 40;
      tries += 1;
    } while (city.resolveSolid({ x, y, radius: 16 }) && tries < 8);
    pickups.push({ kind: kinds[i], x, y, taken: false, bob: random() * Math.PI * 2 });
  }
  return pickups;
}

/**
 * Fire the pistol. Returns true when a bullet left the barrel. Aiming with
 * the mouse (aimActive) shoots at the cursor; otherwise it shoots where the
 * player faces. An empty mag starts a reload instead of firing.
 */
export function fireGun(gun, player, bullets, aimX, aimY, aimActive) {
  if (gun.reloading) return false;
  // An empty mag starts a reload even while the trigger is still cooling down.
  if (gun.ammo <= 0) {
    gun.reloading = true;
    gun.reloadTimer = GUN.reloadSeconds;
    return false;
  }
  if (gun.cooldown > 0) return false;
  gun.ammo -= 1;
  gun.cooldown = 0.16;
  const angle = aimActive ? Math.atan2(aimY - player.y, aimX - player.x) : player.angle;
  const ox = player.x + Math.cos(angle) * (player.inCar ? 26 : 18);
  const oy = player.y + Math.sin(angle) * (player.inCar ? 26 : 18);
  bullets.push({ x: ox, y: oy, vx: Math.cos(angle) * GUN.bulletSpeed, vy: Math.sin(angle) * GUN.bulletSpeed, life: GUN.range, damage: GUN.damage });
  if (gun.ammo === 0) {
    gun.reloading = true;
    gun.reloadTimer = GUN.reloadSeconds;
  }
  return true;
}

export function updateGun(gun, dt) {
  if (gun.cooldown > 0) gun.cooldown -= dt;
  if (gun.reloading) {
    gun.reloadTimer -= dt;
    if (gun.reloadTimer <= 0) {
      gun.reloading = false;
      gun.ammo = GUN.mag;
    }
  }
}

function bulletHitsCircle(b, c) {
  return Math.hypot(b.x - c.x, b.y - c.y) < c.radius + 6;
}

/** Move bullets, stop them at walls, and apply their hits. */
export function updateBullets(bullets, dt, city, people, cops, interceptors, damagePlayer) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && city.resolveSolid({ x: b.x, y: b.y, radius: 2 })) dead = true;
    if (!dead) {
      for (const person of people) {
        if (person.kind === 'vulture' && bulletHitsCircle(b, person)) {
          person.health -= b.damage;
          if (person.health <= 0) people.splice(people.indexOf(person), 1);
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const cop of cops) {
        if (bulletHitsCircle(b, cop)) {
          cops.splice(cops.indexOf(cop), 1);
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const car of interceptors) {
        if (bulletHitsCircle(b, car)) {
          car.speed *= 0.4;
          dead = true;
          break;
        }
      }
    }
    if (dead) bullets.splice(i, 1);
  }
}

/** Enemy bullets: they only ever hurt the player. */
export function updateEnemyBullets(enemyBullets, dt, city, player, damagePlayer) {
  for (let i = enemyBullets.length - 1; i >= 0; i -= 1) {
    const b = enemyBullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && city.resolveSolid({ x: b.x, y: b.y, radius: 2 })) dead = true;
    if (!dead && Math.hypot(b.x - player.x, b.y - player.y) < (player.inCar ? 24 : 16)) {
      damagePlayer(b.damage);
      dead = true;
    }
    if (dead) enemyBullets.splice(i, 1);
  }
}

/** Pickups the player walks or drives over: cash, health, ammo. */
export function collectPickups(pickups, player, gun) {
  let cash = 0;
  for (const p of pickups) {
    if (p.taken) continue;
    if (Math.hypot(p.x - player.x, p.y - player.y) < 30) {
      p.taken = true;
      if (p.kind === 'cash') cash += 25;
      else if (p.kind === 'health') player.health = Math.min(100, player.health + 40);
      else if (p.kind === 'ammo') gun.ammo = GUN.mag;
    }
  }
  return cash;
}
