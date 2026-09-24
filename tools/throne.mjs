export default async function (page, out) {
  const r = await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null);
    g.startRun(3); g.director.update = () => {};
    const p = g.player; p.camYaw = Math.PI; p.camPitch = 0.12;
    for (let i = 0; i < 10; i++) g.update(1 / 30);
    g.render(1 / 30);
    return { name: g.world.theme.name, pos: p.pos.toArray().map((v) => v.toFixed(1)), enemies: g.enemies.length, draws: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles };
  });
  console.log(JSON.stringify(r));
  await page.screenshot({ path: `${out}-spawn.png` });
  await page.evaluate(() => {
    const g = window.game; const p = g.player;
    p.placeAt(4, -10); p.camYaw = Math.PI - 0.1; p.camPitch = 0.05;
    g.teleporter.discovered = true; g.teleporter.interact();
    for (let i = 0; i < 75; i++) g.update(1 / 30);
    g.render(1 / 30);
  });
  await page.screenshot({ path: `${out}-court.png` });
  const r2 = await page.evaluate(() => {
    const g = window.game; const p = g.player; p.godMode = true;
    const c = g.teleporter.court;
    const names = c.members.map((e) => e.name + ':' + Math.round(e.hp));
    for (const e of c.members) { e.hp = 1; e.hurt(10, false, null); g.combat.onKill(e); }
    for (let i = 0; i < 30 * 9; i++) { p.hp = p.stats.maxHp; g.update(1 / 30); }
    p.placeAt(0, 20); p.camYaw = Math.PI; p.camPitch = -0.25;
    for (let i = 0; i < 10; i++) g.update(1 / 30);
    g.render(1 / 30);
    return { names, phase: c.phase, boss: g.boss && g.boss.name, state: g.boss && g.boss.state, hp: g.boss && Math.round(g.boss.hp), y: g.boss && g.boss.pos.y.toFixed(1) };
  });
  console.log(JSON.stringify(r2));
  await page.screenshot({ path: `${out}-queen.png` });
}
