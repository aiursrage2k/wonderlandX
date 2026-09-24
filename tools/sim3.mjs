// Fast-forward a full stage with an autopilot and report what happened.
export default async function (page, out) {
  await page.evaluate(() => {
    window.debugStart();
    const g = window.game;
    g.renderer.setAnimationLoop(null);
    g.log = [];
    const inp = g.input;
    g.autopilot = (dt) => {
      const p = g.player;
      if (!p.alive) return;
      if (g.godMode) p.hp = Math.max(p.hp, p.stats.maxHp * 0.5);
      inp.keys.clear();
      // target: nearest live enemy
      let tgt = null, bd = 1e9;
      for (const e of g.enemies) {
        if (!e.alive || e.state === 'spawn') continue;
        const d = e.pos.distanceTo(p.pos) - (e.colossus ? 40 : 0);
        if (d < bd) { bd = d; tgt = e; }
      }
      let goal = null;
      if (g.teleporter.state === 'idle' && g.runTime > g.tpAt) goal = g.teleporter.pos;
      if (g.teleporter.state === 'ready') goal = g.teleporter.pos;
      if (g.teleporter.state === 'sealed') {
        const inv = g.interactables.find((i) => i.kind === 'invite' && !i.used);
        if (inv && !g.enemies.some((e) => e.alive && e.boss)) goal = inv.interactPos;
      }
      if (!goal && (!tgt || bd > 25)) {
        const ch = g.interactables.filter((i) => !i.used && i.kind !== 'glass' && (i.kind === 'tin' || p.gold >= i.cost))
          .sort((a, b) => a.pos.distanceTo(p.pos) - b.pos.distanceTo(p.pos))[0];
        if (ch) goal = ch.pos;
      }
      if (g.teleporter.state === 'charging' && !g.teleporter.inZone) goal = g.teleporter.pos;
      const range = tgt && tgt.colossus ? 150 : 45;
      if (tgt && bd < range) {
        const c = tgt.hitCenter(new p.pos.constructor());
        const dx = c.x - p.cam.x, dz = c.z - p.cam.z, dy = c.y - p.cam.y;
        p.camYaw = Math.atan2(dx, dz) + 0.05;
        p.camPitch = Math.atan2(dy, Math.hypot(dx, dz));
        inp.mouse.left = true;
        if (Math.random() < 0.02) inp.pressed.add('rmb');
        if (p.corruption >= 50 && Math.random() < 0.05) inp.pressed.add('q');
        if (bd < 5 && Math.random() < 0.05) inp.pressed.add('shift');
        if (!goal) { inp.keys.add(bd < 10 ? 's' : 'w'); inp.keys.add(Math.sin(g.time * 0.7) > 0 ? 'a' : 'd'); }
      } else inp.mouse.left = false;
      if (goal) {
        const want = Math.atan2(goal.x - p.pos.x, goal.z - p.pos.z);
        if (!tgt || bd >= range) { p.camYaw = want; p.camPitch = -0.1; inp.keys.add('w'); }
        else {
          // move toward goal while shooting: pick key by relative angle
          const rel = ((want - p.camYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          if (Math.abs(rel) < 1.2) inp.keys.add('w'); else if (Math.abs(rel) > 2) inp.keys.add('s');
          if (rel > 0.4 && rel < 2.7) inp.keys.add('a'); if (rel < -0.4 && rel > -2.7) inp.keys.add('d');
        }
        if (Math.hypot(goal.x - p.pos.x, goal.z - p.pos.z) < 3.5) inp.pressed.add('e');
      }
      if (Math.random() < 0.01) inp.pressed.add(' ');
      // unstick
      g._stuck = (g._stuck || 0) + (Math.hypot(p.vel.x, p.vel.z) < 0.5 && inp.keys.size ? dt : -dt);
      if (g._stuck > 1.5) { inp.pressed.add(' '); inp.pressed.add('shift'); g._stuck = 0; }
    };
  });
  const run = async (secs, label, opts = {}) => {
    const r = await page.evaluate(({ secs, opts }) => {
      const g = window.game;
      Object.assign(g, opts);
      const t0 = performance.now();
      let steps = 0;
      const startDepth = g.depth;
      while (steps * (1 / 30) < secs) {
        g.update(1 / 30);
        steps++;
        if (g.state === 'transition') { // let the fade timeout fire
          break;
        }
      }
      const p = g.player;
      return {
        ms: Math.round(performance.now() - t0), steps, runTime: g.runTime.toFixed(1), state: g.state, depth: g.depth, startDepth,
        hp: Math.round(p.hp), maxHp: p.stats.maxHp, gold: p.gold, kills: p.kills, dmg: Math.round(p.damageDealt), corr: Math.round(p.corruption),
        items: p.inv.order.map((i) => `${i}x${p.inv.count(i)}`).join(','), enemies: g.enemies.filter((e) => e.alive).length,
        chestsOpened: g.interactables.filter((i) => i.used).length, tp: g.teleporter.state, charge: g.teleporter.charge.toFixed(2),
        boss: g.enemies.filter((e) => e.boss).map((e) => `${Math.round(e.hp)}/${Math.round(e.maxHp)} ${e.state}`).join(','),
        pos: p.pos.toArray().map((v) => v.toFixed(0)).join(','), coeff: g.difficulty().toFixed(2), level: g.enemyLevel(),
      };
    }, { secs, opts });
    console.log(label, JSON.stringify(r));
    return r;
  };
  const snap = async (name) => {
    await page.evaluate(() => { const g = window.game; g.render(1 / 30); });
    await page.screenshot({ path: `${out}-${name}.png` });
  };
  const t0 = Date.now();
  for (let depth = 1; depth <= 3; depth++) {
    await run(30, `d${depth}-fight`, { godMode: true, tpAt: 60 });
    await snap(`d${depth}-fight`);
    let r;
    for (let i = 0; i < 40; i++) {
      r = await run(15, `d${depth}-e${i}`, { godMode: true, tpAt: 0 });
      if (r.state === 'transition' || r.state === 'won') break;
      if (i === 4) await snap(`d${depth}-boss`);
    }
    if (r.state === 'won') { await snap('won'); break; }
    await page.waitForTimeout(1500);
  }
  const st = await page.evaluate(() => ({ state: window.game.state, depth: window.game.depth, court: window.game.teleporter.court && window.game.teleporter.court.phase }));
  console.log('final', JSON.stringify(st), 'wall s', ((Date.now() - t0) / 1000).toFixed(0));
}