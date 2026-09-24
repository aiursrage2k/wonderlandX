// Compose a mockup-like combat moment and screenshot a few frames of it.
export default async function (page, out) {
  await page.evaluate(() => {
    window.debugStart();
    const g = window.game;
    g.renderer.setAnimationLoop(null);
    g.director.update = () => {};
    const p = g.player;
    const gp = g.teleporter.pos;
    // stand south of the glass, facing it
    const ang = g.teleporter.model.rotation.y;
    p.placeAt(gp.x + Math.sin(ang) * 13, gp.z + Math.cos(ang) * 13);
    p.camYaw = ang + Math.PI;
    p.camPitch = -0.06;
    const fx = Math.sin(p.camYaw), fz = Math.cos(p.camYaw), rx = -fz, rz = fx;
    const at = (f, r) => [p.pos.x + fx * f + rx * r, p.pos.z + fz * f + rz * r];
    const S = (t, f, r) => { const e = g.director.spawn(t, ...at(f, r), null); e.spawnT = 0.01; return e; };
    S('guard', 4, 2.2); S('guard', 6, -3.5); S('guard', 9, 4);
    S('teacup', 7, 6); S('teacup', 5, -6.5);
    const w = S('wisp', 10, -1); w.hover = 3;
    const r = S('rabbit', 12, -5); r.cooldown = 99;
    p.inv.add('drink_me'); p.inv.add('pocket_watch'); p.inv.add('cheshire'); p.inv.add('rose_thorn');
    p.recompute(); g.hud.updateItems(p.inv); p.hp = 72; p.corruption = 64; p.gold = 142;
    g.input.mouse.left = true;
    g.runTime = 412;
    for (let i = 0; i < 25; i++) g.update(1 / 30);
    p.camYaw = ang + Math.PI - 0.05; p.camPitch = -0.02;
  });
  for (let k = 0; k < 3; k++) {
    await page.evaluate(() => { const g = window.game; for (let i = 0; i < 8; i++) g.update(1 / 30); g.player.camYaw += 0.0; g.render(1 / 30); });
    await page.screenshot({ path: `${out}-${k}.png` });
  }
  await page.evaluate(() => { const g = window.game; g.player.camPitch = 0.35; g.player.updateCamera(0); g.update(1/30); g.render(1 / 30); });
  await page.screenshot({ path: `${out}-sky.png` });
}
