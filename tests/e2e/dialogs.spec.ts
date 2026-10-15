import { test, expect } from "@playwright/test";

test("link dialog validates input, preserves selection, cancels and removes links", async ({
  page,
}) => {
  page.on("dialog", async (dialog) => {
    await dialog.dismiss();
    throw new Error("Unexpected native browser dialog");
  });
  await page.goto("http://127.0.0.1:3101/?fixture=composition");
  const body = page.getByRole("textbox", { name: "Cuerpo del texto" });
  await body.fill("Biblioteca");
  await body.press("ControlOrMeta+A");
  const addLink = page.getByRole("button", { name: "Añadir enlace" });
  await addLink.click();
  const dialog = page.getByRole("dialog", { name: "Añadir enlace" });
  const input = dialog.getByRole("textbox", { name: "Dirección del enlace" });
  const save = dialog.getByRole("button", { name: "Guardar enlace" });
  await expect(input).toBeFocused();
  await input.fill("javascript:alert(1)");
  await save.click();
  await expect(dialog).toContainText(
    "El enlace debe comenzar con https:// o http://.",
  );
  await expect(body.locator("a")).toHaveCount(0);
  await input.fill("https://example.com/biblioteca");
  await page.screenshot({ path: test.info().outputPath("link-dialog.png") });
  await save.click();
  await expect(dialog).toHaveCount(0);
  await expect(body.locator("a")).toHaveText("Biblioteca");
  await expect(body.locator("a")).toHaveAttribute(
    "href",
    "https://example.com/biblioteca",
  );
  await addLink.click();
  await expect(input).toHaveValue("https://example.com/biblioteca");
  await input.fill("https://example.com/cancelado");
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(body.locator("a")).toHaveAttribute(
    "href",
    "https://example.com/biblioteca",
  );
  await addLink.click();
  await input.fill("");
  await save.click();
  await expect(dialog).toHaveCount(0);
  await expect(body.locator("a")).toHaveCount(0);
  await expect(body).toHaveText("Biblioteca");
});
