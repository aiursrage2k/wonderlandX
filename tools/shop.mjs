export default async function (page, out) {
  await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null); g.director.update = () => {};
    const p = g.player; const sh = g.shop;
    p.placeAt(sh.interactPos.x + (sh.interactPos.x - sh.pos.x) * 1.6, sh.interactPos.z + (sh.interactPos.z - sh.pos.z) * 1.6);
    p.camYaw = Math.atan2(sh.pos.x - p.pos.x, sh.pos.z - p.pos.z) + 0.25; p.camPitch = 0.02;
    for (let i = 0; i < 10; i++) g.update(1 / 30);
    g.render(1 / 30);
  });
  await page.screenshot({ path: `${out}-stall.png` });
  await page.evaluate(() => {
    const g = window.game; g.player.gold = 260; g.openShop(g.shop); g.update(1 / 30); g.render(1 / 30);
    window.__btn = document.querySelectorAll('.ware-buy')[1].getBoundingClientRect().toJSON();
  });
  const b = await page.evaluate(() => window.__btn);
  // a real mouse press/release, with frames running in between like a player would
  await page.evaluate(() => window.game.renderer.setAnimationLoop(() => window.game.frame()));
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}-ui.png` });
  const r = await page.evaluate(() => ({ gold: window.game.player.gold, items: window.game.player.inv.order, state: window.game.state }));
  console.log(JSON.stringify(r));
}
