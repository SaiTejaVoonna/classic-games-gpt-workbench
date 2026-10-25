// Browser checks. Requires an existing Playwright install (not a project dependency) and a
// Chromium binary. Usage: NODE_PATH=<dir with playwright> node tests/browser/play.js <output dir>
// Optional: CHROMIUM_PATH (default /opt/pw-browsers/chromium).
const { chromium } = require('playwright');
const INDEX = require('url').pathToFileURL(require('path').resolve(__dirname, '../../index.html')).href;
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const url = (q) => INDEX + (q || '');
const R = []; const ok = (name, cond, extra) => { R.push({ name, pass: !!cond, extra }); };
const st = (p) => p.evaluate(() => window.classicGamesDebug.state());
// The default edge rule is wrap. These runs end at the walls, so they choose Solid walls the way a user would.
const WALLS = () => localStorage.setItem('classic-games.rules.v2', JSON.stringify({ v: 2, chosen: { edges: 'walls' } }));
const openSetup = (p) => p.click('[data-open=dlg-setup]');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: CHROMIUM });

  // ---- Desktop keyboard path ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await p.addInitScript(WALLS);
    await p.goto(url('?seed=3&debug=1'));
    let s = await st(p);
    ok('initial mode menu', s.mode === 'menu');
    ok('dpad disabled in menu', await p.evaluate(() => [...document.querySelectorAll('.dpad-btn')].every(b => b.disabled)));
    await p.click('#btn-new');
    ok('New game focuses board', await p.evaluate(() => document.activeElement.id) === 'board');
    s = await st(p); ok('mode ready, ticks 0', s.mode === 'ready' && s.game.ticks === 0);
    await sleep(400); s = await st(p); ok('no movement before first input', s.game.ticks === 0);
    await p.keyboard.press('ArrowLeft'); s = await st(p);
    ok('reversal at start ignored (still ready)', s.mode === 'ready');
    await p.keyboard.press('ArrowUp'); s = await st(p);
    ok('first valid key starts run', s.mode === 'running');
    await sleep(520); s = await st(p);
    ok('time-based movement at default Slow 300 ms (1 to 3 ticks in ~520ms)', s.game.tickMs === 300 && s.game.ticks >= 1 && s.game.ticks <= 3, 'ticks=' + s.game.ticks + ' tickMs=' + s.game.tickMs);
    ok('moving up after ArrowUp', s.game.dir === 'up');
    await p.keyboard.press('d'); await sleep(200); s = await st(p); ok('WASD d turns right', s.game.dir === 'right');
    await p.keyboard.press(' '); s = await st(p); ok('Space pauses', s.mode === 'paused');
    const t1 = s.game.ticks; await sleep(600); s = await st(p); ok('no ticks while paused', s.game.ticks === t1);
    ok('dpad disabled while paused', await p.evaluate(() => [...document.querySelectorAll('.dpad-btn')].every(b => b.disabled)));
    ok('Continue enabled, Pause disabled while paused', !(await p.isDisabled('#btn-continue')) && await p.isDisabled('#btn-pause'));
    await p.keyboard.press('p'); s = await st(p); ok('P resumes', s.mode === 'running');
    // hidden tab: auto-pause, no catch-up
    await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    s = await st(p); ok('hidden tab auto-pauses', s.mode === 'paused'); const t2 = s.game.ticks;
    await sleep(1500);
    await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
    s = await st(p); ok('becoming visible does not auto-resume', s.mode === 'paused' && s.game.ticks === t2);
    await p.click('#btn-continue');
    ok('Continue focuses board', await p.evaluate(() => document.activeElement.id) === 'board');
    await sleep(120); s = await st(p); ok('no catch-up burst after resume (<=1 tick in 120ms)', s.game.ticks - t2 <= 1, 'delta=' + (s.game.ticks - t2));
    // Space outside the board must not pause
    await p.focus('#btn-new'); await p.keyboard.press('KeyP'); s = await st(p); ok('P on a button (not board) does not pause', s.mode === 'running');
    // new game confirmation
    await p.click('#btn-new');
    s = await st(p); ok('New game mid-run pauses and asks to confirm', s.mode === 'paused' && await p.evaluate(() => document.getElementById('dlg-confirm').open));
    await p.click('#dlg-confirm button[value=cancel]');
    await p.waitForFunction(() => document.activeElement && document.activeElement.id === 'btn-continue', null, { timeout: 2000 }).catch(() => {});
    s = await st(p); ok('Cancel keeps the paused run', s.mode === 'paused' && s.game.ticks > 0);
    ok('Cancel returns focus to Continue', await p.evaluate(() => document.activeElement.id) === 'btn-continue');
    await p.click('#btn-new'); await p.click('#dlg-confirm button[value=confirm]');
    await p.waitForFunction(() => window.classicGamesDebug.state().mode === 'ready', null, { timeout: 2000 }).catch(() => {});
    s = await st(p); ok('Confirm starts fresh ready game', s.mode === 'ready' && s.game.score === 0 && s.game.ticks === 0);
    // run into wall (wait until the board has focus again after the dialog closes)
    await p.waitForFunction(() => document.activeElement && document.activeElement.id === 'board');
    await p.keyboard.press('ArrowRight');
    await p.waitForFunction(() => window.classicGamesDebug.state().mode === 'over', null, { timeout: 9000 });
    s = await st(p); ok('wall collision ends run', s.mode === 'over' && s.game.reason === 'wall');
    ok('game-over overlay and status are plain sentences', /^Game over\. Score \d+\.$/.test(await p.textContent('#overlay-text')) && (await p.textContent('#status')).startsWith('Game over. Score '), await p.textContent('#overlay-text'));
    await sleep(500); const tOver = (await st(p)).game.ticks; await sleep(400); ok('frozen after game over', (await st(p)).game.ticks === tOver);
    ok('errors', errs.length === 0, errs.join('|'));
    await ctx.close();
  }

  // ---- Scoring + best persistence via bot with real key presses ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const p = await ctx.newPage();
    await p.addInitScript(WALLS);
    await p.goto(url('?seed=11&debug=1'));
    await p.click('#btn-new');
    const key = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
    const opp = { up: 'down', down: 'up', left: 'right', right: 'left' };
    const t0 = Date.now(); let s = await st(p);
    while (s.mode !== 'over' && s.game.score < 3 && Date.now() - t0 < 30000) {
      const h = s.game.snake[0], f = s.game.food; if (!f) break;
      let want = f.x > h.x ? 'right' : f.x < h.x ? 'left' : f.y > h.y ? 'down' : 'up';
      if (want === opp[s.game.dir]) want = h.y < s.game.rows - 1 ? 'down' : 'up';
      if (want !== s.game.dir || s.mode === 'ready') await p.keyboard.press(key[want]);
      await sleep(70); s = await st(p);
    }
    ok('bot ate food: score >= 1 and length = 3 + score', s.game.score >= 1 && s.game.snake.length === 3 + s.game.score, `score=${s.game.score} len=${s.game.snake.length}`);
    ok('score shown in DOM', (await p.textContent('#score')) === String(s.game.score));
    const sc = s.game.score;
    // finish run by steering into the wall
    await p.keyboard.press('ArrowUp'); await p.waitForFunction(() => window.classicGamesDebug.state().mode === 'over', null, { timeout: 8000 }).catch(() => {});
    s = await st(p);
    if (s.mode !== 'over') { await p.keyboard.press('ArrowLeft'); await p.waitForFunction(() => window.classicGamesDebug.state().mode === 'over', null, { timeout: 8000 }).catch(() => {}); s = await st(p); }
    ok('run ended', s.mode === 'over');
    const stored = await p.evaluate(() => localStorage.getItem('classic-games.best.prototype-v3'));
    ok('best stored per rules profile under the v3 key', stored && JSON.parse(stored).best['slow|classic|clear|walls|bonus'] === s.game.score && s.game.score >= sc, stored);
    ok('best shown', (await p.textContent('#best')) === String(s.game.score));
    await p.reload(); ok('best survives reload', (await p.textContent('#best')) === String(s.game.score));
    await p.click('[data-open=dlg-top]'); ok('top score dialog lists the recorded best', (await p.evaluate(() => [...document.querySelectorAll('#top-list li')].map(l => l.textContent))).some(t => t.endsWith(': ' + s.game.score)));
    await ctx.close();
  }

  // ---- Storage failure ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.addInitScript(() => {
      const thrower = () => { throw new DOMException('denied', 'SecurityError'); };
      Storage.prototype.getItem = thrower; Storage.prototype.setItem = thrower;
    });
    await p.goto(url('?seed=11&debug=1'));
    ok('page loads with throwing storage', errs.length === 0, errs.join('|'));
    await openSetup(p); await p.click('label.radio:has(input[name=edges][value=walls])'); await p.keyboard.press('Escape');
    ok('game rules still work for the session when storage throws (note says not saved)', (await p.textContent('#rules-note')).includes('Not saved on this device'), await p.textContent('#rules-note'));
    await p.click('#btn-new'); await p.keyboard.press('ArrowRight');
    await p.waitForFunction(() => window.classicGamesDebug.state().mode === 'over', null, { timeout: 9000 });
    ok('game playable and ends; no errors', errs.length === 0, errs.join('|'));
    ok('best labelled session-only when storage fails', (await p.textContent('#best-note')).includes('session'));
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.addInitScript(() => { for (const k of ['v3', 'v2', 'v1']) localStorage.setItem('classic-games.best.prototype-' + k, '{corrupt'); });
    await p.goto(url('?debug=1'));
    ok('corrupt stored best ignored', errs.length === 0 && (await p.textContent('#best')) === '0');
    await ctx.close();
  }

  // ---- Mobile touch path (Playwright touch emulation) ----
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.addInitScript(() => localStorage.setItem('classic-games.ui', JSON.stringify({ v: 1, chosen: { dpad: 'on' } })));
    await p.goto(url('?seed=3&debug=1'));
    const tap = async (sel) => { await p.locator(sel).scrollIntoViewIfNeeded(); const b = await p.locator(sel).boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
    await tap('#btn-new');
    let s = await st(p); ok('touch: New game', s.mode === 'ready');
    // the phone board is tall and the snake starts heading down, so Left starts the run
    await tap('.dpad .left'); s = await st(p); ok('touch: D-pad Left starts run', s.mode === 'running' && s.game.shape === 'tall');
    await sleep(350); await tap('.dpad .up'); await sleep(350); s = await st(p); ok('touch: D-pad Up turns', s.game.dir === 'up');
    await tap('.dpad .down'); s = await st(p); ok('touch: reversal via D-pad ignored', s.game.queue.length === 0);
    await tap('#btn-pause'); s = await st(p); ok('touch: Pause', s.mode === 'paused');
    ok('touch: D-pad disabled while paused', await p.evaluate(() => [...document.querySelectorAll('.dpad-btn')].every(b => b.disabled)));
    await tap('#btn-continue'); s = await st(p); ok('touch: Continue', s.mode === 'running');
    const sizes = await p.evaluate(() => [...document.querySelectorAll('.dpad-btn,.actions .btn,.header-actions .btn')].filter(b => b.offsetParent).map(b => { const r = b.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); }));
    ok('touch targets >= 44px', sizes.every(z => z.split('x').every(n => +n >= 44)), sizes.join(','));
    ok('page does not scroll horizontally', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    ok('errors (touch)', errs.length === 0, errs.join('|'));
    await p.screenshot({ path: process.argv[2] + '/play-touch-390x844.png' });
    await ctx.close();
  }

  // ---- Speed setting ----
  const speedOf = async (p) => (await st(p)).game.speed;
  const ticksIn = async (p, ms) => { const a = (await st(p)).game.ticks; await sleep(ms); return (await st(p)).game.ticks - a; };
  const openSettings = async (p) => { await p.evaluate(() => document.getElementById('btn-setup').click()); };
  const pickSpeed = async (p, v) => { await p.click(`label.radio:has(input[name=speed][value=${v}])`); };
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.goto(url('?seed=3&debug=1'));
    ok('default speed is Slow (300 ms) with no saved choice', await speedOf(p) === 'slow' && (await st(p)).game.tickMs === 300 && (await p.textContent('#speed-name')) === 'Slow');
    ok('nothing is written to storage until the user chooses', await p.evaluate(() => localStorage.getItem('classic-games.speed')) === null);
    ok('page title and heading copy', (await p.title()) === 'Snake | Classic Games' && (await p.textContent('h1')).trim() === 'Snake' && (await p.textContent('.site-footer')).trim() === 'Classic Games' && (await p.textContent('.tagline')).trim() === 'Inspired by classic mobile games.');
    const bodyText = await p.evaluate(() => document.body.textContent.replace(/\s+/g, ' '));
    ok('no em or en dashes in any visible copy (including dialogs)', !/[\u2013\u2014]/.test(bodyText));
    ok('no Early prototype badge or repeated board disclaimer', !/early prototype/i.test(bodyText) && (await p.locator('.badge, .board-note').count()) === 0);
    ok('one About note, inside Instructions', (bodyText.match(/An early version of Classic Games\. Gameplay may differ from the originals\./g) || []).length === 1 && (await p.locator('#dlg-help .about').count()) === 1);
    ok('Level selectors and unfinished-feature wording are not shown', !/unavailable|not implemented|why are|choose a level/i.test(bodyText) && (await p.locator('#sel-level, #sel-maze, input[type=checkbox]').count()) === 0);
    await p.click('[data-open=dlg-top]'); ok('Top score shows No score yet for a fresh profile', (await p.textContent('#top-text')) === 'No score yet.'); await p.keyboard.press('Escape');
    await openSettings(p);
    const labels = await p.evaluate(() => [...document.querySelectorAll('label.radio:has(input[name=speed])')].map(l => l.textContent.replace(/\s+/g, ' ').trim()));
    ok('settings list Slow 300 / Medium 220 / Fast 150', labels.join('|') === 'Slow (300 ms per step)|Medium (220 ms per step)|Fast (150 ms per step)', labels.join('|'));
    ok('Slow radio checked by default', await p.isChecked('input[name=speed][value=slow]'));
    ok('help text: Applies to new games.', (await p.textContent('#speed-note')) === 'Applies to new games.', await p.textContent('#speed-note'));
    // keyboard operation of the radio group
    await p.focus('input[name=speed][value=slow]'); await p.keyboard.press('ArrowDown');
    ok('keyboard: ArrowDown moves the speed radio to Medium', await p.isChecked('input[name=speed][value=medium]') && await speedOf(p) === 'medium');
    ok('menu state adopts the new speed immediately', (await p.textContent('#speed-name')) === 'Medium' && (await st(p)).game.tickMs === 220);
    await pickSpeed(p, 'slow');
    ok('choice saved under classic-games.speed', await p.evaluate(() => localStorage.getItem('classic-games.speed')) === 'slow');
    await p.keyboard.press('Escape');
    await p.reload(); await p.waitForFunction(() => window.classicGamesDebug);
    ok('speed preference survives reload', await speedOf(p) === 'slow' && (await p.textContent('#speed-name')) === 'Slow');
    await openSettings(p); ok('radio reflects the saved speed after reload', await p.isChecked('input[name=speed][value=slow]')); await p.keyboard.press('Escape');

    // real timing per speed
    await p.click('#btn-new'); await p.keyboard.press('ArrowRight'); // heading right keeps 13 cells before the wall
    let s = await st(p); ok('Slow run records 300 ms ticks', s.game.speed === 'slow' && s.game.tickMs === 300);
    const slowTicks = await ticksIn(p, 1500);
    ok('Slow: about 5 ticks in 1.5 s (300 ms/tick)', slowTicks >= 4 && slowTicks <= 6, 'ticks=' + slowTicks);

    // change while running: the run keeps its timing; applies to next New game
    await openSettings(p);
    s = await st(p); ok('opening Settings pauses the run', s.mode === 'paused');
    await pickSpeed(p, 'fast');
    ok('note says the current run keeps its speed', (await p.textContent('#speed-note')) === 'This run keeps Slow. Fast starts with your next new game.', await p.textContent('#speed-note'));
    s = await st(p); ok('existing run keeps tickMs 300 after changing the setting', s.game.speed === 'slow' && s.game.tickMs === 300);
    await p.keyboard.press('Escape');
    ok('HUD still shows the run speed (Slow)', (await p.textContent('#speed-name')) === 'Slow');
    await p.click('#btn-continue');
    const contTicks = await ticksIn(p, 1200);
    ok('resumed run still ticks at 300 ms (not 150): about 4 ticks in 1.2 s', contTicks >= 3 && contTicks <= 5, 'ticks=' + contTicks);
    await p.click('#btn-new'); await p.click('#dlg-confirm button[value=confirm]');
    await p.waitForFunction(() => window.classicGamesDebug.state().mode === 'ready');
    s = await st(p); ok('next New game uses the new speed (Fast 150 ms)', s.game.speed === 'fast' && s.game.tickMs === 150 && (await p.textContent('#speed-name')) === 'Fast');
    await p.keyboard.press('ArrowRight');
    const fastTicks = await ticksIn(p, 1500);
    ok('Fast: about 10 ticks in 1.5 s (150 ms/tick)', fastTicks >= 8 && fastTicks <= 12, 'ticks=' + fastTicks);
    await p.keyboard.press('ArrowUp'); // turn away from the wall before the pause checks
    // pause/resume intact at the new speed
    await p.keyboard.press(' '); const f1 = (await st(p)).game.ticks; await sleep(500);
    ok('pause freezes ticks at Fast', (await st(p)).mode === 'paused' && (await st(p)).game.ticks === f1);
    await p.keyboard.press('p'); ok('resume works at Fast', (await st(p)).mode === 'running');
    ok('speed change: no errors', errs.length === 0, errs.join('|'));
    await ctx.close();
  }

  // ---- Explicitly saved speeds are preserved ----
  for (const saved of ['slow', 'medium', 'fast']) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const p = await ctx.newPage();
    await p.addInitScript(v => { localStorage.setItem('classic-games.speed', v); }, saved);
    await p.goto(url('?debug=1'));
    ok(`saved ${saved} speed is kept on load`, await speedOf(p) === saved && (await st(p)).game.tickMs === { slow: 300, medium: 220, fast: 150 }[saved]);
    await ctx.close();
  }

  // ---- Best scores separated by speed; legacy data preserved ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const p = await ctx.newPage();
    await p.addInitScript(() => { if (!localStorage.getItem('classic-games.speed')) localStorage.setItem('classic-games.speed', 'fast'); localStorage.setItem('classic-games.rules.v2', JSON.stringify({ v: 2, chosen: { edges: 'walls' } })); });
    await p.goto(url('?seed=11&debug=1'));
    await p.click('#btn-new');
    const key = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
    const opp = { up: 'down', down: 'up', left: 'right', right: 'left' };
    const t0 = Date.now(); let s = await st(p);
    while (s.mode !== 'over' && s.game.score < 2 && Date.now() - t0 < 30000) {
      const h = s.game.snake[0], f = s.game.food; if (!f) break;
      let want = f.x > h.x ? 'right' : f.x < h.x ? 'left' : f.y > h.y ? 'down' : 'up';
      if (want === opp[s.game.dir]) want = h.y < s.game.rows - 1 ? 'down' : 'up';
      if (want !== s.game.dir || s.mode === 'ready') await p.keyboard.press(key[want]);
      await sleep(50); s = await st(p);
    }
    const fastScore = s.game.score;
    ok('bot scored at Fast', s.game.speed === 'fast' && fastScore >= 1, 'score=' + fastScore);
    await p.keyboard.press('ArrowUp'); await p.waitForFunction(() => window.classicGamesDebug.state().mode === 'over', null, { timeout: 8000 }).catch(() => {});
    s = await st(p);
    if (s.mode !== 'over') { await p.keyboard.press('ArrowLeft'); await p.waitForFunction(() => window.classicGamesDebug.state().mode === 'over', null, { timeout: 8000 }).catch(() => {}); s = await st(p); }
    const stored = JSON.parse(await p.evaluate(() => localStorage.getItem('classic-games.best.prototype-v3')));
    ok('Fast best stored under its own profile only', stored.best['fast|classic|clear|walls|bonus'] === s.game.score && Object.keys(stored.best).length === 1, JSON.stringify(stored));
    await openSettings(p); await pickSpeed(p, 'slow'); await p.keyboard.press('Escape');
    await p.click('#btn-new');
    ok('Slow run shows its own best (0), not the Fast score', (await p.textContent('#best')) === '0' && (await p.textContent('#best-note')).includes('this setup'));
    await p.click('[data-open=dlg-top]');
    const top = await p.evaluate(() => [...document.querySelectorAll('#top-list li')].map(l => l.textContent));
    ok('Top score lists the setup that scored, with its rules', top.length === 1 && top[0] === `Fast, Classic, Clear field, Solid walls, Bonus on: ${s.game.score}`, top.join('|'));
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const p = await ctx.newPage();
    await p.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('classic-games.best.prototype-v1', JSON.stringify({ v: 1, best: 5 })); } });
    await p.goto(url('?seed=3&debug=1'));
    ok('legacy best is not shown at the default Slow speed', (await p.textContent('#best')) === '0');
    await openSettings(p); await pickSpeed(p, 'fast'); await p.keyboard.press('Escape');
    ok('legacy best is not shown under the Fast profile with wrap and bonus either', (await p.textContent('#best')) === '0');
    await openSetup(p); await p.click('label.radio:has(input[name=edges][value=walls])'); await p.click('label.radio:has(input[name=bonus][value=off])'); await p.keyboard.press('Escape');
    ok('legacy best (150 ms, classic, clear, solid walls, no bonus) appears under that profile', (await p.textContent('#best')) === '5');
    ok('legacy v1 data left untouched', await p.evaluate(() => localStorage.getItem('classic-games.best.prototype-v1')) === JSON.stringify({ v: 1, best: 5 }));
    await ctx.close();
  }

  // ---- Preference storage failure / invalid ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.addInitScript(() => { const t = () => { throw new DOMException('denied', 'SecurityError'); }; Storage.prototype.getItem = t; Storage.prototype.setItem = t; });
    await p.goto(url('?seed=3&debug=1'));
    await openSettings(p); await pickSpeed(p, 'medium');
    ok('speed choice works for the session when storage throws', await speedOf(p) === 'medium' && (await p.textContent('#speed-note')).includes('Not saved on this device'), await p.textContent('#speed-note'));
    await p.keyboard.press('Escape'); await p.click('#btn-new');
    ok('New game uses the session speed; no errors', (await st(p)).game.tickMs === 220 && errs.length === 0, errs.join('|'));
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const p = await ctx.newPage();
    await p.addInitScript(() => { localStorage.setItem('classic-games.speed', 'turbo'); });
    await p.goto(url('?debug=1'));
    ok('invalid stored speed falls back to Slow', await speedOf(p) === 'slow');
    await ctx.close();
  }

  // ---- Settings dialog fit and touch ----
  for (const [w, h, theme] of [[320, 568, 'colour'], [320, 568, 'night'], [390, 844, 'lcd'], [768, 1024, 'colour'], [1366, 768, 'colour']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 900 });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.addInitScript(t => { try { localStorage.setItem('classic-games.theme', t); } catch (e) { /* ignore */ } }, theme);
    await p.goto(url('?debug=1'));
    await openSettings(p);
    const m = await p.evaluate(() => { const d = document.getElementById('dlg-setup'); const r = d.getBoundingClientRect(); const close = d.querySelector('.dlg-foot button').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, vh: innerHeight, vw: innerWidth, scrolls: d.scrollHeight > d.clientHeight, radios: [...d.querySelectorAll('label.radio')].map(l => Math.round(l.getBoundingClientRect().height)), closeH: Math.round(close.height) }; });
    ok(`settings dialog fits ${w}x${h} ${theme}`, m.top >= 0 && m.bottom <= m.vh && m.left >= 0 && m.right <= m.vw, JSON.stringify(m));
    ok(`settings radios and Close are at least 44 px high at ${w}x${h}`, m.radios.every(z => z >= 44) && m.closeH >= 44, JSON.stringify(m.radios) + ' close=' + m.closeH);
    await p.locator('#dlg-setup .dlg-foot button').scrollIntoViewIfNeeded();
    const cb = await p.locator('#dlg-setup .dlg-foot button').boundingBox();
    ok(`Close reachable (scrolls if needed) at ${w}x${h}`, cb && cb.y >= 0 && cb.y + cb.height <= h, JSON.stringify(cb));
    if (w === 320 && theme === 'colour') await p.screenshot({ path: process.argv[2] + '/settings-320x568.png' });
    if (w === 390) await p.screenshot({ path: process.argv[2] + '/settings-390x844.png' });
    if (w < 900) {
      const tap = async (sel) => { await p.locator(sel).scrollIntoViewIfNeeded(); const b = await p.locator(sel).boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
      await p.locator('label.radio:has(input[name=speed][value=fast])').scrollIntoViewIfNeeded();
      await tap('label.radio:has(input[name=speed][value=fast])');
      ok(`touch: tapping Fast selects it at ${w}x${h}`, await p.evaluate(() => localStorage.getItem('classic-games.speed')) === 'fast');
    }
    ok(`settings: no errors at ${w}x${h}`, errs.length === 0, errs.join('|'));
    await ctx.close();
  }
  await browser.close();
  const failed = R.filter(r => !r.pass);
  R.forEach(r => console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.extra && !r.pass ? '  [' + r.extra + ']' : '')));
  console.log(`\n${R.length - failed.length}/${R.length} passed`);
})();
