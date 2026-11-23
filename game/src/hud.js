// The HUD: health and cash, the wanted stars, the mission objective, the
// speedometer and ammo — and the minimap, a live top-down sketch of the
// city with the player, the mission marker, the police and the traffic.
import { WORLD } from './config.js';
import { roadLines } from './city.js';

function drawStars(c, x, y, stars, max) {
  c.font = '22px sans-serif';
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  for (let i = 0; i < max; i += 1) {
    c.fillStyle = i < stars ? '#ffd94d' : 'rgba(255,255,255,0.25)';
    c.fillText('★', x + i * 26, y);
  }
}

function drawMinimap(c, state, x, y, w, h) {
  const sx = w / WORLD.width;
  const sy = h / WORLD.height;
  c.fillStyle = 'rgba(16,26,16,0.88)';
  c.fillRect(x, y, w, h);
  c.strokeStyle = 'rgba(255,255,255,0.4)';
  c.lineWidth = 1;
  c.strokeRect(x, y, w, h);
  // Roads.
  c.strokeStyle = '#a8a08c';
  c.lineWidth = 4;
  const { verticals, horizontals } = roadLines();
  for (const rx of verticals) {
    c.beginPath();
    c.moveTo(x + rx * sx, y);
    c.lineTo(x + rx * sx, y + h);
    c.stroke();
  }
  for (const ry of horizontals) {
    c.beginPath();
    c.moveTo(x, y + ry * sy);
    c.lineTo(x + w, y + ry * sy);
    c.stroke();
  }
  // Beach and water along the bottom edge.
  c.fillStyle = '#e8cf96';
  c.fillRect(x, y + 1780 * sy, w, 140 * sy);
  c.fillStyle = '#2e7f9e';
  c.fillRect(x, y + 1880 * sy, w, 40 * sy);
  // Mission target.
  const m = state.missions.manager;
  if (m.target) {
    c.fillStyle = '#ffd94d';
    c.beginPath();
    c.arc(x + m.target.x * sx, y + m.target.y * sy, 6, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#ffd94d';
    c.beginPath();
    c.arc(x + m.target.x * sx, y + m.target.y * sy, 10, 0, Math.PI * 2);
    c.stroke();
  }
  // Traffic as grey dots, chase cars red, foot cops blue.
  c.fillStyle = '#b9b2a4';
  for (const car of state.cars) {
    if (car.traffic) c.fillRect(x + car.x * sx - 1, y + car.y * sy - 1, 3, 3);
  }
  c.fillStyle = '#ff3b30';
  for (const car of state.chaseCars) {
    c.beginPath();
    c.arc(x + car.x * sx, y + car.y * sy, 4, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = '#5aa2ff';
  for (const cop of state.cops) {
    c.fillRect(x + cop.x * sx - 2, y + cop.y * sy - 2, 4, 4);
  }
  // The player: a white arrow that turns with them.
  const p = state.player;
  c.save();
  c.translate(x + p.x * sx, y + p.y * sy);
  c.rotate(p.angle);
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.moveTo(8, 0);
  c.lineTo(-6, -5);
  c.lineTo(-6, 5);
  c.closePath();
  c.fill();
  c.restore();
}

export function drawHUD(c, state, viewW, viewH, paused) {
  const p = state.player;
  const m = state.missions.manager;
  c.textBaseline = 'alphabetic';

  // Top-left: health bar and cash.
  c.fillStyle = 'rgba(10,10,14,0.6)';
  c.fillRect(14, 14, 220, 58);
  c.fillStyle = '#fff3d6';
  c.font = 'bold 15px sans-serif';
  c.textAlign = 'left';
  c.fillText('RICO VEGA', 24, 34);
  c.fillStyle = '#3a3a3a';
  c.fillRect(24, 42, 140, 12);
  c.fillStyle = p.health > 30 ? '#3aff7a' : '#ff5a5a';
  c.fillRect(24, 42, 140 * Math.max(0, p.health / 100), 12);
  c.fillStyle = '#3aff7a';
  c.font = 'bold 18px sans-serif';
  c.fillText(`$${p.cash}`, 176, 55);

  // Top-right: wanted stars and the clock.
  drawStars(c, viewW - 150, 30, p.stars, 5);
  c.fillStyle = '#fff3d6';
  c.font = '15px sans-serif';
  c.textAlign = 'right';
  const minutes = Math.floor(state.time / 60);
  const seconds = Math.floor(state.time % 60);
  c.fillText(`SOLMAR ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`, viewW - 16, 58);

  // Bottom-centre: the mission objective.
  c.textAlign = 'center';
  const obj = m.objective;
  c.font = '16px sans-serif';
  const tw = c.measureText(obj).width;
  c.fillStyle = 'rgba(10,10,14,0.65)';
  c.fillRect(viewW / 2 - tw / 2 - 14, viewH - 86, tw + 28, 30);
  c.fillStyle = '#ffd94d';
  c.fillText(obj, viewW / 2, viewH - 65);

  // Bottom-right: speed and ammo, or the pistol's state on foot.
  c.textAlign = 'right';
  if (p.car) {
    const mph = Math.round(Math.abs(p.car.speed) * 0.12);
    c.fillStyle = '#fff3d6';
    c.font = 'bold 26px sans-serif';
    c.fillText(`${mph} mph`, viewW - 16, viewH - 100);
    c.font = '14px sans-serif';
    c.fillText(`${p.car.model}  •  ${Math.max(0, Math.round(p.car.health))}%`, viewW - 16, viewH - 78);
  } else {
    c.fillStyle = '#fff3d6';
    c.font = 'bold 20px sans-serif';
    c.fillText(`AMMO ${p.ammo} / ${p.reserve}`, viewW - 16, viewH - 100);
    if (p.reloadTimer > 0) {
      c.font = '14px sans-serif';
      c.fillText('RELOADING…', viewW - 16, viewH - 78);
    }
  }

  // Bottom-left: the minimap.
  drawMinimap(c, state, 14, viewH - 180, 220, 165);

  // A car nearby on foot: the prompt to steal it.
  if (!p.car && !paused) {
    let near = null;
    for (const car of [...state.cars, ...state.chaseCars]) {
      if (Math.hypot(car.x - p.x, car.y - p.y) < 64) {
        near = car;
        break;
      }
    }
    if (near) {
      c.textAlign = 'center';
      c.fillStyle = '#ffd94d';
      c.font = 'bold 17px sans-serif';
      c.fillText(`Press E to take the ${near.model}`, viewW / 2, viewH - 100);
    }
  }
  // No active mission: the prompt to start the next job.
  if (!m.active && !m.done && !paused) {
    c.textAlign = 'center';
    c.fillStyle = '#ffd94d';
    c.font = 'bold 17px sans-serif';
    c.fillText('Press E to start the next job', viewW / 2, viewH - 122);
  }
}
