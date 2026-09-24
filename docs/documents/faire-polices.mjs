// Fabrique polices.css : les polices du site (Cormorant Garamond, Manrope) prises dans le
// build local (.next/static/media), pour que les PDF aient les mêmes polices que le site.
// À relancer après chaque « npm run build » (les noms de fichiers changent).
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const racine = new URL("../../", import.meta.url).pathname;
const dossier = `${racine}.next/static/chunks/`;
const css = readdirSync(dossier).filter((f) => f.endsWith(".css")).map((f) => readFileSync(dossier + f, "utf8")).join("\n");
const faces = (css.match(/@font-face\{[^}]*\}/g) ?? []).map((f) => f.replace(/url\(\.\.\/media\//g, `url(file://${racine}.next/static/media/`));
writeFileSync(new URL("./polices.css", import.meta.url), faces.join("\n"));
console.log(`polices.css : ${faces.length} polices`);
