import { describe, it, expect } from "vitest";
import sharp from "sharp";
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
});
