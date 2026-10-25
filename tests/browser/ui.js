// Browser checks for the header icon navigation, dialog behaviour, the split between
// Settings and Game setup, and edge default migration. Requires an existing Playwright
// install (not a project dependency) and a Chromium binary.
// Usage: NODE_PATH=<dir with playwright> node tests/browser/ui.js <output dir>
const { chromium } = require('playwright');
const INDEX = require('url').pathToFileURL(require('path').resolve(__dirname, '../../index.html')).href;
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const R = []; const ok = (name, cond, extra) => { R.push({ name, pass: !!cond, extra }); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const lum = (c) => { const f = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const rgb = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);

async function open(browser, { viewport, touch, theme, init } = {}) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1366, height: 768 }, hasTouch: !!touch });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(([t, i]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    if (t) localStorage.setItem('classic-games.theme', t);
    if (i) for (const [k, v] of Object.entries(i)) localStorage.setItem(k, v);
  }, [theme || null, init || null]);
  await p.goto(INDEX + '?debug=1&seed=3');
  return { ctx, p, errs };
}

const tipInfo = (p, i) => p.evaluate((idx) => {
  const b = document.querySelectorAll('.icon-btn')[idx];
  const t = b.querySelector('.tip');
  const cs = getComputedStyle(t);
  const r = t.getBoundingClientRect();
  return { text: t.textContent, visible: cs.visibility === 'visible' && parseFloat(cs.opacity) > 0.9, left: r.left, right: r.right, top: r.top, bottom: r.bottom, vw: innerWidth, vh: innerHeight, color: cs.color, bg: cs.backgroundColor };
}, i);

(async () => {
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const NAMES = ['Top score', 'Instructions', 'App settings', 'Full screen'];

  // ---- header icon navigation ----
  for (const [w, h, touch] of [[1366, 768, false], [390, 844, true], [320, 568, true]]) {
    const { ctx, p, errs } = await open(browser, { viewport: { width: w, height: h }, touch });
    const tag = `${w}x${h}`;
    const info = await p.evaluate(() => [...document.querySelectorAll('.header-actions > *')].map(b => { const r = b.getBoundingClientRect(); return { tag: b.tagName, name: b.getAttribute('aria-label'), w: Math.round(r.width), h: Math.round(r.height), svg: !!b.querySelector('svg[aria-hidden=true]'), text: [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('') }; }));
    ok(`[${tag}] header has four icon buttons with persistent names and inline SVG`, info.length === 4 && info.every((b, i) => b.tag === 'BUTTON' && b.name === NAMES[i] && b.svg && b.text === ''), JSON.stringify(info));
    ok(`[${tag}] each icon target is at least 44x44`, info.every(b => b.w >= 44 && b.h >= 44), JSON.stringify(info.map(b => b.w + 'x' + b.h)));
    for (const n of NAMES) ok(`[${tag}] "${n}" is exposed to assistive technology by its name`, await p.getByRole('button', { name: n, exact: true }).count() === 1);
    ok(`[${tag}] no horizontal overflow with the icon header`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    for (let i = 0; i < 3; i++) { const t = await tipInfo(p, i); if (i === 0) ok(`[${tag}] tooltips are hidden until hover or focus`, !t.visible); }

    if (!touch) {
      for (let i = 0; i < 3; i++) {
        await p.locator('.icon-btn').nth(i).hover();
        await sleep(220);
        const t = await tipInfo(p, i);
        ok(`[${tag}] hover shows the "${NAMES[i]}" label inside the viewport`, t.visible && t.text === NAMES[i] && t.left >= 0 && t.right <= t.vw && t.bottom <= t.vh, JSON.stringify(t));
      }
      await p.mouse.move(700, 400); await sleep(220);
      ok(`[${tag}] tooltip hides when the pointer leaves`, !(await tipInfo(p, 2)).visible);
    }

    // keyboard focus
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    await p.keyboard.press('Tab'); // wordmark link
    for (let i = 0; i < 3; i++) {
      await p.keyboard.press('Tab');
      await sleep(220);
      const f = await p.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { label: a.getAttribute('aria-label'), ow: parseFloat(cs.outlineWidth), os: cs.outlineStyle, oc: cs.outlineColor, bg: getComputedStyle(document.body).backgroundColor }; });
      const t = await tipInfo(p, i);
      ok(`[${tag}] keyboard focus on "${NAMES[i]}" shows its label`, f.label === NAMES[i] && t.visible && t.text === NAMES[i] && t.left >= 0 && t.right <= t.vw, JSON.stringify({ f, t }));
      ok(`[${tag}] "${NAMES[i]}" has a visible focus ring (3 px solid, 3:1 against the page)`, f.os === 'solid' && f.ow >= 3 && ratio(rgb(f.oc), rgb(f.bg)) >= 3, JSON.stringify(f));
      if (i === 0) {
        await p.keyboard.press('Escape'); await sleep(220);
        ok(`[${tag}] Escape dismisses a shown tooltip without moving focus`, !(await tipInfo(p, 0)).visible && await p.evaluate(() => document.activeElement.getAttribute('aria-label')) === 'Top score');
        await p.keyboard.press('Tab'); await sleep(220);
        i++; // the focus moved to the next button; check it here
        const t2 = await tipInfo(p, 1);
        ok(`[${tag}] the next focus shows its label again`, t2.visible && t2.text === 'Instructions');
        const f2 = await p.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { ow: cs.outlineWidth, os: cs.outlineStyle }; });
        ok(`[${tag}] "Instructions" has a visible focus ring`, f2.os === 'solid' && parseFloat(f2.ow) >= 3);
      }
    }
    const tc = await tipInfo(p, 2);
    ok(`[${tag}] tooltip text has at least 4.5:1 contrast`, ratio(rgb(tc.color), rgb(tc.bg)) >= 4.5, `${tc.color} on ${tc.bg}`);
    // activation by keyboard
    await p.keyboard.press('Enter'); await sleep(150);
    ok(`[${tag}] Enter on the focused Settings icon opens Settings`, await p.evaluate(() => document.getElementById('dlg-settings').open));
    await p.keyboard.press('Escape'); await sleep(100);
    ok(`[${tag}] focus returns to the Settings icon after closing`, await p.evaluate(() => document.activeElement.getAttribute('aria-label')) === 'App settings');
    ok(`[${tag}] no errors`, errs.length === 0, errs.join('|'));
    await ctx.close();
  }

  // ---- Settings versus Game setup ----
  {
    const { ctx, p } = await open(browser);
    await p.click('[data-open=dlg-settings]');
    const settings = await p.evaluate(() => [...new Set([...document.querySelectorAll('#dlg-settings input')].map(i => i.name))]);
    ok('App settings hold Theme, Sound and Vibration only', settings.sort().join(',') === 'haptics,sound,theme', settings.join(','));
    ok('Settings has no gameplay rule wording', !/maze|wrap|lives|bonus|edges/i.test(await p.evaluate(() => document.getElementById('dlg-settings').textContent)));
    await p.keyboard.press('Escape');
    await p.click('#btn-setup');
    const setup = await p.evaluate(() => [...new Set([...document.querySelectorAll('#dlg-setup input')].map(i => i.name))]);
    ok('Game settings hold look, speed and rules', setup.sort().join(',') === 'board,bonus,edges,fx,lives,snakecolour,snakestyle,speed', setup.join(','));
    ok('Game settings is titled and says the rules apply to the next run', (await p.textContent('#dlg-setup-t')) === 'Game settings' && (await p.textContent('#setup-summary')).startsWith('Selected for the next run:'));
    await p.keyboard.press('Escape');
    const pos = await p.evaluate(() => { const n = document.getElementById('btn-new').getBoundingClientRect(); const g = document.getElementById('btn-setup').getBoundingClientRect(); const panel = document.querySelector('.panel').getBoundingClientRect(); return { dy: g.top - n.bottom, inPanel: g.left >= panel.left && g.right <= panel.right, h: g.height, label: document.getElementById('btn-setup').textContent }; });
    ok('the Game settings action sits right below New game, inside the controls panel', pos.dy >= 0 && pos.dy < 24 && pos.inPanel && pos.h >= 44 && pos.label === 'Game settings', JSON.stringify(pos));
    ok('the selected rules are shown before New game, with the next game label', (await p.textContent('#rules-line')).startsWith('Next game: '));
    await ctx.close();
  }

  // ---- dialogs open at the top and stay usable ----
  const dlgs = [['dlg-settings', '[data-open=dlg-settings]'], ['dlg-setup', '#btn-setup'], ['dlg-help', '[data-open=dlg-help]'], ['dlg-top', '[data-open=dlg-top]']];
  for (const [w, h, touch] of [[320, 568, true], [390, 844, true], [768, 1024, false], [1366, 768, false]]) {
    const { ctx, p, errs } = await open(browser, { viewport: { width: w, height: h }, touch });
    for (const [id, trigger] of dlgs) {
      const tag = `[${w}x${h}] ${id}`;
      const pageScroll0 = await p.evaluate(() => document.scrollingElement.scrollTop);
      await p.evaluate((t) => document.querySelector(t).click(), trigger); await sleep(120);
      const m = await p.evaluate((dlgId) => {
        const d = document.getElementById(dlgId);
        const r = d.getBoundingClientRect();
        const sc = d.querySelector('.dlg-scroll');
        const sr = sc.getBoundingClientRect();
        const h2 = d.querySelector('h2'); const hr = h2.getBoundingClientRect();
        const close = d.querySelector('.dlg-foot button').getBoundingClientRect();
        const first = d.querySelector('input, p');
        const fr = first.getBoundingClientRect();
        return { open: d.open, top: r.top, bottom: r.bottom, vh: innerHeight, left: r.left, right: r.right, vw: innerWidth, scrollTop: sc.scrollTop, canScroll: sc.scrollHeight > sc.clientHeight, headingVisible: hr.top >= r.top && hr.bottom <= r.bottom && hr.top >= 0, headingFocused: document.activeElement === h2, closeVisible: close.top >= 0 && close.bottom <= innerHeight && close.top >= sr.bottom - 1, closeH: Math.round(close.height), firstVisible: fr.top >= sr.top - 1 && fr.bottom <= sr.bottom + 1, active: document.activeElement.tagName, pageScroll: document.scrollingElement.scrollTop };
      }, id);
      ok(`${tag} opens inside the viewport at the top (height <= 88%)`, m.open && m.top >= 0 && m.bottom <= m.vh && m.left >= 0 && m.right <= m.vw && (m.bottom - m.top) <= m.vh * 0.88 + 1, JSON.stringify(m));
      ok(`${tag} starts scrolled to the top with the heading visible and focused`, m.scrollTop === 0 && m.headingVisible && m.headingFocused, JSON.stringify(m));
      ok(`${tag} first content is visible and Close is in view without scrolling (44 px high)`, m.firstVisible && m.closeVisible && m.closeH >= 44, JSON.stringify(m));
      ok(`${tag} the page behind does not scroll`, m.pageScroll === pageScroll0);
      if (m.canScroll) {
        await p.evaluate((dlgId) => { const sc = document.getElementById(dlgId).querySelector('.dlg-scroll'); sc.scrollTop = sc.scrollHeight; }, id);
        const end = await p.evaluate((dlgId) => { const d = document.getElementById(dlgId); const sc = d.querySelector('.dlg-scroll'); const sr = sc.getBoundingClientRect(); const last = [...sc.querySelectorAll('input, p, li')].pop().getBoundingClientRect(); const close = d.querySelector('.dlg-foot button').getBoundingClientRect(); return { lastVisible: last.bottom <= sr.bottom + 1, closeVisible: close.bottom <= innerHeight, h2: d.querySelector('h2').getBoundingClientRect().top >= 0 }; }, id);
        ok(`${tag} content scrolls inside; the last item is reachable and the heading and Close stay in view`, end.lastVisible && end.closeVisible && end.h2, JSON.stringify(end));
      }
      // keyboard: Tab from the heading reaches the first control
      await p.evaluate((dlgId) => { const d = document.getElementById(dlgId); d.querySelector('.dlg-scroll').scrollTop = 0; d.querySelector('h2').focus(); }, id);
      await p.keyboard.press('Tab');
      const tabbed = await p.evaluate((dlgId) => { const d = document.getElementById(dlgId); const a = document.activeElement; return { inside: d.contains(a), tag: a.tagName, type: a.type || '' }; }, id);
      ok(`${tag} Tab from the heading stays inside the dialog (first control, or the labelled scroll region for text only dialogs)`, tabbed.inside && (id === 'dlg-help' || id === 'dlg-top' ? (tabbed.tag === 'DIV' || tabbed.tag === 'BUTTON') : tabbed.type === 'radio'), JSON.stringify(tabbed));
      await p.keyboard.press('Escape'); await sleep(100);
      ok(`${tag} Escape closes it`, !(await p.evaluate((dlgId) => document.getElementById(dlgId).open, id)));
    }
    ok(`[${w}x${h}] dialogs: no errors`, errs.length === 0, errs.join('|'));
    await ctx.close();
  }

  // ---- edge default and migration ----
  {
    const { ctx, p } = await open(browser);
    ok('fresh profile starts with Wrap around and Clear field', (await p.textContent('#rules-line')).includes('wrap around') && (await p.textContent('#rules-line')) === 'Next game: 1 life, clear field, wrap around edges, bonus food on.');
    await p.click('#btn-new'); await p.keyboard.press('ArrowRight');
    const s = await p.evaluate(() => window.classicGamesDebug.state());
    ok('a fresh run is created with wrap on', s.game.wrap === true && s.game.profile === 'slow|classic|clear|wrap|bonus');
    await ctx.close();
  }
  {
    const v1 = JSON.stringify({ v: 1, board: 'gate', edges: 'walls', lives: 'extra', bonus: 'off' });
    const { ctx, p } = await open(browser, { init: { 'classic-games.rules': v1 } });
    ok('v1 data: board, lives and bonus are kept; the old default walls moves to the new default wrap', (await p.textContent('#rules-line')) === 'Next game: 3 lives, gate maze, wrap around edges, bonus food off.', await p.textContent('#rules-line'));
    ok('reading v1 writes nothing and leaves it untouched', await p.evaluate(() => localStorage.getItem('classic-games.rules.v2')) === null && await p.evaluate(() => localStorage.getItem('classic-games.rules')) === v1);
    await p.click('[data-open=dlg-setup]'); await p.click('label.radio:has(input[name=edges][value=walls])');
    const v2 = JSON.parse(await p.evaluate(() => localStorage.getItem('classic-games.rules.v2')));
    ok('an explicit Solid walls choice is saved with the migrated choices (v2)', v2.v === 2 && v2.chosen.edges === 'walls' && v2.chosen.board === 'gate' && v2.chosen.lives === 'extra' && v2.chosen.bonus === 'off', JSON.stringify(v2));
    await p.keyboard.press('Escape');
    await p.reload(); await p.waitForFunction(() => window.classicGamesDebug);
    ok('the explicit Solid walls choice survives reload', (await p.textContent('#rules-line')).includes('solid walls') && (await p.textContent('#rules-line')).includes('solid walls'));
    ok('v1 data is still untouched', await p.evaluate(() => localStorage.getItem('classic-games.rules')) === v1);
    await ctx.close();
  }
  {
    const { ctx, p } = await open(browser, { init: { 'classic-games.rules': JSON.stringify({ v: 1, board: 'clear', edges: 'wrap', lives: 'classic', bonus: 'on' }) } });
    ok('v1 data that already says wrap keeps wrap', (await p.textContent('#rules-line')).includes('wrap around'));
    await ctx.close();
  }
  {
    const { ctx, p } = await open(browser, { init: { 'classic-games.rules.v2': JSON.stringify({ v: 2, chosen: { edges: 'walls' } }) } });
    ok('an explicit v2 Solid walls choice is honoured on load', (await p.textContent('#rules-line')).includes('solid walls'));
    await ctx.close();
  }

  // ---- reference look (Night = Modern Arcade) and screenshots for the record ----
  {
    const { ctx, p } = await open(browser, { theme: 'night' });
    const v = await p.evaluate(() => { const c = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return { board: c('--board'), snake: c('--snake'), food: c('--food'), bonus: c('--bonus') }; });
    ok('Night theme keeps the dark navy board, bright green snake, red fruit and gold bonus', v.board === '#08111f' && v.snake === '#34e39c' && v.food === '#ff6b5e' && v.bonus === '#ffd166', JSON.stringify(v));
    ok('speed meter shows one of three dots for Slow', await p.evaluate(() => document.getElementById('speed-dots').getAttribute('data-level')) === '1' && await p.locator('.speed-dots i').count() === 3);
    await p.click('#btn-new'); await p.keyboard.press('ArrowUp'); await sleep(900); await p.keyboard.press('Space');
    await p.screenshot({ path: process.argv[2] + '/ui-night-1366.png' });
    await p.hover('[data-open=dlg-top]'); await sleep(250);
    await p.screenshot({ path: process.argv[2] + '/ui-tooltip-1366.png', clip: { x: 900, y: 0, width: 466, height: 120 } });
    await ctx.close();
  }

  await browser.close();
  const failed = R.filter(r => !r.pass);
  R.forEach(r => console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.extra && !r.pass ? '  [' + r.extra + ']' : '')));
  console.log(`\n${R.length - failed.length}/${R.length} passed`);
})();
