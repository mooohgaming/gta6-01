// Drawing only: the world's state and the current screen in, pixels out. A
// camera follows the player (or a fixed point the screenshot scenes set),
// the city draws under it, and the HUD and the screen panels draw on top in
// screen space. Every animated effect reads state.time, never the wall clock,
// so the same world always paints the same frame.

import { CITY, FONT, HORIZONTAL, LANDMARKS, PALETTE, ROAD_HALF, VERTICAL, WATER_X } from './config.js';
import { drawHud } from './hud.js';
import { MISSION_DEFS } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_COMPLETE = 'complete';

const SCALE = 0.62;

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const camera = { x: 220, y: 200, scale: SCALE };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
  }

  function viewSize() {
    return { w: canvas.width / (window.devicePixelRatio || 1), h: canvas.height / (window.devicePixelRatio || 1) };
  }

  function updateCamera(state) {
    if (state.camera) {
      camera.x = state.camera.x;
      camera.y = state.camera.y;
      return;
    }
    const view = viewSize();
    const halfW = view.w / 2 / camera.scale;
    const halfH = view.h / 2 / camera.scale;
    camera.x = Math.max(halfW, Math.min(CITY.width - halfW, state.player.x));
    camera.y = Math.max(halfH, Math.min(CITY.height - halfH, state.player.y));
  }

  function text(value, x, y, size, color, align = 'left') {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawCar(x, y, angle, color, w = 44, h = 22) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.fillStyle = color;
    context.fillRect(-w / 2, -h / 2, w, h);
    context.fillStyle = 'rgba(13, 21, 38, 0.55)';
    context.fillRect(-w / 2 + 8, -h / 2 + 3, 12, h - 6);
    context.fillStyle = '#ffe9a8';
    context.fillRect(w / 2 - 4, -h / 2 + 3, 3, 4);
    context.fillRect(w / 2 - 4, h / 2 - 7, 3, 4);
    context.restore();
  }

  function drawWorld(state) {
    const city = state.city;
    // Grass, then the beach and the sea on the east edge.
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, CITY.width, CITY.height);
    context.fillStyle = PALETTE.sand;
    context.fillRect(city.sand.x, 0, city.sand.w, CITY.height);
    context.fillStyle = PALETTE.water;
    context.fillRect(city.water.x, 0, city.water.w, CITY.height);
    // A few wave lines in the sea, placed by the clock of the world.
    context.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    context.lineWidth = 2;
    for (let i = 0; i < 6; i += 1) {
      const y = ((i * 340 + state.time * 12) % CITY.height);
      context.beginPath();
      context.moveTo(WATER_X + 18, y);
      context.lineTo(WATER_X + 70, y);
      context.stroke();
    }
    // Parks.
    for (const park of city.parks) {
      context.fillStyle = PALETTE.park;
      context.fillRect(park.x - park.w / 2, park.y - park.h / 2, park.w, park.h);
      context.fillStyle = '#2a5a34';
      for (let i = 0; i < park.trees; i += 1) {
        const tx = park.x - park.w / 2 + 20 + ((i * 67) % Math.max(40, park.w - 40));
        const ty = park.y - park.h / 2 + 20 + ((i * 43) % Math.max(40, park.h - 40));
        context.beginPath();
        context.arc(tx, ty, 10, 0, Math.PI * 2);
        context.fill();
      }
    }
    // Roads: dark asphalt, lighter sidewalks, dashed centre lines.
    for (const vx of VERTICAL) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(vx - ROAD_HALF - 6, 0, ROAD_HALF * 2 + 12, CITY.height);
      context.fillStyle = PALETTE.road;
      context.fillRect(vx - ROAD_HALF, 0, ROAD_HALF * 2, CITY.height);
    }
    for (const hy of HORIZONTAL) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(0, hy - ROAD_HALF - 6, CITY.width, ROAD_HALF * 2 + 12);
      context.fillStyle = PALETTE.road;
      context.fillRect(0, hy - ROAD_HALF, CITY.width, ROAD_HALF * 2);
    }
    context.strokeStyle = PALETTE.roadLine;
    context.lineWidth = 2;
    context.setLineDash([18, 22]);
    for (const vx of VERTICAL) {
      context.beginPath();
      context.moveTo(vx, 0);
      context.lineTo(vx, CITY.height);
      context.stroke();
    }
    for (const hy of HORIZONTAL) {
      context.beginPath();
      context.moveTo(0, hy);
      context.lineTo(CITY.width, hy);
      context.stroke();
    }
    context.setLineDash([]);
    // Buildings.
    for (const b of city.buildings) {
      context.fillStyle = b.landmark ? PALETTE.landmark : PALETTE.building;
      context.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
      context.fillStyle = b.landmark ? PALETTE.landmarkRoof : b.roof;
      context.fillRect(b.x - b.w / 2 + 6, b.y - b.h / 2 + 6, b.w - 12, b.h - 12);
      if (b.landmark) {
        context.strokeStyle = '#f2c94c';
        context.lineWidth = 3;
        context.strokeRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
      }
    }
    // Landmark names, in screen space so they stay readable.
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    const view = viewSize();
    const ratio = window.devicePixelRatio || 1;
    for (const key of Object.keys(LANDMARKS)) {
      const lm = LANDMARKS[key];
      const sx = (lm.x - camera.x) * camera.scale + view.w / 2;
      const sy = (lm.y - camera.y) * camera.scale + view.h / 2;
      if (sx < -80 || sx > view.w + 80 || sy < -30 || sy > view.h + 30) continue;
      context.font = `600 13px ${FONT}`;
      context.textAlign = 'center';
      context.fillStyle = 'rgba(13, 21, 38, 0.75)';
      const w = context.measureText(lm.name).width + 14;
      context.fillRect(sx - w / 2, sy - 24, w, 20);
      context.fillStyle = '#ffe9a8';
      context.fillText(lm.name, sx, sy - 9);
    }
    context.restore();
    // Pickups, bobbing on the world's own clock.
    for (const p of state.pickups) {
      if (p.taken) continue;
      const bob = Math.sin(state.time * 3 + p.bob) * 3;
      context.fillStyle = p.kind === 'cash' ? PALETTE.cash : p.kind === 'health' ? PALETTE.health : PALETTE.ammo;
      context.beginPath();
      context.arc(p.x, p.y + bob, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#0d1526';
      context.font = `700 11px ${FONT}`;
      context.textAlign = 'center';
      context.fillText(p.kind === 'cash' ? '$' : p.kind === 'health' ? '+' : 'A', p.x, p.y + bob + 4);
    }
    // Parked cars, then traffic.
    for (const car of state.parked) {
      if (car.taken) continue;
      drawCar(car.x, car.y, car.angle, car.kind === 'comet' ? '#d21f3c' : '#b7c0cc');
    }
    for (const car of state.traffic) drawCar(car.x, car.y, car.angle, car.color);
    for (const car of state.interceptors) drawCar(car.x, car.y, car.angle, '#1d2f7a', 46, 24);
    // People.
    for (const person of state.people) {
      if (person.kind === 'vulture') {
        context.fillStyle = PALETTE.vulture;
        context.beginPath();
        context.arc(person.x, person.y, 13, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#ffffff';
        context.beginPath();
        context.arc(person.x, person.y, 5, 0, Math.PI * 2);
        context.fill();
      } else if (person.down > 0) {
        context.fillStyle = '#c9a227';
        context.beginPath();
        context.arc(person.x, person.y, 10, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillStyle = PALETTE.pedestrian;
        context.beginPath();
        context.arc(person.x, person.y, 9, 0, Math.PI * 2);
        context.fill();
      }
    }
    // Foot cops.
    for (const cop of state.cops) {
      context.fillStyle = PALETTE.cop;
      context.beginPath();
      context.arc(cop.x, cop.y, 12, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(cop.x, cop.y, 5, 0, Math.PI * 2);
      context.fill();
    }
    // Bullets.
    context.strokeStyle = PALETTE.bullet;
    context.lineWidth = 3;
    for (const b of state.bullets) {
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    context.strokeStyle = PALETTE.enemyBullet;
    for (const b of state.enemyBullets) {
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    // The player: a car, or a person with a facing tick.
    const player = state.player;
    if (player.inCar) {
      drawCar(player.x, player.y, player.angle, '#e5534b', 46, 24);
    } else {
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.arc(player.x, player.y, 14, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#0d1526';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(player.x, player.y);
      context.lineTo(player.x + Math.cos(player.angle) * 18, player.y + Math.sin(player.angle) * 18);
      context.stroke();
    }
    // The mission target: a pulsing ring.
    const runner = state.missions.runner;
    if (!runner.done) {
      const def = MISSION_DEFS[runner.index];
      const stage = def.stages[runner.stage];
      const target = stage.target ?? (stage.clearVultures ? { x: LANDMARKS.mall.x, y: LANDMARKS.mall.y } : null);
      if (target) {
        const r = 26 + Math.sin(state.time * 4) * 5;
        context.strokeStyle = '#ffffff';
        context.lineWidth = 3;
        context.beginPath();
        context.arc(target.x, target.y, r, 0, Math.PI * 2);
        context.stroke();
        context.fillStyle = '#ffffff';
        context.beginPath();
        context.arc(target.x, target.y, 5, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawPanel(title, lines, prompt) {
    const view = viewSize();
    const width = 640;
    const height = 150 + lines.length * 30 + 70;
    const x = (view.w - width) / 2;
    const y = (view.h - height) / 2;
    context.fillStyle = 'rgba(23, 30, 44, 0.94)';
    context.fillRect(x, y, width, height);
    context.strokeStyle = '#f2c94c';
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    text(title, view.w / 2, y + 58, 44, PALETTE.text, 'center');
    lines.forEach((line, i) => text(line, view.w / 2, y + 108 + i * 30, 18, PALETTE.muted, 'center'));
    text(prompt, view.w / 2, y + height - 36, 20, PALETTE.cash, 'center');
  }

  function draw(state, screen) {
    updateCamera(state);
    const view = viewSize();
    const ratio = window.devicePixelRatio || 1;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, view.w, view.h);
    context.setTransform(ratio * camera.scale, 0, 0, ratio * camera.scale, ratio * (view.w / 2 - camera.x * camera.scale), ratio * (view.h / 2 - camera.y * camera.scale));
    drawWorld(state);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (screen === SCREEN_TITLE) {
      const save = state.save;
      const lines = [
        'An open-world crime story in a sun-soaked bay city.',
        'Drive, steal cars, outrun the law, run six missions — take Solmar Bay.',
        save ? `Continue: mission ${save.mission + 1} with $${save.cash}  (press C)` : `Best story cash: $${state.best || 0}`,
        '',
        'WASD / arrows drive & walk · Space handbrake · E enter / exit car',
        'F or click shoot · R reload · M mute · P pause',
      ];
      drawPanel('SOLMAR BAY', lines, 'Press Space to start');
      return;
    }
    drawHud(context, state, view.w, view.h);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', ['The city waits for you.'], 'Press P to resume');
    else if (screen === SCREEN_BUSTED) drawPanel('Busted', [`The Bayview police took $${150} off you.`, `Cash now: $${state.player.cash}.`], 'Press Space to walk free');
    else if (screen === SCREEN_WASTED) drawPanel('Wasted', [`The hospital bill was $${100}.`, `Cash now: $${state.player.cash}.`], 'Press Space to get back up');
    else if (screen === SCREEN_COMPLETE) {
      drawPanel('Story Complete', [`You took Solmar Bay. Final cash: $${state.player.cash}.`, `Six missions, $${1980} earned, one city yours.`], 'Press Space to play again');
    }
  }

  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const view = viewSize();
    return {
      x: camera.x + (clientX - rect.left - view.w / 2) / camera.scale,
      y: camera.y + (clientY - rect.top - view.h / 2) / camera.scale,
    };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toWorld, camera };
}
