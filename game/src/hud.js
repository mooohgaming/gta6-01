// The HUD: cash and the current mission, wanted stars, health and ammo, and
// the live minimap — the whole city at a glance, with the player, the law
// and the mission marker on it.

import { CITY, FONT, HORIZONTAL, LANDMARKS, PALETTE, VERTICAL } from './config.js';
import { MISSION_DEFS } from './missions.js';

const MAP = { w: 216, h: 176 };

export function drawHud(ctx, state, viewW, viewH) {
  const player = state.player;
  const runner = state.missions.runner;
  ctx.textBaseline = 'top';

  // Cash and mission, top left.
  ctx.fillStyle = 'rgba(13, 21, 38, 0.72)';
  ctx.fillRect(14, 14, 340, 78);
  ctx.fillStyle = PALETTE.cash;
  ctx.font = `700 26px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`$${player.cash.toLocaleString('en-US')}`, 28, 22);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `600 15px ${FONT}`;
  const mission = runner.done ? 'Story complete' : `${runner.index + 1}. ${MISSION_DEFS[runner.index].name}`;
  ctx.fillText(mission, 28, 52);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `13px ${FONT}`;
  const objective = runner.done ? 'Solmar Bay is yours.' : MISSION_DEFS[runner.index].text;
  ctx.fillText(objective, 28, 72);

  // Wanted stars, top right (left of the minimap).
  ctx.textAlign = 'right';
  ctx.font = `26px ${FONT}`;
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < player.wanted ? PALETTE.star : 'rgba(238, 241, 245, 0.22)';
    ctx.fillText('★', viewW - MAP.w - 34 - i * 30, 20);
  }

  // Health and ammo, bottom left.
  ctx.fillStyle = 'rgba(13, 21, 38, 0.72)';
  ctx.fillRect(14, viewH - 64, 280, 50);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `600 13px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('HEALTH', 28, viewH - 56);
  ctx.fillStyle = '#3a4356';
  ctx.fillRect(28, viewH - 36, 150, 12);
  ctx.fillStyle = player.health > 35 ? PALETTE.cash : PALETTE.health;
  ctx.fillRect(28, viewH - 36, 150 * (player.health / 100), 12);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `600 15px ${FONT}`;
  ctx.fillText(player.inCar ? 'IN CAR' : 'ON FOOT', 196, viewH - 52);
  ctx.fillStyle = PALETTE.ammo;
  ctx.fillText(`◉ ${state.gun.ammo}/12${state.gun.reloading ? ' …' : ''}`, 196, viewH - 30);

  drawMinimap(ctx, state, viewW, viewH);
}

function drawMinimap(ctx, state, viewW, viewH) {
  const x0 = viewW - MAP.w - 14;
  const y0 = 54;
  const sx = MAP.w / CITY.width;
  const sy = MAP.h / CITY.height;
  ctx.fillStyle = 'rgba(13, 21, 38, 0.78)';
  ctx.fillRect(x0 - 6, y0 - 6, MAP.w + 12, MAP.h + 12);
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0, y0, MAP.w, MAP.h);
  // Water on the east edge.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(x0 + 2440 * sx, y0, MAP.w - 2440 * sx, MAP.h);
  // Roads.
  ctx.strokeStyle = PALETTE.road;
  ctx.lineWidth = 2;
  for (const vx of VERTICAL) {
    ctx.beginPath();
    ctx.moveTo(x0 + vx * sx, y0);
    ctx.lineTo(x0 + vx * sx, y0 + MAP.h);
    ctx.stroke();
  }
  for (const hy of HORIZONTAL) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + hy * sy);
    ctx.lineTo(x0 + MAP.w, y0 + hy * sy);
    ctx.stroke();
  }
  // Landmarks.
  ctx.fillStyle = PALETTE.landmark;
  for (const key of Object.keys(LANDMARKS)) {
    const lm = LANDMARKS[key];
    ctx.fillRect(x0 + lm.x * sx - 2, y0 + lm.y * sy - 2, 4, 4);
  }
  // The mission target pulses.
  const runner = state.missions.runner;
  if (!runner.done) {
    const def = MISSION_DEFS[runner.index];
    const stage = def.stages[runner.stage];
    const target = stage.target ?? (stage.clearVultures ? { x: LANDMARKS.mall.x, y: LANDMARKS.mall.y } : null);
    if (target) {
      const pulse = 3 + Math.sin(state.time * 4) * 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x0 + target.x * sx, y0 + target.y * sy, pulse + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x0 + target.x * sx, y0 + target.y * sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Cops and interceptors, then the player on top.
  ctx.fillStyle = PALETTE.cop;
  for (const cop of state.cops) ctx.fillRect(x0 + cop.x * sx - 1.5, y0 + cop.y * sy - 1.5, 3, 3);
  for (const car of state.interceptors) ctx.fillRect(x0 + car.x * sx - 1.5, y0 + car.y * sy - 1.5, 3, 3);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x0 + state.player.x * sx, y0 + state.player.y * sy, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.player;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x0 + state.player.x * sx, y0 + state.player.y * sy, 5.5, 0, Math.PI * 2);
  ctx.stroke();
}
