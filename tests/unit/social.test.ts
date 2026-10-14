import { describe, it, expect } from "vitest";
import { publicationText } from "../../src/lib/social";
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
});
