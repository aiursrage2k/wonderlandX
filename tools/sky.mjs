export default async function (page, out) {
  await page.evaluate(() => { window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null); g.director.update = () => {}; });
  for (const [name, yaw] of [['n', Math.PI], ['s', 0]]) {
    await page.evaluate((yaw) => { const g = window.game; const p = g.player; p.camYaw = yaw; p.camPitch = 0.18; for (let i = 0; i < 3; i++) g.update(1 / 30); g.render(1 / 30); }, yaw);
    await page.screenshot({ path: `${out}-${name}.png` });
  }
}
