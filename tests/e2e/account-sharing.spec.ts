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
  await page.getByRole("tab", { name: "Crear cuenta", exact: true }).click();
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
  isMobile,
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
  const share = page.getByRole("button", { name: "Compartir enlace" });
  if (!isMobile) await page.mouse.move(200, 200);
  await expect(share).not.toBeVisible();
  if (isMobile)
    await page
      .getByRole("button", { name: "Mostrar opciones de lectura" })
      .click();
  else await page.mouse.move(100, 8);
  await expect(share).toBeVisible();
  await share.click();
  await expect(page.locator("body")).toHaveAttribute(
    "data-shared-url",
    fixture("focus"),
  );
  await page.keyboard.press("Escape");
  await expect(share).not.toBeVisible();
  await page
    .getByRole("button", { name: "Mostrar opciones de lectura" })
    .press("Enter");
  await expect(share).toBeVisible();
  if (isMobile)
    await page
      .getByRole("button", { name: "Ocultar opciones de lectura" })
      .click();
  else {
    await page.keyboard.press("Escape");
    await page.mouse.move(100, 8);
    await page.mouse.move(200, 250);
  }
  await expect(share).not.toBeVisible();
  await page.locator(".letter").screenshot({
    path: `test-results/focus-hidden-${test.info().project.name}.png`,
  });
});
test("login methods are separate from registration and tabs work with the keyboard", async ({
  page,
}) => {
  await page.goto(fixture("login"));
  const login = page.getByRole("tab", { name: "Iniciar sesión" });
  const signup = page.getByRole("tab", { name: "Crear cuenta" });
  await expect(login).toHaveAttribute("aria-selected", "true");
  const group = page.getByRole("group", { name: "Método de inicio de sesión" });
  const buttons = group.getByRole("button");
  const boxes = await buttons.evaluateAll((nodes) =>
    nodes.map((node) => {
      const b = node.getBoundingClientRect();
      return { x: b.x, y: b.y, right: b.right, bottom: b.bottom };
    }),
  );
  for (let i = 1; i < boxes.length; i++) {
    if (Math.abs(boxes[i].y - boxes[i - 1].y) < 1)
      expect(boxes[i].x - boxes[i - 1].right).toBeGreaterThanOrEqual(9);
    else expect(boxes[i].y - boxes[i - 1].bottom).toBeGreaterThanOrEqual(9);
  }
  await expect(
    group.getByRole("button", { name: "Con contraseña" }),
  ).toHaveAttribute("aria-pressed", "true");
  await group.getByRole("button", { name: "Enlace por correo" }).click();
  await expect(
    page.getByLabel("Correo electrónico", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveCount(0);
  await login.press("ArrowRight");
  await expect(signup).toHaveAttribute("aria-selected", "true");
  await expect(signup).toBeFocused();
  await expect(
    page.getByRole("tabpanel", { name: "Crear cuenta" }),
  ).toBeVisible();
  await expect(group).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Olvidé mi contraseña" }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Repetir contraseña", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".login-panel").screenshot({
    path: `test-results/signup-spaced-${test.info().project.name}.png`,
  });
  await signup.press("ArrowLeft");
  await expect(login).toHaveAttribute("aria-selected", "true");
  await expect(group).toBeVisible();
  await page.locator(".login-panel").screenshot({
    path: `test-results/login-tabs-${test.info().project.name}.png`,
  });
});

test("saved sharing URLs can be copied after reopening and disappear after revocation", async ({
  page,
}) => {
  const id = "22222222-2222-4222-8222-222222222222";
  const documentId = "11111111-1111-4111-8111-111111111111";
  const url = `https://example.com/s/${"a".repeat(64)}`;
  let links: object[] = [];
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          document.body.dataset.copiedUrl = value;
        },
      },
    });
  });
  await page.route("**/api/studio", (route) =>
    route.fulfill({
      json: {
        grants: [],
        publications: [],
        links,
      },
    }),
  );
  await page.route("**/api/sharing", (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "link") {
      links = [
        {
          id,
          document_id: documentId,
          notebook_id: null,
          revoked_at: null,
          url,
        },
      ];
      return route.fulfill({ json: { id, url } });
    }
    expect(body.action).toBe("revokeLink");
    expect(body.id).toBe(id);
    links = [];
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto(fixture("sharing"));
  await page.getByRole("button", { name: "Abrir compartir" }).click();
  await page.getByRole("button", { name: "Crear enlace", exact: true }).click();
  await expect(page.getByText(url, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "Abrir compartir" }).click();
  await expect(page.getByText(url, { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Copiar enlace", exact: true })
    .click();
  await expect(page.locator("body")).toHaveAttribute("data-copied-url", url);
  await page
    .locator(".modal")
    .screenshot({
      path: `test-results/saved-links-${test.info().project.name}.png`,
    });
  await page
    .getByRole("button", { name: "Revocar enlace", exact: true })
    .click();
  await expect(page.getByText(url, { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "Abrir compartir" }).click();
  await expect(
    page.getByRole("button", { name: "Copiar enlace", exact: true }),
  ).toHaveCount(0);
});
