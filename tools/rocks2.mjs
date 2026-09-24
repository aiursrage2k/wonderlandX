export default async function (page, out) {
  const r = await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null); g.director.update = () => {};
    const p = g.player; const res = [];
    for (const b of g.world.boulders.slice(0, 6)) {
      p.placeAt(b.x + 9, b.z);
      p.vel.set(0, 0, 0);
      g.input.keys.clear(); g.input.keys.add('w');
      let minD = 1e9;
      for (let i = 0; i < 60; i++) {
        p.camYaw = Math.atan2(b.x - p.pos.x, b.z - p.pos.z);
        g.update(1 / 30);
        minD = Math.min(minD, Math.hypot(p.pos.x - b.x, p.pos.z - b.z));
      }
      const col = g.world.colliders.find((c) => Math.abs(c.x - b.x) < 1e-6 && Math.abs(c.z - b.z) < 1e-6);
      res.push({ size: +b.size.toFixed(2), r: col && +col.r.toFixed(2), top: col && +(col.top - g.world.height(b.x, b.z)).toFixed(2), minD: +minD.toFixed(2) });
    }
    g.input.keys.clear();
    return res;
  });
  console.log(JSON.stringify(r));
}
