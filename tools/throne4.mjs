export default async function (page, out) {
  await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null);
    g.startRun(3); g.director.update = () => {};
    const p = g.player; p.godMode = true;
    g.teleporter.interact();
    const c = g.teleporter.court;
    for (const e of c.members) { e.hp = 1; e.hurt(10, false, null); g.combat.onKill(e); }
    for (let i = 0; i < 30 * 9; i++) { p.hp = p.stats.maxHp; g.update(1 / 30); }
    for (const it of g.interactables) if (it.kind !== 'glass' && it.kind !== 'pickup') it.model.visible = false;
    p.placeAt(6, 12);
  });
  const log = [];
  for (const atk of ['rake', 'slam', 'decree', 'lance', 'thorns', 'summon']) {
    const r = await page.evaluate((atk) => {
      const g = window.game; const q = g.boss; const p = g.player;
      q.state = atk; q.t = 0; q.fired = 0; q.didHit = false; q.begin(atk);
      const hp0 = p.hp; let hits = 0; p.godMode = false; p.invuln = 0;
      const orig = p.hurt.bind(p); p.hurt = (d, f) => { hits++; return false; };
      const snapAt = { rake: 0.8, slam: 1.2, decree: 1.3, lance: 1.0, thorns: 1.9, summon: 1.3 }[atk];
      let n = 0;
      while (q.t < snapAt && n++ < 400) { g.update(1 / 30); }
      p.hurt = orig;
      const yaw = Math.atan2(q.pos.x - p.pos.x, q.pos.z - p.pos.z);
      p.camYaw = yaw; p.camPitch = 0.28;
      g.update(1 / 30); g.render(1 / 30);
      return { atk, state: q.state, t: q.t.toFixed(2), hits };
    }, atk);
    await page.screenshot({ path: `${out}-${atk}.png` });
    const r2 = await page.evaluate(() => {
      const g = window.game; const q = g.boss; const p = g.player; let hits = 0;
      const orig = p.hurt.bind(p); p.hurt = () => { hits++; return false; };
      let n = 0; while (q.state !== 'idle' && n++ < 600) g.update(1 / 30);
      p.hurt = orig;
      return { after: q.state, hits, frames: n, enemies: g.enemies.filter((e) => e.alive).length };
    });
    log.push(JSON.stringify({ ...r, ...r2 }));
  }
  console.log(log.join('\n'));
}
