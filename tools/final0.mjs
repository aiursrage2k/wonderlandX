export default async function (page) {
  const r = await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null);
    g.startRun(3);
    for (let i = 0; i < 30 * 40; i++) g.update(1 / 30);
    const before = g.enemies.filter((e) => e.alive).length;
    g.teleporter.interact();
    for (let i = 0; i < 30 * 30; i++) { g.player.hp = g.player.stats.maxHp; g.update(1 / 30); }
    return { before, after: g.enemies.filter((e) => e.alive).map((e) => e.name) };
  });
  console.log(JSON.stringify(r));
}
