export default async function (page, out) {
  const r = await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null);
    const p = g.player; p.camYaw = Math.PI; p.camPitch = 0.18; g.update(1/30); g.render(1/30);
    const m = g.world.moon; const v = m.position.clone().project(g.camera);
    return { moon: m.position.toArray().map(Math.round), proj: v.toArray().map((x) => x.toFixed(2)), vis: m.visible, parent: !!m.parent, cam: g.camera.position.toArray().map(Math.round), far: g.camera.far, fog: m.material.fog, op: m.material.opacity };
  });
  console.log(JSON.stringify(r));
}
