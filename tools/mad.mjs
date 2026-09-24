export default async function (page, out) {
  await page.evaluate(() => {
    window.debugStart();
    const g = window.game; g.renderer.setAnimationLoop(null);
    const p = g.player;
    const fx = Math.sin(p.camYaw), fz = Math.cos(p.camYaw), rx = -fz, rz = fx;
    for (let i = 0; i < 9; i++) { const e = g.director.spawn(['guard', 'teacup', 'wisp'][i % 3], p.pos.x + fx * (8 + i) + rx * (i - 4) * 1.5, p.pos.z + fz * (8 + i) + rz * (i - 4) * 1.5, i === 4 ? { id: 'crimson', name: 'Crimson', color: '#ff2a3a' } : null); e.spawnT = 0.05; }
    p.corruption = 100; p.camPitch = -0.05;
    for (let i = 0; i < 20; i++) g.update(1 / 30);
    g.input.pressed.add('q');
    g.input.mouse.left = true;
    for (let i = 0; i < 12; i++) g.update(1 / 30);
    g.input.pressed.add('rmb');
    for (let i = 0; i < 16; i++) g.update(1 / 30);
    g.render(1 / 30);
  });
  await page.screenshot({ path: `${out}-1.png` });
  await page.evaluate(() => { const g = window.game; for (let i = 0; i < 10; i++) g.update(1 / 30); g.render(1 / 30); });
  await page.screenshot({ path: `${out}-2.png` });
}
