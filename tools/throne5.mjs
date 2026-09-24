export default async function (page, out) {
  const r = await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null);
    g.startRun(3); g.director.update = () => {};
    const p = g.player; p.godMode = true;
    g.teleporter.interact();
    const c = g.teleporter.court;
    for (const e of c.members) { e.hp = 1; e.hurt(10, false, null); g.combat.onKill(e); }
    for (let i = 0; i < 30 * 9; i++) { p.hp = p.stats.maxHp; g.update(1 / 30); }
    const q = g.boss; q.cooldown = 99;
    let n = 0; while (q.state !== 'idle' && n++ < 600) g.update(1 / 30);
    g.tickers = [];
    p.placeAt(6, 12);
    const out = {};
    let hits = []; p.hurt = (d) => { hits.push([q.state, q.t.toFixed(2), Math.hypot(p.pos.x, p.pos.z).toFixed(1), p.pos.y.toFixed(2)]); return false; };
    q.state = 'thorns'; q.t = 0; q.fired = 0; q.didHit = false; q.begin('thorns');
    for (let i = 0; i < 150; i++) g.update(1 / 30);
    out.thorns = hits.slice(); out.tickers = g.tickers.length;
    hits.length = 0;
    out.addRoom = g.director.addRoom(); out.alive = g.enemies.filter((e) => e.alive).map((e) => e.name);
    q.state = 'summon'; q.t = 0; q.fired = 0; q.didHit = false; q.begin('summon');
    for (let i = 0; i < 60; i++) g.update(1 / 30);
    out.after = g.enemies.filter((e) => e.alive).map((e) => e.name + ':' + e.state);
    return out;
  });
  console.log(JSON.stringify(r));
}
