export default async function (page, out) {
  await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null);
    g.director.update = () => {};
    const p = g.player; const sp = g.world.spawn;
    const e = g.director.spawn('rook', sp.x + 4, sp.z - 16, null); e.spawnT = 0.01; e.cooldown = 0.3;
    p.hp = 5; p.camYaw = Math.PI;
    let n = 0; while (p.alive && n++ < 600) g.update(1 / 30);
    window._n = n;
  });
  for (const [label, secs] of [['a', 0.6], ['b', 1.8], ['c', 3.2]]) {
    await page.evaluate((secs) => {
      const g = window.game;
      while (g.killcam && g.killcam.t < secs) g.update(1 / 30);
      g.render(1 / 30);
    }, secs);
    await page.screenshot({ path: `${out}-${label}.png` });
  }
  const r = await page.evaluate(() => {
    const g = window.game; let n = 0;
    while (g.state === 'dying' && n++ < 400) g.update(1 / 30);
    return { state: g.state, dead: !document.getElementById('screen-dead').classList.contains('hidden'), killer: g.deathKiller, frames: window._n };
  });
  console.log(JSON.stringify(r));
  await page.screenshot({ path: `${out}-d.png` });
}
