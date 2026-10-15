import { test, expect } from "@playwright/test";

const fixture = "http://127.0.0.1:3101/?fixture=resources";
const resourceId = "44444444-4444-4444-8444-444444444444";
const photo = {
  name: "foto.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7mQAAAAASUVORK5CYII=",
    "base64",
  ),
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/resource/**", (route) =>
    route.fulfill({ contentType: "image/png", body: photo.buffer }),
  );
  await page.goto(fixture);
});

test("CC0 can be published without optional metadata and removed immediately by its contributor", async ({
  page,
}) => {
  let uploaded = false;
  await page.route("**/api/upload", async (route) => {
    const body = route.request().postDataBuffer()!.toString();
    expect(body).toContain('name="license"\r\n\r\nCC0');
    uploaded = true;
    await route.fulfill({ json: { id: resourceId } });
  });
  await page.getByRole("button", { name: "Imágenes", exact: true }).click();
  await page.getByRole("button", { name: "Aportar un recurso" }).click();
  await page
    .getByLabel("Nombre", { exact: true })
    .fill("Foto de dominio público");
  await page.getByLabel("Archivo", { exact: true }).setInputFiles(photo);
  const author = page.getByLabel("Autoría", { exact: true });
  const source = page.getByLabel("Procedencia", { exact: true });
  await expect(author).not.toHaveAttribute("required");
  await expect(source).not.toHaveAttribute("required");
  await expect(
    page.getByLabel("Descripción", { exact: true }),
  ).not.toHaveAttribute("required");
  for (const license of ["CC-BY-4.0", "OFL-1.1", "Apache-2.0"]) {
    await page
      .getByRole("combobox", { name: /^Licencia/ })
      .selectOption(license);
    await expect(author).toHaveAttribute("required");
    await expect(source).toHaveAttribute("required");
  }
  await page.getByRole("combobox", { name: /^Licencia/ }).selectOption("CC0");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Publicar recurso" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(uploaded).toBe(true);
  await page
    .getByRole("button", { name: "Ver Foto de dominio público", exact: true })
    .click();
  const detail = page.getByRole("dialog");
  await expect(detail).not.toContainText("Autoría:");
  await expect(detail).not.toContainText("Procedencia:");
  let deleted = false;
  await page.route(`**/api/resource/${resourceId}`, async (route) => {
    expect(route.request().method()).toBe("DELETE");
    deleted = true;
    await route.fulfill({ json: { ok: true } });
  });
  page.once("dialog", (dialog) => dialog.accept());
  await detail.getByRole("button", { name: "Eliminar recurso" }).click();
  await expect(detail).toHaveCount(0);
  expect(deleted).toBe(true);
  await expect(
    page.getByRole("heading", { name: "Foto de dominio público" }),
  ).toHaveCount(0);
});

test("only own contributions offer deletion, cancellation preserves them and errors allow retry", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Imágenes", exact: true }).click();
  await page
    .getByRole("button", { name: "Ver Imagen ajena", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Eliminar recurso" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page
    .getByRole("button", { name: "Ver Mi imagen", exact: true })
    .click();
  const remove = page.getByRole("button", { name: "Eliminar recurso" });
  let attempts = 0;
  await page.route(
    "**/api/resource/33333333-3333-4333-8333-333333333330",
    (route) => {
      attempts++;
      return route.fulfill(
        attempts === 1
          ? { status: 500, json: { error: "No se pudo eliminar el recurso." } }
          : { json: { ok: true } },
      );
    },
  );
  page.once("dialog", (dialog) => dialog.dismiss());
  await remove.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(attempts).toBe(0);
  page.once("dialog", (dialog) => dialog.accept());
  await remove.click();
  await expect(page.getByRole("alert")).toContainText(
    "No se pudo eliminar el recurso.",
  );
  await expect(remove).toBeEnabled();
  page.once("dialog", (dialog) => dialog.accept());
  await remove.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Mi imagen", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Imagen ajena", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Papeles", exact: true }).click();
  await page
    .locator(".resource-card")
    .first()
    .getByRole("button")
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Eliminar recurso" }),
  ).toHaveCount(0);
});
