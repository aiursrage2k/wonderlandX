export default async function (page, out) {
  await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null); g.director.update = () => {};
    const p = g.player; const fx = Math.sin(p.camYaw), fz = Math.cos(p.camYaw), rx = -fz, rz = fx;
    const es = [];
    for (let i = 0; i < 4; i++) { const e = g.director.spawn(['guard', 'teacup', 'guard', 'wisp'][i], p.pos.x + fx * 6 + rx * (i - 1.5) * 2.2, p.pos.z + fz * 6 + rz * (i - 1.5) * 2.2, null); e.spawnT = 0.01; es.push(e); }
    if (es[3]) es[3].hover = 1.5;
    for (let i = 0; i < 20; i++) g.update(1 / 30);
    p.camPitch = -0.2;
    const dir = new p.pos.constructor(fx, 0, fz);
    for (const e of es) g.combat.damageEnemy(e, 50, { dir, canCrit: false });
    g.hitStopT = 0;
    for (let i = 0; i < 9; i++) g.update(1 / 30);
    g.render(1 / 30);
    window.__es = es;
  });
  await page.screenshot({ path: `${out}-1.png` });
  await page.evaluate(() => { const g = window.game; for (let i = 0; i < 45; i++) g.update(1 / 30); g.render(1 / 30); });
  await page.screenshot({ path: `${out}-2.png` });
}
