export default async function (page, out) {
  const r = await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null);
    g.director.update = () => {};
    const p = g.player; p.gold = 500;
    const t = g.interactables.filter((i) => i.kind === 'terminal');
    const shop = g.multishops[0];
    const mid = shop.terminals[1];
    const fwd = { x: Math.sin(mid.model.rotation.y), z: Math.cos(mid.model.rotation.y) };
    p.placeAt(mid.pos.x + fwd.x * 4.2, mid.pos.z + fwd.z * 4.2);
    p.camYaw = mid.model.rotation.y + Math.PI; p.camPitch = -0.12;
    for (let i = 0; i < 5; i++) g.update(1 / 30);
    g.render(1 / 30);
    return { n: t.length, shops: g.multishops.length, offers: shop.terminals.map((x) => x.offer.name + ' ' + x.offer.cost) };
  });
  console.log(JSON.stringify(r));
  await page.screenshot({ path: `${out}-a.png` });
  const r2 = await page.evaluate(() => {
    const g = window.game; const p = g.player; const shop = g.multishops[0]; const mid = shop.terminals[1];
    p.placeAt(mid.pos.x + Math.sin(mid.model.rotation.y) * 2, mid.pos.z + Math.cos(mid.model.rotation.y) * 2);
    g.update(1 / 30);
    const label = document.getElementById('prompt').textContent;
    const gold0 = p.gold; g.input.pressed.add('e'); g.update(1 / 30);
    for (let i = 0; i < 20; i++) g.update(1 / 30);
    p.placeAt(mid.pos.x + Math.sin(mid.model.rotation.y) * 4.2, mid.pos.z + Math.cos(mid.model.rotation.y) * 4.2);
    g.update(1 / 30); g.render(1 / 30);
    return { label, spent: gold0 - p.gold, used: shop.terminals.map((t) => t.used), items: [...p.inv.stacks.keys()], perks: p.perks };
  });
  console.log(JSON.stringify(r2));
  await page.screenshot({ path: `${out}-b.png` });
  const r3 = await page.evaluate(() => {
    const g = window.game; const p = g.player;
    p.placeAt(0, 60); g.update(1/30);
    p.onGround = false; p.vel.y = 5; p.jumpsUsed = 1; g.input.pressed.add(' '); g.update(1 / 30);
    for (let i = 0; i < 6; i++) g.update(1 / 30);
    p.camYaw = p.yaw + Math.PI / 2; g.update(1/30); g.render(1 / 30);
    return { flipT: p.flipT && p.flipT.toFixed(2), bodyRot: p.parts.body.rotation.x.toFixed(2) };
  });
  console.log(JSON.stringify(r3));
  await page.screenshot({ path: `${out}-flip.png` });
}
