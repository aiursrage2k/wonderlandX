// node tools/shot.mjs out tools/portrait.mjs  — env BOSS=madhatter|queen|crimson, DEPTH
export default async function (page, out) {
  const boss = process.env.BOSS || 'madhatter';
  const depth = +(process.env.DEPTH || 2);
  const views = JSON.parse(process.env.VIEWS || '[[0,1.2,7,0,2,0]]');
  await page.evaluate(({ boss, depth }) => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null);
    g.startRun(depth); g.director.update = () => {};
    const p = g.player; p.godMode = true;
    for (const it of g.interactables) if (it.model) it.model.visible = false;
    const sp = g.world.spawn;
    const e = g.director.spawn(boss, sp.x, sp.z - 8, null);
    e.state = boss === 'crimson' ? 'rise' : 'chase'; e.spawnT = 0; e.cooldown = 999; if (boss === 'crimson') { e.pos.set(0, e.riseY0, -66); e.t = 10; }
    window._e = e;
    for (let i = 0; i < 40; i++) g.update(1 / 30);
    e.think = function (dt) { this.vel.set(0, 0, 0); if (this.pose) this.pose(dt, null); };
    for (let i = 0; i < 10; i++) g.update(1 / 30);
    document.getElementById('hud').style.display = 'none';
    p.model.visible = false; p.placeAt(sp.x + 30, sp.z + 30);
  }, { boss, depth });
  let k = 0;
  for (const v of views) {
    await page.evaluate((v) => {
      const g = window.game; const e = window._e;
      g.update(1 / 30);
      const [dx, dy, dz, lx, ly, lz] = v;
      const c = e.pos;
      const cam = g.player.cam; cam.set(c.x + dx, c.y + dy, c.z + dz);
      g.player.lookDir.set(c.x + lx - cam.x, c.y + ly - cam.y, c.z + lz - cam.z).normalize();
      g.render(1 / 30);
    }, v);
    await page.screenshot({ path: `${out}-${k++}.png` });
  }
}
