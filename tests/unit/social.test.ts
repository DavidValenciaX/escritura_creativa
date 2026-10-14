import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  publicationText,
  wrapCardText,
  socialCards,
} from "../../src/lib/social";
describe("social image export", () => {
  it("preserves paragraphs, accents and long words without dropping text", () => {
    const text = publicationText({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "¡Qué día!" }] },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Segunda línea" }],
        },
      ],
    });
    expect(text).toBe("¡Qué día!\nSegunda línea\n");
    const original = "ñ".repeat(95);
    expect(wrapCardText(original).join("")).toBe(original);
    expect(
      wrapCardText(original).every((line) => Array.from(line).length <= 42),
    ).toBe(true);
  });
  it("creates paginated portrait JPEGs and safely renders markup as literal text", async () => {
    const images = await socialCards(
      '<script> & "Título"',
      Array.from({ length: 30 }, (_, i) => `Línea ${i} con ñ`).join("\n"),
    );
    expect(images).toHaveLength(2);
    for (const image of images) {
      const meta = await sharp(image).metadata();
      expect(meta.format).toBe("jpeg");
      expect(meta.width).toBe(1080);
      expect(meta.height).toBe(1350);
    }
  }, 30000);
  it("rejects oversized exports instead of silently cropping the writing", async () => {
    await expect(socialCards("Largo", "línea\n".repeat(241))).rejects.toThrow(
      "diez tarjetas",
    );
  });
  it("renders distinct Spanish glyphs rather than identical missing-font boxes", async () => {
    for (const [left, right] of [
      ["A", "B"],
      ["n", "ñ"],
      ["a", "á"],
      ["?", "¿"],
    ]) {
      const first = (await socialCards("Título", left))[0];
      const second = (await socialCards("Título", right))[0];
      expect(
        first.equals(second),
        `${left} and ${right} must have different glyphs`,
      ).toBe(false);
    }
    const image = (
      await socialCards(
        "Prueba de exportación",
        "¡Qué día tan especial!\n\nÁÉÍÓÚ · áéíóú · ñ Ñ · ¿cómo estás?\n\nEsta imagen debe mostrar letras legibles.\n\nDavid",
      )
    )[0];
    mkdirSync("test-results", { recursive: true });
    writeFileSync("test-results/social-spanish.jpg", image);
  }, 30000);
  it("fits long headings and wide letters inside the paper margins", async () => {
    const images = await socialCards(
      "W".repeat(200),
      "W".repeat(42) + "\n".repeat(23),
    );
    for (const image of images) {
      const borderImage = await sharp(image)
        .extract({ left: 1020, top: 0, width: 60, height: 1350 })
        .toBuffer();
      const border = await sharp(borderImage).stats();
      expect(border.channels.every((channel) => channel.min > 200)).toBe(true);
    }
  }, 30000);
});
