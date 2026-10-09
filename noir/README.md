# Grey City Blues

A rain-soaked, black-and-white noir shooter in the browser. Rain City is grey,
and the Technicolor Syndicate is painting it: goons pour out of portals in the
sky, giant robot-vacuum Paintbots roll down the avenues laying stripes, and
Goon Trucks cruise with rocket-men in the back. You are Mack Malone, a grumpy
hard-boiled private eye with a flask and a big red revolver. Crazy Sally rides
shotgun in a red dress and fires rockets out of the window of your black '41
Packard. Every goon you drop washes the color back out of the streets. Let the
City Color meter fill up and Mack pukes in the gutter and gives up.

Built the same way as Wonderland X: three.js plus code. Every model is built
from primitives, every texture is painted on a canvas, and the sound effects and
jazz are synthesized live with WebAudio. There are no asset files.

## Play

No build step. Serve the repository root and open `noir/`:

```sh
npx http-server -c-1 .     # then visit http://localhost:8080/noir/
```

## How it plays

- **Main menu = the office.** Rain on the window, blinds throwing shadows, flasks
  on every surface. DOTTIE-9, the drunk robot receptionist, works the front desk.
- **The Big Board.** A corkboard map of Rain City with thirteen case files
  pinned to it. Closing a case unseals the next one. Closed cases stay on the board,
  so you can replay any case for a better grade.
- **Every case opens in the office.** Mack is asleep at his desk, a dame checks
  in with Dottie, Sally kicks the door in, and they take the case. Each case is
  louder and more absurd than the last. Along the way: a torch singer whose blue
  note came out actually blue, a rainbow living in a bank vault, holes in the sky
  humming show tunes, a Police Commissioner turning into a frosted cruller, a
  sunrise smuggled out in boxcars, the corrupt Mayor Horace Krane and his
  forty-foot paint mech, the Prism King, a color cult, Dottie converting to that
  cult and riding a giant Paintbot, and finally the city cracking open into a
  Technicolor Hell.
- **The city** is a 16×16 grid of 4-lane streets about 1.3 km across, with
  empty lots, banks, City Hall and Krane Plaza, the Strip and its casinos, the
  docks, the rail yards, the Last Drop, and the Holy Glaze donut shop. The Holy
  Glaze lot is full of cop cars, and Mack and Sally call the cops fat pigs every
  time they drive past.
- **Sin City color.** The world renders in grey. The only things that keep their
  color are Sally's dress, Mack's revolver, the cop lights, the donut and a few
  neon signs, plus whatever the Syndicate has painted.
- **The Last Drop.** Visit Gus between cases for extra flasks, hints, and
  case-specific clues that change the fight (double rocket damage on a boss,
  weaker portals and so on). You can also walk in once per case mid-mission to
  get patched up.
- **Portals** spit goons until you crack them with bullets or rockets, then walk
  up on foot and hold E to jam Mack's flask of grey into them. That's three
  seconds with your back to the goons, so let Sally cover you.
- **Evidence.** Goons drop receipts, pamphlets, matchbooks. Pick them up on foot.
  At the bar after the case, Gus reads them, and they unlock the clue for the
  next case.
- **Monologues.** Every case opens on the street with Mack's narration and Sally
  cutting in, and closes at the Last Drop with Mack brooding while Sally orders
  another round.
- **Civilians** walk the sidewalks with umbrellas and keep clear of portals, but
  a portal left open long enough reaches them and they get infected: rainbow,
  shambling, painting. Sealing the portal cures them. Kill a civilian, infected
  or not, and the cops finally leave the Holy Glaze: you're Wanted by the City
  for the rest of the case.
- **The Packard takes a beating**: sparks and debris on every crash, bumpers,
  headlights and the hood ornament tear off, then the engine smokes and burns.
- **Goon Trucks** dump their riders the first time you hit them, and the riders
  scatter and paint.
- **WRNC radio.** Chet Ballantine, "the Voice of the Rain," crackles in between
  the action with city news, fake news, ads, and hints: the Mayor's shady deals,
  cult flyers turning up early, all pointing at case 13.
- **Waves.** Wave cases open portals spread across the whole city, one more
  each wave. The moment a portal opens it spits out 5 goons, half a second
  apart. After that it only refills: while fewer than 5 of its goons are
  alive, it adds one every 5 seconds until it's sealed. There are never more
  than 20 on the streets. Foot goons
  leave a thin paint snail trail wherever they walk. Clear a wave and every
  goon still standing goes off like a firecracker, nearest first.
- **Sally's rockets.** She locks on by herself (red reticle), preferring the
  biggest crowd she can see. Her rockets fire a little wide and heat-seek into
  the target, re-acquiring if it dies. The blast hits everything nearby, throws
  survivors back, and bursts goons into their paint, with a red shockwave
  across the street.
- **Sally takes the wheel.** Hop out with E (to seal a portal, say) and Sally
  slides over and runs down every foot thug within about 30m of Mack, braking
  for Mack. With nothing to hit she does zig-zag laps around him with rocket
  boost bursts. Press E (or Z) to call her over, then E again to climb in.
- **CASE CLOSED.** Win a case and a silver CASE CLOSED card slams down on the
  street with a big-band stab, and all street chatter stops. The bar debrief
  then has just one Mack monologue (the bar closer).
- **PAINTED THE TOWN.** Lose to the color and a rainbow card slams down over
  Mack's puke scene, before the result screen.
- **Breathers wash the city.** Between waves the rain gets a chance: City
  Color drifts down by about a quarter over a breather.
- **The Packard vs. thugs.** Foot thugs never stop the car: at anything faster
  than a crawl you drive straight through them and they burst. Between waves there's a breather with a countdown, and any
  leftover goons run for it.
- **The bar scene.** Case-close debriefs happen in the corner booth at the
  Last Drop. The first time you close a case you get the full debrief:
  Mack broods, Gus reads the evidence, Sally orders another round. Then a dream
  wipe (a wavy shimmer and a harp glissando) and Mack wakes up face down on his
  desk in the office, where the results come up. After that
  it's just a quick toast. Walk out the door to skip either one; the full scene
  can be rewatched from the results screen.
- **WASTED.** Go down and the world slows, Mack hits the pavement, and a big
  red WASTED slams onto the screen. Then you're in the Last Drop: Mack's stool
  is empty and Sally is drinking without him. Walk out the door (under the
  busted neon HELLO, which only says HELL) and the case restarts, with you
  already in the Packard and Sally riding shotgun.
- **Score and multiplier.** Kills and portal seals score points times your
  multiplier, which climbs as you chain kills (up to ×8) and drops when you get
  hit or go quiet. Shooting a civilian costs 500 and resets it. The final score
  is your street score plus a clean-close bonus.
- **Knock it over.** Lamp posts topple (and their light goes out); hydrants,
  trash cans, newspaper boxes, mailboxes and parking meters go flying when you
  hit them with the Packard or catch them in an explosion. Hydrants geyser.
- **Pedestrians** stick to the sidewalks and cross only at the crosswalks.
- **Wayfinding.** "Go to" objectives (start with *meet Big Pork at the Holy
  Glaze*) paint red chevrons on the road that re-route in real time, plus a
  beacon at the destination. The radar shows every objective, with an arrow on
  the rim when it's out of range.
- **Newsreels.** Your best run on each case is recorded and can be replayed as
  a scratchy newsreel from the board. Runs export and import as JSON, so the top
  scorer's run could be featured in the next episode. A global leaderboard would
  need a server; everything here is stored locally.
- **Jazz.** Ten generative tunes (ballads, swing, bossa, a waltz, up-tempo hard
  bop) in a rotating playlist. Each play composes a fresh head and solos, and
  `N` skips to the next tune.

## The story so far (and where it's going)

Thirteen cases, one arc. Each case is stranger than the last, and each one
leaves a breadcrumb for the finale: an eye painted on the pier, a hymnal called
*Songs of the Seventh Color*, a note from "the Choir".

| # | Case | What happens |
| --- | --- | --- |
| 1 | The Blue Period | Meet Big Pork, then four waves of tears in the sky across the whole city: 1, 2, 3, then 4 portals, with a breather between each. |
| 2 | Purple Rain Man | A blue note comes out actually blue. Vic Vermilion. The first Paintbots. |
| 3 | The Vault of Many Colors | Bank heists; a rainbow left in the vault mocks the tellers. |
| 4 | Holes in the Sky | Portals open over Old Town, humming show tunes. |
| 5 | Snake Eyes on the Strip | Jellybean jackpots, Paintbot fleets, Chartreuse Charlie. |
| 6 | Glazed and Confused | The Police Commissioner becomes a thirty-foot frosted cruller. |
| 7 | The Sunrise Express | A sunrise smuggled in boxcars; Madame Magenta's double-cross. |
| 8 | Hizzoner | Mayor Krane sold the city: paint copters, then his Re-Election Machine mech. |
| 9 | The King of Light | The Prism King falls, but he was only the herald. Church bells ring. |
| 10 | Hymns in the Key of Pink | The Church of the Holy Spectrum baptizes Old Town in paint. Deacon Daffodil. |
| 11 | Dottie Sees the Light | Dottie joins the cult and rides Mother Roomba. Bring her home. |
| 12 | The Seventh Color | Southside cracks open; Chromadaemons; the High Chromancer. |
| 13 | Technicolor Hell | The city herself hires Mack. The Saint of All Colors rises out of City Hall. |

## Controls

| Input | Action |
| --- | --- |
| WASD | Move / drive |
| Right mouse (hold) | Draw and aim the big red revolver |
| Left mouse | Fire (while aiming). In the car, Sally fires a rocket where you point |
| R / Space | Tuck and roll (on foot) |
| Shift | Rocket boost (in the car): flames out the tailpipes, burnout marks; drifting refills it |
| Space | Handbrake drift (in the car): tire smoke, skid marks, squeal |
| E | Get in or out of the Packard, enter the Last Drop, pick up evidence (on foot) |
| E (hold, on foot) | Seal a cracked portal by jamming the flask of grey into it (3 seconds, you can't shoot) |
| Z | Whistle: the Packard drives itself to you |
| F | Focus on or off: time crawls, paid for with the color you've stolen from the Syndicate |
| Q | Pull from the flask (heal + a moment of focus) |
| G | Pain pills: full heal, but Mack sees the world in color for a while (he hates it) |
| Mouse wheel | Zoom |
| N | Next jazz tune |
| Esc | Pause |

The revolver holds six rounds. Holster it for a moment and Mack reloads.

## Code map

| File | What's in it |
| --- | --- |
| `src/main.js` | Boot, renderer + film grain/vignette/lens-rain post pass, menus, board, cutscenes, bar, scoring, saves, newsreels |
| `src/game.js` | The streets: player, Sally, the Packard (and its autopilot), the Syndicate, portals, bosses, wayfinding, case logic, recording/replay |
| `src/city.js` | Rain City generation, landmarks, collision grid, road routing helpers, map drawing |
| `src/paint.js` | The color system: grey shading patch for every material plus the paint canvas the Syndicate draws on |
| `src/models.js` | Mack, Sally, Dottie, the dames, goons, Paintbots, trucks, the Packard, cop cars, the Mayor, the Prism King |
| `src/interiors.js` | The office (with the cutscene actors) and the Last Drop |
| `src/story.js` | The thirteen cases, the cast, monologues, evidence, radio bulletins, every line of dialogue |
| `src/audio.js` | Rain, guns, rockets and the generative jazz combo |
| `src/fx.js` | Rain, particles, tracers, explosion flashes |
| `src/hud.js` | HUD, portraits, radar and pointers |

`tools/noir-shot.mjs` is a headless Playwright harness. Load the page with
`?debug` and `window.__noir.step(seconds)` fast-forwards the game without
rendering, which is handy for scripted playthroughs.

## Writing a new case

Cases are plain data in `src/story.js`. To add the next, stranger chapter,
append an object to `CASES` and it appears on the Big Board automatically,
sealed until the case before it is closed:

```js
{
  id: 14, title: 'The Moon Has Been Painted', district: 'The Docks', music: 'high',
  dame: { name: 'Lady Luna', hat: 'veil', shade: 0xdddddd, ghost: true },
  blurb: 'One line for the board.',
  intro: [            // [action, speaker, line]; actions: sleep, dameIn, dameDesk, wake, sallyIn, stamp
    ['sleep', 'NARR', 'Opening narration.'],
    ['dameIn', 'NARR', 'She walks in.'],
    [null, 'DOTTIE', '*hic* ...'],
    ['wake', 'MACK', '...'],
    ['sallyIn', 'SALLY', '...'],
    ['stamp', 'MACK', 'We\'re taking it.'],
  ],
  stages: [           // goal types: goto (at: landmark), kill (n), portals (n), roombas (n), boss (boss id)
    { text: 'Meet somebody', goal: { type: 'goto', at: 'donut', r: 30, label: 'BIG PORK', arrive: [['PORK', '...']] }, mix: {}, max: 0, interval: 9 },
    { text: 'Clear the docks', goal: { type: 'kill', n: 15 }, mix: { hood: 0.4, goon: 0.3, truck: 0.3 }, max: 10, interval: 1.6 },
    { text: 'Scrap the Paintbots', goal: { type: 'roombas', n: 3 }, roombas: 3, mix: { dauber: 1 }, max: 6, interval: 2 },
  ],
  bleedCap: 0.28,     // how much of the district may be painted before Mack gives up
  outro: [['MACK', '...']],
  clue: { text: 'What Gus knows.', effects: ['rocket2x', 'portalWeak', 'bigWash', 'lowriderWeak', 'extraFlask'] },
  gus: 'Gus\'s hint for this case.',
}
```

Enemy types for `mix`: `dauber`, `hood`, `goon`, `roller`, `lowrider`,
`truck`, `roomba`, `copter`, `cultist`, `imp`. Stages also take `copters: n`
and `roombas: n` to send those in at the start, and a case with `hell: 1` or
`hell: 2` gets glowing fissures that spit imps. Bosses live in `BOSSES`, landmarks for `goto` in `L` in
`src/city.js`.
