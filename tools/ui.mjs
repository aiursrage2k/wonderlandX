export default async function (page, out) {
  await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null);
    const p = g.player; p.gold = 340; p.xp = 40; p.corruption = 62; p.hp = p.stats.maxHp * 0.25;
    p.inv.add('sugar'); p.inv.add('sugar'); p.inv.add('jubjub'); p.recompute(); p.perks.vitality = 2; p.recompute(); g.hud.updateItems(p.inv);
    const gp = g.teleporter.pos; p.placeAt(gp.x, gp.z + 14); p.camYaw = Math.PI; p.camPitch = 0.05;
    g.teleporter.discovered = true; g.teleporter.interact();
    for (let i = 0; i < 40; i++) { g.update(1 / 30); }
    g.boss.hp = g.boss.maxHp * 0.62; p.teapotCharges = 0; p.teapotT = 2; p.dashCd = 2.5; p.rollCd = 0.6;
    for (let i = 0; i < 3; i++) g.update(1 / 30);
    g.render(1 / 30);
  });
  await page.screenshot({ path: `${out}-hud.png` });
  await page.evaluate(() => { const g = window.game; g.setPaused(true); g.update(1 / 30); g.render(1 / 30); });
  await page.screenshot({ path: `${out}-pause.png` });
}
