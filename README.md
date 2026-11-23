# Solmar Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/mooohgaming/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/mooohgaming/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the spirit of GTA 6, built for [make.fun's "Make GTA 6" bounty](https://make.fun/bounty/gta6-01). You are a wheelman new to Solmar Bay — a sun-soaked city of casinos, cafés, beaches and bad decisions. Drive, steal cars, outrun the law and run six story missions to take the city.

## What is in the city

- A seeded, deterministic city (2560×2080) with a road grid, traffic, pedestrians, parks, a beach and a marina — plus six named landmarks: Golden Palm Casino, Mama Rosa's Cafe, Solmar General Hospital, Bayview Police HQ, Sunset Mall and Marina Towers.
- Arcade driving with 26 traffic cars and stealable parked cars, including the red Comet GT.
- A wanted system, 0–5 stars: foot cops who arrest you, police Interceptors that ram and shoot at 3+ stars, heat that decays once you break line of sight. Busted costs $150, wasted costs $100.
- A six-mission story arc paying $1,980 in total: a cafe job, a pizza run, a grand theft Comet, losing a three-star tail, a turf war against eight Vultures, and the Golden Palm heist.
- Pistol combat (12-round magazine, reload), cash, health and ammo pickups, a HUD with a live minimap, localStorage save/continue, title, pause, busted, wasted and story-complete screens, and synthesized WebAudio sound — no audio files.

## Controls

- **WASD / arrows** — drive and walk
- **Space** — handbrake (hold while driving), start on the menus
- **E** — enter / exit a car
- **F** or **mouse click** — shoot (aim with the mouse)
- **R** — reload
- **M** — mute
- **P** — pause

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. Everything is static files under `game/` — no network, no build step. `node main.ts` hands the game in the way the bounty scores it (it copies `game/` and `screenshots/` and writes `dossier.json`).

---

<sub>Entered on [make.fun](https://make.fun/?ref=lucky-stork-10-1000&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
