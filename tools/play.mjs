export default async function (page, out) {
  await page.evaluate(() => window.debugStart());
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const g = window.game;
    const p = g.player;
    const fx = Math.sin(p.camYaw), fz = Math.cos(p.camYaw);
    g.director.spawn('guard', p.pos.x + fx * 7 - fz * 2, p.pos.z + fz * 7 + fx * 2, null);
    g.director.spawn('guard', p.pos.x + fx * 9 + fz * 3, p.pos.z + fz * 9 - fx * 3, null);
    g.director.spawn('teacup', p.pos.x + fx * 11 + fz * 5, p.pos.z + fz * 11 - fx * 5, null);
    g.director.spawn('teacup', p.pos.x + fx * 6 - fz * 5, p.pos.z + fz * 6 + fx * 5, null);
    g.director.spawn('wisp', p.pos.x + fx * 12, p.pos.z + fz * 12, null);
    g.director.spawn('rabbit', p.pos.x + fx * 20 - fz * 4, p.pos.z + fz * 20 + fx * 4, null);
    p.inv.add('drink_me'); p.inv.add('whetstone'); p.inv.add('jubjub'); p.recompute(); g.hud.updateItems(p.inv);
    p.corruption = 60; p.gold = 87;
    window.__fire = true;
    g.input.mouse.left = true;
  });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${out}-a.png` });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.game.input.pressed.add('rmb'); });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}-b.png` });
  const info = await page.evaluate(() => {
    const g = window.game;
    return { fps: 0, enemies: g.enemies.map((e) => `${e.name}:${Math.round(e.hp)}/${Math.round(e.maxHp)}:${e.state}`), hp: g.player.hp, pos: g.player.pos.toArray().map((v) => v.toFixed(1)) };
  });
  console.log(JSON.stringify(info));
}
