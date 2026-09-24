export default async function (page, out) {
  await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null);
    g.loadStage(2); g.director.update = () => {};
    const p = g.player; p.placeAt(0, 30); p.camYaw = Math.PI; p.camPitch = -0.75;
    const h = g.director.spawn('madhatter', 0, 12, null); h.spawnT = 0; h.state = 'chase';
    g.boss = h;
    for (let i = 0; i < 5; i++) g.update(1 / 30);
    h.cooldown = 0; h.twelveT = 0;
    for (let i = 0; i < 40; i++) { g.update(1 / 30); p.hp = p.stats.maxHp; }
    g.render(1 / 30);
  });
  await page.screenshot({ path: `${out}-warn.png` });
  await page.evaluate(() => { const g = window.game; for (let i = 0; i < 110; i++) { g.update(1 / 30); g.player.hp = g.player.stats.maxHp; } g.render(1 / 30); });
  await page.screenshot({ path: `${out}-after.png` });
  const r = await page.evaluate(() => window.game.world.clock.sectors.map((s) => +s.y.toFixed(1)));
  console.log('sector heights', JSON.stringify(r));
}
