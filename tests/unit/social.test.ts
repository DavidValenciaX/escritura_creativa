import { describe, it, expect } from "vitest";
import { publicationText } from "../../src/lib/social";
import { cardSlices } from "../../src/lib/social-layout";
describe("social image export", () => {
  it("preserves paragraphs and Spanish accents in the text copy", () => {
    expect(
      publicationText({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "¡Qué día!" }] },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Segunda línea" }],
          },
        ],
      }),
    ).toBe("¡Qué día!\nSegunda línea\n");
  });
  it("paginates without cutting text lines or photographs and preserves every pixel", () => {
    const bands = [
      { top: 990, bottom: 1030 },
      { top: 1700, bottom: 2200 },
      { top: 2300, bottom: 2340 },
    ];
    const pages = cardSlices(2900, 1025, bands);
    expect(pages.length).toBeGreaterThan(2);
    expect(pages.reduce((sum, page) => sum + page.height, 0)).toBe(2900);
    expect(pages.every((page) => page.height <= 1025)).toBe(true);
    for (const band of bands)
      expect(
        pages.some(
          (page) =>
            page.top <= band.top && page.top + page.height >= band.bottom,
        ),
      ).toBe(true);
    for (let i = 1; i < pages.length; i++)
      expect(pages[i].top).toBe(pages[i - 1].top + pages[i - 1].height);
  });
  it("rejects oversized exports and elements that cannot fit without cropping", () => {
    expect(() => cardSlices(12000, 1025, [])).toThrow("diez tarjetas");
    expect(() => cardSlices(2000, 1025, [{ top: 0, bottom: 1600 }])).toThrow(
      "demasiado alto",
    );
  });
  it("reserves margins on every continuation and at the bottom without losing text", () => {
    const bands = [
      { top: 930, bottom: 980 },
      { top: 1880, bottom: 1940 },
      { top: 2700, bottom: 2750 },
    ];
    const pages = cardSlices(3000, 1025, bands, 55);
    expect(pages.reduce((sum, p) => sum + p.height, 0)).toBe(3000);
    for (const [i, page] of pages.entries()) {
      expect(page.inset).toBe(i ? 55 : 0);
      expect(page.inset + page.height).toBeLessThanOrEqual(970);
      for (const band of bands)
        expect(
          !(
            band.top < page.top + page.height &&
            band.bottom > page.top + page.height
          ),
        ).toBe(true);
    }
  });
});
