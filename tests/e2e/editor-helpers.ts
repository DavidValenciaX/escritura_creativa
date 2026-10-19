import { expect, type Page } from "@playwright/test";

export async function editorOptions(
  page: Page,
  section?: "Formato" | "Apariencia" | "Detalles",
) {
  const main = page.getByRole("dialog", {
    name: "Opciones del editor",
    exact: true,
  });
  if (!(await main.isVisible())) {
    const back = page.getByRole("button", { name: "Opciones", exact: true });
    if (await back.isVisible()) await back.click();
    else
      await page
        .getByRole("button", { name: "Opciones del editor", exact: true })
        .click();
  }
  await expect(main).toBeVisible();
  if (section)
    await main.getByRole("button", { name: section, exact: true }).click();
}
