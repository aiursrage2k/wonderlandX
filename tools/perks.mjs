export default async function (page, out) {
  await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null); g.director.update = () => {};
    const p = g.player; const fx = Math.sin(p.camYaw), fz = Math.cos(p.camYaw);
    const es = [];
    for (let i = 0; i < 5; i++) { const e = g.director.spawn('guard', p.pos.x + fx * 7 + (i - 2) * 1.5, p.pos.z + fz * 7, null); e.spawnT = 0; es.push(e); }
    for (let i = 0; i < 3; i++) g.update(1 / 30);
    for (const e of es) g.combat.damageEnemy(e, 50, { dir: new p.pos.constructor(fx, 0, fz), canCrit: false });
    g.hitStopT = 0; p.camPitch = -0.25;
    for (let i = 0; i < 12; i++) g.update(1 / 30);
    g.render(1 / 30);
  });
  await page.screenshot({ path: `${out}-coins.png` });
  const r1 = await page.evaluate(() => { const g = window.game; for (let i = 0; i < 150; i++) g.update(1 / 30); const p = g.player; return { gold: p.gold, xp: p.xp, level: p.level, coinsLeft: g.combat.coins.length }; });
  console.log('after kills', JSON.stringify(r1));
  await page.evaluate(() => { const g = window.game; const p = g.player; p.gainXp(400); p.gold += 300; g.update(1 / 30); g.render(1 / 30); });
  await page.screenshot({ path: `${out}-level.png` });
  await page.evaluate(() => { const g = window.game; g.openPerks(); g.renderer.setAnimationLoop(() => g.frame()); });
  const b = await page.evaluate(() => document.querySelectorAll('.perk button')[1].getBoundingClientRect().toJSON());
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down(); await page.waitForTimeout(100); await page.mouse.up();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}-perks.png` });
  const r2 = await page.evaluate(() => { const p = window.game.player; return { gold: p.gold, perks: p.perks, level: p.level, maxHp: p.stats.maxHp, dmg: +p.stats.damage.toFixed(2) }; });
  console.log('after perk', JSON.stringify(r2));
}
