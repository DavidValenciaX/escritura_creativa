import { describe, it, expect } from "vitest";
import {
  appearanceSchema,
  defaultAppearance,
  draftSchema,
  imageIds,
  referencesResource,
  validateContent,
} from "../../src/lib/model";
const id = "a72b0f89-aedd-4ad2-a5ac-92e6d6137b07";
describe("untrusted editor content", () => {
  it("validates saved image geometry while accepting legacy images", () => {
    const content = (layout: unknown) => ({
      type: "doc",
      content: [{ type: "image", attrs: { assetId: id, layout } }],
    });
    const layout = { x: 12, y: 35, width: 40, rotation: -25, ratio: 1.5 };
    expect(validateContent(content(layout))).toBe(true);
    expect(validateContent(content(null))).toBe(true);
    for (const bad of [
      { width: 0 },
      { x: -1 },
      { rotation: 900 },
      { ratio: 0 },
      { y: "20px" },
      { x: Infinity },
    ])
      expect(validateContent(content({ ...layout, ...bad }))).toBe(false);
  });
  it("accepts formatted Spanish text and owned image references", () =>
    expect(
      validateContent({
        type: "doc",
        content: [
          {
            type: "paragraph",
            attrs: { textAlign: "center" },
            content: [
              {
                type: "text",
                text: "¡Querida vida! Ñ, á, é.",
                marks: [{ type: "bold" }],
              },
            ],
          },
          { type: "image", attrs: { assetId: id, alt: "Un recuerdo" } },
        ],
      }),
    ).toBe(true));
  it("rejects executable links, arbitrary HTML and unreferenced remote images", () => {
    expect(
      validateContent({
        type: "doc",
        content: [
          {
            type: "text",
            text: "x",
            marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
          },
        ],
      }),
    ).toBe(false);
    expect(
      validateContent({ type: "doc", content: [{ type: "iframe" }] }),
    ).toBe(false);
    expect(
      validateContent({
        type: "doc",
        content: [
          { type: "image", attrs: { src: "https://other.test/personal.jpg" } },
        ],
      }),
    ).toBe(false);
  });
  it("bounds nesting and document size", () => {
    let tree: unknown = { type: "paragraph" };
    for (let i = 0; i < 25; i++) tree = { type: "blockquote", content: [tree] };
    expect(validateContent({ type: "doc", content: [tree] })).toBe(false);
    expect(
      validateContent({
        type: "doc",
        content: [{ type: "text", text: "a".repeat(500001) }],
      }),
    ).toBe(false);
  });
  it("rejects invalid appearance, ink and dates", () => {
    expect(
      appearanceSchema.safeParse({
        ...defaultAppearance,
        ink: "red; background:url(x)",
      }).success,
    ).toBe(false);
    expect(
      appearanceSchema.safeParse({ ...defaultAppearance, paper: "../private" })
        .success,
    ).toBe(false);
    expect(
      draftSchema.safeParse({
        title: "A",
        written_on: "2026-02-30",
        content: { type: "doc" },
        appearance: defaultAppearance,
        signature: "",
        notebook_id: null,
        position: 0,
      }).success,
    ).toBe(false);
  });
  it("tracks image references without trusting src", () => {
    const content = {
      type: "doc",
      content: [
        { type: "image", attrs: { assetId: id, src: "https://evil.test/x" } },
        {
          type: "paragraph",
          content: [{ type: "image", attrs: { assetId: id } }],
        },
      ],
    };
    expect(imageIds(content, "assetId")).toEqual([id]);
    expect(
      referencesResource(
        { appearance: { ...defaultAppearance, paper: id }, content },
        id,
      ),
    ).toBe(true);
  });
});
