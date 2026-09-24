export default async function (page, out) {
  const r = await page.evaluate(() => {
    window.debugStart();
    const g = window.game;
    g.renderer.setAnimationLoop(null);
    const p = g.player;
    for (let i = 0; i < 14; i++) g.director.spawn(['guard','teacup','wisp'][i % 3], p.pos.x + Math.sin(i) * 12, p.pos.z + Math.cos(i) * 12, null);
    for (let i = 0; i < 40; i++) g.update(1 / 30);
    g.renderer.info.autoReset = false;
    g.renderer.info.reset();
    g.render(1 / 30);
    const info = { calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles, geos: g.renderer.info.memory.geometries, tex: g.renderer.info.memory.textures, progs: g.renderer.info.programs.length };
    let meshes = 0; g.scene.traverse((o) => { if (o.isMesh) meshes++; });
    info.meshes = meshes;
    return info;
  });
  console.log(JSON.stringify(r));
}
