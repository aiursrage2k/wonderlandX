export default async function (page, out) {
  const info = await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null); g.director.update = () => {};
    const p = g.player; const fx = Math.sin(p.camYaw), fz = Math.cos(p.camYaw), rx = -fz, rz = fx;
    const d1 = g.director.spawn('diamond', p.pos.x + fx * 10 - rx * 3, p.pos.z + fz * 10 - rz * 3, null);
    const d2 = g.director.spawn('diamond', p.pos.x + fx * 12 + rx * 3, p.pos.z + fz * 12 + rz * 3, null);
    const gd = g.director.spawn('guard', p.pos.x + fx * 6 + rx * 1, p.pos.z + fz * 6 + rz * 1, null); gd.spawnT = 0; gd.state = 'chase';
    p.camPitch = -0.15;
    for (let i = 0; i < 12; i++) g.update(1 / 30);
    g.render(1 / 30);
    window.__g = gd;
    return { S: g.world.S, plazas: g.world.plazas.length, colliders: g.world.colliders.length, interact: g.interactables.length, glass: g.world.glassPos, spawn: g.world.spawn };
  });
  console.log(JSON.stringify(info));
  await page.screenshot({ path: `${out}-portal.png` });
  await page.evaluate(() => {
    const g = window.game; const p = g.player;
    g.combat.damageEnemy(window.__g, 50, { canCrit: false, dir: new p.pos.constructor(0, 0, 1) }); g.hitStopT = 0;
    for (let i = 0; i < 45; i++) g.update(1 / 30);
    g.render(1 / 30);
  });
  await page.screenshot({ path: `${out}-orbs.png` });
  const perf = await page.evaluate(() => {
    const g = window.game; g.renderer.info.autoReset = false; g.renderer.info.reset(); g.render(1 / 30);
    const t0 = performance.now(); for (let i = 0; i < 60; i++) g.update(1 / 30); const upd = (performance.now() - t0) / 60;
    return { calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles, updMs: upd.toFixed(2), orbs: g.combat.orbs.length, xp: g.player.xp.toFixed(1) };
  });
  console.log(JSON.stringify(perf));
}
