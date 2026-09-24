export default async function (page, out) {
  await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null);
    g.loadStage(2); g.director.update = () => {};
    const p = g.player; p.placeAt(0, 50); p.camYaw = Math.PI; p.camPitch = 0.02;
    const put = (t, x, z) => { const e = g.director.spawn(t, x, z, null); e.spawnT = 0; e.state = 'chase'; e.think = function (dt) { this.faceToward(g.player.pos.x, g.player.pos.z, dt); this.t += 0; }; return e; };
    put('hatter', -2.8, 44.5); put('spider', 0.2, 45.5); put('cannon', 3.2, 43.5);
    const h = put('madhatter', 0, 33);
    for (let i = 0; i < 20; i++) g.update(1 / 30);
    g.render(1 / 30);
  });
  await page.screenshot({ path: `${out}-lineup.png` });
}
