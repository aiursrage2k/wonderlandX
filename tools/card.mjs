// The software renderer is too slow for rAF to tick during a transition,
// so drive frames with a timer in this test only.
export default async function (page, out) {
  await page.evaluate(() => {
    const g = window.game; g.renderer.setAnimationLoop(null);
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
    g.transition.skip = false;
    g.transition.play({ depth: 2, name: 'The Mad Hatter’s Clockworks', recap: 'Cleared in <b>3:07</b> · Slain <b>64</b> · Level <b>6</b> · Items <b>9</b>', hold: 30 }, () => {});
  });
  await page.waitForTimeout(9000);
  await page.screenshot({ path: `${out}-card.png` });
}
