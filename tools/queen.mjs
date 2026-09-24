export default async function (page, out) {
  await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null); g.director.update = () => {};
    const p = g.player; const fx = Math.sin(p.camYaw), fz = Math.cos(p.camYaw);
    const q = g.director.spawn('queen', p.pos.x + fx * 13, p.pos.z + fz * 13, null); q.spawnT = 0.01;
    const t = g.interactables.find((i) => i.kind === 'shrine'); t.model.position.set(p.pos.x + fx * 5 - fz * 3, p.pos.y, p.pos.z + fz * 5 + fx * 3);
    for (let i = 0; i < 30; i++) g.update(1 / 30);
    q.cooldown = 0; q.summonT = 99;
    for (let i = 0; i < 40; i++) g.update(1 / 30);
    g.render(1 / 30);
  });
  await page.screenshot({ path: `${out}-1.png` });
  await page.evaluate(() => { const g = window.game; for (let i = 0; i < 40; i++) g.update(1 / 30); g.render(1 / 30); });
  await page.screenshot({ path: `${out}-2.png` });
}
