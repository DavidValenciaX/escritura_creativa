import { test, expect, type Page } from "@playwright/test";
import { editorOptions } from "./editor-helpers";

declare global {
  interface Window {
    typewriterAudio: {
      starts: number;
      contexts: number;
      closed: number;
      sample: { duration: number; playbackRate: number } | null;
    };
  }
}

const preferenceKey = "ec:typewriter-sound:v1";
const soundSwitch = (page: Page) =>
  page.getByRole("switch", { name: "Sonido de máquina de escribir" });
const strikes = (page: Page) =>
  page.evaluate(() => window.typewriterAudio.starts);

test.beforeEach(async ({ page }) => {
  // Observe real Web Audio playback rather than substituting the sound engine.
  await page.addInitScript(() => {
    window.typewriterAudio = {
      starts: 0,
      contexts: 0,
      closed: 0,
      sample: null,
    };
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor() {
        super();
        window.typewriterAudio.contexts++;
      }
      createBufferSource() {
        const source = super.createBufferSource();
        const start = source.start.bind(source);
        source.start = (...args: Parameters<typeof start>) => {
          window.typewriterAudio.starts++;
          window.typewriterAudio.sample = {
            duration: source.buffer!.duration,
            playbackRate: source.playbackRate.value,
          };
          start(...args);
        };
        return source;
      }
      close() {
        window.typewriterAudio.closed++;
        sessionStorage.setItem("test:typewriter-closed", "true");
        return super.close();
      }
    };
  });
  await page.goto("/studio/preview");
  await expect(
    page.getByRole("textbox", { name: "Cuerpo del texto" }),
  ).toBeEditable();
});

test("default sound, accessible switch, persistence and reactivation", async ({
  page,
}) => {
  expect(await page.evaluate(() => window.typewriterAudio.contexts)).toBe(0);
  await editorOptions(page);
  await expect(soundSwitch(page)).toBeChecked();
  await expect(soundSwitch(page)).toContainText("Activado");
  await page.screenshot({ path: test.info().outputPath("sound-options.png") });
  await page.keyboard.press("Escape");
  const body = page.getByRole("textbox", { name: "Cuerpo del texto" });
  await body.click();
  await page.keyboard.type("Hola mundo");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Backspace");
  await expect.poll(() => strikes(page)).toBe(12);
  const sample = await page.evaluate(() => window.typewriterAudio.sample);
  expect(sample!.duration).toBeCloseTo(0.39, 3);
  expect(sample!.playbackRate).toBe(1);
  await page.getByRole("textbox", { name: "Título del texto" }).click();
  await page.keyboard.type("Carta");
  await expect.poll(() => strikes(page)).toBe(17);
  await editorOptions(page);
  await soundSwitch(page).focus();
  await page.keyboard.press("Space");
  await expect(soundSwitch(page)).not.toBeChecked();
  await expect(soundSwitch(page)).toContainText("Desactivado");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), preferenceKey),
  ).toBe("false");
  await page.keyboard.press("Escape");
  await body.click();
  await page.keyboard.type("Sin sonido");
  expect(await strikes(page)).toBe(17);
  await page.reload();
  await editorOptions(page);
  await expect(soundSwitch(page)).not.toBeChecked();
  await page.keyboard.press("Escape");
  await body.click();
  await page.keyboard.type("Silencio");
  expect(await strikes(page)).toBe(0);
  await editorOptions(page);
  await soundSwitch(page).click();
  await page.keyboard.press("Escape");
  await body.click();
  await page.keyboard.type("Si");
  await expect.poll(() => strikes(page)).toBe(2);
});

test("navigation, shortcuts, paste, programmatic updates and preview stay silent", async ({
  page,
}) => {
  const body = page.getByRole("textbox", { name: "Cuerpo del texto" });
  await body.click();
  await page.keyboard.type("Texto");
  await expect.poll(() => strikes(page)).toBe(5);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Shift+ArrowLeft");
  await page.keyboard.press("ControlOrMeta+b");
  await page.keyboard.press("ControlOrMeta+z");
  await body.evaluate((element) => {
    const data = new DataTransfer();
    data.setData("text/plain", "pegado");
    element.dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, clipboardData: data }),
    );
    element.dispatchEvent(
      new InputEvent("beforeinput", {
        bubbles: true,
        inputType: "insertFromPaste",
        data: "pegado",
      }),
    );
  });
  expect(await strikes(page)).toBe(5);
  await editorOptions(page);
  await page.getByRole("button", { name: "Vista previa", exact: true }).click();
  await page.keyboard.type("silencio");
  expect(await strikes(page)).toBe(5);
  await editorOptions(page);
  await page.getByRole("button", { name: "Mi estudio", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => sessionStorage.getItem("test:typewriter-closed")),
    )
    .toBe("true");
});

test("mobile beforeinput and accented composition produce a single strike", async ({
  page,
}) => {
  for (const label of ["Cuerpo del texto", "Título del texto"]) {
    const field = page.getByRole("textbox", { name: label });
    await field.click();
    const before = await strikes(page);
    await field.evaluate((element) => {
      for (const inputType of [
        "insertText",
        "insertLineBreak",
        "deleteContentBackward",
        "deleteContentForward",
      ]) {
        element.dispatchEvent(
          new InputEvent("beforeinput", {
            bubbles: true,
            inputType,
            data: inputType === "insertText" ? "a" : null,
          }),
        );
      }
      element.dispatchEvent(
        new CompositionEvent("compositionstart", { bubbles: true }),
      );
      element.dispatchEvent(
        new InputEvent("beforeinput", {
          bubbles: true,
          inputType: "insertCompositionText",
          data: "e",
          isComposing: true,
        }),
      );
      element.dispatchEvent(
        new InputEvent("beforeinput", {
          bubbles: true,
          inputType: "insertCompositionText",
          data: "é",
          isComposing: true,
        }),
      );
      element.dispatchEvent(
        new CompositionEvent("compositionend", { bubbles: true, data: "é" }),
      );
      element.dispatchEvent(
        new InputEvent("beforeinput", {
          bubbles: true,
          inputType: "insertText",
          data: "é",
        }),
      );
    });
    await expect.poll(() => strikes(page)).toBe(before + 5);
    // An identical character in a later edit must not be mistaken for the commit.
    await field.evaluate((element) => {
      element.dispatchEvent(
        new InputEvent("beforeinput", {
          bubbles: true,
          inputType: "insertText",
          data: "é",
        }),
      );
    });
    await expect.poll(() => strikes(page)).toBe(before + 6);
    await field.evaluate((element) => {
      element.dispatchEvent(
        new CompositionEvent("compositionstart", { bubbles: true }),
      );
      element.dispatchEvent(
        new CompositionEvent("compositionend", { bubbles: true, data: "" }),
      );
    });
    expect(await strikes(page)).toBe(before + 6);
  }
});

test("audio and storage failures do not prevent writing or toggling", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.AudioContext = class {
      constructor() {
        throw new Error("Audio unavailable");
      }
    } as unknown as typeof AudioContext;
    const getItem = Storage.prototype.getItem;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (key === "ec:typewriter-sound:v1")
        throw new Error("Storage unavailable");
      return getItem.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === "ec:typewriter-sound:v1")
        throw new Error("Storage unavailable");
      return setItem.call(this, key, value);
    };
  });
  await page.reload();
  const body = page.getByRole("textbox", { name: "Cuerpo del texto" });
  await body.click();
  await page.keyboard.type("Sigue escribiendo");
  await expect(body).toHaveText("Sigue escribiendo");
  await editorOptions(page);
  await soundSwitch(page).click();
  await expect(soundSwitch(page)).not.toBeChecked();
  await soundSwitch(page).click();
  await expect(soundSwitch(page)).toBeChecked();
  expect(errors).toEqual([]);
});

test("preference is shared with another editor tab", async ({
  page,
  context,
}) => {
  await editorOptions(page);
  await soundSwitch(page).click();
  const other = await context.newPage();
  await other.goto("/studio/preview");
  await editorOptions(other);
  await expect(soundSwitch(other)).not.toBeChecked();
  await soundSwitch(other).click();
  await expect(soundSwitch(page)).toBeChecked();
  await other.close();
});

test("a missing recording does not interrupt writing or play a substitute", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/audio/typewriter-key.wav", (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
  await page.reload();
  const body = page.getByRole("textbox", { name: "Cuerpo del texto" });
  await body.click();
  await page.keyboard.type("Puedo seguir escribiendo.");
  await expect(body).toHaveText("Puedo seguir escribiendo.");
  expect(await strikes(page)).toBe(0);
  expect(errors).toEqual([]);
});
