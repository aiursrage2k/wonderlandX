export default async function (page, out) {
  await page.evaluate(() => window.debugStart());
  await page.waitForTimeout(1500);
  const tests = {
    base: () => {},
    noShadow: () => { window.game.renderer.shadowMap.enabled = false; window.game.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); },
    noPost: () => { window.game.composer.passes[1].enabled = false; window.game.composer.passes[3].enabled = false; },
    noParticles: () => { window.game.fx.glow.points.visible = false; window.game.fx.matter.points.visible = false; },
  };
  for (const [name, fn] of Object.entries(tests)) {
    await page.evaluate(`(${fn.toString()})()`);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}-${name}.png`, clip: { x: 340, y: 460, width: 600, height: 260 } });
  }
}
