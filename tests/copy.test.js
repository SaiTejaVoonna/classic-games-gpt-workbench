'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
const body = html.slice(html.indexOf('<body'));
const visible = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
const DASH = /[–—]/;

test('title, heading, tagline and footer', () => {
  assert.ok(html.includes('<title>Snake | Classic Games</title>'));
  assert.ok(html.includes('<h1 id="game-title">Snake</h1>'));
  assert.ok(html.includes('<p class="tagline">Inspired by classic mobile games.</p>'));
  assert.ok(html.includes('<footer class="site-footer">\n    <p>Classic Games</p>'));
});

test('no em or en dashes in markup or in main.js code', () => {
  assert.ok(!DASH.test(html));
  assert.ok(!DASH.test(main.replace(/\/\/.*$/gm, '')));
});

test('badge and repeated board disclaimer are gone; one About note', () => {
  assert.ok(!/early prototype/i.test(visible));
  assert.ok(!/class="badge"|class="board-note"/.test(html));
  const note = 'An early version of Classic Games. Gameplay may differ from the originals.';
  assert.equal(visible.split(note).length - 1, 1);
  const help = html.slice(html.indexOf('id="dlg-help"'), html.indexOf('id="dlg-top"'));
  assert.ok(help.includes(note));
});

test('unimplemented controls and engineering explanations are not shown', () => {
  assert.ok(!/unavailable|not implemented|why are|choose a level/i.test(visible));
  assert.ok(!/sel-level|sel-maze|type="checkbox"/.test(html));
});

test('visible copy does not mention a phone brand', () => {
  assert.ok(!/nokia/i.test(visible));
});

const dialog = (id) => html.slice(html.indexOf('id="' + id + '"'), html.indexOf('</dialog>', html.indexOf('id="' + id + '"')));

test('App settings hold app-wide choices only (Theme); game choices live in Game settings', () => {
  const settings = dialog('dlg-settings');
  assert.ok(settings.includes('App settings'));
  assert.ok(new RegExp('name="theme"').test(settings));
  for (const app of ['sound', 'haptics']) assert.equal((settings.match(new RegExp('name="' + app + '"[^>]*checked', 'g')) || []).length, 1, app + ' has one default');
  assert.equal((settings.match(/name="theme"[^>]*checked/g) || []).length, 1, 'theme has one default');
  for (const game of ['speed', 'snakecolour', 'snakestyle', 'board', 'edges', 'lives', 'bonus']) {
    assert.ok(!new RegExp('name="' + game + '"').test(settings), game + ' is not an app setting');
  }
  assert.ok(!/maze|wrap|lives|bonus|edges/i.test(settings.replace(/<[^>]*>/g, ' ')), 'no gameplay rule wording in App settings');
});

test('Game settings hold the look, speed and rules with safe defaults', () => {
  const setup = dialog('dlg-setup');
  assert.ok(setup.includes('Game settings'));
  assert.ok(setup.includes('Speed choices are comfort settings, not original game levels.'));
  for (const name of ['speed', 'snakecolour', 'snakestyle']) {
    assert.equal((setup.match(new RegExp('name="' + name + '"[^>]*checked', 'g')) || []).length, 1, name + ' has one default');
  }
  assert.ok(!/name="theme"/.test(setup), 'theme is an app setting');
  for (const name of ['board', 'edges', 'lives', 'bonus']) {
    assert.ok(new RegExp('name="' + name + '"').test(setup), name);
    assert.equal((setup.match(new RegExp('name="' + name + '"[^>]*checked', 'g')) || []).length, 1, name + ' has one default');
  }
  assert.ok(/name="board" value="clear" checked/.test(setup), 'Clear field is the default');
  assert.ok(/name="edges" value="wrap" checked/.test(setup), 'Wrap around is the default');
  assert.ok(/name="edges" value="walls"> Solid walls/.test(setup), 'Solid walls stays available');
  assert.ok(/name="lives" value="classic" checked/.test(setup), 'Classic is the default');
  assert.ok(/name="bonus" value="on" checked/.test(setup));
  assert.ok(/value="unlimited"> Unlimited <small>\(assist mode\)<\/small>/.test(setup), 'Unlimited is labelled as an assist');
  assert.ok(setup.includes('Unlimited is an optional assist. Collisions never end the run.'));
  assert.ok(setup.includes('Solid walls cost a life when you touch the edge. Maze blocks are always solid.'));
  assert.ok(setup.includes('rules apply to the next run.'));
  assert.ok(setup.includes('Classic Games choices, not verified original rules'));
  assert.ok(setup.includes('These rules apply to the next run.'));
});

test('Game settings is a named action next to the New game controls', () => {
  const panel = html.slice(html.indexOf('<section class="panel"'), html.indexOf('</section>', html.indexOf('<section class="panel"')));
  assert.ok(panel.includes('id="btn-new"'));
  assert.ok(/id="btn-setup" data-open="dlg-setup">Game settings</.test(panel));
  assert.ok(panel.includes('id="rules-line"'));
});

test('header utility navigation: inline SVG icons with persistent names and tooltip labels', () => {
  const nav = html.slice(html.indexOf('<nav class="header-actions"'), html.indexOf('</nav>'));
  const buttons = nav.match(/<button[\s\S]*?<\/button>/g);
  assert.equal(buttons.length, 4);
  const expected = [['dlg-top', 'Top score'], ['dlg-help', 'Instructions'], ['dlg-settings', 'App settings'], [null, 'Full screen']];
  buttons.forEach((b, i) => {
    assert.ok(b.includes('class="icon-btn"'), 'icon button ' + i);
    if (expected[i][0]) assert.ok(b.includes('data-open="' + expected[i][0] + '"'), expected[i][1]);
    else assert.ok(b.includes('id="btn-fullscreen"') && b.includes(' hidden>'), 'full screen is hidden until supported');
    assert.ok(b.includes('aria-label="' + expected[i][1] + '"'), 'aria-label ' + expected[i][1]);
    assert.ok(/<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">/.test(b), 'inline svg');
    assert.ok(b.includes('aria-hidden="true"') && b.includes('>' + expected[i][1] + '</span>'), 'tooltip text');
  });
  assert.ok(!/<img|<link[^>]*icon|\.svg"|\.png"/.test(nav), 'no image files or icon libraries');
  assert.ok(!/class="btn btn-quiet"/.test(html));
});

test('dialogs: heading is the first stop, content scrolls inside, Close is not auto focused', () => {
  for (const id of ['dlg-settings', 'dlg-setup', 'dlg-help', 'dlg-top']) {
    const d = dialog(id);
    assert.ok(/<h2 id="[^"]+" tabindex="-1">/.test(d), id + ' heading can take focus');
    assert.ok(d.includes('class="dlg-scroll"'), id + ' has an internal scroll area');
    assert.ok(d.includes('class="dlg-foot"'), id + ' has a fixed footer');
    assert.ok(!/autofocus/.test(d), id + ' does not autofocus Close');
    if (id === 'dlg-help' || id === 'dlg-top') assert.ok(/class="dlg-scroll" tabindex="0" role="region" aria-labelledby="[^"]+"/.test(d), id + ' scroll region is focusable and labelled');
  }
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  assert.ok(/dialog\[open\] \{ display: flex; flex-direction: column; \}/.test(css));
  assert.ok(/max-height: 88dvh/.test(css) && /\.dlg-scroll \{[^}]*overflow-y: auto/.test(css));
  assert.ok(/\.icon-btn:focus-visible \.tip \{ opacity: 1; visibility: visible; \}/.test(css), 'tooltips show on keyboard focus');
  assert.ok(/\.icon-btn:hover \.tip/.test(css), 'and on hover');
  assert.ok(/width: 44px;\s*height: 44px;/.test(css), 'icon targets are 44 by 44');
});

test('instructions explain bonus food, wrap, mazes and lives in short plain sentences', () => {
  const help = html.slice(html.indexOf('id="dlg-help"'), html.indexOf('id="dlg-top"'));
  assert.ok(help.includes('Bonus food:'));
  assert.ok(help.includes('extra points and does not grow the snake'));
  assert.ok(help.includes('Missing it costs nothing.'));
  assert.ok(help.includes('with Wrap around, leaving one edge brings you back on the opposite edge'));
  assert.ok(help.includes('Maze blocks are always solid.'));
  assert.ok(help.includes('Choose these in Game settings before a run.'));
  assert.ok(/costs a life/.test(help));
});

test('the panel shows the lives, rules summary and bonus timer slots', () => {
  assert.ok(html.includes('id="lives"'));
  assert.ok(html.includes('id="rules-line"'));
  assert.ok(html.includes('id="bonus-item" hidden'));
});

test('score copy uses 0 or No score yet, never dash placeholders', () => {
  assert.ok(html.includes('<b id="score">0</b>'));
  assert.ok(html.includes('<b id="best">0</b>'));
  assert.ok(main.includes("'No score yet.'"));
  assert.ok(main.includes("'Game over. Score '"));
  assert.ok(main.includes("'Board full. Score '"));
});

test('Slow is the default speed in markup', () => {
  assert.ok(html.includes('<b id="speed-name">Slow</b>'));
});
