// Drawing only: the world's state and the current screen in, pixels out. A camera
// follows the player through the 2560x2080 city and shows a 1280x720 window of
// it, scaled to fit the browser window. Flat shapes and canvas text, no assets.
import { BEACH_Y, FONT, MARINA_X, PALETTE, WORLD } from './config.js';
import { drawHud } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_COMPLETE = 'complete';

const VIEW_W = 1280;
const VIEW_H = 720;

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  let lastPlayer = { x: 1400, y: 1200 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    view.x = (canvas.width - VIEW_W * view.scale) / 2;
    view.y = (canvas.height - VIEW_H * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${weight ?? ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ?? ''} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawGround(state) {
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    // Beach along the south edge, water along the east edge.
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, BEACH_Y, WORLD.width, WORLD.height - BEACH_Y);
    context.fillStyle = PALETTE.water;
    context.fillRect(MARINA_X, 0, WORLD.width - MARINA_X, BEACH_Y);
    // Parks and their trees.
    for (const park of state.city.parks) {
      context.fillStyle = PALETTE.park;
      context.fillRect(park.x, park.y, park.w, park.h);
    }
    for (const tree of state.city.trees) {
      context.fillStyle = PALETTE.tree;
      context.beginPath();
      context.arc(tree.x, tree.y, 9, 0, Math.PI * 2);
      context.fill();
    }
    // Roads, with a sidewalk strip on each side and a dashed centre line.
    for (const road of [200, 600, 1000, 1400, 1800, 2200]) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(road - 46, 0, 92, WORLD.height);
      context.fillStyle = PALETTE.road;
      context.fillRect(road - 32, 0, 64, WORLD.height);
      context.fillStyle = PALETTE.roadLine;
      for (let y = 20; y < WORLD.height; y += 80) context.fillRect(road - 2, y, 4, 36);
    }
    for (const road of [180, 520, 860, 1200, 1540, 1880]) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(0, road - 46, WORLD.width, 92);
      context.fillStyle = PALETTE.road;
      context.fillRect(0, road - 32, WORLD.width, 64);
      context.fillStyle = PALETTE.roadLine;
      for (let x = 20; x < WORLD.width; x += 80) context.fillRect(x, road - 2, 36, 4);
    }
  }

  function drawBuildings(state) {
    for (const rect of state.city.buildings) {
      context.fillStyle = PALETTE[rect.color] ?? PALETTE.building;
      context.fillRect(rect.x, rect.y, rect.w, rect.h);
      context.fillStyle = PALETTE.buildingRoof;
      context.fillRect(rect.x + 6, rect.y + 6, rect.w - 12, rect.h - 12);
      if (rect.name) {
        context.textBaseline = 'middle';
        text(rect.name, rect.x + rect.w / 2, rect.y + rect.h / 2, 15, PALETTE.text, 'center', 'bold');
      }
    }
  }

  function drawPickups(state) {
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      if (pickup.kind === 'cash') {
        context.fillStyle = PALETTE.gold;
        context.beginPath();
        context.arc(pickup.x, pickup.y, 10, 0, Math.PI * 2);
        context.fill();
        text('$', pickup.x, pickup.y, 14, '#3a2c00', 'center', 'bold');
      } else if (pickup.kind === 'health') {
        context.fillStyle = PALETTE.green;
        context.fillRect(pickup.x - 10, pickup.y - 4, 20, 8);
        context.fillRect(pickup.x - 4, pickup.y - 10, 8, 20);
      } else {
        context.fillStyle = PALETTE.bullet;
        context.fillRect(pickup.x - 9, pickup.y - 7, 18, 14);
        context.fillStyle = '#3a2c00';
        context.fillRect(pickup.x - 5, pickup.y - 3, 10, 6);
      }
    }
  }

  function drawCar(car) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = PALETTE[car.color] ?? PALETTE.traffic;
    context.fillRect(-20, -10, 40, 20);
    context.fillStyle = '#1c2733';
    context.fillRect(-4, -9, 12, 18);
    if (car.driven) {
      context.strokeStyle = PALETTE.player;
      context.lineWidth = 2;
      context.strokeRect(-22, -12, 44, 24);
    }
    context.restore();
  }

  function drawPerson(person) {
    context.fillStyle = PALETTE[person.color] ?? PALETTE.ped;
    context.beginPath();
    context.arc(person.x, person.y, person.kind === 'vulture' ? 11 : 8, 0, Math.PI * 2);
    context.fill();
    if (person.kind === 'vulture') {
      context.fillStyle = PALETTE.red;
      context.beginPath();
      context.arc(person.x, person.y, 4, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    if (player.inCar) return; // The driven car is drawn with the cars.
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(player.x, player.y, 10, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.text;
    context.beginPath();
    context.moveTo(player.x, player.y);
    context.lineTo(player.x + Math.cos(player.angle) * 16, player.y + Math.sin(player.angle) * 16);
    context.stroke();
  }

  function drawBullets(state) {
    context.fillStyle = PALETTE.bullet;
    for (const bullet of state.bullets) {
      context.beginPath();
      context.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = PALETTE.enemyBullet;
    for (const bullet of state.enemyBullets) {
      context.beginPath();
      context.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawPanel(title, lines, prompt) {
    context.fillStyle = 'rgba(10, 14, 22, 0.72)';
    context.fillRect(0, 0, VIEW_W, VIEW_H);
    const width = 680;
    const height = 150 + lines.length * 34;
    const x = (VIEW_W - width) / 2;
    const y = (VIEW_H - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    context.textBaseline = 'alphabetic';
    text(title, VIEW_W / 2, y + 72, 44, PALETTE.text, 'center', 'bold');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW_W / 2, y + 120 + i * 34, 20, PALETTE.muted, 'center');
    }
    text(prompt, VIEW_W / 2, y + height - 28, 22, PALETTE.gold, 'center');
  }

  function draw(state, screen) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    // Camera: centred on the player, clamped inside the city.
    const player = state.player;
    lastPlayer = player;
    const camX = Math.max(VIEW_W / 2, Math.min(WORLD.width - VIEW_W / 2, player.x));
    const camY = Math.max(VIEW_H / 2, Math.min(WORLD.height - VIEW_H / 2, player.y));
    context.setTransform(view.scale, 0, 0, view.scale, view.x - (camX - VIEW_W / 2) * view.scale, view.y - (camY - VIEW_H / 2) * view.scale);
    drawGround(state);
    drawBuildings(state);
    drawPickups(state);
    for (const car of state.parked) drawCar(car);
    for (const car of state.traffic) drawCar(car);
    for (const car of state.interceptors) drawCar(car);
    for (const person of state.people) drawPerson(person);
    for (const cop of state.cops) drawPerson(cop);
    drawPlayer(state);
    drawBullets(state);
    // Back to screen space for the HUD and the panels.
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(context, state, screen);
    if (screen === SCREEN_TITLE) {
      drawPanel('SOLMAR BAY', [
        'An open-world crime game in the spirit of GTA 6.',
        'Drive, steal cars, outrun the law and run six jobs',
        'from Mama Rosa\u2019s Cafe to the Golden Palm heist.',
        'WASD drive · E enter a car · F shoot · R reload · P pause',
      ], 'Press Space or click to start');
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The city waits for you.'], 'Press P to resume');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The law caught up with you. Fine: $150.', 'You wake up at Bayview Police HQ.'], 'Press Space to get back out there');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['You flatlined. Hospital bill: $100.', 'You wake up at Solmar General Hospital.'], 'Press Space to get back out there');
    } else if (screen === SCREEN_COMPLETE) {
      drawPanel('STORY COMPLETE', [
        'All six jobs done. The Golden Palm vault is empty',
        `and Solmar Bay is yours. Final cash: $${state.player.cash}.`,
      ], 'Press Space to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return {
    draw,
    /** The camera the last draw used, for converting pointer positions to world coordinates. */
    camera() {
      const player = lastPlayer;
      const camX = Math.max(VIEW_W / 2, Math.min(WORLD.width - VIEW_W / 2, player.x));
      const camY = Math.max(VIEW_H / 2, Math.min(WORLD.height - VIEW_H / 2, player.y));
      return { x: camX, y: camY, scale: view.scale, ox: view.x, oy: view.y };
    },
  };
}
