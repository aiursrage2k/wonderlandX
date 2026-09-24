export default async function (page, out) {
  const r = await page.evaluate(async () => {
    const g = window.game; g.renderer.setAnimationLoop(null);
    g.transition.skip = false;
    let err = null;
    const p = g.transition.play({ depth: 2, name: 'The Mad Hatter’s Clockworks', recap: 'x', hold: 4 }, () => {}).catch((e) => { err = String(e); });
    await new Promise((r) => setTimeout(r, 1500));
    const el = document.getElementById('transition');
    return { err, cls: el.className, op: el.style.opacity, disp: getComputedStyle(el).display, z: getComputedStyle(el).zIndex, active: g.transition.active, skip: g.transition.skip };
  });
  console.log(JSON.stringify(r));
  await page.screenshot({ path: `${out}-card.png` });
}
