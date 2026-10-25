// Canvas presentation. Reads a game state and draws it; it never changes gameplay. The snake
// is drawn as one connected, rounded body that follows the grid path, with a gently tapered
// tail and a head with small direction aware eyes. Geometry is computed separately from
// drawing so it can be tested without a browser.
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SnakeRender = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var UNIT = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

  // Body and head proportions, as fractions of one cell.
  var BODY_R = 0.42;     // body half width
  var TAIL_R = 0.2;      // half width at the tail tip
  var TAPER_CELLS = 5;   // the taper spans up to this many cells at the tail
  var HEAD_R = 0.5;
  var EYE_R = 0.13;
  var PUPIL_R = 0.065;

  function sgn(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }

  function layout(cols, rows, w, h) {
    var cell = Math.min(w / cols, h / rows);
    return { cell: cell, ox: (w - cell * cols) / 2, oy: (h - cell * rows) / 2, cols: cols, rows: rows };
  }

  function cellCenter(l, x, y) {
    return { x: l.ox + (x + 0.5) * l.cell, y: l.oy + (y + 0.5) * l.cell };
  }

  // Half width at joint i of an n cell snake. Grows from the tail tip up to full body width.
  function bodyRadius(i, n, cell) {
    var span = Math.min(TAPER_CELLS, Math.max(1, n - 1));
    var f = Math.min(1, (n - 1 - i) / span);
    return (TAIL_R + (BODY_R - TAIL_R) * f) * cell;
  }

  // Pure description of the snake shapes for a state and canvas size.
  // Crawling body: one smooth curve through the joints (Catmull-Rom), drawn as many small
  // overlapping circles whose size follows the taper, with a gentle side to side wave that
  // travels from the head to the tail. Presentation only; the cells are unchanged.
  var CRAWL_STEPS = 8;
  var WAVE_LEN = 4.2; // cells per wave
  var WAVE_HZ = 1.1;

  function crawlSamples(g, cell, amp, tMs) {
    var J = g.joints;
    var runs = [];
    var cur = [0];
    for (var i = 1; i < J.length; i++) {
      if (Math.hypot(J[i].x - J[i - 1].x, J[i].y - J[i - 1].y) > cell * 1.6) { runs.push(cur); cur = []; }
      cur.push(i);
    }
    runs.push(cur);
    var out = [];
    runs.forEach(function (run) {
      var pts = run.map(function (k) { return J[k]; });
      var m = pts.length;
      var raw = [];
      for (var a = 0; a < m; a++) {
        var last = a === m - 1;
        var p1 = pts[a];
        if (last) { raw.push({ x: p1.x, y: p1.y, r: p1.r, u: run[a] }); continue; }
        var p2 = pts[a + 1];
        var p0 = a > 0 ? pts[a - 1] : { x: 2 * p1.x - p2.x, y: 2 * p1.y - p2.y };
        var p3 = a + 2 < m ? pts[a + 2] : { x: 2 * p2.x - p1.x, y: 2 * p2.y - p1.y };
        for (var k = 0; k < CRAWL_STEPS; k++) {
          var t = k / CRAWL_STEPS;
          var t2 = t * t;
          var t3 = t2 * t;
          raw.push({
            x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
            y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
            r: p1.r + (p2.r - p1.r) * t, u: run[a] + t
          });
        }
      }
      raw.forEach(function (q, idx) {
        var pa = raw[Math.max(0, idx - 1)];
        var pb = raw[Math.min(raw.length - 1, idx + 1)];
        var dx = pb.x - pa.x;
        var dy = pb.y - pa.y;
        var len = Math.hypot(dx, dy) || 1;
        var env = Math.min(1, q.u / 1.6);
        var off = amp * cell * env * Math.sin(2 * Math.PI * (q.u / WAVE_LEN - tMs / 1000 * WAVE_HZ));
        out.push({ x: q.x - dy / len * off, y: q.y + dx / len * off, r: q.r, u: q.u });
      });
    });
    return out;
  }

  function discs(ctx, samples, dx, dy, k) {
    ctx.beginPath();
    samples.forEach(function (q) {
      var r = Math.max(0, q.r * k);
      ctx.moveTo(q.x + dx + r, q.y + dy);
      ctx.arc(q.x + dx, q.y + dy, r, 0, Math.PI * 2);
    });
    ctx.fill();
  }

  function drawCrawl(ctx, g, palette, cell, anim) {
    var smp = crawlSamples(g, cell, anim.waveAmp || 0, anim.t || 0);
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = palette.snakeEdge;
    discs(ctx, smp, 0, cell * 0.06, 1);
    ctx.restore();
    ctx.fillStyle = palette.snake;
    discs(ctx, smp, 0, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = palette.shine;
    discs(ctx, smp, -cell * 0.08, -cell * 0.1, 0.36);
    ctx.restore();
    // scale pattern: faint dots down the middle of the body
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = palette.snakeEdge;
    smp.forEach(function (q, i) { if (i % CRAWL_STEPS === 0 && q.u > 1 && q.r > cell * 0.25) circle(ctx, q.x, q.y, cell * 0.09); });
    ctx.restore();
  }

  // the head faces along the neck to head direction, so it turns smoothly while gliding round a bend
  function crawlHead(g, cell) {
    var J = g.joints;
    var h = J[0];
    var dx = g.head.ux;
    var dy = g.head.uy;
    if (J.length > 1 && Math.hypot(h.x - J[1].x, h.y - J[1].y) <= cell * 1.6) {
      var vx = h.x - J[1].x;
      var vy = h.y - J[1].y;
      var len = Math.hypot(vx, vy) || 1;
      dx = vx / len;
      dy = vy / len;
    }
    var px = -dy;
    var py = dx;
    g.head = { x: h.x, y: h.y, r: g.head.r, ux: dx, uy: dy };
    g.eyes = [-1, 1].map(function (side) {
      var cx = h.x + dx * cell * 0.12 + px * side * cell * 0.22;
      var cy = h.y + dy * cell * 0.12 + py * side * cell * 0.22;
      return { x: cx, y: cy, r: cell * EYE_R, pupil: { x: cx + dx * cell * 0.04, y: cy + dy * cell * 0.04, r: cell * PUPIL_R } };
    });
  }

  // glide (optional): { prev: previous state, alpha: 0..1 }. Each joint slides from where it
  // was one step ago, so the snake moves smoothly between cells. Rules and cells are
  // unchanged; a joint that wrapped across an edge simply jumps.
  function glidePos(state, i, glide) {
    var c = state.snake[i];
    if (!glide || !glide.prev) return { x: c.x, y: c.y };
    var pv = glide.prev;
    var n = state.snake.length;
    if (pv.cols !== state.cols || pv.rows !== state.rows || pv.snake.length < n - 1 || pv.snake.length > n) return { x: c.x, y: c.y };
    var p = pv.snake[Math.min(i, pv.snake.length - 1)];
    if (Math.abs(c.x - p.x) > 1 || Math.abs(c.y - p.y) > 1) return { x: c.x, y: c.y };
    var a = Math.max(0, Math.min(1, glide.alpha));
    return { x: p.x + (c.x - p.x) * a, y: p.y + (c.y - p.y) * a };
  }

  function snakeGeometry(state, w, h, glide) {
    var l = layout(state.cols, state.rows, w, h);
    var n = state.snake.length;
    var joints = state.snake.map(function (s, i) {
      var g = glidePos(state, i, glide);
      var c = cellCenter(l, g.x, g.y);
      return { x: c.x, y: c.y, r: bodyRadius(i, n, l.cell) };
    });
    var links = [];
    var stubs = [];
    for (var i = 0; i < n - 1; i++) {
      var a = state.snake[i];
      var b = state.snake[i + 1];
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
        links.push({ from: i, to: i + 1 });
      } else {
        // The body crosses a board edge: draw a half cell stub on each side, no long link.
        var ux = Math.abs(dx) > 1 ? -sgn(dx) : sgn(dx);
        var uy = Math.abs(dy) > 1 ? -sgn(dy) : sgn(dy);
        stubs.push({ joint: i, ux: ux, uy: uy, len: l.cell * 0.5 });
        stubs.push({ joint: i + 1, ux: -ux + 0, uy: -uy + 0, len: l.cell * 0.5 });
      }
    }
    var u = UNIT[state.dir] || UNIT.right;
    var hc = joints[0];
    var p = { x: -u.y, y: u.x };
    var eyes = [-1, 1].map(function (side) {
      var cx = hc.x + u.x * l.cell * 0.12 + p.x * side * l.cell * 0.22;
      var cy = hc.y + u.y * l.cell * 0.12 + p.y * side * l.cell * 0.22;
      return {
        x: cx, y: cy, r: l.cell * EYE_R,
        pupil: { x: cx + u.x * l.cell * 0.04, y: cy + u.y * l.cell * 0.04, r: l.cell * PUPIL_R }
      };
    });
    return {
      layout: l,
      joints: joints, links: links, stubs: stubs,
      head: { x: hc.x, y: hc.y, r: l.cell * HEAD_R, ux: u.x, uy: u.y },
      eyes: eyes
    };
  }

  // Blocky snake: one square per cell (the classic pixel look). Same cells as the smooth snake.
  function pixelGeometry(state, w, h) {
    var l = layout(state.cols, state.rows, w, h);
    var u = UNIT[state.dir] || UNIT.right;
    var p = { x: -u.y, y: u.x };
    var cells = state.snake.map(function (s, i) {
      var inset = l.cell * (i === 0 ? 0.04 : 0.1);
      return { x: l.ox + s.x * l.cell + inset, y: l.oy + s.y * l.cell + inset, size: l.cell - 2 * inset, head: i === 0 };
    });
    var hc = cellCenter(l, state.snake[0].x, state.snake[0].y);
    var eyes = [-1, 1].map(function (side) {
      var e = l.cell * 0.14;
      return { x: hc.x + u.x * l.cell * 0.16 + p.x * side * l.cell * 0.2 - e / 2, y: hc.y + u.y * l.cell * 0.16 + p.y * side * l.cell * 0.2 - e / 2, size: e };
    });
    return { layout: l, cells: cells, eyes: eyes };
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    ctx.fill();
  }

  // Filled capsule-like quad between two joints with their own half widths.
  function link(ctx, a, b, dy) {
    var dx = b.x - a.x;
    var dyy = b.y - a.y;
    var len = Math.sqrt(dx * dx + dyy * dyy) || 1;
    var nx = -dyy / len;
    var ny = dx / len;
    ctx.beginPath();
    ctx.moveTo(a.x + nx * a.r, a.y + ny * a.r + dy);
    ctx.lineTo(b.x + nx * b.r, b.y + ny * b.r + dy);
    ctx.lineTo(b.x - nx * b.r, b.y - ny * b.r + dy);
    ctx.lineTo(a.x - nx * a.r, a.y - ny * a.r + dy);
    ctx.closePath();
    ctx.fill();
  }

  function stub(ctx, j, s, dy) {
    var nx = -s.uy;
    var ny = s.ux;
    var ex = j.x + s.ux * s.len;
    var ey = j.y + s.uy * s.len;
    ctx.beginPath();
    ctx.moveTo(j.x + nx * j.r, j.y + ny * j.r + dy);
    ctx.lineTo(ex + nx * j.r, ey + ny * j.r + dy);
    ctx.lineTo(ex - nx * j.r, ey - ny * j.r + dy);
    ctx.lineTo(j.x - nx * j.r, j.y - ny * j.r + dy);
    ctx.closePath();
    ctx.fill();
  }

  function drawBody(ctx, g, dy) {
    g.joints.forEach(function (j) { circle(ctx, j.x, j.y + dy, j.r); });
    g.links.forEach(function (k) { link(ctx, g.joints[k.from], g.joints[k.to], dy); });
    g.stubs.forEach(function (s) { stub(ctx, g.joints[s.joint], s, dy); });
  }

  // palette: { boardLine, snake, snakeHead, snakeEdge, shine, eye, pupil, food, bonus,
  //            obstacle, obstacleEdge }
  function draw(ctx, state, palette, w, h, anim) {
    anim = anim || {};
    var g = snakeGeometry(state, w, h, anim.glide);
    var l = g.layout;
    var cell = l.cell;
    ctx.clearRect(0, 0, w, h);

    // faint grid
    ctx.strokeStyle = palette.boardLine;
    ctx.lineWidth = Math.max(1, cell * 0.04);
    ctx.beginPath();
    var c, r;
    for (c = 1; c < l.cols; c++) { ctx.moveTo(l.ox + c * cell, l.oy); ctx.lineTo(l.ox + c * cell, l.oy + l.rows * cell); }
    for (r = 1; r < l.rows; r++) { ctx.moveTo(l.ox, l.oy + r * cell); ctx.lineTo(l.ox + l.cols * cell, l.oy + r * cell); }
    ctx.stroke();

    // a dashed inner edge shows that the edges wrap
    if (state.wrap && ctx.setLineDash) {
      ctx.save();
      ctx.setLineDash([cell * 0.3, cell * 0.2]);
      ctx.strokeStyle = palette.snake;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = Math.max(1, cell * 0.07);
      ctx.strokeRect(l.ox + cell * 0.06, l.oy + cell * 0.06, l.cols * cell - cell * 0.12, l.rows * cell - cell * 0.12);
      ctx.restore();
    }

    // a solid inner edge shows that the walls are solid
    if (!state.wrap) {
      ctx.save();
      ctx.strokeStyle = palette.obstacleEdge;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = Math.max(1, cell * 0.07);
      ctx.strokeRect(l.ox + cell * 0.06, l.oy + cell * 0.06, l.cols * cell - cell * 0.12, l.rows * cell - cell * 0.12);
      ctx.restore();
    }

    // maze blocks: solid grid aligned squares, used only as real obstacles
    state.obstacles.forEach(function (o) {
      var pad = cell * 0.05;
      ctx.fillStyle = palette.obstacle;
      roundRect(ctx, l.ox + o.x * cell + pad, l.oy + o.y * cell + pad, cell - 2 * pad, cell - 2 * pad, cell * 0.12);
      ctx.fill();
      ctx.strokeStyle = palette.obstacleEdge;
      ctx.lineWidth = Math.max(1, cell * 0.04);
      ctx.stroke();
    });

    // food: a round fruit with a small highlight
    if (state.food) {
      var f = cellCenter(l, state.food.x, state.food.y);
      f.y += (anim.foodBob || 0) * cell;
      var fs = typeof anim.foodScale !== 'number' ? 1 : anim.foodScale;
      ctx.fillStyle = palette.food;
      circle(ctx, f.x, f.y, cell * 0.34 * fs);
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ffffff';
      circle(ctx, f.x - cell * 0.1, f.y - cell * 0.12, cell * 0.08);
      ctx.restore();
    }

    // bonus food: a diamond with a ring that empties as its time runs out
    if (state.bonusItem) {
      var b = cellCenter(l, state.bonusItem.x, state.bonusItem.y);
      var d = cell * 0.3;
      ctx.fillStyle = palette.bonus;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - d);
      ctx.lineTo(b.x + d, b.y);
      ctx.lineTo(b.x, b.y + d);
      ctx.lineTo(b.x - d, b.y);
      ctx.closePath();
      ctx.fill();
      var frac = Math.max(0, Math.min(1, state.bonusItem.ticksLeft / state.bonusTicks));
      ctx.strokeStyle = palette.bonus;
      ctx.lineWidth = Math.max(1.5, cell * 0.08);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(b.x, b.y, cell * 0.44, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
      ctx.stroke();
    }

    if (palette.style === 'pixel') {
      var pg = pixelGeometry(state, w, h);
      pg.cells.forEach(function (c) {
        ctx.fillStyle = c.head ? palette.snakeHead : palette.snake;
        ctx.fillRect(c.x, c.y, c.size, c.size);
      });
      ctx.fillStyle = palette.eye;
      pg.eyes.forEach(function (e) { ctx.fillRect(e.x, e.y, e.size, e.size); });
      return g;
    }

    if (anim.crawl) {
      crawlHead(g, cell);
      drawCrawl(ctx, g, palette, cell, anim);
    } else {
      // snake: soft shadow for subtle depth, body, highlight, then head and eyes
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = palette.snakeEdge;
      drawBody(ctx, g, cell * 0.06);
      circle(ctx, g.head.x, g.head.y + cell * 0.06, g.head.r);
      ctx.restore();

      ctx.fillStyle = palette.snake;
      drawBody(ctx, g, 0);

      // one continuous highlight along the body (a new subpath starts after a board edge)
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = palette.shine;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(1, cell * 0.14);
      ctx.beginPath();
      var open = -1;
      g.links.forEach(function (k) {
        var a = g.joints[k.from];
        var z = g.joints[k.to];
        if (open !== k.from) ctx.moveTo(a.x - cell * 0.08, a.y - cell * 0.1);
        ctx.lineTo(z.x - cell * 0.08, z.y - cell * 0.1);
        open = k.to;
      });
      ctx.stroke();
      ctx.restore();
    }

    // eaten food slides down the body as a bulge
    if (typeof anim.bulge === 'number' && g.joints.length > 1) {
      var bi = Math.max(0, Math.min(g.joints.length - 1, anim.bulge));
      var b0 = g.joints[Math.floor(bi)];
      var b1 = g.joints[Math.min(g.joints.length - 1, Math.ceil(bi))];
      var bf = bi - Math.floor(bi);
      if (Math.abs(b0.x - b1.x) < cell * 1.5 && Math.abs(b0.y - b1.y) < cell * 1.5) {
        ctx.fillStyle = palette.snakeHead;
        ctx.globalAlpha = 0.9;
        circle(ctx, b0.x + (b1.x - b0.x) * bf, b0.y + (b1.y - b0.y) * bf, Math.max(b0.r, b1.r) * 1.22);
        ctx.globalAlpha = 1;
      }
    }

    // a quick tongue flick in front of the head
    if (anim.tongue > 0.02) {
      var tl = cell * (0.25 + 0.5 * anim.tongue);
      var tx = g.head.x + g.head.ux * g.head.r;
      var ty = g.head.y + g.head.uy * g.head.r;
      var ex = tx + g.head.ux * tl;
      var ey = ty + g.head.uy * tl;
      var fx = -g.head.uy;
      var fy = g.head.ux;
      ctx.save();
      ctx.strokeStyle = palette.food;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.5, cell * 0.07);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(ex, ey);
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + g.head.ux * cell * 0.12 + fx * cell * 0.1, ey + g.head.uy * cell * 0.12 + fy * cell * 0.1);
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + g.head.ux * cell * 0.12 - fx * cell * 0.1, ey + g.head.uy * cell * 0.12 - fy * cell * 0.1);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = palette.snakeHead;
    circle(ctx, g.head.x + g.head.ux * cell * 0.04, g.head.y + g.head.uy * cell * 0.04, g.head.r * (1 + 0.22 * (anim.headPulse || 0)));
    g.eyes.forEach(function (e) {
      ctx.fillStyle = palette.eye;
      circle(ctx, e.x, e.y, e.r);
      if (anim.blink) {
        ctx.strokeStyle = palette.snakeEdge;
        ctx.lineWidth = Math.max(1, cell * 0.05);
        ctx.beginPath();
        ctx.moveTo(e.x - e.r, e.y);
        ctx.lineTo(e.x + e.r, e.y);
        ctx.stroke();
        ctx.fillStyle = palette.snakeHead;
        ctx.fillRect(e.x - e.r, e.y - e.r, e.r * 2, e.r);
        return;
      }
      ctx.fillStyle = palette.pupil;
      circle(ctx, e.pupil.x, e.pupil.y, e.pupil.r);
    });
    return g;
  }

  return {
    BODY_R: BODY_R, TAIL_R: TAIL_R, HEAD_R: HEAD_R, TAPER_CELLS: TAPER_CELLS,
    layout: layout, cellCenter: cellCenter, bodyRadius: bodyRadius,
    snakeGeometry: snakeGeometry, pixelGeometry: pixelGeometry, crawlSamples: crawlSamples, draw: draw
  };
});
