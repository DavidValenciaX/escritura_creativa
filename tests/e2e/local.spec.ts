import { editorOptions } from "./editor-helpers";
import { test, expect } from "@playwright/test";
import sharp from "sharp";
test("homepage opens the studio and library fits the viewport with real initial assets", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL("/studio");
  await expect(
    page.getByRole("heading", { name: "Conexión pendiente", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/home-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.goto("/resources");
  await expect(
    page.getByRole("heading", { name: "Biblioteca de recursos" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Marfil", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tipografías", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Lora", exact: true }),
  ).toBeVisible();
  for (const name of ["Caveat", "Kalam", "Patrick Hand"])
    await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(
      0,
    );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("local editor saves Spanish text and appearance across reloads", async ({
  page,
}) => {
  await page.goto("/studio/preview");
  await page
    .getByRole("textbox", { name: "Título del texto" })
    .fill("Una carta para mañana");
  const body = page.getByRole("textbox", { name: "Cuerpo del texto" });
  await body.fill("¡Hola, corazón! Estas palabras se quedan aquí.");
  await editorOptions(page, "Apariencia");
  await page.getByRole("button", { name: "Rosa suave", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Guardado en este navegador",
  );
  await expect(
    page.getByRole("textbox", { name: "Firma", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Letra de la firma")).toHaveCount(0);
  await expect(page.getByLabel("Tamaño de la firma")).toHaveCount(0);
  await page.getByLabel("Letra del título").selectOption("courier");
  for (const label of ["Letra del título", "Letra del cuerpo"])
    await expect(
      page
        .getByLabel(label)
        .locator(
          'option[value="caveat"], option[value="kalam"], option[value="patrick"]',
        ),
    ).toHaveCount(0);
  await page.getByLabel("Letra del cuerpo").selectOption("garamond");
  await page.getByLabel("Tamaño del cuerpo").fill("26");
  await expect
    .poll(async () => {
      const stored = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("ec:preview") ?? "null"),
      );
      return (
        stored?.draft.appearance.bodyFont === "garamond" &&
        stored?.draft.appearance.fontSize === 26 &&
        stored?.pending === false
      );
    })
    .toBe(true);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Título del texto" }),
  ).toHaveValue("Una carta para mañana");
  await expect(body).toContainText("¡Hola, corazón!");
  await editorOptions(page, "Apariencia");
  await expect(page.getByLabel("Letra del título")).toHaveValue("courier");
  await expect(page.getByLabel("Letra del cuerpo")).toHaveValue("garamond");
  await expect(page.getByLabel("Tamaño del cuerpo")).toHaveValue("26");
  await expect(
    page.getByRole("button", { name: "Rosa suave", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await editorOptions(page);
  await page.getByRole("button", { name: "Vista previa", exact: true }).click();
  await expect(page.locator(".screen-only .letter-title")).toHaveText(
    "Una carta para mañana",
  );
  await expect(page.locator(".screen-only .letter-content")).toHaveCSS(
    "font-family",
    /EB Garamond/,
  );
  await expect(page.locator(".screen-only .letter-content")).toHaveCSS(
    "font-size",
    "26px",
  );
  await expect(page.locator(".letter-signature")).toHaveCount(0);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".print-only .letter-title")).toBeVisible();
  await expect(page.locator(".print-only .letter-content")).toHaveCSS(
    "font-family",
    /EB Garamond/,
  );
  await expect(page.locator(".print-only .letter-content")).toHaveCSS(
    "font-size",
    "26px",
  );
  await expect(page.locator(".topbar")).toBeHidden();
});

test("keyboard editing and disconnected local persistence remain available", async ({
  page,
  context,
}) => {
  await page.goto("/studio/preview");
  await page
    .getByRole("textbox", { name: "Título del texto" })
    .fill("Sin conexión");
  await context.setOffline(true);
  const body = page.getByRole("textbox", { name: "Cuerpo del texto" });
  await body.focus();
  await page.keyboard.type("Una página local.");
  await expect(page.getByRole("status")).toContainText(
    "Guardado en este navegador",
  );
  await context.setOffline(false);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Cuerpo del texto" }),
  ).toContainText("Una página local.");
});
test("resource selection and accessible preview dialog work", async ({
  page,
}) => {
  await page.goto("/resources");
  await page
    .getByRole("button", { name: "Ver Papel antiguo", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Papel antiguo" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page
    .getByRole("button", { name: "Ver Papel antiguo", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Usar en un texto", exact: true })
    .click();
  await editorOptions(page, "Apariencia");
  await expect(
    page.getByRole("button", { name: "Papel antiguo", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
test("long letter with images prints across multiple A4 pages", async ({
  page,
}) => {
  const id = "a72b0f89-aedd-4ad2-a5ac-92e6d6137b07";
  const image = await sharp({
    create: { width: 500, height: 180, channels: 3, background: "#b4b99b" },
  })
    .webp()
    .toBuffer();
  await page.route(`**/api/media/${id}`, (route) =>
    route.fulfill({ contentType: "image/webp", body: image }),
  );
  const draft = {
    title: "Lo que quiero recordar",
    written_on: "2026-10-11",
    content: {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { assetId: id, alt: "Un recuerdo de nuestro jardín" },
        },
        ...Array.from({ length: 45 }, (_, i) => ({
          type: "paragraph",
          content: [
            {
              type: "text",
              text: `${i + 1}. Hay recuerdos que merecen una página: la luz de la tarde, una conversación tranquila y esas pequeñas cosas que queremos conservar. ¡Qué alegría volver a ellas!`,
            },
          ],
        })),
      ],
    },
    appearance: {
      paper: "lined",
      titleFont: "lora",
      bodyFont: "lora",
      fontSize: 18,
      lineHeight: 1.8,
      ink: "#34312d",
    },
    signature: "Hasta la próxima página,",
    notebook_id: null,
    position: 0,
  };
  await page.addInitScript(
    (value) =>
      localStorage.setItem(
        "ec:preview",
        JSON.stringify({ draft: value, revision: 1, pending: false }),
      ),
    draft,
  );
  await page.goto("/studio/preview");
  await editorOptions(page);
  await page.getByRole("button", { name: "Vista previa", exact: true }).click();
  await expect(
    page.locator(".screen-only .letter").getByRole("img"),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".print-only .letter-content p").last()).toHaveText(
    "Hasta la próxima página,",
  );
  const pdf = await page.pdf({
    path: `test-results/letter-${test.info().project.name}.pdf`,
    preferCSSPageSize: true,
    printBackground: true,
  });
  expect(
    (pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length,
  ).toBeGreaterThan(1);
  expect(
    await page
      .locator(".print-only .letter")
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
});
