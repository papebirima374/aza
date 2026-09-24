import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "fr-FR" })).newPage();
await p.goto("http://localhost:3100/boutique/couture");
await p.waitForTimeout(1000); const y = await p.locator("ul.grid li").nth(4).evaluate((e) => e.getBoundingClientRect().top + window.scrollY); await p.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);
await p.evaluate(() => window.scrollBy(0, -80));
await p.waitForTimeout(1200);
await p.screenshot({ path: "captures/54-couture-liste.png" });
await b.close();
