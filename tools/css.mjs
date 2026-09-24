export default async function (page, out) {
  const r = await page.evaluate(() => {
    const el = document.getElementById('transition');
    el.classList.remove('hidden');
    const cs = getComputedStyle(el);
    const sheets = [...document.styleSheets].map((s) => { try { return s.cssRules.length; } catch (e) { return 'x'; } });
    return { pos: cs.position, z: cs.zIndex, inset: cs.top, sheets };
  });
  console.log(JSON.stringify(r));
}
