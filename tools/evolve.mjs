export default async function (page, out) {
  await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null); g.director.update = () => {};
    const p = g.player; const fx = Math.sin(p.camYaw), fz = Math.cos(p.camYaw), rx = -fz, rz = fx;
    const lv = [1, 5, 9];
    lv.forEach((L, i) => {
      g.enemyLevel = () => L;
      for (const [t, off] of [['guard', 0], ['teacup', 2.6]]) {
        const e = g.director.spawn(t, p.pos.x + fx * (7 + off) + rx * (i - 1) * 3.2, p.pos.z + fz * (7 + off) + rz * (i - 1) * 3.2, null);
        e.spawnT = 0; e.state = 'chase'; e.think = function (dt) { this.faceToward(g.player.pos.x, g.player.pos.z, dt); };
        e.hp *= 0.7;
      }
    });
    p.camPitch = -0.1;
    for (let i = 0; i < 30; i++) g.update(1 / 30);
    g.render(1 / 30);
  });
  await page.screenshot({ path: `${out}-tiers.png` });
  console.log(await page.evaluate(() => JSON.stringify({ bars: document.querySelectorAll(".ebar").length, html: document.querySelector(".ebar")?.outerHTML.slice(0, 300), hp: window.game.enemies.map((e) => [Math.round(e.hp), Math.round(e.maxHp), e.tier]) })));
}
export async function probe(page) {}
