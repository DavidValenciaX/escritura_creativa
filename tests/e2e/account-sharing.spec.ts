import { test, expect } from "@playwright/test";
import sharp from "sharp";
const fixture = (name: string) => `http://127.0.0.1:3101/?fixture=${name}`;
test("password registration validates confirmation and Google uses the OAuth flow", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/auth", async (route) => {
    requests++;
    await route.fulfill({ json: { signedIn: true } });
  });
  await page.goto(fixture("login"));
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page.getByLabel("Nombre visible", { exact: true }).fill("Usuario");
  await page
    .getByLabel("Nombre de usuario", { exact: true })
    .fill("nuevo-usuario");
  await page
    .getByLabel("Correo electrónico", { exact: true })
    .fill("example@example.com");
  await page.getByLabel("Contraseña", { exact: true }).fill("Password123!");
  await page
    .getByLabel("Repetir contraseña", { exact: true })
    .fill("Different123!");
  await page.getByRole("button", { name: "Registrarse", exact: true }).click();
  await expect(page.getByText("Las contraseñas no coinciden.")).toBeVisible();
  expect(requests).toBe(0);
  await page
    .getByLabel("Repetir contraseña", { exact: true })
    .fill("Password123!");
  await page.getByRole("button", { name: "Registrarse", exact: true }).click();
  await expect(page.locator("body")).toHaveAttribute(
    "data-navigation",
    "/studio",
  );
  await page.getByRole("button", { name: "Continuar con Google" }).click();
  await expect(page.locator("body")).toHaveAttribute(
    "data-auth-action",
    "google",
  );
});
test("profile image preview and user URL update before saving", async ({
  page,
}) => {
  const image = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "#55aa88" },
  })
    .png()
    .toBuffer();
  await page.route("**/api/upload/avatar", (route) =>
    route.fulfill({
      json: {
        id: "22222222-2222-4222-8222-222222222222",
        originalBytes: 100000,
        optimizedBytes: 1000,
      },
    }),
  );
  await page.route("**/api/avatar/*", (route) =>
    route.fulfill({ contentType: "image/png", body: image }),
  );
  await page.goto(fixture("settings"));
  await page.getByLabel("Nombre de usuario público").fill("otro-nombre");
  await expect(
    page.getByText("https://example.com/writers/otro-nombre", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Subir mi propia imagen").setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: image,
  });
  const preview = page.getByRole("img", { name: "Vista previa de tu avatar" });
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute("src", /api\/avatar/);
  await expect
    .poll(() =>
      preview.evaluate((img) => (img as HTMLImageElement).naturalWidth),
    )
    .toBe(32);
});
test("social images have a download fallback and cancelled sharing is not an error", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {
        throw new DOMException("Cancelled", "AbortError");
      },
    });
    Object.defineProperty(navigator, "canShare", {
      value: () => true,
      configurable: true,
    });
  });
  const image = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#ffffff" },
  })
    .jpeg()
    .toBuffer();
  await page.route("**/api/share-images", (route) =>
    route.fulfill({
      json: {
        title: "Texto",
        text: "Contenido",
        images: [`data:image/jpeg;base64,${image.toString("base64")}`],
      },
    }),
  );
  await page.goto(fixture("social"));
  await page
    .getByRole("button", { name: "Preparar imágenes para Instagram" })
    .click();
  await expect(
    page.getByRole("link", { name: "Descargar imagen 1" }),
  ).toHaveAttribute("download", "escrito-1.jpg");
  await page
    .getByRole("button", { name: "Compartir imágenes con una aplicación" })
    .click();
  await expect(
    page.getByText("No se pudieron enviar las imágenes.", { exact: false }),
  ).toHaveCount(0);
});
test("shared paper fills the viewport without studio navigation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        document.body.dataset.sharedUrl = data.url;
      },
    });
  });
  await page.goto(fixture("focus"));
  const letter = page.locator(".letter");
  await expect(letter).toBeVisible();
  const bounds = await letter.boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds!.x).toBeCloseTo(0);
  expect(bounds!.width).toBeCloseTo(viewport.width);
  expect(bounds!.height).toBeGreaterThanOrEqual(viewport.height);
  await expect(page.getByRole("navigation")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Compartir enlace" }).click();
  await expect(page.locator("body")).toHaveAttribute(
    "data-shared-url",
    fixture("focus"),
  );
});
