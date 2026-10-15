import { test, expect, type Page, type Locator } from "@playwright/test";
import sharp from "sharp";
import {
  defaultAppearance,
  draftSchema,
  type ContentNode,
  type Document,
} from "../../src/lib/model";

const assetId = "a72b0f89-aedd-4ad2-a5ac-92e6d6137b07";
const resourceId = "33333333-3333-4333-8333-333333333333";
const doc: Document = {
  id: "11111111-1111-4111-8111-111111111111",
  owner_id: assetId,
  title: "Imágenes libres",
  written_on: "2026-10-14",
  signature: "Una firma",
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Texto que conserva su sitio." }],
      },
    ],
  },
  appearance: defaultAppearance,
  notebook_id: null,
  position: 0,
  revision: 1,
  created_at: "2026-10-14",
  updated_at: "2026-10-14",
};
const fixture = "http://127.0.0.1:3101/?fixture=studio";
async function setup(page: Page, content = doc.content) {
  let saved = { ...doc, content };
  const photo = await sharp({
    create: { width: 300, height: 180, channels: 3, background: "#2090cc" },
  })
    .png()
    .toBuffer();
  await page.route("**/api/media/**", (route) =>
    route.fulfill({ contentType: "image/png", body: photo }),
  );
  await page.route(`**/api/resource/${resourceId}`, (route) =>
    route.fulfill({ contentType: "image/png", body: photo }),
  );
  await page.route("**/api/upload", (route) =>
    route.fulfill({ json: { id: assetId, url: `/api/media/${assetId}` } }),
  );
  await page.route("**/api/studio", (route) =>
    route.fulfill({
      json: {
        documents: [saved],
        notebooks: [],
        publications: [],
        links: [],
        resources: [
          {
            id: resourceId,
            kind: "image",
            name: "Imagen compartida",
            author: "Autor",
            source: "Propio",
            license: "CC0",
            description: "",
            tags: [],
            builtin_key: null,
            hidden: false,
          },
        ],
      },
    }),
  );
  await page.route("**/api/documents", (route) => {
    const body = route.request().postDataJSON();
    expect(draftSchema.safeParse(body.draft).success).toBe(true);
    expect(body.revision).toBe(saved.revision);
    saved = { ...saved, ...body.draft, revision: saved.revision + 1 };
    return route.fulfill({ json: saved });
  });
  return { saved: () => saved, photo };
}
async function open(page: Page) {
  await page.goto(fixture);
  await page
    .getByRole("button", { name: "Seguir escribiendo", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Cuerpo del texto" }),
  ).toBeVisible();
}
function images(content: ContentNode): ContentNode[] {
  return content.type === "image"
    ? [content]
    : (content.content?.flatMap(images) ?? []);
}
async function drag(page: Page, target: Locator, dx: number, dy: number) {
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + dx,
    box.y + box.height / 2 + dy,
    { steps: 8 },
  );
  await page.mouse.up();
}

for (const source of ["upload", "community"] as const) {
  test(`${source} image can be inserted and saved without a description`, async ({
    page,
  }) => {
    const api = await setup(page);
    await open(page);
    await page
      .getByRole("button", { name: "Añadir imagen", exact: true })
      .click();
    if (source === "community")
      await page
        .getByLabel("O una imagen de la comunidad")
        .selectOption(resourceId);
    else
      await page.getByLabel("Imagen personal", { exact: true }).setInputFiles({
        name: "foto.png",
        mimeType: "image/png",
        buffer: api.photo,
      });
    await page
      .getByRole("button", { name: "Insertar imagen", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Una imagen para tu texto" }),
    ).toHaveCount(0);
    await expect(page.locator(".editable-image")).toBeVisible();
    await expect
      .poll(() => images(api.saved().content)[0]?.attrs?.alt)
      .toBe("");
    expect(draftSchema.safeParse(api.saved()).success).toBe(true);
  });
  test(`${source} image moves, scales, rotates, undoes and persists into preview`, async ({
    page,
  }) => {
    const api = await setup(page);
    await open(page);
    await page
      .getByRole("button", { name: "Añadir imagen", exact: true })
      .click();
    if (source === "community")
      await page
        .getByLabel("O una imagen de la comunidad")
        .selectOption(resourceId);
    else
      await page.getByLabel("Imagen personal", { exact: true }).setInputFiles({
        name: "foto.png",
        mimeType: "image/png",
        buffer: api.photo,
      });
    await page
      .getByLabel("Descripción de la imagen", { exact: true })
      .fill("Recuerdo");
    await page
      .getByRole("button", { name: "Insertar imagen", exact: true })
      .click();
    const image = page.locator(".editable-image");
    await expect(image).toHaveClass(/floating-image/);
    const mover = page.getByRole("button", {
      name: "Mover imagen: Recuerdo",
      exact: true,
    });
    await expect
      .poll(() => images(api.saved().content)[0]?.attrs?.layout)
      .toMatchObject({ ratio: 300 / 180 });
    const original = images(api.saved().content)[0].attrs!.layout as {
      x: number;
      y: number;
      width: number;
      rotation: number;
      ratio: number;
    };
    const paragraph = page
      .locator(".tiptap p")
      .filter({ hasText: "Texto que conserva su sitio." });
    const textPosition = () =>
      paragraph.evaluate(
        (el) =>
          el.getBoundingClientRect().top -
          el.closest(".editor-page")!.getBoundingClientRect().top,
      );
    const textTop = await textPosition();
    await drag(page, mover, 22, 45);
    expect(await textPosition()).toBeCloseTo(textTop, 0);
    await expect
      .poll(
        () =>
          (images(api.saved().content)[0]?.attrs?.layout as typeof original)?.y,
      )
      .toBeGreaterThan(original.y);
    const moved = images(api.saved().content)[0].attrs!
      .layout as typeof original;
    await drag(
      page,
      page.getByRole("button", {
        name: "Cambiar tamaño de imagen",
        exact: true,
      }),
      18,
      12,
    );
    await expect
      .poll(
        () =>
          (images(api.saved().content)[0]?.attrs?.layout as typeof original)
            ?.width,
      )
      .toBeGreaterThan(moved.width);
    const scaled = images(api.saved().content)[0].attrs!
      .layout as typeof original;
    await drag(
      page,
      page.getByRole("button", { name: "Girar imagen", exact: true }),
      35,
      15,
    );
    await expect
      .poll(() =>
        Math.abs(
          (images(api.saved().content)[0]?.attrs?.layout as typeof original)
            ?.rotation,
        ),
      )
      .toBeGreaterThan(5);
    await page.getByRole("button", { name: "Deshacer", exact: true }).click();
    await expect
      .poll(() => images(api.saved().content)[0]?.attrs?.layout)
      .toEqual(scaled);
    await page.getByRole("button", { name: "Rehacer", exact: true }).click();
    await expect
      .poll(() =>
        Math.abs(
          (images(api.saved().content)[0]?.attrs?.layout as typeof original)
            ?.rotation,
        ),
      )
      .toBeGreaterThan(5);
    const final = images(api.saved().content)[0].attrs!.layout;
    await page.reload();
    await page
      .getByRole("button", { name: "Seguir escribiendo", exact: true })
      .click();
    await expect(page.locator(".editable-image")).toHaveAttribute(
      "style",
      /rotate\(/,
    );
    await page
      .getByRole("button", { name: "Vista previa", exact: true })
      .click();
    const preview = page.locator(".screen-only .letter-floating-image");
    await expect(preview).toBeVisible();
    expect(
      await preview.evaluate((el) =>
        parseFloat((el as HTMLElement).style.transform.slice(7)),
      ),
    ).toBeCloseTo((final as typeof original).rotation, 3);
    await expect(
      page.locator(".print-only .letter-floating-image"),
    ).toHaveAttribute("style", /rotate\(/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/image-${source}-${test.info().project.name}.png`,
      fullPage: true,
    });
  });
}

test("legacy images keep their flow until moved and support keyboard controls", async ({
  page,
}) => {
  const api = await setup(page, {
    type: "doc",
    content: [
      ...doc.content.content!,
      { type: "image", attrs: { assetId, alt: "Anterior" } },
    ],
  });
  await open(page);
  await expect(page.locator(".editable-image")).toHaveClass(/inline-image/);
  const mover = page.getByRole("button", {
    name: "Mover imagen: Anterior",
    exact: true,
  });
  await drag(page, mover, 10, 35);
  await expect(page.locator(".editable-image")).toHaveClass(/floating-image/);
  await expect
    .poll(() => images(api.saved().content)[0]?.attrs?.layout)
    .not.toBeNull();
  await page.getByRole("button", { name: "Girar imagen", exact: true }).focus();
  await page.keyboard.press("Shift+ArrowRight");
  await expect
    .poll(
      () =>
        (images(api.saved().content)[0]?.attrs?.layout as { rotation: number })
          ?.rotation,
    )
    .toBe(5);
  await page
    .getByRole("button", { name: "Eliminar imagen", exact: true })
    .click();
  await expect.poll(() => images(api.saved().content)).toHaveLength(0);
});

test("touch gestures move images without moving the text", async ({
  page,
  context,
  isMobile,
}) => {
  test.skip(!isMobile, "Touch screen interaction");
  const layout = { x: 10, y: 45, width: 35, rotation: 0, ratio: 300 / 180 };
  const api = await setup(page, {
    type: "doc",
    content: [
      ...doc.content.content!,
      { type: "image", attrs: { assetId, alt: "Táctil", layout } },
    ],
  });
  await open(page);
  const mover = page.getByRole("button", {
    name: "Mover imagen: Táctil",
    exact: true,
  });
  await mover.scrollIntoViewIfNeeded();
  const box = (await mover.boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  const session = await context.newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let step = 1; step <= 6; step++)
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + step * 3, y: y + step * 5 }],
    });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(
      () => (images(api.saved().content)[0]?.attrs?.layout as typeof layout)?.y,
    )
    .toBeGreaterThan(layout.y);
  await expect(
    page.getByRole("button", { name: "Girar imagen", exact: true }),
  ).toBeVisible();
});

test("floating rotated images remain visible in shared image exports", async ({
  page,
}) => {
  const layout = { x: 10, y: 45, width: 35, rotation: 25, ratio: 300 / 180 };
  await setup(page);
  const publication = {
    ...doc,
    content: {
      type: "doc",
      content: [
        ...doc.content.content!,
        { type: "image", attrs: { assetId, alt: "Recuerdo", layout } },
      ],
    },
  };
  await page.route("**/api/share-images", (route) =>
    route.fulfill({
      json: {
        title: doc.title,
        text: "Contenido",
        document: publication,
      },
    }),
  );
  await page.goto("http://127.0.0.1:3101/?fixture=social");
  await page.getByRole("button", { name: "Preparar imágenes" }).click();
  const preview = page.getByRole("img", {
    name: `Imagen 1 de ${doc.title}`,
    exact: true,
  });
  await expect(preview).toBeVisible({ timeout: 30000 });
  const png = Buffer.from(
    (await preview.getAttribute("src"))!.split(",")[1],
    "base64",
  );
  expect(await sharp(png).metadata()).toMatchObject({
    width: 2160,
    height: 2700,
  });
  await sharp(png).toFile(
    `test-results/floating-export-${test.info().project.name}.png`,
  );
  // The center remains blue; rotation and free placement must survive SVG capture.
  const sample = await sharp(png)
    .extract({ left: 500, top: 1010, width: 10, height: 10 })
    .png()
    .toBuffer();
  const color = await sharp(sample).removeAlpha().stats();
  expect(color.channels[0].mean).toBeCloseTo(32, -1);
  expect(color.channels[1].mean).toBeCloseTo(144, -1);
  expect(color.channels[2].mean).toBeCloseTo(204, -1);
});
