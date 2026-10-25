// Browser checks for the phone-first controls: swipe, tall board, overlays, D-pad toggle,
// speed cell, snake colour and style, board picker. Usage as play.js.
const { chromium } = require('playwright');
const INDEX = require('url').pathToFileURL(require('path').resolve(__dirname, '../../index.html')).href;
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const R = []; const ok = (name, cond, extra) => { R.push({ name, pass: !!cond, extra }); };
const st = (p) => p.evaluate(() => window.classicGamesDebug.state());
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const phone = (browser, q) => browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
  .then(async (ctx) => { const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e))); await p.goto(INDEX + '?debug=1&seed=3' + (q || '')); return { ctx, p, errs }; });

// Touch drag on the board through CDP, so the browser sees a real touch gesture.
async function drag(p, cdp, from, to) {
  const pt = (x, y) => [{ x, y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(from[0], from[1]) });
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(from[0] + (to[0] - from[0]) * i / steps, from[1] + (to[1] - from[1]) * i / steps) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROMIUM });

  // ---- phone: tall board, overlay, swipes ----
  {
    const { ctx, p, errs } = await phone(browser);
    const cdp = await ctx.newCDPSession(p);
    let s = await st(p);
    ok('phone gets the tall 14x21 board (same 294 cells)', s.game.shape === 'tall' && s.game.cols === 14 && s.game.rows === 21 && (await p.getAttribute('#layout', 'data-shape')) === 'tall');
    ok('menu shows a big Play button', (await p.textContent('#ov-primary')) === 'Play' && await p.isVisible('#ov-primary') && !(await p.isVisible('#ov-secondary')));
    ok('board is touch-action none', await p.evaluate(() => getComputedStyle(document.getElementById('board')).touchAction) === 'none');
    await p.tap('#ov-primary'); await sleep(120); s = await st(p);
    ok('Play starts a ready run', s.mode === 'ready' && !(await p.isVisible('#ov-primary')));
    const b = await p.locator('#board').boundingBox();
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    await drag(p, cdp, [cx, cy], [cx - 80, cy]); await sleep(450); s = await st(p);
    ok('swipe left starts the run heading left', s.mode === 'running' && s.game.dir === 'left', s.game.dir);
    await drag(p, cdp, [cx, cy], [cx, cy - 80]); await sleep(350); s = await st(p);
    ok('swipe up turns up', s.game.dir === 'up', s.game.dir);
    await drag(p, cdp, [cx, cy], [cx + 80, cy]); await sleep(350); s = await st(p);
    ok('swipe right turns right', s.game.dir === 'right', s.game.dir);
    await drag(p, cdp, [cx, cy], [cx, cy + 80]); await sleep(350); s = await st(p);
    ok('swipe down turns down', s.game.dir === 'down', s.game.dir);
    const q0 = (await st(p)).game.queue.length;
    await drag(p, cdp, [cx, cy], [cx + 10, cy + 8]); await sleep(60); s = await st(p);
    ok('a short movement is ignored', s.game.queue.length === q0 && s.game.dir === 'down');
    // chained turns in one long drag: right then up
    await sleep(350);
    const pt = (x, y) => [{ x, y, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(cx - 60, cy) });
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(cx - 60 + i * 10, cy) });
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(cx + 20, cy - i * 10) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(800); s = await st(p);
    ok('one long drag chains two turns (down to right to up; up straight from down would be a reversal)', s.mode === 'running' && s.game.dir === 'up', s.game.dir);
    // page scroll outside the board still works
    const y0 = await p.evaluate(() => scrollY);
    await p.evaluate(() => window.scrollTo(0, 60));
    ok('page can still scroll outside the board', (await p.evaluate(() => scrollY)) > y0);
    await p.evaluate(() => window.scrollTo(0, 0));
    // pause overlay (restart a clean run first: the turns above may have ended the last one)
    await p.tap('#btn-new'); await sleep(200); if (await p.isVisible('#dlg-confirm')) await p.click('#dlg-confirm button[value=confirm]'); else if ((await st(p)).mode === 'menu') await p.tap('#ov-primary');
    await sleep(150); await drag(p, cdp, [cx, cy], [cx - 80, cy]); await sleep(100);
    await sleep(400); await p.tap('#btn-pause'); await sleep(150); s = await st(p);
    ok('Pause shows Continue and New game on the board', s.mode === 'paused' && (await p.textContent('#ov-primary')) === 'Continue' && (await p.textContent('#ov-secondary')) === 'New game' && await p.isVisible('#btn-continue') && !(await p.isVisible('#btn-pause')));
    await p.tap('#ov-primary'); await sleep(120); s = await st(p);
    ok('board Continue resumes', s.mode === 'running');
    ok('no errors (phone swipe)', errs.length === 0, errs.join('|'));
    await ctx.close();
  }

  // ---- D-pad toggle, speed cell, chips, colour and style ----
  {
    const { ctx, p, errs } = await phone(browser);
    ok('D-pad is hidden by default', !(await p.isVisible('.dpad')) && (await p.getAttribute('#btn-dpad', 'aria-pressed')) === 'false');
    await p.tap('#btn-dpad');
    ok('D-pad toggle shows it and saves the choice', await p.isVisible('.dpad') && (await p.getAttribute('#btn-dpad', 'aria-pressed')) === 'true' &&
      JSON.parse(await p.evaluate(() => localStorage.getItem('classic-games.ui'))).chosen.dpad === 'on');
    await p.reload(); ok('D-pad choice survives a reload', await p.isVisible('.dpad'));
    await p.tap('#btn-dpad');
    ok('D-pad toggle hides it again', !(await p.isVisible('.dpad')));

    await p.tap('#btn-speed'); await sleep(120); let s = await st(p);
    ok('speed cell cycles Slow to Medium for the next game', (await p.textContent('#speed-name')) === 'Medium' && s.game.tickMs === 220, String(s.game.tickMs));
    await p.tap('#btn-speed'); await sleep(120); await p.tap('#btn-speed'); await sleep(120); s = await st(p);
    ok('speed cell wraps back to Slow', (await p.textContent('#speed-name')) === 'Slow' && s.game.speed === 'slow');

    await p.tap('#btn-setup');
    ok('the Game settings button is visible on a phone and opens the dialog', await p.evaluate(() => document.getElementById('dlg-setup').open && document.getElementById('dlg-setup-t').textContent === 'Game settings'));
    const tiles = await p.evaluate(() => [...document.querySelectorAll('.tile')].map(t => t.querySelector('input').value));
    ok('12 boards in the picker', tiles.length === 12 && new Set(tiles).size === 12, tiles.join(','));
    ok('board thumbnails are drawn', await p.evaluate(() => [...document.querySelectorAll('canvas.thumb')].filter(c => c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some(v => v)).length === 12));
    await p.click('label.radio:has(input[name=board][value=zigzag])');
    ok('picking a board updates the rules line and the next run', (await p.textContent('#rules-line')).includes('zigzag maze') && (await st(p)).game.board === 'zigzag');
    await p.keyboard.press('Escape');

    await p.evaluate(() => document.getElementById('btn-setup').click());
    await p.click('label.radio:has(input[name=snakecolour][value=violet])');
    await p.click('label.radio:has(input[name=snakestyle][value=pixel])');
    const skin = JSON.parse(await p.evaluate(() => localStorage.getItem('classic-games.skin'))).chosen;
    ok('snake colour and style are saved only once chosen', skin.colour === 'violet' && skin.style === 'pixel');
    await p.keyboard.press('Escape');
    await p.reload();
    ok('colour and style survive a reload', await p.evaluate(() => document.querySelector('input[name=snakecolour]:checked').value === 'violet' && document.querySelector('input[name=snakestyle]:checked').value === 'pixel'));
    ok('no errors (controls)', errs.length === 0, errs.join('|'));
    await ctx.close();
  }

  // ---- sound and vibration settings ----
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.addInitScript(() => { window.__vib = []; navigator.vibrate = (x) => { window.__vib.push(x); return true; }; });
    await p.goto(INDEX + '?debug=1&seed=3');
    ok('sound and vibration default to on', await p.evaluate(() => document.querySelector('input[name=sound]:checked').value === 'on' && document.querySelector('input[name=haptics]:checked').value === 'on'));
    ok('nothing is stored until the player chooses', await p.evaluate(() => localStorage.getItem('classic-games.app')) === null);
    await p.tap('[data-open=dlg-settings]'); await sleep(200);
    await p.click('label.radio:has(input[name=haptics][value=off])'); await sleep(100);
    const stored = JSON.parse(await p.evaluate(() => localStorage.getItem('classic-games.app'))).chosen;
    ok('turning vibration off is saved in the app key, not a game key', stored.haptics === 'off' && stored.sound === undefined);
    const before = await p.evaluate(() => window.__vib.length);
    await p.click('label.radio:has(input[name=haptics][value=on])'); await sleep(100);
    ok('turning vibration on gives a short preview buzz', (await p.evaluate(() => window.__vib.length)) === before + 1);
    ok('no errors (sound settings)', errs.length === 0, errs.join('|'));
    await ctx.close();
  }

  // ---- animations: on by default, off with Reduce motion, switchable ----
  {
    const { ctx, p, errs } = await phone(browser);
    ok('animations are on by default', await p.evaluate(() => document.querySelector('input[name=fx]:checked').value) === 'on');
    await p.tap('#ov-primary'); await sleep(100);
    await p.evaluate(() => { const g = window.classicGamesDebug.state().game.snake[0]; window.classicGamesDebug.fx.trigger('ate', { x: g.x, y: g.y, points: 1 }); });
    await sleep(80);
    ok('an eat effect creates sparkles and a floating score', await p.evaluate(() => window.classicGamesDebug.fx.state.particles.length > 0 && window.classicGamesDebug.fx.state.floaters.length > 0));
    await p.evaluate(() => document.getElementById('btn-setup').click());
    await p.click('label.radio:has(input[name=fx][value=off])');
    ok('turning animations off is saved', JSON.parse(await p.evaluate(() => localStorage.getItem('classic-games.ui'))).chosen.fx === 'off');
    ok('no errors (effects)', errs.length === 0, errs.join('|'));
    await ctx.close();
    const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const p2 = await c2.newPage(); await p2.goto(INDEX + '?debug=1&seed=3');
    ok('Reduce motion turns animations off until chosen', await p2.evaluate(() => document.querySelector('input[name=fx]:checked').value) === 'off' && await p2.evaluate(() => localStorage.getItem('classic-games.ui')) === null);
    await c2.close();
  }

  // ---- desktop stays wide; game over overlay ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.addInitScript(() => localStorage.setItem('classic-games.rules.v2', JSON.stringify({ v: 2, chosen: { edges: 'walls' } })));
    await p.goto(INDEX + '?debug=1&seed=3');
    let s = await st(p);
    ok('desktop keeps the wide 21x14 board', s.game.shape === 'wide' && s.game.cols === 21);
    await p.click('#ov-primary'); await p.keyboard.press('ArrowUp');
    for (let i = 0; i < 40 && (await st(p)).mode !== 'over'; i++) await sleep(250);
    s = await st(p);
    ok('game over shows Play again', s.mode === 'over' && (await p.textContent('#ov-primary')) === 'Play again' && (await p.textContent('#overlay-text')).startsWith('Game over'));
    await p.click('#ov-primary'); s = await st(p);
    ok('Play again starts a fresh ready run', s.mode === 'ready' && s.game.score === 0);
    ok('no errors (desktop)', errs.length === 0, errs.join('|'));
    await ctx.close();
  }

  await browser.close();
  let fail = 0;
  for (const r of R) { if (!r.pass) fail++; console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.pass ? '' : '  ' + (r.extra || ''))); }
  console.log(`${R.length - fail}/${R.length} passed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
