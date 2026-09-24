export default async function (page, out) {
  const r = await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null);
    g.loadStage(2); g.director.update = () => {};
    const tp = g.teleporter, p = g.player;
    const gp = tp.pos;
    p.placeAt(gp.x, gp.z + 16); p.camYaw = Math.PI; p.camPitch = 0.1;
    for (let i = 0; i < 10; i++) g.update(1 / 30);
    const log = [tp.state + ' ' + document.getElementById('objective').textContent];
    tp.interact();
    log.push('after interact while sealed: ' + tp.state);
    p.kills += 15; for (let i = 0; i < 20; i++) g.update(1 / 30);
    log.push(tp.state + ' broken=' + tp.broken + ' ' + document.getElementById('objective').textContent);
    return log;
  });
  console.log(r.join('\n'));
  await page.evaluate(() => { const g = window.game; g.render(1 / 30); });
  await page.screenshot({ path: `${out}-a.png` });
  const r2 = await page.evaluate(() => {
    const g = window.game, tp = g.teleporter, p = g.player;
    p.kills += 25; for (let i = 0; i < 40; i++) g.update(1 / 30);
    const s = tp.state; tp.interact();
    return s + ' -> ' + tp.state + ' boss=' + (g.boss && g.boss.name);
  });
  console.log(r2);
}
