export default async function (page, out) {
  const r = await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null);
    g.director.update = () => {};
    const p = g.player; const sp = g.world.spawn;
    const e = g.director.spawn('rook', sp.x, sp.z - 20, null); e.spawnT = 0.01; e.cooldown = 0.5;
    p.camYaw = Math.PI; p.camPitch = 0.1;
    let hits = 0; const orig = p.hurt.bind(p); p.hurt = (d) => { hits++; return orig(d); };
    for (let i = 0; i < 30 * 1.9; i++) g.update(1 / 30);
    p.camYaw = Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z) + 0.3; p.camPitch = 0.12;
    g.update(1 / 30); g.render(1 / 30);
    return { state: e.state, t: e.t.toFixed(2), d: e.distToPlayer().toFixed(1) };
  });
  console.log(JSON.stringify(r));
  await page.screenshot({ path: `${out}-gaze.png` });
  const r2 = await page.evaluate(() => {
    const g = window.game; const p = g.player; const e = g.enemies.find((x) => x.name === 'Rook Sentinel');
    let n = 0; const hp0 = p.hp;
    while (!e.didHit && n++ < 200) g.update(1 / 30);
    g.render(1 / 30);
    return { fired: e.didHit, hpLost: Math.round(hp0 - p.hp), hpMax: e.maxHp };
  });
  console.log(JSON.stringify(r2));
  await page.screenshot({ path: `${out}-fire.png` });
}
