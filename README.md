# Solmar Bay
[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/mooohgaming/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/mooohgaming/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the spirit of GTA 6, set in the sunset city of Solmar Bay. Made for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01).

## The story

Rico Vega just rolled into Solmar Bay with $120 and a busted scooter. Mama Rosa runs the cafe on Coral Row and she has work. The Vultures gang has the streets. The Bayview PD has everyone. Six jobs stand between Rico and the Golden Palm Casino heist — and the whole city is open while he gets there.

## How to run it

No build step, no network, no libraries. Serve the `game/` folder with any static server and open it in a desktop browser:

```sh
node serve.ts
# open http://localhost:8080
```

Or open `game/index.html` directly from disk — every file the game loads sits under `game/`.

## Controls

| Key | Action |
|---|---|
| WASD / Arrow keys | Move on foot, drive in a car |
| Mouse | Aim the pistol |
| Click | Shoot |
| E | Steal or enter a car / start the next job |
| F | Punch |
| R | Reload |
| Shift | Run |
| P or Esc | Pause |
| M | Mute |

## Features

- **A complete open world**: Solmar Bay is a 2560×2080 city with a road grid, traffic, pedestrians, parks, parking lots, a beach and a marina, plus six named landmarks — the Golden Palm Casino, Mama Rosa's Cafe, Solmar General Hospital, Bayview Police HQ, Sunset Mall and Marina Towers.
- **On foot and by car**: walk, run, punch, shoot, and steal any of the parked or traffic cars — witnesses call the cops.
- **Wanted system**: 0–5 stars. Foot cops chase and try to bust you, police Interceptors ram your car, and the heat only dies down when nobody can see you. Getting busted costs cash and your ride; getting wasted costs a hospital bill.
- **Six story missions**: a welcome job, a timed pizza run, a car theft, losing a three-star tail, a turf war at the cafe, and the Golden Palm heist — with a waypoint marker, a minimap, and a free-roam ending.
- **Combat**: pistol with ammo and reloads, punches, car explosions, and health, ammo and cash pickups scattered around the city.
- **HUD and minimap**: health, cash, wanted stars, speedometer, mission objective, and a live minimap showing the player, the mission marker, traffic and the police.
- **Save and continue**: cash, missions and position are saved to localStorage, so the story picks up where it stopped.
- **Sound, synthesised live**: engine hum, police sirens, gunfire and a bassline — all WebAudio, no audio files.
- **Deterministic screenshots**: `?shot=downtown|chase|beach|cafe&seed=1` stages a real scene by playing the game's own rules forward, so every screenshot is a genuine render of the game.

## Credits

Solmar Bay, Rico Vega, Mama Rosa, the Vultures and every street, car and song in it are original work, made for this bounty. Nothing here comes from Rockstar Games.
