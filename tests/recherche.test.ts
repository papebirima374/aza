// Recherche des clientes, tolérante aux fautes et aux écritures courantes (noms FICTIFS).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ressemble } from "../lib/recherche.ts";

test("écritures d'un même prénom", () => {
  assert.ok(ressemble("Awa Ndiaye", "770000101", "aoua ndiay"));
  assert.ok(ressemble("Khady Fall", "", "kadi"));
  assert.ok(ressemble("Coumba Diallo", "", "koumba"));
  assert.ok(ressemble("Ndèye Fatou Sow", "", "ndeye fatu"));
});

test("début de mot et numéro de téléphone", () => {
  assert.ok(ressemble("Awa Ndiaye", "770000101", "aw"));
  assert.ok(ressemble("Awa Ndiaye", "77 000 01 01", "0101"));
});

test("pas de faux positif", () => {
  assert.ok(!ressemble("Awa Ndiaye", "770000101", "binta"));
  assert.ok(!ressemble("Awa Ndiaye", "770000101", "4545"));
});
