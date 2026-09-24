export default async function (page, out) {
  const r = await page.evaluate(async () => {
    const g = window.game; g.renderer.setAnimationLoop(null);
    let fired = 0;
    window.requestAnimationFrame = (cb) => setTimeout(() => { fired++; cb(performance.now()); }, 16);
    g.transition.skip = false;
    let err = null;
    try {
      g.transition.play({ depth: 2, name: 'N', recap: 'r', hold: 4 }, () => {}).catch((e) => (err = String(e)));
    } catch (e) { err = 'sync ' + e; }
    await new Promise((r) => setTimeout(r, 1500));
    const el = document.getElementById('transition');
    const cv = document.getElementById('tunnel');
    const px = cv.getContext('2d').getImageData(cv.width / 2 + 200, cv.height / 2, 1, 1).data;
    return { log: window.__tlog, fired, err, cls: el.className, op: getComputedStyle(el).opacity, cw: cv.width, ch: cv.height, px: [...px], rect: el.getBoundingClientRect().toJSON() };
  });
  console.log(JSON.stringify(r));
}
