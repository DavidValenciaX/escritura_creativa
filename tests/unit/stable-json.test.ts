import { describe, expect, it } from "vitest";
import { stableJson } from "../../src/lib/stable-json";
describe("draft comparison across JSONB round trips", () => {
  it("ignores object key order at every depth", () => {
    expect(
      stableJson({
        title: "Carta",
        appearance: { ink: "#34312d", paper: "cream" },
      }),
    ).toBe(
      stableJson({
        appearance: { paper: "cream", ink: "#34312d" },
        title: "Carta",
      }),
    );
  });
  it("detects edits and retains the order of paragraphs and marks", () => {
    expect(stableJson({ content: ["Primero", "Segundo"] })).not.toBe(
      stableJson({ content: ["Segundo", "Primero"] }),
    );
    expect(stableJson({ title: "Carta" })).not.toBe(
      stableJson({ title: "Otra carta" }),
    );
  });
});
