# Meridian Bay — Open-World Crime in a Sun-Soaked Port City

**[Play the bounty on make.fun](https://make.fun/bounty/gta6-01)** ·
**[Repository](https://github.com/gelaspec/gta6-01)**

You are Cassian Rowe, getaway driver, back in Meridian Bay with nothing but a
bus ticket. Fixer Inez Kade has six jobs for you — ending with the Meridian
Bank vault at golden hour. Steal cars, outrun the MBPD, collect the hidden
packages, and make the Bay yours.

## The game

- **A complete open world:** a 7×7 coastal city with five districts (Old Port,
  Marina, Downtown, Calle Verde, The Palms), a beach, the sea and a pier.
- **On foot and by car:** walk, run, jump, steal any car, drive with arcade
  handling, handbrake turns, traffic AI and fleeing pedestrians.
- **Wanted 0–5 stars:** the MBPD answers with patrol cars, foot cops and —
  from 3 stars — a helicopter with a spotlight. Lose the tail to cool off.
- **Six story missions:** First Wheels, Courier Run, The Pickup, Heat,
  Pier Heist and The Meridian Job, with a fixer who talks you through them.
- **Side work:** 10 hidden packages and taxi fares for extra cash.
- **Combat:** fists and a pistol, with a wanted level that answers back.
- **HUD:** money, day and time, wanted stars, health, speed, car condition,
  radio, weapon slots, REP bar, mission panel, police response panel with
  named units and distances, and a live circular minimap.
- **Sound:** synthesized engine, siren, gunshots and a synthwave loop —
  no audio files, no network.
- **Save:** progress, money and packages persist in localStorage.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| E | Enter / leave a car |
| F | Punch |
| Mouse click | Shoot |
| R | Reload |
| Space | Jump on foot, handbrake in a car |
| Shift | Run |
| C | Camera near / far |
| T | Pick up a taxi fare (while driving) |
| Q | Next radio station |
| M | Mute |
| Esc | Pause |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## Screenshots

Four renders of the game itself, taken with `node render-shots.mjs`:

1. `1-chase.jpg` — M6, The Meridian Job: a four-star chase at golden hour.
2. `2-onfoot.jpg` — M1, First Wheels: on foot on the pier, day one.
3. `3-dialog.jpg` — M3, The Pickup: the fixer brief at dusk in Calle Verde.
4. `4-progress.jpg` — M4, Heat: mission passed at neon night.

## Structure

Every file has one clear job:

- `game/index.html` — canvas, HUD and import map
- `game/src/config.js` — tuning, palette, districts, missions, cars, radio
- `game/src/random.js` — seedable RNG
- `game/src/city.js` — the 7×7 city, beach, pier, palms, props
- `game/src/render.js` — renderer, camera rig, time of day
- `game/src/input.js` — keyboard and mouse
- `game/src/player.js` — Cassian Rowe on foot
- `game/src/vehicles.js` — cars, arcade physics, traffic AI
- `game/src/pedestrians.js` — walkers who flee trouble
- `game/src/police.js` — wanted level, patrols, helicopter
- `game/src/combat.js` — fists and pistol
- `game/src/effects.js` — particles, muzzle flash, screen shake
- `game/src/audio.js` — synthesized sound and music
- `game/src/dialog.js` — fixer and dispatch lines
- `game/src/missions.js` — the six missions, packages, taxi fares
- `game/src/hud.js` — HUD, minimap, screens
- `game/src/save.js` — localStorage save
- `game/src/shots.js` — deterministic screenshot states
- `game/src/main.js` — boot and the main loop
- `main.ts` — hands the game in (copies game/ + screenshots/, writes dossier.json)
- `serve.ts` — local static server
- `render-shots.mjs` — takes the four screenshots in headless Chrome

## Originality

Meridian Bay, Cassian Rowe, Inez Kade, the MBPD and every line of this game
are original, built for this bounty. No Rockstar Games material is used.
Three.js is vendored under `game/vendor/` and is never shown as our source.

## License

MIT — see `LICENSE`.
