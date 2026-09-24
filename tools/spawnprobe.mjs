export default async function (page, out) {
  const r = await page.evaluate(() => {
    const res = [];
    for (let k = 0; k < 4; k++) {
      window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null);
      const p = g.player; const w = g.world;
      for (let i = 0; i < 3; i++) g.update(1 / 30);
      const near = w.colliders.filter((c) => Math.hypot(c.x - p.pos.x, c.z - p.pos.z) < c.r + 3).map((c) => ({ d: +Math.hypot(c.x - p.pos.x, c.z - p.pos.z).toFixed(1), r: +c.r.toFixed(1), top: +(c.top - p.pos.y).toFixed(1) }));
      res.push({ spawn: [Math.round(w.spawn.x), Math.round(w.spawn.z)], pos: p.pos.toArray().map((v) => +v.toFixed(1)), cam: p.cam.toArray().map((v) => +v.toFixed(1)), boom: +p.boom.toFixed(2), near });
    }
    return res;
  });
  console.log(JSON.stringify(r, null, 0));
}
