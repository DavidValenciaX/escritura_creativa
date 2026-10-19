import { test, expect } from "@playwright/test";
import { editorOptions } from "./editor-helpers";

test("blank paper focuses the editor during the click so the first keystroke is kept", async ({
  page,
}) => {
  await page.goto("/studio/preview");
  const body = page.getByRole("textbox", { name: "Cuerpo del texto" });
  await expect(body).toBeEditable();
  await page
    .getByRole("button", { name: "Opciones del editor", exact: true })
    .focus();

  // Inspect focus in the same event turn, before any animation frame can run.
  const focusedDuringClick = await page
    .locator(".editor-page")
    .evaluate((paper) => {
      (paper as HTMLElement).click();
      return document.activeElement === paper.querySelector(".tiptap");
    });
  expect(focusedDuringClick).toBe(true);
  await page.keyboard.type("Una hoja para escribir.");
  await expect(body).toHaveText("Una hoja para escribir.");

  const title = page.getByRole("textbox", { name: "Título del texto" });
  await title.click();
  await expect(title).toBeFocused();
});

test("writing fills the app with one control and restores navigation on leaving", async ({
  page,
  isMobile,
}) => {
  await page.goto("/studio/preview");
  const editor = page.locator(".focus-editor");
  await expect(
    page.getByRole("textbox", { name: "Cuerpo del texto" }),
  ).toBeEditable();
  await expect(page.locator(".topbar")).toBeHidden();
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".mobile-navigation")).toBeHidden();
  await expect(editor.getByRole("button")).toHaveCount(1);
  const bounds = await editor.boundingBox();
  expect(bounds!.x).toBe(0);
  expect(bounds!.y).toBe(0);
  expect(bounds!.width).toBe(page.viewportSize()!.width);
  expect(bounds!.height).toBeGreaterThanOrEqual(page.viewportSize()!.height);
  await page.screenshot({
    path: `test-results/focus-editor-${test.info().project.name}.png`,
  });
  expect(
    (await editor.locator(".editor-layout .sheet-frame").boundingBox())!.height,
  ).toBeGreaterThanOrEqual(page.viewportSize()!.height - 1);
  await editor.click({ position: { x: 20, y: 350 } });
  await expect(
    page.getByRole("textbox", { name: "Cuerpo del texto" }),
  ).toBeFocused();
  await page.keyboard.type("Una hoja para escribir.");
  await expect(
    page.getByRole("textbox", { name: "Cuerpo del texto" }),
  ).toHaveText("Una hoja para escribir.");

  await editorOptions(page, "Apariencia");
  const appearance = page.getByRole("dialog", {
    name: "Apariencia",
    exact: true,
  });
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.keyboard.press("Shift+Tab");
  await expect(appearance.getByLabel("Tinta", { exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    appearance.getByRole("button", { name: "Cerrar", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Opciones del editor", exact: true }),
  ).toBeFocused();

  await page.setViewportSize({ width: 844, height: 390 });
  await editorOptions(page);
  const landscapePanel = page.getByRole("dialog", {
    name: "Opciones del editor",
    exact: true,
  });
  await expect(landscapePanel).toBeInViewport();
  if (isMobile) {
    const panelBounds = (await landscapePanel.boundingBox())!;
    expect(panelBounds.y + panelBounds.height).toBeCloseTo(390, 0);
  }
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.keyboard.press("Escape");

  await editorOptions(page, "Detalles");
  await expect(
    page.getByRole("dialog", { name: "Detalles", exact: true }),
  ).toContainText("Guardado en este navegador");
  await expect(
    page.getByRole("combobox", { name: "Cuaderno", exact: true }),
  ).toBeVisible();
  await editorOptions(page);
  await page.getByRole("button", { name: "Mi estudio", exact: true }).click();
  await expect(page).toHaveURL("/studio");
  await expect(page.locator(".topbar")).toBeVisible();
  await expect(editor).toHaveCount(0);
});

test("contextual tools preserve the selected fragment through format panels and resize", async ({
  page,
}) => {
  await page.goto("/studio/preview");
  const body = page.getByRole("textbox", { name: "Cuerpo del texto" });
  const toolbar = page.getByRole("toolbar", {
    name: "Formato de la selección",
  });
  await body.fill("Inicio palabra final");
  await body
    .locator("p")
    .first()
    .click({ position: { x: 1, y: 5 } });
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.anchorOffset))
    .toBe(0);
  await expect(
    page.getByRole("toolbar", { name: "Formato de la selección" }),
  ).toBeHidden();
  for (let i = 0; i < 6; i++) await page.keyboard.press("Shift+ArrowRight");
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe("Inicio");
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole("button", { name: "Negrita", exact: true }).click();
  await expect(body.locator("strong")).toHaveText("Inicio");
  await expect(
    toolbar.getByRole("button", { name: "Negrita", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  await toolbar
    .getByRole("button", { name: "Más formato", exact: true })
    .click();
  await expect(toolbar).toBeHidden();
  await page
    .getByRole("dialog", { name: "Formato", exact: true })
    .getByRole("button", { name: "Cursiva", exact: true })
    .click();
  await expect(body.locator("strong em, em strong")).toHaveText("Inicio");
  await expect(body).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await body.press("ControlOrMeta+A");
  await expect(toolbar).toBeVisible();
  await page.setViewportSize({ width: 390, height: 440 });
  await expect(toolbar).toBeInViewport();
  await expect
    .poll(async () => {
      const box = (await toolbar.boundingBox())!;
      return box.y + box.height;
    })
    .toBeLessThanOrEqual(440);
  await toolbar.getByRole("button", { name: "Subrayado", exact: true }).click();
  await expect
    .poll(async () => (await body.locator("u").allTextContents()).join(""))
    .toBe("Inicio palabra final");
  await body
    .locator("p")
    .first()
    .click({ position: { x: 1, y: 5 } });
  await expect(toolbar).toBeHidden();

  await editorOptions(page, "Formato");
  await page
    .getByRole("dialog", { name: "Formato", exact: true })
    .getByRole("button", { name: "Lista numerada", exact: true })
    .click();
  await expect(body.locator("ol li")).toHaveText("Inicio palabra final");
  await editorOptions(page);
  await page.getByRole("button", { name: "Vista previa", exact: true }).click();
  await expect(toolbar).toBeHidden();
  await expect(page.locator(".screen-only .letter-content ol li")).toHaveText(
    "Inicio palabra final",
  );
  await editorOptions(page);
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(body.locator("ol li")).toHaveText("Inicio palabra final");
});

test("format menu keeps the caret and restores focus after a cancelled link", async ({
  page,
}) => {
  await page.goto("/studio/preview");
  const body = page.getByRole("textbox", { name: "Cuerpo del texto" });
  await body.fill("Antes después");
  await body
    .locator("p")
    .first()
    .click({ position: { x: 1, y: 5 } });
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.anchorOffset))
    .toBe(0);
  await expect(
    page.getByRole("toolbar", { name: "Formato de la selección" }),
  ).toBeHidden();
  for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.anchorOffset))
    .toBe(6);
  await editorOptions(page, "Formato");
  await page
    .getByRole("dialog", { name: "Formato", exact: true })
    .getByRole("button", { name: "Añadir enlace", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Añadir enlace",
    exact: true,
  });
  await expect(
    dialog.getByRole("textbox", { name: "Dirección del enlace" }),
  ).toBeFocused();
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(body).toBeFocused();
  await page.keyboard.type("nuevo ");
  await expect(body).toHaveText("Antes nuevo después");
});
