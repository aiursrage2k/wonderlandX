// Close-up turnaround of a model: node tools/shot.mjs out tools/booth.mjs  (BOOTH=alice|rabbit)
export default async function (page, out) {
  const which = process.env.BOOTH || 'alice';
  const views = which === 'alice'
    ? [['front', 0, 1.25, 2.4], ['three', 0.7, 1.35, 2.4], ['back', Math.PI, 1.3, 2.6], ['face', 0.25, 1.62, 0.8]]
    : [['front', 0, 3.5, 9], ['three', 0.7, 3.8, 9], ['back', Math.PI, 3.6, 9], ['face', 0.35, 5.6, 4.5]];
  await page.evaluate((which) => {
    window.debugStart();
    const g = window.game; g.renderer.setAnimationLoop(null); g.director.update = () => {};
    const p = g.player;
    g.update(1 / 30);
    if (which === 'rabbit') {
      const e = g.director.spawn('rabbit', p.pos.x, p.pos.z + 0.01, null);
      e.spawnT = 0; e.state = 'chase'; e.think = () => {};
      p.model.visible = false; p.update = () => {};
      g._subject = e;
    } else g._subject = null;
    for (let i = 0; i < 20; i++) g.update(1 / 30);
    g.hud.show(false);
  }, which);
  for (const [name, ang, h, d] of views) {
    await page.evaluate(({ ang, h, d }) => {
      const g = window.game; const p = g.player;
      const s = g._subject ? g._subject.pos : p.pos;
      const yaw = g._subject ? g._subject.yaw : p.yaw;
      const a = yaw + ang;
      g.update(1 / 30);
      g.camera.position.set(s.x + Math.sin(a) * d, s.y + h, s.z + Math.cos(a) * d);
      g.camera.lookAt(s.x, s.y + h * (g._subject ? 0.85 : 0.92), s.z);
      g.composer.render();
    }, { ang, h, d });
    await page.screenshot({ path: `${out}-${name}.png` });
  }
}
