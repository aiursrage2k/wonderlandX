export default async function (page, out) {
  const r = await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null);
    g.startRun(3); g.director.update = () => {};
    const p = g.player; p.godMode = true;
    g.teleporter.interact();
    const c = g.teleporter.court;
    for (const e of c.members) { e.hp = 1; e.hurt(10, false, null); g.combat.onKill(e); }
    for (let i = 0; i < 30 * 9; i++) { p.hp = p.stats.maxHp; g.update(1 / 30); }
    p.placeAt(0, 30); p.camYaw = Math.PI; p.camPitch = 0.35;
    for (let i = 0; i < 10; i++) g.update(1 / 30);
    g.render(1 / 30);
    const q = g.boss; const hc = q.hitCenter(new (q.pos.constructor)());
    return { pos: q.pos.toArray(), inScene: !!q.model.parent, vis: q.model.visible, scale: q.model.scale.x, heart: hc.toArray().map(v=>v.toFixed(1)) };
  });
  console.log(JSON.stringify(r));
  await page.screenshot({ path: `${out}-q1.png` });
}
