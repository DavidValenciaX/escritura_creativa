import { expect, test } from "@playwright/test";
import { editorOptions } from "./editor-helpers";

test("selected paragraph breaks convert both ways while preserving styles and surrounding text", async ({
  page,
}) => {
  await page.goto("/studio/preview");
  const body = page.getByRole("textbox", { name: "Cuerpo del texto" });
  await body.fill("Fuera antes");
  await body.press("Enter");
  await body.pressSequentially("Verso uno");
  await body.press("Enter");
  await body.press("ControlOrMeta+b");
  await body.pressSequentially("Verso dos");
  await body.press("ControlOrMeta+b");
  await body.press("Enter");
  await body.pressSequentially("Fuera después");

  await body.evaluate((element) => {
    const paragraphs = element.querySelectorAll("p");
    const range = document.createRange();
    range.setStart(paragraphs[1], 0);
    range.setEnd(paragraphs[2], paragraphs[2].childNodes.length);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  });
  const toolbar = page.getByRole("toolbar", {
    name: "Formato de la selección",
  });
  await toolbar
    .getByRole("button", { name: "Más formato", exact: true })
    .click();
  const panel = page.getByRole("dialog", { name: "Formato", exact: true });
  const soft = panel.getByRole("button", {
    name: "Convertir a salto suave",
    exact: true,
  });
  const paragraph = panel.getByRole("button", {
    name: "Convertir a salto de párrafo",
    exact: true,
  });
  await expect(soft).toBeEnabled();
  await expect(paragraph).toBeDisabled();
  await soft.click();
  await expect(body).toBeFocused();
  await expect(body.locator("p")).toHaveCount(3);
  await expect(body.locator("p").nth(1).locator("br")).toHaveCount(1);
  await expect(body.locator("strong")).toHaveText("Verso dos");
  await expect(body.locator("p").first()).toHaveText("Fuera antes");
  await expect(body.locator("p").last()).toHaveText("Fuera después");

  await editorOptions(page, "Formato");
  await panel.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(body.locator("p")).toHaveCount(4);
  await editorOptions(page, "Formato");
  await panel.getByRole("button", { name: "Rehacer", exact: true }).click();
  await expect(body.locator("p")).toHaveCount(3);
  await editorOptions(page, "Formato");
  await expect(soft).toBeDisabled();
  await expect(paragraph).toBeEnabled();
  await expect(
    panel.getByRole("group", { name: "Tipo de salto" }),
  ).toBeInViewport();
  await panel.screenshot({
    path: `test-results/break-conversion-${test.info().project.name}.png`,
  });
  await paragraph.click();
  await expect(body.locator("p")).toHaveCount(4);
  await expect(body.locator("strong")).toHaveText("Verso dos");
  await expect(body.locator("br")).toHaveCount(0);

  // Convert again and verify the resulting content, rather than only the UI state, persists.
  await editorOptions(page, "Formato");
  await soft.click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem("ec:preview") ?? "null");
        return saved?.pending === false ? saved.draft.content : null;
      }),
    )
    .toMatchObject({
      content: [
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Verso uno" },
            { type: "hardBreak" },
            { type: "text", text: "Verso dos" },
          ],
        },
        { type: "paragraph" },
      ],
    });
  await page.reload();
  await expect(body.locator("p")).toHaveCount(3);
  await expect(body.locator("strong")).toHaveText("Verso dos");
  await editorOptions(page);
  await page.getByRole("button", { name: "Vista previa", exact: true }).click();
  const preview = page.locator(".screen-only .letter-content");
  await expect(preview.locator("p")).toHaveCount(3);
  await expect(preview.locator("br")).toHaveCount(1);
  await expect(preview.locator("strong")).toHaveText("Verso dos");
});

test("a caret beside a break converts it without selecting the whole text", async ({
  page,
}) => {
  await page.goto("/studio/preview");
  const body = page.getByRole("textbox", { name: "Cuerpo del texto" });
  await body.fill("Primer verso");
  await body.press("Enter");
  await body.pressSequentially("Segundo verso");
  await body.press("Home");
  const panel = page.getByRole("dialog", { name: "Formato", exact: true });
  await editorOptions(page, "Formato");
  await panel
    .getByRole("button", { name: "Convertir a salto suave", exact: true })
    .click();
  await expect(body.locator("p")).toHaveCount(1);
  await expect(body.locator("p br")).toHaveCount(1);
  await editorOptions(page, "Formato");
  await panel
    .getByRole("button", { name: "Convertir a salto de párrafo", exact: true })
    .click();
  await expect(body.locator("p")).toHaveCount(2);
  await expect(body.locator("p").first()).toHaveText("Primer verso");
  await expect(body.locator("p").last()).toHaveText("Segundo verso");
});
