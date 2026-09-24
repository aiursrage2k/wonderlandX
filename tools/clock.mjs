export default async function (page, out) {
  const r = await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null);
    g.loadStage(2);
    g.director.update = () => {};
    const p = g.player;
    p.camYaw = Math.PI; p.camPitch = 0.05;
    for (let i = 0; i < 10; i++) g.update(1 / 30);
    g.render(1 / 30);
    return { name: g.world.theme.name, colliders: g.world.colliders.length, pos: p.pos.toArray().map((v) => v.toFixed(1)) };
  });
  console.log(JSON.stringify(r));
  await page.screenshot({ path: `${out}-spawn.png` });
  await page.evaluate(() => {
    const g = window.game; const p = g.player;
    p.placeAt(12, 26); p.camYaw = Math.PI + 0.5; p.camPitch = -0.35;
    for (const [t, x, z] of [['hatter', 6, 14], ['spider', 10, 12], ['spider', 11, 13], ['cannon', 0, 8], ['hatter', 14, 17]]) {
      const e = g.director.spawn(t, x, z, null); e.spawnT = 0.01;
    }
    for (let i = 0; i < 30; i++) g.update(1 / 30);
    g.render(1 / 30);
  });
  await page.screenshot({ path: `${out}-fight.png` });
}
