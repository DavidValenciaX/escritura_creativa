import { test, expect, type Locator } from "@playwright/test";
import sharp from "sharp";

async function composition(sheet: Locator) {
  return sheet.evaluate((element) => {
    const paper = element.getBoundingClientRect();
    const scale = paper.width / 820;
    const selectors = {
      date: ".letter-date",
      title: ".letter-title",
      body: ".tiptap p, .letter-content p",
      signature: ".letter-signature",
      image: ".floating-image",
      end: ".letter-end",
    };
    return Object.fromEntries(
      Object.entries(selectors).map(([name, selector]) => {
        const node = element.querySelector(selector)!;
        const bounds = node.getBoundingClientRect();
        return [
          name,
          {
            x: (bounds.left - paper.left) / scale,
            y: (bounds.top - paper.top) / scale,
            width: bounds.width / scale,
            height: bounds.height / scale,
            fontSize: parseFloat(getComputedStyle(node).fontSize),
          },
        ];
      }),
    );
  });
}

test("all presentations preserve the complete sheet composition", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const photo = await sharp({
    create: { width: 300, height: 200, channels: 3, background: "#2090cc" },
  })
    .png()
    .toBuffer();
  await page.route("**/api/media/**", (route) =>
    route.fulfill({ contentType: "image/png", body: photo }),
  );
  await page.goto("http://127.0.0.1:3101/?fixture=composition");
  await page.getByRole("textbox", { name: "Título del texto" }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  const preview = page.locator("#composition-preview .sheet-document");
  const reference = await composition(preview);
  await expect(preview.locator(".letter-title")).toHaveCSS(
    "font-family",
    /Dancing Script/,
  );
  await expect(preview.locator(".letter-signature")).toHaveCSS(
    "font-family",
    /Kalam/,
  );
  expect(reference.signature.fontSize).toBe(40);
  for (const width of [318, 240, 180, 96]) {
    await page.locator("#composition-thumbnail").evaluate((element, value) => {
      (element as HTMLElement).style.width = `${value + 2}px`;
    }, width);
    const sheet = page.locator("#composition-thumbnail .sheet-document");
    await expect
      .poll(() => sheet.evaluate((el) => el.getBoundingClientRect().width))
      .toBeCloseTo(width, 0);
    const small = await composition(sheet);
    expect
      .soft(small.body.height, `thumbnail at ${width}px: body.height`)
      .toBeCloseTo(reference.body.height, 0);
    expect
      .soft(small.signature.y, `thumbnail at ${width}px: signature.y`)
      .toBeCloseTo(reference.signature.y, 0);
  }
  await page.locator("#composition-thumbnail").evaluate((element) => {
    (element as HTMLElement).style.width = "320px";
  });
  await expect
    .poll(() =>
      page
        .locator("#composition-thumbnail .sheet-document")
        .evaluate((el) => el.getBoundingClientRect().width),
    )
    .toBeCloseTo(318, 0);
  for (const id of ["editor", "thumbnail", "shared"]) {
    const sheet = page.locator(`#composition-${id} .sheet-document`).first();
    await expect(sheet.locator(".letter-signature")).toHaveCSS(
      "font-family",
      /Kalam/,
    );
    const actual = await composition(sheet);
    for (const [name, dimensions] of Object.entries(reference)) {
      for (const [axis, value] of Object.entries(dimensions))
        expect
          .soft(
            actual[name][axis as keyof typeof dimensions],
            `${id}: ${name}.${axis}`,
          )
          .toBeCloseTo(value, 0);
    }
  }
  const thumbnail = page.locator("#composition-thumbnail .sheet-frame");
  const signature = page.locator("#composition-thumbnail .letter-signature");
  expect(
    (await signature.boundingBox())!.y +
      (await signature.boundingBox())!.height,
  ).toBeLessThanOrEqual(
    (await thumbnail.boundingBox())!.y +
      (await thumbnail.boundingBox())!.height +
      1,
  );
  await thumbnail.screenshot({
    path: `test-results/composition-thumbnail-${test.info().project.name}.png`,
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await expect
    .poll(() => preview.evaluate((el) => el.getBoundingClientRect().width))
    .toBeCloseTo(360, 0);
  const resized = await composition(preview);
  for (const [name, dimensions] of Object.entries(reference))
    for (const [axis, value] of Object.entries(dimensions))
      expect
        .soft(
          resized[name][axis as keyof typeof dimensions],
          `resize: ${name}.${axis}`,
        )
        .toBeCloseTo(value, 0);
  await page.locator("#composition-preview").screenshot({
    path: `test-results/composition-${test.info().project.name}.png`,
  });
  await page.emulateMedia({ media: "print" });
  const printed = page.locator("#composition-print .sheet-document");
  await expect(printed).toBeVisible();
  await expect(printed.locator(".letter-signature")).toHaveCSS(
    "font-family",
    /Kalam/,
  );
  const pdfComposition = await composition(printed);
  for (const [name, dimensions] of Object.entries(reference))
    for (const [axis, value] of Object.entries(dimensions))
      expect
        .soft(
          pdfComposition[name][axis as keyof typeof dimensions],
          `print: ${name}.${axis}`,
        )
        .toBeCloseTo(value, 0);
  const pdf = await page.pdf({
    path: `test-results/composition-${test.info().project.name}.pdf`,
    preferCSSPageSize: true,
    printBackground: true,
  });
  expect(
    (pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length,
  ).toBe(1);
  expect(errors).toEqual([]);
});
