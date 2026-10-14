import { test, expect, type Page } from "@playwright/test";
import {
  defaultAppearance,
  emptyContent,
  type Document,
  type Resource,
} from "../../src/lib/model";

const resource: Resource = {
  id: "33333333-3333-4333-8333-333333333333",
  kind: "paper",
  name: "Papel aportado",
  author: "Autor",
  source: "Propio",
  license: "CC0",
  description: "",
  tags: [],
  builtin_key: null,
  hidden: false,
};
const document: Document = {
  id: "11111111-1111-4111-8111-111111111111",
  owner_id: "22222222-2222-4222-8222-222222222222",
  title: "Primer escrito",
  written_on: "2026-10-14",
  content: emptyContent,
  appearance: { ...defaultAppearance, paper: "lined" },
  signature: "",
  notebook_id: null,
  position: 0,
  revision: 1,
  updated_at: "2026-10-14",
  created_at: "2026-10-14",
};
const secondId = "44444444-4444-4444-8444-444444444444";
const fixture = "http://127.0.0.1:3101/?fixture=studio";
const notice =
  "Abre o crea un texto para aplicar el recurso elegido de la biblioteca.";

async function setup(page: Page, selectedResource = resource) {
  const documents = [
    document,
    {
      ...document,
      id: secondId,
      title: "Segundo escrito",
      appearance: { ...defaultAppearance },
    },
  ];
  const saves: string[] = [];
  const publications = new Map(documents.map((doc) => [doc.id, doc]));
  await page.route("**/api/studio", (route) =>
    route.fulfill({
      json: {
        documents,
        resources: [selectedResource],
        notebooks: [],
        publications: [...publications.values()].map((doc) => ({
          document_id: doc.id,
          is_public: false,
        })),
        links: [],
      },
    }),
  );
  await page.route("**/api/documents", (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "create") {
      const created = {
        ...document,
        id: "55555555-5555-4555-8555-555555555555",
        title: "Nuevo escrito",
      };
      documents.push(created);
      return route.fulfill({ json: created });
    }
    expect(body.action).toBe("save");
    const index = documents.findIndex((doc) => doc.id === body.id);
    expect(body.revision).toBe(documents[index].revision);
    documents[index] = {
      ...documents[index],
      ...body.draft,
      revision: body.revision + 1,
    };
    saves.push(body.id);
    return route.fulfill({ json: documents[index] });
  });
  await page.route("**/api/publish", (route) => {
    const body = route.request().postDataJSON();
    const doc = documents.find((doc) => doc.id === body.id)!;
    expect(body.revision).toBe(doc.revision);
    publications.set(doc.id, doc);
    return route.fulfill({ json: {} });
  });
  return { documents, saves, publications };
}
async function open(page: Page, title: string) {
  await page
    .locator(".document-card")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    .getByRole("button", { name: "Seguir escribiendo", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Cuerpo del texto" }),
  ).toBeVisible();
}

for (const kind of ["paper", "font"] as const) {
  test(`library ${kind} applies once, survives refreshes, and leaves other publications unchanged`, async ({
    page,
  }) => {
    const api = await setup(page, { ...resource, kind });
    const field = kind === "paper" ? "paper" : "bodyFont";
    await page.goto(`${fixture}&resource=${resource.id}#textos`);
    await expect(page.getByText(notice)).toBeVisible();
    await open(page, document.title);
    await expect
      .poll(() => api.documents[0].appearance[field])
      .toBe(resource.id);
    await expect(page).toHaveURL(`${fixture}#textos`);
    expect(api.publications.get(document.id)?.appearance[field]).toBe(
      document.appearance[field],
    );
    // Publishing reloads studio resources while the editor is still open.
    await page
      .getByRole("button", { name: "Publicar y compartir", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Actualizar versión publicada",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("La versión de lectura está actualizada."),
    ).toBeVisible();
    expect(api.publications.get(document.id)?.appearance[field]).toBe(
      resource.id,
    );
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    await page.getByRole("button", { name: "Mi estudio", exact: true }).click();
    await expect(page.getByText(notice)).toHaveCount(0);
    await open(page, "Segundo escrito");
    await page
      .getByRole("button", { name: "Publicar y compartir", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Actualizar versión publicada",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("La versión de lectura está actualizada."),
    ).toBeVisible();
    expect(api.publications.get(secondId)?.appearance).toEqual(
      defaultAppearance,
    );
    expect(api.saves).toEqual([document.id]);
    await page.reload();
    await expect(page.getByText(notice)).toHaveCount(0);
    await open(page, "Segundo escrito");
    await page.getByRole("button", { name: "Mi estudio", exact: true }).click();
    expect(api.saves).toEqual([document.id]);
  });
}

test("a new text consumes the resource and stale session selections cannot change other texts", async ({
  page,
}) => {
  const api = await setup(page);
  await page.addInitScript(
    (id) => sessionStorage.setItem("ec:apply-resource", id),
    resource.id,
  );
  await page.goto(`${fixture}&resource=${resource.id}`);
  await page
    .getByRole("button", { name: "Escribir un texto", exact: true })
    .click();
  await expect.poll(() => api.documents[2]?.appearance.paper).toBe(resource.id);
  await page.getByRole("button", { name: "Mi estudio", exact: true }).click();
  await page.reload();
  await open(page, "Segundo escrito");
  await page.getByRole("button", { name: "Mi estudio", exact: true }).click();
  expect(api.documents[1].appearance).toEqual(defaultAppearance);
  expect(api.saves).toEqual([api.documents[2].id]);
});

test("uploaded resources are never selected just because there is no pending choice", async ({
  page,
}) => {
  const api = await setup(page);
  await page.goto(fixture);
  await open(page, "Segundo escrito");
  await page.getByRole("button", { name: "Marfil", exact: true }).waitFor();
  await expect(
    page.getByRole("button", { name: "Marfil", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Mi estudio", exact: true }).click();
  expect(api.documents[1].appearance).toEqual(defaultAppearance);
  expect(api.saves).toEqual([]);
});
