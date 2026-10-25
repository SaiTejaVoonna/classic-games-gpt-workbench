// Browser checks. Requires an existing Playwright install (not a project dependency) and a
// Chromium binary. Usage: NODE_PATH=<dir with playwright> node tests/browser/sweep.js <output dir>
// Optional: CHROMIUM_PATH (default /opt/pw-browsers/chromium).
const { chromium } = require('playwright');
const INDEX = require('url').pathToFileURL(require('path').resolve(__dirname, '../../index.html')).href;
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const out = process.argv[2];
const sizes = [[320,568],[390,844],[768,1024],[1366,768],[1440,900]];
(async () => {
  const b = await chromium.launch({ executablePath: CHROMIUM });
  const rows = [];
  for (const theme of ['colour','lcd','night']) for (const [w,h] of sizes) {
    const ctx = await b.newContext({ viewport:{width:w,height:h}, hasTouch: w<900 });
    const p = await ctx.newPage(); const errs=[];
    p.on('pageerror',e=>errs.push(String(e))); p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
    await p.addInitScript(t=>{try{localStorage.setItem('classic-games.theme',t)}catch(e){}}, theme);
    await p.goto(INDEX + '?seed=3');
    const m = async () => p.evaluate(() => {
      const r = s => { const e=document.querySelector(s); if(!e||!e.offsetParent&&getComputedStyle(e).display==='none') return null; const q=e.getBoundingClientRect(); return {w:Math.round(q.width),h:Math.round(q.height),b:Math.round(q.bottom),r:Math.round(q.right),l:Math.round(q.left)}; };
      const small=[...document.querySelectorAll('button:not(:disabled)')].filter(x=>x.offsetParent).filter(x=>{const q=x.getBoundingClientRect();return q.width<44||q.height<44}).map(x=>x.textContent.trim()||x.getAttribute('aria-label'));
      const t=r('.title-block'), sc=r('.scores');
      return { hscroll: document.documentElement.scrollWidth>innerWidth, docH: document.documentElement.scrollHeight, board:r('#board'), dpad:r('.dpad'), small, headOverlap: t&&sc? t.r>sc.l : false, vh: innerHeight };
    });
    const menu = await m();
    await p.click('#btn-new'); await p.keyboard.press('ArrowUp'); await p.waitForTimeout(450); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(300);
    await p.click('#btn-pause').catch(()=>{});
    const play = await m();
    if (theme==='colour' || w===390) await p.screenshot({ path: `${out}/${theme}-${w}x${h}-paused.png` });
    rows.push({theme,w,h,errors:errs.length,hscroll:menu.hscroll||play.hscroll,boardBottom:play.board.b,dpadBottom:play.dpad?play.dpad.b:null,vh:h,small:play.small.join('|'),headOverlap:menu.headOverlap,docH:play.docH});
    await ctx.close();
  }
  console.table(rows); await b.close();
})();
