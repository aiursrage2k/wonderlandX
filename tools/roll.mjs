export default async function (page, out) {
  const r = await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null); g.director.update = () => {};
    const p = g.player; const i = g.input;
    for (let k = 0; k < 5; k++) g.update(1 / 30);
    // double jump
    i.pressed.add(' '); g.update(1 / 30);
    for (let k = 0; k < 8; k++) g.update(1 / 30);
    const y1 = p.pos.y - g.world.height(p.pos.x, p.pos.z);
    i.pressed.add(' '); g.update(1 / 30);
    let peak = 0; for (let k = 0; k < 20; k++) { g.update(1 / 30); peak = Math.max(peak, p.pos.y - g.world.height(p.pos.x, p.pos.z)); }
    for (let k = 0; k < 40; k++) g.update(1 / 30);
    // roll
    const start = p.pos.clone();
    i.keys.add('w'); i.pressed.add('c');
    g.update(1 / 30);
    const inv = p.rollT > 0;
    for (let k = 0; k < 5; k++) g.update(1 / 30);
    g.render(1 / 30);
    window.__rollMid = true;
    return { afterFirstJump: y1.toFixed(2), doubleJumpPeak: peak.toFixed(2), rolling: inv, rollDist: start.distanceTo(p.pos).toFixed(2), bodyRotX: p.parts.body.rotation.x.toFixed(2) };
  });
  console.log(JSON.stringify(r));
  await page.screenshot({ path: `${out}-mid.png` });
}
