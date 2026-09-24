export default async function (page, out) {
  for (const atk of ['claw', 'barrage']) {
    await page.evaluate((atk) => {
      if (!window.game.player) window.debugStart();
      const g = window.game; g.renderer.setAnimationLoop(null); g.director.update = () => {};
      const p = g.player; const fx = Math.sin(p.camYaw), fz = Math.cos(p.camYaw);
      for (const e of g.enemies) { e.alive = false; e.remove(); } g.enemies = [];
      const r = g.director.spawn('rabbit', p.pos.x + fx * (atk === 'claw' ? 6 : 12), p.pos.z + fz * (atk === 'claw' ? 6 : 12), null);
      r.spawnT = 0; r.state = 'chase';
      for (let i = 0; i < 3; i++) g.update(1 / 30);
      r.faceToward(p.pos.x, p.pos.z, 10, 100);
      r.state = atk; r.t = 0; r.telegraph();
      p.camPitch = -0.25;
      for (let i = 0; i < 14; i++) g.update(1 / 30);
      g.render(1 / 30);
    }, atk);
    await page.screenshot({ path: `${out}-${atk}.png` });
  }
}
