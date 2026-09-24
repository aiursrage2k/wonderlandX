export default async function (page, out) {
  const r = await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null);
    g.startRun(3); g.director.update = () => {};
    const p = g.player; p.godMode = true;
    g.teleporter.interact();
    const c = g.teleporter.court;
    for (const e of c.members) { e.hp = 1; e.hurt(10, false, null); g.combat.onKill(e); }
    for (let i = 0; i < 30 * 9; i++) { p.hp = p.stats.maxHp; g.update(1 / 30); }
    const q = g.boss;
    q.state = 'summon'; q.t = 0; q.fired = 0; q.didHit = false; q.begin('summon');
    const log = [];
    for (let i = 0; i < 60; i++) { g.update(1 / 30); if (i % 10 === 0) log.push([q.state, q.t.toFixed(2), q.didHit, g.enemies.length].join(',')); }
    return log;
  });
  console.log(JSON.stringify(r));
}
