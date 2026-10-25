// Pixel checks of the real canvas: connected rounded snake, tapered tail, head with eyes,
// obstacles, food, bonus ring and wrap stubs, in all three themes. Requires an existing
// Playwright install (not a project dependency) and a Chromium binary.
// Usage: NODE_PATH=<dir with playwright> node tests/browser/rendering.js <output dir>
const { chromium } = require('playwright');
const INDEX = require('url').pathToFileURL(require('path').resolve(__dirname, '../../index.html')).href;
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const R = []; const ok = (name, cond, extra) => { R.push({ name, pass: !!cond, extra }); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Runs inside the page. Draws a custom state on the real canvas and exposes pixel probes.
const SETUP = () => {
  const E = window.SnakeEngine, Rn = window.SnakeRender;
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const pal = () => ({ boardLine: css('--board-line'), snake: css('--snake'), snakeHead: css('--snake-head'), snakeEdge: css('--snake-edge'), shine: css('--shine'), eye: css('--eye'), pupil: css('--pupil'), food: css('--food'), bonus: css('--bonus'), obstacle: css('--obstacle'), obstacleEdge: css('--obstacle-edge') });
  const hex = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  window.__t = {
    draw(cells, dir, over) {
      const g = Object.assign({}, E.createGame(Object.assign({ seed: 3 }, (over && over.opts) || {})), { snake: cells.map(([x, y]) => ({ x, y })), dir, food: null }, (over && over.state) || {});
      document.getElementById('overlay').hidden = true;
      window.__t.state = g;
      window.__t.geo = Rn.draw(ctx, g, pal(), canvas.width, canvas.height);
      return { cell: window.__t.geo.layout.cell, w: canvas.width, h: canvas.height };
    },
    px(x, y) { const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data; return [d[0], d[1], d[2], d[3]]; },
    center(cx, cy) { const l = window.__t.geo.layout; return { x: l.ox + (cx + 0.5) * l.cell, y: l.oy + (cy + 0.5) * l.cell, c: l.cell }; },
    // number of opaque pixels along a vertical or horizontal line through (x, y)
    extent(x, y, axis, reach) {
      let n = 0;
      for (let k = -reach; k <= reach; k++) {
        const d = axis === 'v' ? ctx.getImageData(Math.round(x), Math.round(y + k), 1, 1).data : ctx.getImageData(Math.round(x + k), Math.round(y), 1, 1).data;
        if (d[3] > 128) n++;
      }
      return n;
    },
    color(name) { return hex(css(name)); },
    cssHex(name) { return css(name); }
  };
};
const near = (a, b, tol = 14) => a.slice(0, 3).every((v, i) => Math.abs(v - b[i]) <= tol);
const lum = (c) => { const f = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

(async () => {
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  for (const theme of ['colour', 'lcd', 'night']) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.addInitScript(t => { localStorage.setItem('classic-games.theme', t); localStorage.setItem('classic-games.ui', JSON.stringify({ v: 1, chosen: { fx: 'off' } })); }, theme);
    await p.goto(INDEX + '?debug=1&seed=3');
    await p.evaluate(SETUP);
    const T = (name, cond, extra) => ok(`[${theme}] ${name}`, cond, extra);

    // straight path
    const straight = [[10, 7], [9, 7], [8, 7], [7, 7], [6, 7]];
    const info = await p.evaluate((c) => window.__t.draw(c, 'right'), straight);
    const c = info.cell;
    let gaps = 0;
    for (let i = 0; i < straight.length - 1; i++) {
      const a = await p.evaluate(([x, y]) => window.__t.center(x, y), straight[i]);
      const b = await p.evaluate(([x, y]) => window.__t.center(x, y), straight[i + 1]);
      const mid = await p.evaluate(([x, y]) => window.__t.px(x, y), [(a.x + b.x) / 2, (a.y + b.y) / 2]);
      if (mid[3] < 250) gaps++;
    }
    T('straight path has no gaps between segments', gaps === 0, 'gaps=' + gaps);
    const mid = await p.evaluate(([x, y]) => window.__t.center(x, y), straight[2]);
    const tail = await p.evaluate(([x, y]) => window.__t.center(x, y), straight[4]);
    const bodyW = await p.evaluate(([x, y, r]) => window.__t.extent(x, y, 'v', r), [mid.x, mid.y, Math.round(c)]);
    const tailW = await p.evaluate(([x, y, r]) => window.__t.extent(x, y, 'v', r), [tail.x, tail.y, Math.round(c)]);
    T('body width is about 0.84 of a cell and not a square block edge to edge', Math.abs(bodyW - 0.84 * c) < 0.12 * c, `bodyW=${bodyW} cell=${c.toFixed(1)}`);
    T('the tail tapers: narrower than the body', tailW < bodyW * 0.8 && tailW >= 0.2 * c, `tailW=${tailW} bodyW=${bodyW}`);
    const tailEnd = await p.evaluate(([x, y]) => window.__t.px(x, y), [tail.x - c * 0.35, tail.y]);
    T('the tail tip ends inside its cell (rounded, not a full square)', tailEnd[3] < 128);

    // turn: rounded outer corner, filled inside
    await p.evaluate((cc) => window.__t.draw(cc, 'right'), [[9, 5], [8, 5], [7, 5], [7, 6], [7, 7]]);
    const corner = await p.evaluate(([x, y]) => window.__t.center(x, y), [7, 5]);
    const outer = await p.evaluate(([x, y]) => window.__t.px(x, y), [corner.x - c * 0.42, corner.y - c * 0.42]);
    const rounded = await p.evaluate(([x, y]) => window.__t.px(x, y), [corner.x - c * 0.2, corner.y - c * 0.2]);
    const inner = await p.evaluate(([x, y]) => window.__t.px(x, y), [corner.x + c * 0.15, corner.y + c * 0.15]);
    T('a bend is round on the outside (a block would fill that corner)', outer[3] < 128 && rounded[3] > 250 && inner[3] > 250, JSON.stringify({ outer, rounded, inner }));
    // each link of the bend is continuous
    let bendGaps = 0;
    const bend = [[9, 5], [8, 5], [7, 5], [7, 6], [7, 7]];
    for (let i = 0; i < bend.length - 1; i++) {
      const a = await p.evaluate(([x, y]) => window.__t.center(x, y), bend[i]);
      const b = await p.evaluate(([x, y]) => window.__t.center(x, y), bend[i + 1]);
      const m = await p.evaluate(([x, y]) => window.__t.px(x, y), [(a.x + b.x) / 2, (a.y + b.y) / 2]);
      if (m[3] < 250) bendGaps++;
    }
    T('the bend is connected end to end', bendGaps === 0);

    // head, body colours, eyes
    await p.evaluate((cc) => window.__t.draw(cc, 'right'), straight);
    const head = await p.evaluate(([x, y]) => window.__t.center(x, y), straight[0]);
    const headPx = await p.evaluate(([x, y]) => window.__t.px(x, y), [head.x - c * 0.1, head.y]);
    const bodyPx = await p.evaluate(([x, y]) => window.__t.px(x, y), [mid.x, mid.y + c * 0.25]);
    const headCol = await p.evaluate(() => window.__t.color('--snake-head'));
    const bodyCol = await p.evaluate(() => window.__t.color('--snake'));
    T('the head has its own colour, distinct from the body', near(headPx, headCol) && near(bodyPx, bodyCol) && (theme === 'lcd' || !near(headCol, bodyCol, 20)), JSON.stringify({ headPx, bodyPx, headCol, bodyCol }));
    const eyeCol = await p.evaluate(() => window.__t.color('--eye'));
    const pupilCol = await p.evaluate(() => window.__t.color('--pupil'));
    const geo = await p.evaluate(() => { const g = window.__t.geo; return { eyes: g.eyes, head: g.head }; });
    let eyesOk = true;
    for (const e of geo.eyes) {
      const eyePx = await p.evaluate(([x, y]) => window.__t.px(x, y), [e.x - e.r * 0.5, e.y]);
      const pupPx = await p.evaluate(([x, y]) => window.__t.px(x, y), [e.pupil.x, e.pupil.y]);
      if (!(near(eyePx, eyeCol, 30) && near(pupPx, pupilCol, 30))) eyesOk = false;
    }
    T('two small eyes with pupils are drawn on the head', eyesOk);
    T('eyes are restrained (a fraction of the head)', geo.eyes.every(e => e.r < 0.3 * geo.head.r));

    // eyes follow the direction
    const dirs = { right: [10, 7, [9, 7], [8, 7]], left: [10, 7, [11, 7], [12, 7]], up: [10, 7, [10, 8], [10, 9]], down: [10, 7, [10, 6], [10, 5]] };
    let dirOk = true; let dirNote = '';
    for (const [dir, [hx, hy, n1, n2]] of Object.entries(dirs)) {
      await p.evaluate(([cc, d]) => window.__t.draw(cc, d), [[[hx, hy], n1, n2], dir]);
      const g2 = await p.evaluate(() => { const g = window.__t.geo; return { eyes: g.eyes, head: g.head }; });
      const u = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] }[dir];
      for (const e of g2.eyes) {
        const fwd = (e.x - g2.head.x) * u[0] + (e.y - g2.head.y) * u[1];
        const px = await p.evaluate(([x, y]) => window.__t.px(x, y), [e.x - u[0] * e.r * 0.5, e.y - u[1] * e.r * 0.5]);
        if (!(fwd > 0 && near(px, eyeCol, 30))) { dirOk = false; dirNote += ` ${dir}:${JSON.stringify(px)}`; }
      }
      // the mirrored position behind the head is plain head colour
      const back = await p.evaluate(([x, y]) => window.__t.px(x, y), [g2.eyes[0].x - 2 * (g2.eyes[0].x - g2.head.x), g2.eyes[0].y - 2 * (g2.eyes[0].y - g2.head.y)]);
      if (near(back, eyeCol, 12) && !near(eyeCol, headCol, 30)) { dirOk = false; dirNote += ` ${dir}:backEye`; }
    }
    T('eyes sit at the front for all four directions', dirOk, dirNote);

    // contrast of what is actually painted
    const board = await p.evaluate(() => window.__t.color('--board'));
    T('snake and head stay at least 3:1 against the board', ratio(bodyCol, board) >= 3 && ratio(headCol, board) >= 3, `${ratio(bodyCol, board).toFixed(2)} ${ratio(headCol, board).toFixed(2)}`);

    // food, obstacles, bonus
    await p.evaluate(() => {
      window.__t.draw([[8, 7], [7, 7], [6, 7]], 'right', { opts: { board: 'pillars' }, state: { food: { x: 12, y: 5 }, bonusItem: { x: 16, y: 7, ticksLeft: 6 }, bonusTicks: 24 } });
    });
    const food = await p.evaluate(() => window.__t.center(12, 5));
    const foodPx = await p.evaluate(([x, y]) => window.__t.px(x, y), [food.x + 0.1 * c, food.y + 0.1 * c]);
    const foodCol = await p.evaluate(() => window.__t.color('--food'));
    T('food is a round fruit in the food colour', near(foodPx, foodCol, 20) && (await p.evaluate(([x, y]) => window.__t.px(x, y), [food.x + c * 0.33, food.y + c * 0.33]))[3] < 128);
    const ob = await p.evaluate(() => window.__t.center(4, 2));
    const obPx = await p.evaluate(([x, y]) => window.__t.px(x, y), [ob.x, ob.y]);
    const obCol = await p.evaluate(() => window.__t.color('--obstacle'));
    T('maze blocks are solid grid aligned squares in the obstacle colour', near(obPx, obCol, 14) && (await p.evaluate(([x, y]) => window.__t.px(x, y), [ob.x + c * 0.3, ob.y + c * 0.3]))[3] > 250, JSON.stringify({ obPx, obCol }));
    const bn = await p.evaluate(() => window.__t.center(16, 7));
    const bonusCol = await p.evaluate(() => window.__t.color('--bonus'));
    const bnPx = await p.evaluate(([x, y]) => window.__t.px(x, y), [bn.x, bn.y]);
    T('bonus food is a diamond in the bonus colour, different in shape from the round fruit', near(bnPx, bonusCol, 14) && (await p.evaluate(([x, y]) => window.__t.px(x, y), [bn.x + c * 0.26, bn.y + c * 0.26]))[3] < 128);
    const ringRight = await p.evaluate(([x, y]) => window.__t.px(x, y), [bn.x + c * 0.44, bn.y]);
    const ringLeft = await p.evaluate(([x, y]) => window.__t.px(x, y), [bn.x - c * 0.44, bn.y]);
    T('the timer ring shows a quarter of its sweep at 6 of 24 ticks', ringRight[3] > 128 && ringLeft[3] < 128, JSON.stringify({ ringRight, ringLeft }));
    T('food, bonus and blocks keep at least 3:1 against the board', ratio(foodCol, board) >= 3 && ratio(bonusCol, board) >= 3 && ratio(obCol, board) >= 3, `${ratio(foodCol, board).toFixed(2)} ${ratio(bonusCol, board).toFixed(2)} ${ratio(obCol, board).toFixed(2)}`);

    // wrap stubs
    await p.evaluate(() => window.__t.draw([[1, 3], [0, 3], [20, 3], [19, 3]], 'right', { opts: { wrap: true } }));
    const left = await p.evaluate(() => window.__t.center(0, 3));
    const right = await p.evaluate(() => window.__t.center(20, 3));
    const l0 = await p.evaluate(([x, y]) => window.__t.px(x, y), [left.x - c * 0.45, left.y + c * 0.2]);
    const r0 = await p.evaluate(([x, y]) => window.__t.px(x, y), [right.x + c * 0.45, right.y + c * 0.2]);
    const farMid = await p.evaluate(([x, y]) => window.__t.px(x, y), [(left.x + right.x) / 2, left.y]);
    T('a body crossing the edge shows body at both edges and none in between', l0[3] > 250 && r0[3] > 250 && farMid[3] < 128, JSON.stringify({ l0, r0, farMid }));

    // screenshot for the record
    await p.evaluate(() => window.__t.draw([[13, 5], [12, 5], [11, 5], [10, 5], [9, 5], [9, 6], [9, 7], [10, 7], [11, 7], [12, 7], [13, 7], [13, 8], [13, 9], [12, 9], [11, 9], [10, 9], [9, 9]], 'right', { opts: { board: 'pillars' }, state: { food: { x: 17, y: 4 }, bonusItem: { x: 17, y: 9, ticksLeft: 14 }, bonusTicks: 24 } }));
    await p.locator('#board').screenshot({ path: `${process.argv[2]}/render-${theme}.png` });

    // live game: the drawn snake stays connected frame after frame
    await p.addInitScript(() => {});
    await p.evaluate(() => { localStorage.setItem('classic-games.speed', 'fast'); });
    await p.reload(); await p.waitForFunction(() => window.classicGamesDebug);
    await p.click('#btn-new');
    const keys = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown'];
    let live = 0, liveGaps = 0, k = 0;
    await p.keyboard.press(keys[k++]);
    const t0 = Date.now();
    while (Date.now() - t0 < 3500) {
      await sleep(210);
      const r = await p.evaluate(() => {
        const s = window.classicGamesDebug.state();
        if (s.mode !== 'running') return { skip: true, mode: s.mode };
        const Rn = window.SnakeRender, cv = document.getElementById('canvas'), cx = cv.getContext('2d');
        const g = Rn.snakeGeometry(s.game, cv.width, cv.height);
        let gaps = 0;
        g.links.forEach(l => {
          const a = g.joints[l.from], b = g.joints[l.to];
          const d = cx.getImageData(Math.round((a.x + b.x) / 2), Math.round((a.y + b.y) / 2), 1, 1).data;
          if (d[3] < 250) gaps++;
        });
        return { gaps, links: g.links.length };
      });
      if (r.skip) { if (r.mode === 'over') break; continue; }
      live++; liveGaps += r.gaps;
      await p.keyboard.press(keys[k++ % keys.length]);
    }
    T('live play: sampled frames are all connected', live >= 5 && liveGaps === 0, `frames=${live} gaps=${liveGaps}`);
    T('no errors', errs.length === 0, errs.join('|'));
    await ctx.close();
  }

  // retina scale
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
    const p = await ctx.newPage();
    await p.addInitScript(() => localStorage.setItem('classic-games.ui', JSON.stringify({ v: 1, chosen: { fx: 'off' } })));
    await p.goto(INDEX + '?debug=1&seed=3');
    await p.evaluate(SETUP);
    const info = await p.evaluate(() => window.__t.draw([[10, 7], [9, 7], [8, 7], [7, 7]], 'right'));
    const a = await p.evaluate(() => window.__t.center(9, 7));
    const mid = await p.evaluate(([x, y]) => window.__t.px(x, y), [a.x + info.cell / 2, a.y]);
    ok('[retina 2x, 390 wide] canvas follows the device pixel ratio and the snake is connected', info.w >= 2 * 300 && mid[3] > 250, JSON.stringify({ w: info.w, mid }));
    await ctx.close();
  }

  await browser.close();
  const failed = R.filter(r => !r.pass);
  R.forEach(r => console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.extra && !r.pass ? '  [' + r.extra + ']' : '')));
  console.log(`\n${R.length - failed.length}/${R.length} passed`);
})();
