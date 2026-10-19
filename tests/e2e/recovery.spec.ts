import { editorOptions } from "./editor-helpers";
import { test, expect, type Page } from "@playwright/test";
import {
  defaultAppearance,
  type Document,
  type Draft,
} from "../../src/lib/model";

const initial: Document = {
  id: "11111111-1111-4111-8111-111111111111",
  owner_id: "22222222-2222-4222-8222-222222222222",
  title: "Carta guardada",
  written_on: "2026-10-14",
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Contenido guardado." }],
      },
    ],
  },
  appearance: defaultAppearance,
  signature: "Autor",
  notebook_id: null,
  position: 0,
  revision: 1,
  updated_at: "2026-10-14",
  created_at: "2026-10-14",
};
const key = `ec:draft:${initial.owner_id}:${initial.id}`;
const asDraft = ({
  title,
  written_on,
  content,
  appearance,
  signature,
  notebook_id,
  position,
}: Document): Draft => ({
  title,
  written_on,
  content,
  appearance,
  signature,
  notebook_id,
  position,
});
function reordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reordered);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([k, v]) => [k, reordered(v)]),
  );
}
async function setup(page: Page, doc = initial) {
  let saved = doc;
  let saves = 0;
  let fail = false;
  await page.route("**/api/studio", (route) =>
    route.fulfill({
      json: {
        documents: [reordered(saved)],
        notebooks: [],
        resources: [],
        publications: [],
      },
    }),
  );
  await page.route("**/api/documents", (route) => {
    const body = route.request().postDataJSON();
    expect(body.action).toBe("save");
    expect(body.revision).toBe(saved.revision);
    saves++;
    if (fail)
      return route.fulfill({
        status: 500,
        json: { error: "Error de conexión de prueba" },
      });
    saved = { ...saved, ...body.draft, revision: saved.revision + 1 };
    return route.fulfill({ json: reordered(saved) });
  });
  return {
    document: () => saved,
    saves: () => saves,
    fail: (value: boolean) => {
      fail = value;
    },
  };
}
async function open(page: Page) {
  await page.goto("http://127.0.0.1:3101/?fixture=studio");
  await page
    .getByRole("button", { name: "Seguir escribiendo", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Cuerpo del texto" }),
  ).toBeVisible();
}
async function stored(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? "null"),
    key,
  );
}
async function seed(page: Page, draft: Draft, revision = 1) {
  await page.addInitScript(
    ({ key, draft, revision }) => {
      if (sessionStorage.getItem("recovery-seeded")) return;
      sessionStorage.setItem("recovery-seeded", "yes");
      localStorage.setItem(
        key,
        JSON.stringify({ draft, revision, pending: true, tab: "closed-tab" }),
      );
    },
    { key, draft, revision },
  );
}
const banner = (page: Page) =>
  page.getByText("Hay un borrador local que no llegó a guardarse.", {
    exact: true,
  });

test("legacy signatures become editable body text and remain once after saving and reopening", async ({
  page,
}) => {
  const api = await setup(page);
  await seed(page, asDraft(initial));
  await open(page);
  await expect(banner(page)).toHaveCount(0);
  const body = page.getByRole("textbox", { name: "Cuerpo del texto" });
  await expect(body.locator("p").last()).toHaveText("Autor");
  await expect(
    page.getByRole("textbox", { name: "Firma", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Letra de la firma")).toHaveCount(0);
  await expect(page.getByLabel("Tamaño de la firma")).toHaveCount(0);
  await expect.poll(async () => (await stored(page))?.pending).toBe(false);
  expect(api.saves()).toBe(0);
  await body.locator("p").last().fill("Autor actualizado");
  await expect.poll(() => api.document().signature).toBe("");
  await open(page);
  await expect(body.locator("p").last()).toHaveText("Autor actualizado");
  await expect(body).not.toContainText("Autor actualizadoAutor");
  await expect(body.locator("p")).toHaveCount(2);
  await expect(banner(page)).toHaveCount(0);
});

test("identical local copies and unchanged editor content never request recovery", async ({
  page,
}) => {
  const api = await setup(page);
  await seed(page, asDraft(initial));
  await open(page);
  await expect(banner(page)).toHaveCount(0);
  await expect.poll(async () => (await stored(page))?.pending).toBe(false);
  // Tiptap adds default attributes without changing the saved text.
  await page
    .getByRole("textbox", { name: "Cuerpo del texto" })
    .locator("p")
    .first()
    .fill("Contenido guardado.");
  await page.waitForTimeout(1100);
  expect(api.saves()).toBe(0);
  expect((await stored(page)).pending).toBe(false);
  await open(page);
  await expect(banner(page)).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Título del texto" })
    .fill("Carta actualizada");
  await expect.poll(() => api.document().title).toBe("Carta actualizada");
  await expect.poll(async () => (await stored(page))?.pending).toBe(false);
  await open(page);
  await expect(banner(page)).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Título del texto" }),
  ).toHaveValue("Carta actualizada");
});

test("download preserves a real recovery, and recovering saves it once", async ({
  page,
}) => {
  const api = await setup(page);
  const draft = { ...asDraft(initial), title: "Trabajo pendiente" };
  await seed(page, draft);
  await open(page);
  await expect(banner(page)).toBeVisible();
  await editorOptions(page);
  await page.getByRole("button", { name: "Publicar y compartir" }).click();
  expect((await stored(page)).draft.title).toBe("Trabajo pendiente");
  expect(api.saves()).toBe(0);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar recuperación" }).click();
  expect((await download).suggestedFilename()).toBe(
    `borrador-${initial.id}.json`,
  );
  await expect(banner(page)).toBeVisible();
  await page
    .getByRole("button", { name: "Recuperar borrador", exact: true })
    .click();
  await expect(banner(page)).toHaveCount(0);
  await expect.poll(() => api.document().title).toBe("Trabajo pendiente");
  await expect.poll(async () => (await stored(page))?.pending).toBe(false);
  expect(api.saves()).toBe(1);
  await open(page);
  await expect(banner(page)).toHaveCount(0);
});

test("using the saved version discards the recovery and restores the server content", async ({
  page,
}) => {
  const api = await setup(page);
  await seed(page, { ...asDraft(initial), title: "Trabajo descartado" }, 0);
  await open(page);
  await expect(banner(page)).toBeVisible();
  await page
    .getByRole("textbox", { name: "Título del texto" })
    .fill("Cambio sin elegir recuperación");
  await page
    .getByRole("button", { name: "Usar versión guardada", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Título del texto" }),
  ).toHaveValue(initial.title);
  await expect(banner(page)).toHaveCount(0);
  await expect.poll(async () => (await stored(page))?.pending).toBe(false);
  await page.waitForTimeout(1100);
  expect(api.saves()).toBe(0);
  await open(page);
  await expect(banner(page)).toHaveCount(0);
});

test("failed saves survive reopening and clear only after successful recovery", async ({
  page,
}) => {
  const api = await setup(page);
  await open(page);
  api.fail(true);
  await page
    .getByRole("textbox", { name: "Título del texto" })
    .fill("Escrito sin guardar");
  await expect(page.getByRole("status")).toContainText("Error al guardar");
  expect((await stored(page)).pending).toBe(true);
  await open(page);
  await expect(banner(page)).toBeVisible();
  api.fail(false);
  await page
    .getByRole("button", { name: "Recuperar borrador", exact: true })
    .click();
  await expect.poll(() => api.document().title).toBe("Escrito sin guardar");
  await expect.poll(async () => (await stored(page))?.pending).toBe(false);
  await open(page);
  await expect(banner(page)).toHaveCount(0);
});

test("older recoveries require an explicit choice before overwriting a newer revision", async ({
  page,
}) => {
  const api = await setup(page, { ...initial, revision: 2 });
  await seed(page, { ...asDraft(initial), title: "Recuperación antigua" });
  await open(page);
  await page
    .getByRole("button", { name: "Recuperar borrador", exact: true })
    .click();
  await expect(
    page.getByText("Otra pestaña cambió este texto.", { exact: false }),
  ).toBeVisible();
  await page.waitForTimeout(1100);
  expect(api.saves()).toBe(0);
  await page
    .getByRole("button", { name: "Revisar versiones", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Conservar mi borrador", exact: true })
    .click();
  await expect.poll(() => api.document().title).toBe("Recuperación antigua");
  await expect.poll(async () => (await stored(page))?.pending).toBe(false);
  await open(page);
  await expect(banner(page)).toHaveCount(0);
});
