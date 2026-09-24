export default async function (page, out) {
  const r = await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null); g.director.update = () => {};
    const p = g.player; const b = g.world.boulders[0];
    p.placeAt(b.x + 7, b.z + 3);
    p.camYaw = Math.atan2(b.x - p.pos.x, b.z - p.pos.z) + 0.3; p.camPitch = -0.12;
    for (let i = 0; i < 5; i++) g.update(1 / 30);
    g.render(1 / 30);
    // walk straight into it and see if we're stopped
    const start = p.pos.clone();
    p.camYaw = Math.atan2(b.x - p.pos.x, b.z - p.pos.z);
    g.input.keys.add('w');
    for (let i = 0; i < 90; i++) g.update(1 / 30);
    g.input.keys.clear();
    return { boulders: g.world.boulders.length, colliders: g.world.colliders.length, distToCentre: Math.hypot(p.pos.x - b.x, p.pos.z - b.z).toFixed(2), size: b.size.toFixed(2), moved: start.distanceTo(p.pos).toFixed(2) };
  });
  console.log(JSON.stringify(r));
  await page.screenshot({ path: `${out}-1.png` });
}
