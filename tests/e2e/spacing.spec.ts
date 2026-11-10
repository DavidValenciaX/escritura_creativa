import { test, expect } from "@playwright/test";
import { editorOptions } from "./editor-helpers";

test("poem spacing updates immediately and persists in preview and print", async ({
  page,
}) => {
  await page.goto("/studio/preview");
  const body = page.getByRole("textbox", { name: "Cuerpo del texto" });
  await body.fill("Primer verso");
  await body.press("Shift+Enter");
  await body.pressSequentially("Segundo verso");
  await body.press("Enter");
  await body.pressSequentially("Otra estrofa");
  await expect(body.locator("p")).toHaveCount(2);
  await expect(body.locator("p").first().locator("br")).toHaveCount(1);
  await expect(body.locator("p").first()).toHaveCSS("margin-top", "0px");
  await expect(body.locator("p").first()).toHaveCSS("margin-bottom", "18px");

  await editorOptions(page, "Apariencia");
  const group = page.getByRole("group", { name: "Espaciado", exact: true });
  const leading = group.getByRole("combobox", {
    name: "Interlineado",
    exact: true,
  });
  const before = group.getByRole("combobox", {
    name: "Antes del párrafo",
    exact: true,
  });
  const after = group.getByRole("combobox", {
    name: "Después del párrafo",
    exact: true,
  });
  await expect(before).toHaveValue("0");
  await expect(after).toHaveValue("1");
  await expect(group).toContainText(
    "Enter crea un párrafo. Shift + Enter cambia de línea dentro del mismo párrafo.",
  );
  await leading.focus();
  await page.keyboard.press("Tab");
  await expect(before).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(after).toBeFocused();
  await leading.selectOption("1.5");
  await before.selectOption("0.5");
  await after.selectOption("1.5");
  const paragraph = body.locator("p").first();
  await expect(paragraph).toHaveCSS("line-height", "27px");
  await expect(paragraph).toHaveCSS("margin-top", "9px");
  await expect(paragraph).toHaveCSS("margin-bottom", "27px");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await group.screenshot({
    path: `test-results/spacing-controls-${test.info().project.name}.png`,
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem("ec:preview") ?? "null");
        return saved?.pending === false ? saved.draft.appearance : null;
      }),
    )
    .toMatchObject({
      lineHeight: 1.5,
      paragraphSpacingBefore: 0.5,
      paragraphSpacingAfter: 1.5,
    });

  await page.reload();
  await expect(body.locator("p")).toHaveCount(2);
  await expect(paragraph).toHaveText("Primer versoSegundo verso");
  await expect(paragraph).toHaveCSS("margin-top", "9px");
  await editorOptions(page, "Apariencia");
  await expect(leading).toHaveValue("1.5");
  await expect(before).toHaveValue("0.5");
  await expect(after).toHaveValue("1.5");
  await editorOptions(page);
  await page.getByRole("button", { name: "Vista previa", exact: true }).click();
  const preview = page.locator(".screen-only .letter-content p").first();
  await expect(preview).toHaveCSS("line-height", "27px");
  await expect(preview).toHaveCSS("margin-top", "9px");
  await expect(preview).toHaveCSS("margin-bottom", "27px");
  await expect(preview.locator("br")).toHaveCount(1);
  await page.emulateMedia({ media: "print" });
  const printed = page.locator(".print-only .letter-content p").first();
  await expect(printed).toBeVisible();
  await expect(printed).toHaveCSS("line-height", "27px");
  await expect(printed).toHaveCSS("margin-top", "9px");
  await expect(printed).toHaveCSS("margin-bottom", "27px");
});
