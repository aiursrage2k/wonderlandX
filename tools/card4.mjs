export default async function (page, out) {
  const r = await page.evaluate(async () => {
    const g = window.game;
    let calls = 0, fired = 0;
    const orig = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => { calls++; return orig((t) => { fired++; cb(t); }); };
    g.transition.skip = false;
    const t0 = performance.now();
    g.transition.play({ depth: 2, name: 'X', recap: 'x', hold: 4 }, () => {});
    await new Promise((r) => setTimeout(r, 2500));
    return { calls, fired, elapsed: Math.round(performance.now() - t0), cls: document.getElementById('transition').className, state: g.state };
  });
  console.log(JSON.stringify(r));
}
