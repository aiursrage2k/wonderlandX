export default async function (page, out) {
  await page.evaluate(() => {
    const g = window.game;
    g.transition.skip = false;
    g.renderer.setAnimationLoop(null); // let the overlay animate at full speed in headless
    document.getElementById('screen-title').classList.add('hidden');
    g.startRun(1);
    g.player.kills = 23;
    setTimeout(() => { g.state = 'play'; g.stageTime = 187; g.nextStage(); }, 3600);
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}-intro.png` });
  await page.waitForTimeout(4200);
  await page.screenshot({ path: `${out}-fall.png` });
  await page.waitForTimeout(3500);
  await page.evaluate(() => { const g = window.game; g.update(1 / 30); g.render(1 / 30); });
  await page.screenshot({ path: `${out}-arrive.png` });
  console.log(await page.evaluate(() => JSON.stringify({ state: window.game.state, depth: window.game.depth })));
}
