// The HUD and the live minimap, drawn in the 1280x720 screen space after the
// world. Cash, wanted stars, health, ammo and the current objective; the minimap
// shows the whole city, the player, the law and the mission target.
import { PALETTE } from './config.js';
import { missionTarget, missionText } from './missions.js';

const VIEW_W = 1280;
const VIEW_H = 720;
const MAP_W = 220;
const MAP_H = 176;
const MAP_X = VIEW_W - MAP_W - 16;
const MAP_Y = VIEW_H - MAP_H - 16;

function stars(wanted) {
  let out = '';
  for (let i = 0; i < 5; i += 1) out += i < wanted ? '★' : '☆';
  return out;
}

export function drawHud(ctx, state, screen) {
  ctx.textBaseline = 'top';
  // Cash, top left.
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.gold;
  ctx.textAlign = 'left';
  ctx.fillText(`$${state.player.cash}`, 20, 14);
  // Wanted stars, top centre.
  ctx.font = '30px system-ui, sans-serif';
  ctx.fillStyle = state.player.wanted > 0 ? PALETTE.red : PALETTE.muted;
  ctx.textAlign = 'center';
  ctx.fillText(stars(state.player.wanted), VIEW_W / 2, 14);
  // Health bar, top right.
  const barX = VIEW_W - 220;
  ctx.fillStyle = '#10151f';
  ctx.fillRect(barX, 18, 200, 18);
  ctx.fillStyle = state.player.health > 40 ? PALETTE.green : PALETTE.red;
  ctx.fillRect(barX, 18, Math.max(0, 200 * (state.player.health / 100)), 18);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.text;
  ctx.textAlign = 'right';
  ctx.fillText(`HP ${Math.ceil(state.player.health)}`, barX - 10, 18);
  // Ammo, under the health bar.
  ctx.font = '20px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = state.gun.reloading ? PALETTE.red : PALETTE.text;
  ctx.fillText(state.gun.reloading ? 'RELOADING…' : `AMMO ${state.gun.ammo} / ${state.gun.mag}`, VIEW_W - 20, 44);
  // Mission line, bottom left.
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.text;
  ctx.textAlign = 'left';
  ctx.fillText(missionText(state), 20, VIEW_H - 32);
  // Speed, bottom centre, while driving.
  if (state.player.inCar) {
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`${Math.round(Math.abs(state.player.speed) * 0.36)} km/h`, VIEW_W / 2, VIEW_H - 34);
  }
  drawMinimap(ctx, state);
}

function drawMinimap(ctx, state) {
  const scaleX = MAP_W / 2560;
  const scaleY = MAP_H / 2080;
  ctx.fillStyle = 'rgba(10, 14, 22, 0.85)';
  ctx.fillRect(MAP_X, MAP_Y, MAP_W, MAP_H);
  ctx.strokeStyle = PALETTE.muted;
  ctx.strokeRect(MAP_X, MAP_Y, MAP_W, MAP_H);
  const px = (x) => MAP_X + x * scaleX;
  const py = (y) => MAP_Y + y * scaleY;
  // Roads.
  ctx.fillStyle = '#3a3f4a';
  for (const road of [200, 600, 1000, 1400, 1800, 2200]) ctx.fillRect(px(road - 32), MAP_Y, 64 * scaleX, MAP_H);
  for (const road of [180, 520, 860, 1200, 1540, 1880]) ctx.fillRect(MAP_X, py(road - 32), MAP_W, 64 * scaleY);
  // Buildings.
  ctx.fillStyle = '#6a7080';
  for (const rect of state.city.buildings) {
    ctx.fillRect(px(rect.x), py(rect.y), Math.max(1, rect.w * scaleX), Math.max(1, rect.h * scaleY));
  }
  // Mission target.
  const target = missionTarget(state);
  if (target) {
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.arc(px(target.x), py(target.y), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.arc(px(target.x), py(target.y), 9, 0, Math.PI * 2);
    ctx.stroke();
  }
  // The law.
  ctx.fillStyle = '#4a90e2';
  for (const cop of state.cops) {
    ctx.fillRect(px(cop.x) - 2, py(cop.y) - 2, 4, 4);
  }
  for (const car of state.interceptors) {
    ctx.fillRect(px(car.x) - 2, py(car.y) - 2, 4, 4);
  }
  // The player.
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(px(state.player.x), py(state.player.y), 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.text;
  ctx.beginPath();
  ctx.arc(px(state.player.x), py(state.player.y), 6, 0, Math.PI * 2);
  ctx.stroke();
}
