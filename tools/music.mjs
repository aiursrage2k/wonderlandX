export default async function (page, out) {
  await page.mouse.click(10, 10);
  const r = await page.evaluate(async () => {
    const A = await import('/src/engine/audio.js');
    A.unlockAudio();
    const res = {};
    const an = A.debugAnalyser();
    const buf = new Float32Array(2048);
    for (const name of ['title', 'stage', 'boss', 'final', 'victory']) {
      A.setMusic(name);
      await new Promise((r) => setTimeout(r, 3500));
      let peak = 0, sum = 0, n = 0;
      for (let k = 0; k < 10; k++) {
        an.getFloatTimeDomainData(buf);
        for (const v of buf) { peak = Math.max(peak, Math.abs(v)); sum += v * v; n++; }
        await new Promise((r) => setTimeout(r, 100));
      }
      res[name] = { peak: peak.toFixed(3), rms: Math.sqrt(sum / n).toFixed(4) };
    }
    return res;
  });
  console.log(JSON.stringify(r));
}
