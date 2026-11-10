import { describe, expect, it } from "vitest";
import { paperStyle } from "../../src/components/letter";
import { defaultAppearance, type Appearance } from "../../src/lib/model";

describe("shared paragraph spacing styles", () => {
  it("renders saved spacing in em and preserves zero", () => {
    expect(
      paperStyle({
        ...defaultAppearance,
        paragraphSpacingBefore: 0.5,
        paragraphSpacingAfter: 0,
      }),
    ).toMatchObject({
      "--paragraph-spacing-before": "0.5em",
      "--paragraph-spacing-after": "0em",
    });
  });

  it("renders legacy publications with their original margins", () => {
    const { paragraphSpacingBefore, paragraphSpacingAfter, ...legacy } =
      defaultAppearance;
    expect(paperStyle(legacy as Appearance)).toMatchObject({
      "--paragraph-spacing-before": "0em",
      "--paragraph-spacing-after": "1em",
    });
  });
});
