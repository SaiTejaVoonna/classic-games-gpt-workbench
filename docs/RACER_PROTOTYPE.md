# Racer prototype (Classic Games prototype choices)

An early playable road game in `racer/`. Open `racer/index.html`; it needs no build step and no dependencies. It shares `src/sfx.js` (synthesised sound and vibration) with Snake.

The original phone racing game is not verified here, so every rule below is a Classic Games prototype choice, not a claim about the original.

| # | Choice |
|---|---|
| R1 | Three lanes. One swipe, tap on a side, or arrow key changes lane by one. A long drag chains lane changes. |
| R2 | Traffic drives the same way, slower than you. Hitting a car ends the run. There are no lives. |
| R3 | Speed rises from 44 to 92 (metres per second in game units) over the first 8,000 metres. |
| R4 | Score is distance plus near-miss bonuses. Passing a car within one lane gives a combo (the ring shows its 3 second timer). |
| R5 | Seven chapters of 900 m each (short on purpose so the prototype shows every look), then the road loops back to the first. A real build would make chapters longer. |
| R6 | Each chapter has its own sky, light, scenery, weather and traffic look. Looks blend over the last 22 percent of a chapter. |
| R7 | The best score is stored on the device only (`classic-games.racer.best`). The sound switch is stored the same way. |

## Technique

The road is drawn as horizontal slices projected with simple perspective, with a curve offset accumulated slice by slice (the classic pseudo-3D approach, written from scratch here). It is not real 3D. Sprites are drawn with canvas paths: no images.

Reference read while planning: [jakesgordon/javascript-racer](https://github.com/jakesgordon/javascript-racer) (MIT, plain HTML and JS). No code or art from it is used.

## Checks

`tests/browser/racer.js` (Playwright and Chromium, same way as the other browser suites). `docs/screenshots/racer-24-frames.png` is a contact sheet of 24 real frames from the game.

## Limits

- Not tested on a real phone. Frame rate on older phones is unknown.
- Music is not built. Sound is the short effects from `src/sfx.js` plus a simple engine tone.
- Jump, boost, awards, camera options and the launcher are not built.
