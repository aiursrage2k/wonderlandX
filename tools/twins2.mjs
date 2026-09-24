export default async function (page) {
  const r = await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null);
    g.startRun(2); g.director.update = () => {};
    const p = g.player; p.godMode = true;
    const t = g.interactables.filter((i) => i.kind === 'invite')[0];
    p.placeAt(t.pos.x, t.pos.z + 3.5); g.update(1 / 30);
    t.interact();
    for (let i = 0; i < 40; i++) g.update(1 / 30);
    const e = g.enemies.find((q) => q.boss && q.alive);
    let calls = 0; const od = e.onDeath.bind(e); e.onDeath = () => { calls++; od(); };
    e.hp = 1; e.hurt(10, false, null); g.combat.onKill(e);
    for (let i = 0; i < 60; i++) g.update(1 / 30);
    return { calls, twinsDown: g.twinsDown, state: g.teleporter.state, broken: g.teleporter.broken, tables: g.interactables.filter((i) => i.kind === 'invite').map((i) => i.pos.toArray().map(Math.round)) };
  });
  console.log(JSON.stringify(r));
}
