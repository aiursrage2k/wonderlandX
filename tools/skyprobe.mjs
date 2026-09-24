export default async function (page, out) {
  const r = await page.evaluate(() => {
    window.debugStart(); const g = window.game; g.renderer.setAnimationLoop(null); g.director.update = () => {};
    const p = g.player; p.camYaw = Math.PI - 0.4; p.camPitch = 0.35; g.update(1 / 30);
    const w = g.world;
    const info = { skyVisible: w.sky.visible, skyPos: w.sky.position.toArray().map(Math.round), cam: g.camera.position.toArray().map(Math.round), fogDensity: g.scene.fog.density };
    // hide everything but the sky
    const hidden = [];
    g.scene.traverse((o) => { if ((o.isMesh || o.isSprite || o.isPoints) && o !== w.sky && o.visible) { o.visible = false; hidden.push(o); } });
    g.render(1 / 30);
    window.__hidden = hidden;
    return info;
  });
  console.log(JSON.stringify(r));
  await page.screenshot({ path: `${out}-only.png` });
}
