export default async function (page, out) {
  const r = await page.evaluate(async () => {
    const g = window.game; g.renderer.setAnimationLoop(null);
    let n = 0;
    const tick = () => { n++; if (n < 1000) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    await new Promise((r) => setTimeout(r, 1000));
    const n1 = n;
    g.transition.skip = false;
    g.transition.play({ depth: 2, name: 'X', recap: 'x', hold: 4 }, () => {});
    await new Promise((r) => setTimeout(r, 1000));
    return { rafPerSecBefore: n1, rafAfter: n - n1, vis: document.visibilityState };
  });
  console.log(JSON.stringify(r));
}
