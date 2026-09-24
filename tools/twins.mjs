export default async function (page, out) {
  const info = await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null);
    g.startRun(2); g.director.update = () => {};
    const tables = g.interactables.filter((i) => i.kind === 'invite');
    const t = tables[0]; const p = g.player;
    p.placeAt(t.pos.x, t.pos.z + 9); p.camYaw = Math.PI; p.camPitch = 0.05;
    for (let i = 0; i < 6; i++) g.update(1 / 30);
    g.render(1 / 30);
    return { n: tables.length, pos: tables.map((q) => [Math.round(q.pos.x), Math.round(q.pos.z), q.type]), spawn: [Math.round(g.world.spawn.x), Math.round(g.world.spawn.z)], seals: g.teleporter.sealCount, obj: document.getElementById('objective').textContent };
  });
  console.log(JSON.stringify(info));
  await page.screenshot({ path: `${out}-table.png` });
  const log = [];
  for (const which of [0, 1]) {
    const r = await page.evaluate((which) => {
      const g = window.game; const p = g.player; p.godMode = true;
      const t = g.interactables.filter((i) => i.kind === 'invite')[which];
      p.placeAt(t.pos.x, t.pos.z + 3.5);
      g.update(1 / 30);
      const prompt = document.getElementById('prompt').textContent;
      g.input.pressed.add('e'); g.update(1 / 30);
      const e = g.enemies.find((q) => q.boss && q.alive);
      const states = new Set(); let hits = 0;
      const orig = p.hurt.bind(p); p.hurt = (d, f) => { hits++; return false; };
      for (let i = 0; i < 30 * 16; i++) { g.update(1 / 30); states.add(e.state); if (i === 30 * 5) { p.camYaw = Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z); p.camPitch = 0.1; } }
      p.hurt = orig;
      p.camYaw = Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z); p.camPitch = 0.12; g.update(1 / 30); g.render(1 / 30);
      window._e = e;
      return { prompt, name: e && e.name, hp: e && Math.round(e.maxHp), states: [...states], hits };
    }, which);
    log.push(JSON.stringify(r));
    await page.screenshot({ path: `${out}-fight${which}.png` });
    await page.evaluate(() => { const g = window.game; const e = window._e; e.hp = 1; e.hurt(10, false, null); g.combat.onKill(e); for (let i = 0; i < 60; i++) g.update(1 / 30); });
  }
  const end = await page.evaluate(() => { const g = window.game; for (let i = 0; i < 30; i++) g.update(1 / 30); return { twinsDown: g.twinsDown, state: g.teleporter.state, broken: g.teleporter.broken, obj: document.getElementById('objective').textContent }; });
  console.log(log.join('\n'));
  console.log(JSON.stringify(end));
}
