import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const { chromium } = pw;
const nom = process.argv[2];
const dos = new URL("./", import.meta.url).pathname;
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(`file://${dos}${nom}.html`, { waitUntil: "networkidle" });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(800);
await p.pdf({ path: `${dos}${nom}.pdf`, format: "A4", printBackground: true, preferCSSPageSize: true });
// aperçu des pages
await p.setViewportSize({ width: 794, height: 1123 });
const n = await p.evaluate(() => document.querySelectorAll(".page").length);
for (const i of [0, 1, 2, 5, 6]) {
  if (i >= n) continue;
  await p.evaluate((i) => document.querySelectorAll(".page")[i].scrollIntoView(), i);
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${dos}apercu-${nom}-${i}.png` });
}
await b.close();
console.log(nom, n, "pages");
