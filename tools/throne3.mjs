export default async function (page, out) {
  const info = await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null);
    g.startRun(3); g.director.update = () => {};
    const p = g.player; p.godMode = true;
    g.teleporter.interact();
    const c = g.teleporter.court;
    for (const e of c.members) { e.hp = 1; e.hurt(10, false, null); g.combat.onKill(e); }
    for (let i = 0; i < 30 * 9; i++) { p.hp = p.stats.maxHp; g.update(1 / 30); }
    for (const it of g.interactables) if (it.kind !== 'glass') it.model.visible = false;
    document.getElementById('hud').style.display = 'none';
    const q = g.boss; q.model.updateMatrixWorld(true);
    const box = new (q.model.children[0].constructor === Object ? Object : window.THREE_Box || Object)();
    let n = 0, vis = 0; q.model.traverse((o) => { if (o.isMesh) { n++; if (o.visible) vis++; } });
    return { n, vis, parent: q.model.parent && q.model.parent.type, mpos: q.model.position.toArray(), bodyChildren: q.parts.body.children.length };
  });
  console.log(JSON.stringify(info));
  for (const [n, pos, look] of [['front', [0, 14, 5], [0, 18, -60]], ['side', [45, 18, -30], [0, 16, -64]]]) {
    await page.evaluate(([pos, look]) => {
      const g = window.game; g.update(1 / 30);
      g.player.cam.set(...pos); g.player.lookDir.set(look[0] - pos[0], look[1] - pos[1], look[2] - pos[2]).normalize();
      g.render(1 / 30);
    }, [pos, look]);
    await page.screenshot({ path: `${out}-${n}.png` });
  }
}
