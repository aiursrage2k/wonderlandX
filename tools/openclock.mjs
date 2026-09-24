export default async function (page, out) {
  const r = await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null);
    g.startRun(2); g.director.update = () => {};
    const p = g.player;
    for (let i = 0; i < 10; i++) g.update(1 / 30);
    p.camYaw = Math.atan2(-p.pos.x, -p.pos.z); p.camPitch = 0.05;
    g.update(1 / 30); g.render(1 / 30);
    const info = g.renderer.info.render;
    return { spawn: p.pos.toArray().map((v) => v.toFixed(0)), dist: Math.hypot(p.pos.x, p.pos.z).toFixed(0), terminals: g.interactables.filter((i) => i.kind === 'terminal').length, chests: g.interactables.filter((i) => i.kind === 'chest').length, inArena: g.interactables.filter((i) => Math.hypot(i.pos.x, i.pos.z) < 107).map((i) => i.kind).join(','), colliders: g.world.colliders.length, disc: g.teleporter.discovered };
  });
  console.log(JSON.stringify(r));
  await page.screenshot({ path: `${out}-spawn.png` });
  for (const [n, d] of [['approach', 140], ['rim', 112], ['inside', 70]]) {
    const r2 = await page.evaluate((d) => {
      const g = window.game; const p = g.player;
      const a = Math.atan2(p.pos.z, p.pos.x);
      p.placeAt(Math.cos(a) * d, Math.sin(a) * d);
      for (let i = 0; i < 4; i++) g.update(1 / 30);
      p.camYaw = Math.atan2(-p.pos.x, -p.pos.z); p.camPitch = 0.08;
      g.update(1 / 30); g.render(1 / 30);
      return { y: p.pos.y.toFixed(2), disc: g.teleporter.discovered };
    }, d);
    console.log(n, JSON.stringify(r2));
    await page.screenshot({ path: `${out}-${n}.png` });
  }
}
