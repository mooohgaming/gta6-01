// The renderer: paints the pre-rendered city layer, then every moving
// thing on top of it, then the screens. One canvas, no images, no
// network — everything is drawn from shapes.
import { WORLD } from './config.js';
import { drawHUD } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_COMPLETE = 'complete';

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function drawCarShape(c, car, isPlayer, time) {
  c.save();
  c.translate(car.x, car.y);
  c.rotate(car.angle);
  // Shadow.
  c.fillStyle = 'rgba(20,10,5,0.3)';
  roundRect(c, -28 + 4, -13 + 5, 56, 26, 8);
  c.fill();
  // Body.
  c.fillStyle = car.color;
  roundRect(c, -28, -13, 56, 26, 8);
  c.fill();
  // Roof and windows.
  c.fillStyle = 'rgba(20,30,45,0.85)';
  roundRect(c, -8, -11, 20, 22, 5);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.25)';
  c.fillRect(-6, -11, 4, 22);
  // Wheels.
  c.fillStyle = '#16181c';
  c.fillRect(-20, -16, 12, 5);
  c.fillRect(-20, 11, 12, 5);
  c.fillRect(10, -16, 12, 5);
  c.fillRect(10, 11, 12, 5);
  // Headlights and brake lights.
  c.fillStyle = '#fff6c9';
  c.fillRect(26, -10, 3, 5);
  c.fillRect(26, 5, 3, 5);
  if (car.brakeLight) {
    c.fillStyle = '#ff2e2e';
    c.fillRect(-29, -10, 3, 5);
    c.fillRect(-29, 5, 3, 5);
  }
  if (car.police) {
    c.fillStyle = '#e8e4da';
    c.fillRect(-6, -13, 14, 26);
    // Flashing light bar, driven by world time so a scene is deterministic.
    const phase = Math.floor(time * 5.5) % 2 === 0;
    c.fillStyle = phase ? '#ff2e2e' : '#2e6fff';
    c.fillRect(-12, -13, 8, 5);
    c.fillStyle = phase ? '#2e6fff' : '#ff2e2e';
    c.fillRect(-12, 8, 8, 5);
  }
  if (car.smoke > 0) {
    c.fillStyle = 'rgba(80,80,80,0.5)';
    c.beginPath();
    c.arc(-24, 0, 8 + car.smoke * 6, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
  if (isPlayer) {
    c.strokeStyle = '#ffd94d';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(car.x, car.y, 36, 0, Math.PI * 2);
    c.stroke();
  }
}

function drawPerson(c, x, y, angle, color, radius, dead) {
  if (dead) {
    c.fillStyle = '#8a2f2f';
    c.beginPath();
    c.arc(x, y, radius, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#5c1d1d';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x - radius, y - radius);
    c.lineTo(x + radius, y + radius);
    c.moveTo(x + radius, y - radius);
    c.lineTo(x - radius, y + radius);
    c.stroke();
    return;
  }
  c.fillStyle = 'rgba(20,10,5,0.3)';
  c.beginPath();
  c.arc(x + 3, y + 4, radius, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, radius, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#f2c89b';
  c.beginPath();
  c.arc(x + Math.cos(angle) * 5, y + Math.sin(angle) * 5, radius * 0.55, 0, Math.PI * 2);
  c.fill();
}

function drawScreenTitle(c, w, h, state, best) {
  c.fillStyle = 'rgba(20,8,20,0.72)';
  c.fillRect(0, 0, w, h);
  c.textAlign = 'center';
  c.fillStyle = '#ffb347';
  c.font = 'bold 64px sans-serif';
  c.fillText('SOLMAR BAY', w / 2, h * 0.24);
  c.fillStyle = '#fff3d6';
  c.font = '22px sans-serif';
  c.fillText('An open-world crime story in the spirit of GTA 6', w / 2, h * 0.24 + 36);
  c.font = '17px sans-serif';
  c.fillStyle = '#e8dcc0';
  const lines = [
    'Rico Vega just rolled into Solmar Bay with $120 and a busted scooter.',
    'Mama Rosa has work. The Vultures have the streets. The cops have everyone.',
    '',
    'WASD / Arrows — move and drive    E — steal a car / start a job    Mouse — aim, Click — shoot',
    'F — punch    R — reload    Shift — run    P — pause    M — mute',
    '',
    'Steal cars, run missions, dodge the law. Save with the game — it keeps your cash and progress.',
  ];
  lines.forEach((line, i) => c.fillText(line, w / 2, h * 0.42 + i * 26));
  c.fillStyle = '#ffd94d';
  c.font = 'bold 24px sans-serif';
  c.fillText('Press SPACE or CLICK to start', w / 2, h * 0.78);
  if (best > 0) {
    c.fillStyle = '#fff3d6';
    c.font = '17px sans-serif';
    c.fillText(`Best take: $${best}`, w / 2, h * 0.78 + 32);
  }
}

function drawScreenText(c, w, h, title, sub, color) {
  c.fillStyle = 'rgba(15,8,18,0.66)';
  c.fillRect(0, 0, w, h);
  c.textAlign = 'center';
  c.fillStyle = color;
  c.font = 'bold 56px sans-serif';
  c.fillText(title, w / 2, h * 0.42);
  c.fillStyle = '#fff3d6';
  c.font = '20px sans-serif';
  c.fillText(sub, w / 2, h * 0.42 + 40);
  c.fillStyle = '#ffd94d';
  c.font = 'bold 22px sans-serif';
  c.fillText('Press SPACE or CLICK to continue', w / 2, h * 0.62);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let viewW = 1280;
  let viewH = 720;

  function resize() {
    viewW = canvas.clientWidth || window.innerWidth;
    viewH = canvas.clientHeight || window.innerHeight;
    canvas.width = viewW;
    canvas.height = viewH;
  }
  window.addEventListener('resize', resize);
  resize();

  function zoom() {
    return Math.max(viewW / 1100, viewH / 760);
  }

  return {
    get viewW() {
      return viewW;
    },
    get viewH() {
      return viewH;
    },
    get zoom() {
      return zoom();
    },
    draw(state, screen, best) {
      const z = zoom();
      const cam = state.camera;
      const shakeX = cam.shake ? (Math.random() - 0.5) * cam.shake : 0;
      const shakeY = cam.shake ? (Math.random() - 0.5) * cam.shake : 0;
      ctx.fillStyle = '#1a1218';
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.save();
      ctx.translate(viewW / 2 - cam.x * z + shakeX, viewH / 2 - cam.y * z + shakeY);
      ctx.scale(z, z);
      // The city layer, clipped to the visible region.
      const vx = cam.x - viewW / 2 / z - 40;
      const vy = cam.y - viewH / 2 / z - 40;
      const vw = viewW / z + 80;
      const vh = viewH / z + 80;
      if (state.layer) {
        ctx.drawImage(state.layer, vx, vy, vw, vh, vx, vy, vw, vh);
      }
      // Mission target marker on the ground.
      const m = state.missions.manager;
      if (m.target) {
        const pulse = 1 + Math.sin(state.time * 4) * 0.12;
        ctx.strokeStyle = '#ffd94d';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(m.target.x, m.target.y, 26 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffd94d';
        ctx.beginPath();
        ctx.moveTo(m.target.x, m.target.y - 34);
        ctx.lineTo(m.target.x - 8, m.target.y - 52);
        ctx.lineTo(m.target.x + 8, m.target.y - 52);
        ctx.closePath();
        ctx.fill();
      }
      // Pickups.
      for (const pk of state.pickups) {
        ctx.fillStyle = pk.kind === 'health' ? '#ff5a5a' : pk.kind === 'ammo' ? '#ffd94d' : '#3aff7a';
        ctx.beginPath();
        ctx.arc(pk.x, pk.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a1218';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pk.kind === 'health' ? '+' : pk.kind === 'ammo' ? 'A' : '$', pk.x, pk.y);
      }
      // Skid marks and particles.
      for (const pt of state.particles) {
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Cars: parked and traffic, then chase cars, then the player's car.
      for (const car of state.cars) drawCarShape(ctx, car, false, state.time);
      for (const car of state.chaseCars) drawCarShape(ctx, car, false, state.time);
      if (state.player.car) drawCarShape(ctx, state.player.car, true, state.time);
      // People.
      for (const ped of state.peds) drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, 10, ped.dead);
      for (const cop of state.cops) drawPerson(ctx, cop.x, cop.y, cop.angle, '#1a2a5e', 11, false);
      for (const g of state.gang) drawPerson(ctx, g.x, g.y, g.angle, '#5e1a2a', 11, g.health <= 0);
      // The player on foot.
      if (!state.player.car) {
        drawPerson(ctx, state.player.x, state.player.y, state.player.angle, '#ff8c1a', 13, false);
        if (state.player.ammo > 0 || state.player.reserve > 0) {
          ctx.strokeStyle = '#22242a';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(state.player.x + Math.cos(state.player.angle) * 14, state.player.y + Math.sin(state.player.angle) * 14);
          ctx.lineTo(state.player.x + Math.cos(state.player.angle) * 26, state.player.y + Math.sin(state.player.angle) * 26);
          ctx.stroke();
        }
      }
      // Bullets as short tracers.
      ctx.strokeStyle = '#ffe9a8';
      ctx.lineWidth = 3;
      for (const b of state.bullets) {
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
        ctx.stroke();
      }
      ctx.restore();

      // HUD and screens live in screen space.
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHUD(ctx, state, viewW, viewH, screen === SCREEN_PAUSED);
      if (screen === SCREEN_TITLE) drawScreenTitle(ctx, viewW, viewH, state, best);
      else if (screen === SCREEN_PAUSED) {
        ctx.fillStyle = 'rgba(15,8,18,0.55)';
        ctx.fillRect(0, 0, viewW, viewH);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff3d6';
        ctx.font = 'bold 48px sans-serif';
        ctx.fillText('PAUSED', viewW / 2, viewH * 0.42);
        ctx.font = '20px sans-serif';
        ctx.fillText('Press P or SPACE to keep playing', viewW / 2, viewH * 0.42 + 40);
      } else if (screen === SCREEN_BUSTED) {
        drawScreenText(ctx, viewW, viewH, 'BUSTED', 'The Bayview PD took your cash and your ride. Mama Rosa is not impressed.', '#7fb2ff');
      } else if (screen === SCREEN_WASTED) {
        drawScreenText(ctx, viewW, viewH, 'WASTED', 'You woke up at Solmar General with a hospital bill.', '#ff5a5a');
      } else if (screen === SCREEN_OVER) {
        drawScreenText(ctx, viewW, viewH, 'GAME OVER', 'Solmar Bay keeps your best take. Press SPACE to play again.', '#ffd94d');
      } else if (screen === SCREEN_COMPLETE) {
        drawScreenText(ctx, viewW, viewH, 'STORY COMPLETE', 'The Golden Palm is yours. Solmar Bay belongs to Rico Vega now.', '#3aff7a');
      }
    },
  };
}
