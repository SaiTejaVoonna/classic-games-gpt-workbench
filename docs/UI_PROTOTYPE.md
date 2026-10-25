# Snake UI prototype

> Historical note: this describes the earlier non-playable interface preview. It is superseded by [PLAYABLE_PROTOTYPE.md](PLAYABLE_PROTOTYPE.md); gameplay now exists and the statements below about "nothing moves" no longer apply.

Status: implementation by Claude Code for the owner-authorized UI milestone. **Not independently accepted**; Codex review corrections (focus, food contrast, header touch targets) applied and awaiting re-review.

## Scope
Interface only, following `docs/INTERFACE_SPEC.md` and `docs/ARCHITECTURE_PLAN.md`. Dependency-free HTML, CSS and vanilla JavaScript with a Canvas 2D board, system fonts, no raster assets, no backend, no network requests.

- `index.html`: semantic shell, controls, three `<dialog>` panels (Top score, Instructions, Settings).
- `styles.css`: layout, Colour/LCD/Night themes via CSS custom properties, focus and reduced-motion rules.
- `src/main.js`: preview-state wiring, theme switcher, static canvas drawing. No engine.
- `docs/screenshots/`: Chromium screenshots (see Checks).

## What is implemented
- Minimal header (wordmark, Top score, Instructions, Settings), "Snake" heading with an unofficial-inspiration note, and Score/Best labelled `(placeholder)` and showing a dash.
- One dominant board: a **static illustrative** snake and food on a faint grid, captioned "UI prototype — gameplay not implemented; board proportions provisional".
- New game, Pause, Continue buttons that only switch between labelled interface-preview states (Menu, Ready (preview), Paused (preview)) with an overlay and status text. Continue is enabled only in the Paused preview.
- Level and Maze selects are disabled and show only "Unavailable", with an explanation of why. No counts or options are invented.
- Working Colour (default), LCD and Night theme switcher in Settings. The theme preference is the only thing stored (`localStorage` key `classic-games.theme`, failure-tolerant). No scores are stored.
- Sound and Vibration controls are disabled and labelled not implemented.
- Mobile D-pad of four labelled 44 px+ buttons and board-focused arrow keys; both only display "Last input" and only register in the Ready preview (D-pad buttons are disabled in Menu and Paused). New game and Continue move focus to the board so arrow keys work immediately without clicking it; Pause moves focus to Continue. Nothing moves.
- Desktop (900 px and wider) puts controls beside the board; narrower screens use a single column; short landscape phones use a side-control layout. The D-pad is hidden on wide screens with a fine pointer.

## What is deliberately not implemented
No engine, moving snake, collision, scoring, growth, timing, speed table, maze map or sound. The board's 21×14 grid and 3:2 shape are **provisional placeholders**, not evidence about the original handset (see unresolved items U01–U06 in `docs/NOKIA_REFERENCE.md`). Nothing here claims historical accuracy.

## Run locally
Open `index.html` directly in a browser, or serve the folder with any static server, for example `python3 -m http.server` and visit `http://localhost:8000/`. No build step or install. The script is a plain deferred script (not an ES module) so the page works from `file://`; the architecture plan's module split can be adopted when the engine arrives.

## Checks run
Environment: cloud Linux container, Chromium 1194 build from `/opt/pw-browsers` driven by the preinstalled Playwright 1.56.1 (no package installs), pages opened via `file://`.

| Check | Result |
| --- | --- |
| `node --check src/main.js` | pass |
| ESLint (global install, temporary config outside the repo: `no-undef`, `no-unused-vars`, `eqeqeq`) | pass |
| HTML tag balance, duplicate IDs, IDs referenced by JS exist (small script) | pass |
| Console/page errors at all sizes × 3 themes (15 combinations) | none |
| Horizontal overflow at 320×568, 390×844, 768×1024, 1366×768, 1440×900, each theme | none |
| Enabled buttons at least 44 px wide and 44 px high (computed, every size/theme); header actions measured Top score 76×44, Instructions 88×44, Settings 65×44 at 390 px | all |
| 390×844: board and D-pad fully inside the viewport (D-pad bottom 771 px of 844); footer below the fold | pass |
| 1366×768 and 1440×900: no page scroll; board 744×496 | pass |
| Default theme Colour; Level/Maze/Continue initially disabled | pass |
| New game → Pause → Continue state cycle; D-pad input display | pass |
| Settings and Instructions dialogs open and close with Escape; Night theme applies | pass |
| Keyboard Tab reaches buttons with a 3 px solid outline (computed style) | pass |
| Real keyboard input, no board click: New game → focus on `#board`; ArrowLeft/ArrowUp register ("Left", "Up") | pass |
| Pause → focus on Continue; ArrowRight with the board focused while Paused is ignored (still "Up") | pass |
| Continue → focus on `#board`; ArrowDown registers ("Down") | pass |
| D-pad buttons disabled on load and enabled after New game (fresh page) | pass |
| Contrast, script computing WCAG ratios from the theme variables in `styles.css`, all three themes: text pairs ink/bg, ink/surface, muted/bg, muted/surface, accent-ink/accent, ink/board at least 4.5:1; non-text snake/board, snake-head/board, food/board, focus/bg, focus/surface, accent/surface at least 3:1 | 0 failures of 54 pairs |
| `prefers-reduced-motion: reduce`: button transition duration 0 s | pass |
| D-pad hidden on 1366×768 with a fine pointer | pass |
| Compressed size of HTML+CSS+JS (gzip) | about 6.9 KB (20.9 KB raw) |

## Contrast change
The review measured Colour food `#d98a1a` on board `#e8e1cd` at 2.12:1. Colour food is now `#a85f00`, 3.74:1 against the board (food remains a diamond shape, distinct from square snake segments). The script flagged only that pair; other values are unchanged.

## Known limits and issues
- At 320×568 and 768×1024 the page scrolls vertically; the D-pad is below the fold at 320×568. The fit requirement was met only for 390×844.
- Verified in Chromium only. Not tested in Safari, Firefox, real mobile browsers, with a screen reader or on actual touch hardware. Touch was emulated by Playwright.
- Contrast was computed from CSS variables only; blended states (the board overlay at 45% opacity, disabled controls at reduced opacity) and anti-aliased canvas edges were not measured. Disabled controls are exempt from contrast requirements.
- The spec's "ask before discarding a resumable run" prompt is not previewed. Keyboard shortcuts other than arrows (WASD, 2/4/6/8, P, Escape for pause) are not implemented pending owner approval. Arrow keys only act while the board has focus.
- Colour overlay and status text are plain DOM text; the canvas has a single static `role="img"` label.
- The "Top score" dialog says no scores exist. It is not the final design of that function.
- Screenshots in `docs/screenshots/` were regenerated after the corrections. They are of this static preview, not of a game, and are not approved designs.
