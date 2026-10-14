import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { richLetter } from "../browser/rich-letter";
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
  await page.route("**/api/share-images", (route) =>
    route.fulfill({
      json: {
        title: "Texto",
        text: "Contenido",
        document: socialPublication,
      },
    }),
  );
  await page.goto(fixture("social"));
  await page.getByRole("button", { name: "Preparar imágenes" }).click();
  await expect(
    page.getByRole("link", { name: "Descargar imagen 1" }),
  ).toHaveAttribute("download", "escrito-1.png");
  await page
    .getByRole("button", { name: "Compartir imágenes con una aplicación" })
    .click();
  await expect(
    page.getByText("No se pudieron enviar las imágenes.", { exact: false }),
  ).toHaveCount(0);
});

const socialPublication = {
  document_id: "11111111-1111-4111-8111-111111111111",
  owner_id: "11111111-1111-4111-8111-111111111111",
  title: "Texto compartido",
  written_on: "2026-10-13",
  signature: "Autor",
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Contenido de lectura." }],
      },
    ],
  },
  appearance: {
    paper: "lined",
    titleFont: "dancing",
    bodyFont: "lora",
    fontSize: 18,
    lineHeight: 1.8,
    ink: "#34312d",
  },
  published_at: "2026-10-13",
  updated_at: "2026-10-13",
  is_public: false,
  notebook_id: null,
};
test("export uses the same paper, date, title font and signature as the reading view", async ({
  page,
}) => {
  await page.route("**/api/share-images", (route) =>
    route.fulfill({
      json: {
        title: socialPublication.title,
        text: "Contenido de lectura.\nAutor",
        document: socialPublication,
      },
    }),
  );
  await page.goto(fixture("social"));
  await page.getByRole("button", { name: "Preparar imágenes" }).click();
  const preview = page.getByRole("img", {
    name: "Imagen 1 de Texto compartido",
  });
  await expect(preview).toBeVisible({ timeout: 20000 });
  const data = Buffer.from(
    (await preview.getAttribute("src"))!.split(",")[1],
    "base64",
  );
  const metadata = await sharp(data).metadata();
  expect(metadata).toMatchObject({ format: "png", width: 2160, height: 2700 });
  await expect(
    page.getByRole("link", { name: "Ver imagen 1 a tamaño completo" }),
  ).toHaveAttribute("href", /^blob:/);
  await sharp(data).toFile(
    `test-results/design-export-${test.info().project.name}.png`,
  );
  await page.locator("#reference").evaluate((node) => {
    (node as HTMLElement).style.display = "block";
  });
  const reference = await page
    .locator("#reference .letter")
    .screenshot({ scale: "css" });
  const expected = await sharp(reference)
    .resize(2160, 2700)
    .removeAlpha()
    .raw()
    .toBuffer();
  const actual = await sharp(data).removeAlpha().raw().toBuffer();
  let difference = 0;
  for (let i = 0; i < actual.length; i++)
    difference += Math.abs(actual[i] - expected[i]);
  expect(difference / actual.length).toBeLessThan(5);
  await page.locator("#reference").evaluate((node) => {
    (node as HTMLElement).style.display = "none";
  });
  const actions = page.locator(".social-sharing-actions");
  const boxes = await actions.getByRole("button").evaluateAll((nodes) =>
    nodes.map((node) => {
      const b = node.getBoundingClientRect();
      return { x: b.x, right: b.right, y: b.y, bottom: b.bottom };
    }),
  );
  expect(
    boxes[1].x >= boxes[0].right
      ? boxes[1].x - boxes[0].right
      : boxes[1].y - boxes[0].bottom,
  ).toBeGreaterThanOrEqual(11);
});

test("an existing writing can be added, transferred and removed from notebooks", async ({
  page,
}) => {
  const a = "22222222-2222-4222-8222-222222222222";
  const b = "33333333-3333-4333-8333-333333333333";
  let doc = {
    ...socialPublication,
    id: socialPublication.document_id,
    notebook_id: null as string | null,
    revision: 1,
    position: 0,
    created_at: "2026-10-13",
  };
  await page.route("**/api/studio", (route) =>
    route.fulfill({
      json: {
        documents: [doc],
        notebooks: [
          { id: a, title: "Cartas" },
          { id: b, title: "Poemas" },
        ],
        resources: [],
        publications: [],
      },
    }),
  );
  await page.route("**/api/documents", (route) => {
    const body = route.request().postDataJSON();
    expect(body.action).toBe("move");
    expect(body.revision).toBe(doc.revision);
    doc = { ...doc, notebook_id: body.notebook_id, revision: doc.revision + 1 };
    return route.fulfill({ json: doc });
  });
  await page.goto(fixture("studio"));
  for (const value of [a, b, ""]) {
    await page
      .getByRole("button", { name: "Mover a cuaderno: Texto compartido" })
      .click();
    await page.getByLabel("Cuaderno de destino").selectOption(value);
    await page
      .getByRole("button", { name: "Mover escrito", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Mover a cuaderno" }),
    ).toHaveCount(0);
    expect(doc.notebook_id).toBe(value || null);
  }
  await page.getByLabel("Filtrar por cuaderno").selectOption("loose");
  await expect(
    page.getByRole("button", { name: "Mover a cuaderno: Texto compartido" }),
  ).toBeVisible();
});

test("export includes custom paper, a community font and a personal photograph", async ({
  page,
}) => {
  const paper = "22222222-2222-4222-8222-222222222222";
  const font = "33333333-3333-4333-8333-333333333333";
  const photo = "44444444-4444-4444-8444-444444444444";
  const background = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#eadbb8" },
  })
    .png()
    .toBuffer();
  const photograph = await sharp({
    create: { width: 250, height: 150, channels: 3, background: "#2090cc" },
  })
    .png()
    .toBuffer();
  await page.route(`**/api/resource/${paper}`, (route) =>
    route.fulfill({ contentType: "image/png", body: background }),
  );
  await page.route(`**/api/resource/${font}`, (route) =>
    route.fulfill({
      contentType: "font/woff2",
      body: readFileSync(
        "node_modules/@fontsource/caveat/files/caveat-latin-400-normal.woff2",
      ),
    }),
  );
  await page.route(`**/api/media/${photo}`, (route) =>
    route.fulfill({ contentType: "image/png", body: photograph }),
  );
  const publication = {
    ...socialPublication,
    appearance: { ...socialPublication.appearance, paper, titleFont: font },
    content: {
      type: "doc",
      content: [
        ...socialPublication.content.content,
        { type: "image", attrs: { assetId: photo, alt: "Foto personal" } },
      ],
    },
  };
  await page.route("**/api/share-images", (route) =>
    route.fulfill({
      json: {
        title: publication.title,
        text: "Contenido",
        document: publication,
      },
    }),
  );
  await page.goto(fixture("social"));
  await page.getByRole("button", { name: "Preparar imágenes" }).click();
  const preview = page.getByRole("img", {
    name: "Imagen 1 de Texto compartido",
  });
  await expect(preview).toBeVisible({ timeout: 20000 });
  const image = Buffer.from(
    (await preview.getAttribute("src"))!.split(",")[1],
    "base64",
  );
  const { data, info } = await sharp(image)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let blue = 0;
  for (let i = 0; i < data.length; i += info.channels)
    if (data[i] < 80 && data[i + 1] > 90 && data[i + 2] > 160) blue++;
  expect(blue).toBeGreaterThan(20000);
  const firstPixel = [data[0], data[1], data[2]];
  expect(firstPixel[0]).toBeGreaterThan(210);
  expect(firstPixel[2]).toBeLessThan(210);
  await sharp(image).toFile(
    `test-results/custom-export-${test.info().project.name}.png`,
  );
});
test("long exports paginate without dividing a photograph", async ({
  page,
}) => {
  const photo = "44444444-4444-4444-8444-444444444444";
  const image = await sharp({
    create: { width: 650, height: 650, channels: 3, background: "#2090cc" },
  })
    .png()
    .toBuffer();
  await page.route(`**/api/media/${photo}`, (route) =>
    route.fulfill({ contentType: "image/png", body: image }),
  );
  const publication = {
    ...socialPublication,
    content: {
      type: "doc",
      content: [
        ...Array.from({ length: 45 }, (_, i) => ({
          type: "paragraph",
          content: [
            { type: "text", text: `Párrafo ${i + 1}: áéíóú, ñ y signos ¿? ¡!` },
          ],
        })),
        {
          type: "image",
          attrs: { assetId: photo, alt: "Fotografía completa" },
        },
      ],
    },
  };
  await page.route("**/api/share-images", (route) =>
    route.fulfill({
      json: {
        title: publication.title,
        text: "Texto largo",
        document: publication,
      },
    }),
  );
  await page.goto(fixture("social"));
  await page.getByRole("button", { name: "Preparar imágenes" }).click();
  const cards = page.locator(".social-cards img");
  await expect(cards.first()).toBeVisible({ timeout: 20000 });
  expect(await cards.count()).toBeGreaterThan(1);
  let photos = 0;
  for (const src of await cards.evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLImageElement).src),
  )) {
    const buffer = Buffer.from(src.split(",")[1], "base64");
    const { data, info } = await sharp(buffer)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(2160);
    expect(info.height).toBe(2700);
    const marginTop = await sharp(buffer)
      .extract({ left: 0, top: 0, width: 2160, height: 120 })
      .raw()
      .toBuffer();
    const marginBottom = await sharp(buffer)
      .extract({ left: 0, top: 2580, width: 2160, height: 120 })
      .raw()
      .toBuffer();
    for (const pixels of [marginTop, marginBottom]) {
      let ink = 0;
      for (let i = 0; i < pixels.length; i += info.channels)
        if (pixels[i] < 120 && pixels[i + 1] < 120 && pixels[i + 2] < 120)
          ink++;
      expect(ink).toBe(0);
    }
    let blue = 0;
    for (let i = 0; i < data.length; i += info.channels)
      if (data[i] < 80 && data[i + 1] > 90 && data[i + 2] > 160) blue++;
    if (blue) {
      expect(blue).toBeGreaterThan(700000);
      photos++;
    }
  }
  expect(photos).toBe(1);
});

test("rich paragraphs, marked text and lists paginate without clipped or missing lines", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.route("**/api/share-images", (route) =>
    route.fulfill({
      json: {
        title: richLetter.title,
        text: "Texto completo",
        document: richLetter,
      },
    }),
  );
  await page.goto(fixture("pagination"));
  await page
    .getByRole("button", { name: "Preparar imágenes", exact: true })
    .click();
  const previews = page.locator(".social-cards img");
  await expect(previews.first()).toBeVisible({ timeout: 30000 });
  const images = await previews.evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLImageElement).src),
  );
  expect(images.length).toBeGreaterThan(2);
  const geometry = await page.evaluate(async () => {
    const host = document.getElementById("reference")!;
    host.style.display = "block";
    const original = host.querySelector<HTMLElement>(".letter")!;
    const html = original.innerHTML;
    const text = original.querySelector(".letter-content")!.textContent;
    const { paginateForTest: paginateLetter } = window as typeof window & {
      paginateForTest: (
        letter: HTMLElement,
        height: number,
        margin: number,
      ) => HTMLElement[];
    };
    const pages: HTMLElement[] = paginateLetter(original, 1025, 55);
    const fragments = pages.map((page, i) => {
      page.dataset.testPage = String(i);
      const bounds = page.getBoundingClientRect();
      const rows: { top: number; bottom: number }[] = [];
      const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(walker.currentNode);
        for (const rect of range.getClientRects())
          rows.push({
            top: rect.top - bounds.top,
            bottom: rect.bottom - bounds.top,
          });
      }
      const numbers = Array.from(
        page.querySelectorAll<HTMLLIElement>("ol > li"),
      )
        .filter((li) => getComputedStyle(li).listStyleType !== "none")
        .map((li) =>
          li.hasAttribute("value")
            ? li.value
            : (li.parentElement as HTMLOListElement).start +
              Array.from(li.parentElement!.children).indexOf(li),
        );
      return {
        text: page.querySelector(".letter-content")?.textContent ?? "",
        rows,
        numbers,
      };
    });
    return { text, fragments, sourceUnchanged: html === original.innerHTML };
  });
  expect(geometry.sourceUnchanged).toBe(true);
  expect(geometry.fragments.map((p) => p.text).join("")).toBe(geometry.text);
  expect(geometry.fragments.flatMap((p) => p.numbers)).toEqual([
    1, 2, 3, 4, 5, 6, 7, 8,
  ]);
  expect(images).toHaveLength(geometry.fragments.length);
  for (const [i, fragment] of geometry.fragments.entries()) {
    expect(
      fragment.rows.every((row) => row.top >= 53 && row.bottom <= 966),
    ).toBe(true);
    await page.locator("[data-test-page]").evaluateAll((nodes) =>
      nodes.forEach((node) => {
        (node as HTMLElement).style.display = "none";
      }),
    );
    const element = page.locator(`[data-test-page="${i}"]`);
    await element.evaluate((node) =>
      Object.assign((node as HTMLElement).style, {
        display: "block",
        position: "fixed",
        top: "0",
        left: "0",
      }),
    );
    const reference = await element.screenshot({
      scale: "css",
      path: `test-results/rich-reference-${test.info().project.name}-${i + 1}.png`,
    });
    const buffer = Buffer.from(images[i].split(",")[1], "base64");
    await sharp(buffer).toFile(
      `test-results/rich-page-${test.info().project.name}-${i + 1}.png`,
    );
    const expected = await sharp(reference).removeAlpha().raw().toBuffer();
    const actual = await sharp(buffer)
      .resize(820, 1025)
      .removeAlpha()
      .raw()
      .toBuffer();
    // Compare complete painted lines, allowing font antialiasing differences
    // between a native screenshot and a downsampled high-resolution SVG.
    const paintedLines = (pixels: Buffer) => {
      const lines: { top: number; bottom: number }[] = [];
      for (let y = 0; y < 1025; y++) {
        let ink = 0;
        for (let x = 40; x < 780; x++) {
          const offset = (y * 820 + x) * 3;
          if (
            pixels[offset] < 120 &&
            pixels[offset + 1] < 120 &&
            pixels[offset + 2] < 120
          )
            ink++;
        }
        if (ink <= 5) continue;
        const last = lines.at(-1);
        if (last && y - last.bottom <= 7) last.bottom = y;
        else lines.push({ top: y, bottom: y });
      }
      return lines;
    };
    const exportedLines = paintedLines(actual),
      referenceLines = paintedLines(expected);
    expect(exportedLines).toHaveLength(referenceLines.length);
    for (let line = 0; line < referenceLines.length; line++) {
      expect(
        Math.abs(exportedLines[line].top - referenceLines[line].top),
      ).toBeLessThanOrEqual(5);
      expect(
        Math.abs(exportedLines[line].bottom - referenceLines[line].bottom),
      ).toBeLessThanOrEqual(5);
    }
  }
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
for (const mode of ["notebook", "account-notebook"]) {
  test(`${mode} shows cards and opens only the chosen text in full screen`, async ({
    page,
    isMobile,
  }) => {
    await page.goto(fixture(mode));
    const cards = page.locator(".document-grid .document-card");
    await expect(cards).toHaveCount(2);
    await expect(
      page.getByRole("heading", { name: "Alejandra" }),
    ).toBeVisible();
    await expect(page.locator(".letter:visible")).toHaveCount(0);
    await expect(page.locator(".card-actions")).toHaveCount(0);
    await expect(cards.first().locator(".paper-lined")).toBeVisible();
    await expect(cards.last().locator(".paper-vintage")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.screenshot({
      path: `test-results/${mode}-cards-${test.info().project.name}.png`,
      fullPage: true,
    });

    const second = page.getByRole("button", {
      name: "Leer Otra página",
      exact: true,
    });
    if (isMobile) await second.tap();
    else await second.click();
    const reader = page.getByRole("dialog", {
      name: "Otra página",
      exact: true,
    });
    await expect(reader).toBeVisible();
    await expect(page.locator(".letter:visible")).toHaveCount(1);
    await expect(
      reader.getByRole("heading", { name: "Otra página", exact: true }),
    ).toBeVisible();
    await expect(
      reader.getByText("Un escrito largo para leer con calma.").first(),
    ).toBeVisible();
    const box = (await reader.boundingBox())!;
    expect(box.x).toBe(0);
    expect(box.y).toBe(0);
    expect(box.width).toBe(page.viewportSize()!.width);
    expect(box.height).toBe(page.viewportSize()!.height);
    await expect(
      reader.getByRole("button", { name: "Volver al cuaderno" }),
    ).toBeFocused();
    await reader.evaluate((element) => {
      element.scrollTop = 500;
    });
    await expect(
      reader.getByRole("button", { name: "Volver al cuaderno" }),
    ).toBeInViewport();
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".letter:visible")).toHaveCount(1);
    await expect(reader).toHaveCSS("overflow", "visible");
    await page.emulateMedia({ media: "screen" });
    await page.screenshot({
      path: `test-results/${mode}-reader-${test.info().project.name}.png`,
    });
    await reader.getByRole("button", { name: "Volver al cuaderno" }).click();
    await expect(reader).toHaveCount(0);
    await expect(second).toBeFocused();
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");

    const first = page.getByRole("button", {
      name: "Leer Texto compartido",
      exact: true,
    });
    await first.press("Enter");
    const firstReader = page.getByRole("dialog", {
      name: "Texto compartido",
      exact: true,
    });
    await expect(firstReader).toBeVisible();
    await expect(firstReader.locator(".letter")).toHaveCount(1);
    await firstReader
      .getByRole("button", { name: "Reportar", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Reportar contenido" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Reportar contenido" }),
    ).toHaveCount(0);
    await expect(firstReader).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(firstReader).toHaveCount(0);
    await expect(first).toBeFocused();
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".letter:visible")).toHaveCount(2);
  });
}

test("a shared notebook closes its open text when access is revoked", async ({
  page,
}) => {
  await page.route("**/api/link/test-token", (route) =>
    route.fulfill({ status: 404, json: { error: "Revocado" } }),
  );
  await page.goto(fixture("notebook"));
  await page
    .getByRole("button", { name: "Leer Otra página", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Otra página", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Este contenido ya no está disponible" }),
  ).toBeVisible();
  await expect(page.locator(".document-card")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
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
  await expect(
    page.getByRole("heading", { name: "Imagen", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preparar imágenes", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Personas concretas", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Crear enlace", exact: true }).click();
  await expect(page.getByText(url, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "Abrir compartir" }).click();
  await expect(page.getByText(url, { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Copiar enlace", exact: true })
    .click();
  await expect(page.locator("body")).toHaveAttribute("data-copied-url", url);
  await page.locator(".modal").screenshot({
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
