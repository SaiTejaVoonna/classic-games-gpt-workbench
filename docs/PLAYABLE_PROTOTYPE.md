# Playable prototype (Classic Games prototype choices)

Status: implemented by Claude Code on the owner authorized requests. **Not independently accepted**; Codex review pending. The page shows one About note in Instructions ("An early version of Classic Games. Gameplay may differ from the originals."). The full rule details live here, not in the interface.

**Fidelity statement.** Nothing in this prototype is claimed to match any original game. Every rule and number below is a *Classic Games prototype choice* made so the game is playable and varied. None is historically verified, and none may be marked verified without evidence (`docs/NOKIA_REFERENCE.md`, unresolved items U01 to U12).

## Evidence revisit
The primary sources in `docs/NOKIA_REFERENCE.md` (S1 manual, S2 related model manual, S3 replica article) could not be re-fetched from this container (the hosts did not resolve), so nothing new was verified. No historical constants were taken from memory, clones or recollection. The classification below restates only what `docs/NOKIA_REFERENCE.md` already records.

| Feature in this prototype | Evidence status (from `docs/NOKIA_REFERENCE.md`) | What the prototype does |
| --- | --- | --- |
| New game, Continue, Level, Top score, Instructions | Verified for the 3310 (S1). | New game, Continue, Top score and Instructions exist. Level is replaced by browser speed settings. |
| Speed levels | A Level function is verified (S1). Number of levels and exact timing are unknown (U02). | Slow, Medium and Fast are comfort settings of 300, 220 and 150 ms. They are not original level values. |
| Food, growth, death on own body, keys 2/4/6/8 | Corroborated by the 3395 manual (S2), not verified for the 3310 (U04, U07, U09). | Food grows the snake by one. Arrow keys and WASD are modern browser controls. |
| Clear field and mazes | Corroborated by the 3395 manual: clear field plus five mazes (S2). The 3310 count, layouts and menu location are unknown (U06). | A clear field and three original prototype layouts (Pillars, Gate, Frame). They are not copies of any original map. |
| Wraparound and wall rules | Unknown for the target (U05). | **Wrap around is the Classic Games default** so normal play does not end at a screen edge. Solid walls remain an explicit choice. This is a prototype choice, not verified Nokia behavior. |
| Temporary bonus creature or item | A replica article describes temporary bonus creatures (S3, replica corroboration). Trigger, duration, formula and growth are unknown (U08). | An optional timed bonus that gives extra points only. All numbers are prototype choices. |
| Score values | Unknown (U07). | +1 per food, +5 per bonus (prototype choices). |
| Lives | Not described in the sources. | Classic is one life. Extra lives and Unlimited are optional modern style assists, not original rules. |
| Themes, rounded snake art, icon navigation | Presentation only. | Three themes. The snake is drawn as a connected rounded body. The header uses icon buttons with labels. |

Google Snake style modes are not used as evidence for any Nokia behavior. Their ideas (for example variants of walls or extra modes) appear here only as clearly labelled optional prototype settings.

## Scope
- `src/engine.js`: deterministic, pure simulation (state in, next state and events out). No DOM, storage, sound or wall clock. Seeded RNG. Edge wrap, maze blocks, lives modes and the bonus item live here and are covered by tests.
- `src/render.js`: Canvas drawing of the board, maze blocks, fruit, bonus item and snake. Geometry is computed separately from drawing so it can be tested without a browser.
- `src/storage.js`: failure tolerant stores for best scores (per rules setup), the speed choice and the rules choices.
- `src/main.js`: wiring, frame loop, input, dialogs, settings, themes.
- `index.html`, `styles.css`: existing site structure and layout. Codex's wording (`2bb935f`) and the earlier copy cleanup are preserved. The header now uses inline SVG icon buttons (see A27).
- `tests/*.test.js` (Node built-in runner) and `tests/browser/*.js` (Playwright checks; need an existing Playwright install, not a project dependency).

Controls are unchanged: arrow keys or WASD while the board has focus, Space or P to pause and resume, D-pad buttons on touch, New game and Continue focus the board. Swipe input is not part of this change.

## Prototype choices (for owner review)
| ID | Choice |
| --- | --- |
| A1 | Board 21×14 cells (3:2), carried over from the UI mock. Not historical (U01). |
| A2 | Start length 3, heading right, fixed start cell (head at x=7, middle row) (U03). |
| A3 | Superseded by A17. Still no original levels and no acceleration (U02). |
| A4 | Turn queue depth 2. A repeat or reversal of the most recent queued or current direction is ignored; extra inputs are dropped (U04). |
| A5 | At most 2 ticks per rendered frame; long gaps are clamped, not replayed. |
| A7 | The run starts on the first accepted direction input. A reversal of the initial heading does not start it (U03). |
| A8 | When Solid walls is selected, touching the edge is a collision and costs a life (U05). Wrap around is the default (A20). |
| A9 | The cell the tail is vacating this tick is free when not growing. Moving into it while growing is a collision (U09). |
| A10 | +1 point and +1 segment per food, applied immediately (U07). Food is placed uniformly on free cells (not on the snake, a maze block or the bonus item). |
| A11 | A full board ends the run as "Board full" (U10). |
| A12 | Browser adaptation: the run auto-pauses when the tab is hidden or a panel (Instructions, Top score, Settings) opens. Resuming is explicit and never replays elapsed time. |
| A13 | Continue resumes a paused in-memory run only. Nothing persists across reload. |
| A14 | New game during a running or paused run asks for confirmation. |
| A16 | WASD and Space/P are proposed alternatives from the interface spec and are not approved. |
| A17 | **Speed settings** (Settings → Speed): Slow 300 ms (default), Medium 220 ms, Fast 150 ms per tick. Comfort choices from owner testing, not original level values. Stored under `classic-games.speed`; unknown stored values fall back to Slow; explicit choices are kept. The Settings copy says: "Speed choices are comfort settings, not original game levels." |
| A18 | A change to speed or any rule below **applies to the next New game**. A run records its settings at creation, so a run in progress keeps them and the Settings note says so. With no run started (menu or a fresh ready state) the pending game adopts the change at once. |
| A20 | **Edge rule** (Game setup → Edges): **Wrap around is the default**, Solid walls is an explicit choice. With wrap, leaving one edge re-enters at the opposite edge in the same row or column. With Solid walls, touching the edge costs a life. Maze blocks are solid with either rule. The selected rule is visible before and during play: an Edges readout, the rules line ("wrap around edges" or "solid walls"), a dashed inner edge when wrapping and a solid inner edge when walls are on. It is a Classic Games prototype choice, not verified Nokia behavior. The engine option is `wrap`; the engine and the app both default to wrap, and only an explicit `wrap: false` selects walls. |
| A21 | **Board** (Game setup → Board): Clear field (default) or one of three prototype mazes made of solid grid aligned squares: Pillars (four 2×2 blocks), Gate (a wall at x=10 with a gap on rows 5 to 8), Frame (two horizontal bars). The start cells and the start row up to x=14 stay clear. Tests check that every free cell is reachable and that food and bonus never land on a block. Hitting a block is a collision with reason `obstacle`. |
| A22 | **Lives** (Game setup → Lives): Classic one life (default); Extra lives, three lives in total; Unlimited, an optional assist that is off by default and labelled "assist mode". A collision costs a life. After a lost life, or any collision in Unlimited, the snake restarts at the start cells with the start length, the score is kept, food or bonus on the restart cells is moved or cleared, and the game waits for a direction. The last life, or any collision in Classic, ends the run. Lives are never added during a run. The Lives readout and the rules line ("Assist: unlimited lives") stay visible during play. |
| A23 | **Bonus food** (Game setup → Bonus food: On by default). After every 5th regular food a bonus appears on a free cell for 24 ticks (about 7.2 s at Slow, 5.3 s at Medium, 3.6 s at Fast). It is worth 5 points and does not grow the snake. It is not a life, shield or invincibility. Missing it costs nothing. Only one is active at a time. Its timer runs only while the snake is moving (it is frozen while paused or waiting after a lost life) and is shown as a ring around the item and as seconds next to the Lives readout. `bonusEvery`, `bonusTicks`, `bonusPoints` and `bonusGrows` are engine options with tests. |
| A24 | **Best scores are kept per rules setup**: key `speed|lives|board|walls or wrap|bonus or nobonus` under `classic-games.best.prototype-v3`. Older data (v1 one value; v2 one value per speed) is migrated to the setup it was recorded under (classic lives, clear field, solid walls, no bonus; v1 as Fast). Older keys are never rewritten or deleted. Top score lists up to eight setups. |
| A25 | Board, edges, lives and bonus choices are stored under `classic-games.rules.v2` as `{v:2, chosen:{...}}`, **recording only choices the user made**, so a later default change never overrides an explicit choice. Nothing is written until the user changes one; invalid fields fall back individually. The first version (`classic-games.rules`, every field stored) is read once and never modified: board, lives and bonus are kept; a stored `edges: wrap` is kept; a stored `edges: walls` cannot be told apart from the old default, so it moves to the new default (wrap). Anyone who wants Solid walls picks it once and it is then saved as an explicit choice. |
| A26 | **Visuals.** The snake is one rounded body that follows the grid path, with a tapered tail (tip about 0.2 cell half width, full width 0.42 over the last 5 cells), a larger head and two small eyes at the front that follow the current direction. A soft shadow and one continuous highlight add subtle depth. Fruit is a round shape, bonus food a diamond with a timer ring, so shape differs as well as colour. Themes only change colours: Colour (warm neutral, green, amber), LCD (monochrome) and Night (dark navy board, mint snake, red fruit, gold bonus: the Modern Arcade direction of the reference image). No scenery, rocks or stars. |
| A27 | **Layout of controls.** The header has three icon buttons (trophy for Top score, help circle for Instructions, gear for Settings), each 44 by 44 px with a persistent `aria-label`, an inline SVG, and a text label that shows on pointer hover and on keyboard focus (hidden until then; Escape hides it). **Settings holds presentation preferences only: Theme, Snake colour, Snake style and Speed.** (A fourth header icon, Full screen, appears where supported.) **Game setup** is a separate dialog, opened by a Game setup button directly under New game, that holds Board, Edges, Lives and Bonus food and states that the choices apply to the next run. The rules line shows "Next game: ..." before a run and "This run: ..." during one, with a second "Next game" line when the saved choice differs. All dialogs keep the heading and Close button in view, scroll only their middle part, are at most 88% of the viewport tall, reset to the top on open and put initial focus on the heading. The speed readout has a three dot meter. |
| A28 | **Phone-first controls (M1).** Swipe on the board steers (a drag of 24 CSS px along one axis turns; one long drag chains turns; shorter movements are ignored; the board has `touch-action: none`, the rest of the page scrolls normally). Optional on-screen D-pad, off by default, toggled by a button and remembered once chosen. Big Play, Continue, New game and Play again buttons on the board. The HUD shows Score, Best (this setup), Length, Lives and a Speed cell that cycles Slow, Medium and Fast for the next game. Rule chips (Edges, Board, Lives, Bonus) open Game setup at their group. Full screen button where the browser supports it (not iPhone Safari). |
| A29 | **Tall board on phones.** On narrow portrait screens the board is 14 wide by 21 tall (the same 294 cells as 21 by 14, mazes transposed, the snake starts heading down), so scores stay comparable. It is chosen when a run starts and never changes mid-run. |
| A30 | **Snake colours and styles.** Green, cyan, blue, violet, pink and lime (never red, orange or yellow, which belong to the fruit and bonus), in the Colour and Night themes; LCD keeps its monochrome snake. Styles: Smooth and Pixel blocks. Stored only once chosen. Purely visual. |
| A31 | **Twelve boards.** Clear field, Pillars, Gate, Frame, plus Corners, Tunnels, Zigzag, Rooms, Diamond, Islands, Staircase and Bars, with previews in Game setup. |

Not implemented: original levels, leaves, rocks or other scenery, bonus creatures, sound, vibration, swipe steering, persistence of an in progress run, icon navigation. Unlimited and Extra lives are assists and are never described as original rules.

## Test hooks
`?seed=<int>` fixes the RNG seed. `?debug=1` exposes a read only snapshot at `window.classicGamesDebug.state()` and allows `bonusEvery`, `bonusTicks`, `bonusPoints` and `bonusGrows=1` query values. They are used by the browser checks only.

## Run and test
Open `index.html` in a browser (works from `file://`; scripts are plain deferred scripts, not modules), or serve the folder with any static server.

- Unit tests: `node --test tests/*.test.js` (no install).
- Browser checks (Playwright and Chromium preinstalled in the cloud container): `NODE_PATH=<playwright dir> node tests/browser/<name>.js <outdir>` for `play`, `rules`, `rendering` and `sweep`.

## Results (this container, final source of this revision)
| Check | Result |
| --- | --- |
| `node --check` on `src/*.js`; ESLint on `src` and `tests/*.js` (temporary config outside the repo: `no-undef`, `no-unused-vars`, `eqeqeq`) | pass |
| Unit tests, `node --test tests/*.test.js` | 127/127 pass |
| - engine (70): earlier simulation tests plus the new defaults (wrap on, clear field, one life, bonus on; only an explicit `wrap:false` selects walls), wrap on all four edges with default options, solid wall collisions on all four edges (a classic run ends, extra lives lose exactly one life), maze blocks solid with and without wrap | pass |
| - storage (26): per setup best scores and migration, speed preference, and the rules preference: fresh defaults (wrap), nothing written until a choice, only chosen fields stored under the v2 key, an explicit walls choice kept, a changed default not overriding an unchosen field, v1 migration (board, lives and bonus kept, walls moves to the new default, wrap kept, v1 left untouched, v2 wins afterwards), invalid data, throwing and null storage | pass |
| - render (17) and copy (14): rendering geometry as before; copy tests now also check the icon header (three buttons, aria-labels, inline SVG, tooltip text, no image files), Settings holding Theme and Speed only, Game setup holding Board, Edges, Lives and Bonus with Wrap around as the default and Solid walls available, Game setup next to New game, dialog structure (focusable heading, internal scroll area, fixed footer, no autofocus on Close) and the tooltip, hover and 44 px rules in the CSS | pass |
| Browser `play.js` (116 checks) | pass |
| Browser `rules.js` (54 checks): defaults and rules summary before a run ("Next game: 1 life, clear field, wrap around edges, bonus food on."), only explicit choices saved, reload, invalid saved values, a change never alters a run in progress ("This run" and "Next game" lines), wrap in all four directions at the default, explicit solid walls ending a classic run, solid walls costing one life with extra lives, maze blocks solid with wrap, lives, bonus and touch checks as before | pass |
| Browser `rendering.js` (58 checks, three themes plus a retina case): connected rounded snake, tapered tail, head and eyes for all four directions, blocks, fruit, bonus ring, wrap stubs, contrast | pass |
| Browser `ui.js` (182 checks) | pass |
| - header icons at 1366×768, 390×844 and 320×568: three buttons with persistent accessible names and inline SVG, at least 44×44, tooltip hidden until hover or focus, hover label inside the viewport, label on real keyboard Tab focus, 3 px solid focus ring at 3:1 or better against the page, Escape hides a label without moving focus, Enter opens the dialog and focus returns to the icon, tooltip text contrast at least 4.5:1, no horizontal overflow | pass |
| - Settings versus Game setup: Settings has only `theme` and `speed` inputs and no rule wording; Game setup has only `board`, `edges`, `lives`, `bonus`; the Game setup button sits within 24 px below New game inside the controls panel | pass |
| - dialogs (Settings, Game setup, Instructions, Top score) at 320×568, 390×844, 768×1024, 1366×768: open inside the viewport at most 88% tall, scrolled to the top with the heading visible and focused, first content visible, Close visible without scrolling and 44 px high, page behind does not scroll, long content scrolls inside while heading and Close stay in view and the last item is reachable, Tab from the heading stays inside, Escape closes | pass |
| - edge default and migration in the browser: fresh profile starts with Wrap and Clear field; v1 data migrates as described in A25 and is never modified; an explicit Solid walls choice is saved with the migrated choices and survives reload; v1 `wrap` is kept; v2 walls is honoured | pass |
| - Night theme variables and the speed meter | pass |
| Responsive sweep: 320×568, 390×844, 768×1024, 1366×768, 1440×900 × three themes | no console errors, no horizontal overflow, enabled buttons at least 44×44 |
| 390×844 fit | board and D-pad inside the viewport (D-pad bottom 767 of 844) |
| 1366×768, 1440×900 | no page scroll |
| Contrast from theme variables (text 4.5:1, non text 3:1) | 0 failures |
| Size: HTML+CSS+JS gzip (6 files) | about 22.6 KB |

## Limits
- Chromium only. Safari, Firefox, real phones, screen readers and real device touch were **not** tested. "Touch" tests use Playwright's touch emulation.
- Timing is checked by tick counts against elapsed time, not by perceived latency on a real device.
- At 320×568 the D-pad ends at 675 px on a 568 px viewport, so it is below the fold. The Game setup dialog is taller than small screens and scrolls inside while its heading and Close button stay in view.
- The tooltips are CSS only. On touch screens there is no hover, so the label appears only for keyboard focus; the buttons keep their accessible names.
- The reference image's icon navigation, speed slider and bonus star are interpreted in a restrained way: a three dot speed meter, a diamond bonus with a timer ring, and no scenery.
- After a lost life the snake restarts at the start length (a length reset is part of A22). Whether that suits the owner is a design question.
- Bonus timing is counted in ticks, so its length in seconds depends on the speed (A23).
- Game feel, difficulty, maze difficulty and the lives numbers are untuned guesses.
- `docs/UI_PROTOTYPE.md` and older screenshots describe the earlier non playable preview.

## Decisions needed from the owner
1. Accept, change or reject the prototype choices above (A1 to A31), knowing none is historical.
2. Whether bonus food should default to On, and whether the bonus length should be in seconds rather than ticks.
3. Whether a lost life should keep the snake length instead of resetting it.
4. Which reference handset and firmware to verify against, and how evidence will be gathered (U01 to U12), before any rule is called faithful.
5. Whether auto-pause (A12), session only Continue (A13) and the extra key mappings (A16) are approved.

## Link status (GitHack)
The repository is public (verified by Codex). Links take the form `https://raw.githack.com/SaiTejaVoonna/classic-games/<commit-sha>/index.html`, pinned to a commit. The report for each commit gives the current link and says whether it was verified. The `preview/ui-prototype` branch is not updated by this work.
