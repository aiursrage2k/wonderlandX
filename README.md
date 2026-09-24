# Wonderland X

A dark-Wonderland third-person roguelite shooter in the browser, in the spirit of
Risk of Rain 2. Fall down the rabbit hole as Alice, loot tea chests, stack
strange items, find the Looking Glass, and survive the boss while it charges.
Every minute (and every depth) the garden gets madder.

Everything is built from code: the models are primitives, and every texture
(marble, playing cards, floral porcelain, clock faces, the Cheshire grin in the
sky) is painted procedurally on canvas. Sound and music are synthesised with
WebAudio. There are no image or audio assets.

## Play

No build step. Serve the folder and open `index.html`:

```sh
npx http-server -c-1 .     # or: python3 -m http.server
```

Click **Fall Down the Rabbit Hole**. The game takes pointer lock for mouse
aiming; if the browser refuses it, aiming falls back to edge-panning toward the
cursor. Touch devices get a virtual stick and buttons.

| Input | Action |
| --- | --- |
| WASD | Move (sprint automatically when running forward and not firing) |
| Mouse | Aim |
| Space | Jump (more with the Hatter's Top Hat) |
| LMB | **Razor Deck** — fling razor playing cards |
| RMB | **Teapot Grenade** — lobbed burst for 600%, scalds the ground |
| Shift | **Rabbit Hop** — invulnerable dash |
| Q | **Madness** — spend 50+ Corruption to erupt and enter Madness (faster homing violet cards) |
| E | Interact |
| Esc / P | Pause · **M** mute |

## The loop

- **Director.** Enemies spawn from a credit budget that grows with the run
  timer and depth, with elites (Crimson, Gilded, Voidborne) appearing as the
  difficulty climbs: *Curious → Curiouser → Peculiar → Mad → Mad as a Hatter →
  Off With Her Head → Unbirthday*.
- **Gold** from kills and biscuit tins buys **Tea Chests** (common/uncommon) and
  **Royal Tea Chests** (uncommon/legendary). The **Mad Hatter's Tea Table** is a
  chance shrine.
- **The Dormouse's Curio Cart** (⚖ on the minimap, on every starting plaza) sells
  five chosen items at fixed prices, plus Healing Tea and rerolls. The game pauses
  while you browse.
- **Kills are messy:** enemies burst into bleeding gibs, blood mist and
  directional splatter that stays on the floor, with a hit-stop on each kill.
- **The Looking Glass** (the ♥ on the minimap) starts the hour: stay inside its
  circle for it to charge while the boss hunts you. Charge it, kill the boss,
  and step through to the next depth.
- **Bosses:** the White Rabbit (odd depths: claw combo, jumpable shockwave
  slams, clock-bolt barrages, charges, summons) and the Queen of Hearts (even
  depths: racing thorn lines, a rain of hearts, card volleys, guard summons).
- **Enemies:** Card Guards (telegraphed spear lunges), Teacup Mimics (hopping
  artillery that spits boiling tea), Clockwork Wisps (flying, charged bolt
  volleys).
- **18 stacking items** across three rarities, from *Drink Me Potion* (attack
  speed) to *The Vorpal Blade* (every 5th throw is a piercing 600% blade) and
  the *Unbirthday Present* (an extra life).

## Code map

```
index.html          HUD markup + import map (three.js is vendored under vendor/)
css/style.css       Gothic HUD styling
src/main.js         Game state, stage loading, render pipeline (bloom + grade)
src/world/world.js  Terrain, marble plazas, props, sky, lights, collision
src/gfx/            Procedural textures and primitive-built models
src/game/           Player, enemies + director, combat, items, interactables
src/fx/fx.js        GPU particle pools, ground rings, beams
src/ui/hud.js       Bars, minimap, skills, items, damage numbers
tools/              Headless Playwright harnesses (screenshots, autopilot sim)
```

`node tools/shot.mjs out tools/sim.mjs` fast-forwards a whole run with an
autopilot and prints what happened; the other scripts in `tools/` compose
screenshots. Append `?debug` to the URL to expose `window.game`.

Three.js is MIT licensed (see `vendor/three/LICENSE`).
