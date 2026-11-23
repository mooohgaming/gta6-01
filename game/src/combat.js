// Combat: the player's pistol (a 12-round magazine, a reload, a fire rate) and the
// bullets both sides fire. A bullet stops at the first thing it hits. Killing a
// pedestrian is a crime; killing a cop is a bigger one; Vultures are fair game.
import { GUN } from './config.js';
import { pointInBuilding } from './city.js';

export function createGun() {
  return { ammo: GUN.mag, mag: GUN.mag, reloading: false, reloadTimer: 0, cooldown: 0 };
}

export function startReload(gun) {
  if (gun.reloading || gun.ammo === gun.mag) return;
  gun.reloading = true;
  gun.reloadTimer = GUN.reloadSeconds;
}

export function updateGun(gun, dt) {
  if (gun.cooldown > 0) gun.cooldown -= dt;
  if (!gun.reloading) return;
  gun.reloadTimer -= dt;
  if (gun.reloadTimer <= 0) {
    gun.ammo = gun.mag;
    gun.reloading = false;
  }
}

/** Fire one round toward (aimX, aimY). Returns true when a bullet left the barrel. */
export function tryShoot(state, aimX, aimY) {
  const gun = state.gun;
  if (gun.reloading) return false;
  if (gun.ammo <= 0) {
    startReload(gun);
    return false;
  }
  if (gun.cooldown > 0) return false;
  gun.ammo -= 1;
  gun.cooldown = GUN.fireInterval;
  const player = state.player;
  let dx = aimX - player.x;
  let dy = aimY - player.y;
  let dist = Math.hypot(dx, dy);
  if (dist < 1) {
    // Aiming at your own feet means straight ahead.
    dx = Math.cos(player.angle);
    dy = Math.sin(player.angle);
    dist = 1;
  }
  state.bullets.push({
    x: player.x + (dx / dist) * 18,
    y: player.y + (dy / dist) * 18,
    vx: (dx / dist) * GUN.bulletSpeed,
    vy: (dy / dist) * GUN.bulletSpeed,
    life: GUN.bulletRange / GUN.bulletSpeed,
    damage: GUN.bulletDamage,
    from: 'player',
  });
  return true;
}

function hitPerson(list, bullet) {
  for (let i = 0; i < list.length; i += 1) {
    const person = list[i];
    const dx = person.x - bullet.x;
    const dy = person.y - bullet.y;
    if (dx * dx + dy * dy < 15 * 15) return { person, index: i };
  }
  return null;
}

/**
 * Advance the player's bullets. Returns the kills that happened, so the world can
 * charge the crimes: { ped: n, cop: n, vulture: n }.
 */
export function updateBullets(state, dt, city) {
  const kills = { ped: 0, cop: 0, vulture: 0 };
  const kept = [];
  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.life <= 0) continue;
    if (pointInBuilding(city, bullet.x, bullet.y)) continue;
    const hitPeople = hitPerson(state.people, bullet);
    const hitCops = hitPeople === null ? hitPerson(state.cops, bullet) : null;
    const hit = hitPeople ?? hitCops;
    if (hit === null) {
      kept.push(bullet);
      continue;
    }
    const person = hit.person;
    person.health -= bullet.damage;
    if (person.health <= 0) {
      if (person.kind === 'ped') {
        kills.ped += 1;
        state.people.splice(hit.index, 1);
      } else if (person.kind === 'vulture') {
        kills.vulture += 1;
        state.people.splice(hit.index, 1);
      } else if (person.kind === 'cop') {
        kills.cop += 1;
        state.cops.splice(hit.index, 1);
      }
    }
  }
  state.bullets = kept;
  return kills;
}

/** Vultures and Interceptors shoot back when the player is close enough. */
export function updateEnemyFire(state, dt, city, random) {
  for (const vulture of state.people) {
    if (vulture.kind !== 'vulture') continue;
    vulture.shootCooldown -= dt;
    const dist = Math.hypot(state.player.x - vulture.x, state.player.y - vulture.y);
    if (vulture.shootCooldown <= 0 && dist < 450) {
      vulture.shootCooldown = 1.4 + random() * 0.6;
      fireEnemyBullet(state, vulture, 8, 0.12, random);
    }
  }
  for (const interceptor of state.interceptors) {
    interceptor.shootCooldown -= dt;
    const dist = Math.hypot(state.player.x - interceptor.x, state.player.y - interceptor.y);
    if (interceptor.shootCooldown <= 0 && dist < 500 && state.player.wanted >= 3) {
      interceptor.shootCooldown = 1.1 + random() * 0.5;
      fireEnemyBullet(state, interceptor, 6, 0.18, random);
    }
  }
}

function fireEnemyBullet(state, shooter, damage, spread, random) {
  const player = state.player;
  // The miss spread comes from the seeded random, never the clock, so a replay
  // of the same seed takes the same shots.
  const angle = Math.atan2(player.y - shooter.y, player.x - shooter.x) + (random() - 0.5) * spread * 2;
  state.enemyBullets.push({
    x: shooter.x + Math.cos(angle) * 20,
    y: shooter.y + Math.sin(angle) * 20,
    vx: Math.cos(angle) * 760,
    vy: Math.sin(angle) * 760,
    life: 1.2,
    damage,
    from: shooter.kind,
  });
}

/**
 * Advance enemy bullets. Returns true when the player was hit down to zero health.
 */
export function updateEnemyBullets(state, dt, city) {
  const player = state.player;
  const kept = [];
  for (const bullet of state.enemyBullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.life <= 0) continue;
    if (pointInBuilding(city, bullet.x, bullet.y)) continue;
    const dx = player.x - bullet.x;
    const dy = player.y - bullet.y;
    if (dx * dx + dy * dy < 16 * 16) {
      player.health -= bullet.damage;
      if (player.health <= 0) {
        player.health = 0;
        state.over = 'wasted';
      }
      continue;
    }
    kept.push(bullet);
  }
  state.enemyBullets = kept;
  return state.over === 'wasted';
}
