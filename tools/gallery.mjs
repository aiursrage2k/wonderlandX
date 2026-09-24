export default async function (page, out) {
  await page.evaluate(() => window.debugStart());
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const g = window.game;
    const p = g.player;
    g.director.update = () => {};
    const fx = Math.sin(p.camYaw), fz = Math.cos(p.camYaw);
    const rx = -fz, rz = fx;
    const put = (type, f, r) => {
      const e = g.director.spawn(type, p.pos.x + fx * f + rx * r, p.pos.z + fz * f + rz * r, null);
      e.spawnT = 0; e.state = 'chase'; e.think = function (dt) { this.faceToward(g.player.pos.x, g.player.pos.z, dt); };
      return e;
    };
    put('guard', 5, -2.2);
    put('teacup', 4.5, 0.3);
    const w = put('wisp', 5, 2.4); w.pos.y = g.world.height(w.pos.x, w.pos.z) + 1.8;
    put('rabbit', 14, 0);
    p.camPitch = 0.05;
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}-gal.png` });
  await page.evaluate(() => {
    const g = window.game; const p = g.player;
    p.camYaw += Math.PI; p.camPitch = -0.15;
    g.player.updateCamera(0);
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}-front.png` });
}
