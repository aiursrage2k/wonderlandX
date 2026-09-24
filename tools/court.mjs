export default async function (page, out) {
  await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null);
    g.startRun(3);
    const p = g.player; p.godMode = true;
    p.placeAt(4, 2); p.camYaw = Math.PI - 0.15; p.camPitch = 0.05;
    g.teleporter.interact();
    for (let i = 0; i < 30 * 8; i++) { p.hp = p.stats.maxHp; g.update(1 / 30); }
    p.camYaw = Math.PI - 0.15;
    g.update(1 / 30); g.render(1 / 30);
  });
  await page.screenshot({ path: `${out}-court.png` });
}
