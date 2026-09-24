export default async function (page, out) {
  const r = await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null);
    g.loadStage(2); g.director.update = () => {};
    const p = g.player;
    for (let i = 0; i < 14; i++) g.director.spawn(['hatter', 'spider', 'cannon'][i % 3], Math.cos(i) * 45, Math.sin(i) * 45, null);
    for (let i = 0; i < 40; i++) g.update(1 / 30);
    g.renderer.info.autoReset = false; g.renderer.info.reset(); g.render(1 / 30);
    return { calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles, geos: g.renderer.info.memory.geometries };
  });
  console.log(JSON.stringify(r));
}
