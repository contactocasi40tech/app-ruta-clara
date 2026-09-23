import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const home = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");
const auth = readFileSync(new URL("./AuthPage.tsx", import.meta.url), "utf8");

const claraAsset = "/manus-storage/clara-oficial-ruta-clara_9dc2a8ad.png";
const legacyStem = ["cla", "r"].join("");

describe("Clara brand anchor", () => {
  it("uses the official Clara portrait in login and the protected experience", () => {
    expect(home).toContain(claraAsset);
    expect(auth).toContain(claraAsset);
  });

  it("presents Clara as a guide and preserves the clinical boundary", () => {
    expect(home).toContain("Hola, soy Clara");
    expect(home).toContain("Te acompaño a ordenar lo que sientes y dar un siguiente paso");
    expect(auth).toContain("Tu guía en Ruta Clara");
    expect(auth).toContain("Esta app prepara. Un profesional evalúa.");
  });

  it("keeps the six educational and registration pillars visible", () => {
    for (const pillar of [
      "Planes de alimentación",
      "Actividad física",
      "Monitoreo constante con glucómetro",
      "Interpretación de resultados",
      "Prevención de complicaciones",
      "Apoyo emocional",
    ]) {
      expect(home).toContain(pillar);
    }
    expect(home).toContain("Herramienta informativa, no sustituye consejo profesional de salud");
  });

  it("does not reintroduce the previous shortened identity", () => {
    const visibleLegacyName = new RegExp(`\\b${legacyStem}\\b`, "i");
    expect(home).not.toMatch(visibleLegacyName);
    expect(auth).not.toMatch(visibleLegacyName);
    expect(home).not.toContain(`${legacyStem.toUpperCase()}_IMAGE`);
    expect(auth).not.toContain(`${legacyStem.toUpperCase()}_IMAGE`);
    expect(auth).not.toContain(`auth-mobile-${legacyStem}\"`);
    expect(auth).not.toContain(`auth-${legacyStem}-portrait`);
  });
});
