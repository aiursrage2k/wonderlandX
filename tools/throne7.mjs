export default async function (page, out) {
  await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null);
    g.startRun(3); g.director.update = () => {};
    const p = g.player; p.godMode = true;
    p.placeAt(3, -12);
    g.teleporter.interact();
    for (let i = 0; i < 20; i++) g.update(1 / 30);
    p.camYaw = Math.PI + 0.15; p.camPitch = 0.02;
    g.update(1 / 30); g.render(1 / 30);
  });
  await page.screenshot({ path: `${out}-kneel.png` });
  const r = await page.evaluate(() => {
    const g = window.game; const p = g.player;
    for (let i = 0; i < 90; i++) { p.hp = p.stats.maxHp; g.update(1 / 30); }
    const k = g.teleporter.court.members.map((e) => e.name + ':' + e.state);
    p.camYaw = Math.PI + 0.15; g.update(1 / 30); g.render(1 / 30);
    return k;
  });
  console.log(JSON.stringify(r));
  await page.screenshot({ path: `${out}-fight.png` });
  const v = await page.evaluate(() => {
    const g = window.game; const p = g.player; const c = g.teleporter.court;
    for (const e of c.members) { e.hp = 1; e.hurt(10, false, null); g.combat.onKill(e); }
    for (let i = 0; i < 30 * 9; i++) { p.hp = p.stats.maxHp; g.update(1 / 30); }
    const q = g.boss; q.hp = 1; q.hurt(10, false, null); g.combat.onKill(q);
    const log = [];
    for (let i = 0; i < 30 * 7; i++) { p.hp = p.stats.maxHp; g.update(1 / 30); if (i === 45) { p.camYaw = Math.PI; p.camPitch = 0.3; g.render(1 / 30); } }
    return { state: g.state, phase: c.phase, win: !document.getElementById('screen-win').classList.contains('hidden'), stats: document.getElementById('win-stats').textContent.trim().replace(/\s+/g, ' ') };
  });
  console.log(JSON.stringify(v));
  await page.evaluate(() => window.game.render(1 / 30));
  await page.screenshot({ path: `${out}-win.png` });
}
